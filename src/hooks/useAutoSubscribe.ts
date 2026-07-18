"use client";

/**
 * TxLINE auto-subscription hook
 * ===============================
 * Orchestrates the wallet-to-TxLINE subscription flow. On mount, checks for an
 * existing API token across storage layers (localStorage → on-chain UserProfile).
 * If missing, walks the user through: (1) signing a guest JWT request, (2) sending
 * an on-chain subscribe transaction to the TxLINE program (4-week free tier),
 * (3) signing a message to activate the API token, and (4) persisting the token
 * on-chain via setTxLineToken. Exposes states for UI feedback.
 */

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTxLine } from '../context/TxLineContext';
import { fetchUserProfile, setTxLineToken } from '../lib/settlement';
import { saveTokens } from '../lib/persistence';
import nacl from 'tweetnacl';

export type SubscriptionState = 'idle' | 'checking' | 'needed' | 'subscribing' | 'activating' | 'done' | 'error';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useAutoSubscribe() {
  const { publicKey, signMessage, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { client } = useTxLine();
  const [state, setState] = useState<SubscriptionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    if (!publicKey || !signMessage || !signTransaction) return;
    setState('subscribing');
    setError(null);

    try {
      setState('subscribing');
      const jwt = await client.getGuestJwt();

      const {
        PublicKey, TransactionInstruction, SystemProgram,
        TransactionMessage, VersionedTransaction,
      } = await import('@solana/web3.js');
      const { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

      const programId = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
      const txlTokenMint = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
      const DURATION_WEEKS = 4;

      const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('pricing_matrix')], programId
      );
      const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('token_treasury_v2')], programId
      );
      const tokenTreasuryVault = getAssociatedTokenAddressSync(
        txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        txlTokenMint, publicKey, false, TOKEN_2022_PROGRAM_ID
      );

      // Instruction data: 8-byte discriminator + 2-byte tier (LE) + 2-byte duration_weeks (LE)
      const data = new Uint8Array(12);
      data.set([254, 28, 191, 138, 156, 179, 183, 53], 0);
      data[8] = 1;   // tier = 1 (UInt16LE)
      data[9] = 0;
      data[10] = DURATION_WEEKS & 0xff;   // duration_weeks (UInt16LE)
      data[11] = (DURATION_WEEKS >> 8) & 0xff;

      const keys = [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
        { pubkey: txlTokenMint, isSigner: false, isWritable: false },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
        { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      const subscribeIx = new TransactionInstruction({ keys, programId, data: Buffer.from(data) });

      const instructions: typeof subscribeIx[] = [];
      const accInfo = await connection.getAccountInfo(userTokenAccount);
      if (!accInfo) {
        instructions.push(createAssociatedTokenAccountInstruction(
          publicKey, userTokenAccount, publicKey, txlTokenMint,
          TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        ));
      }
      instructions.push(subscribeIx);

      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(message);
      const signedTx = await signTransaction(versionedTx);
      const txSig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSig, 'confirmed');

      setState('activating');

      const messageBytes = new TextEncoder().encode(`${txSig}::${jwt}`);
      let sigBytes: Uint8Array;
      try {
        sigBytes = await signMessage(messageBytes);
      } catch (msgErr: any) {
        throw new Error(
          `Firma de mensaje rechazada o fallida: ${msgErr?.message || 'Revisá tu wallet e intentá de nuevo'}`
        );
      }
      const walletSignature = toBase64(sigBytes);

      try {
        await client.activateApiToken({
          txSig,
          walletSignature,
          leagues: [],
        });
      } catch (apiErr: any) {
        throw new Error(
          `Error al activar el API token: ${apiErr?.message || 'TxLINE no respondió'}`
        );
      }

      // Persistir token on-chain en UserProfile
      try {
        const token = client.getApiToken();
        if (token) {
          await setTxLineToken(connection, { publicKey, signTransaction }, token);
        }
      } catch (onChainErr: any) {
        console.warn('[subscribe] No se pudo guardar token on-chain:', onChainErr?.message);
      }

      setState('done');
    } catch (e: any) {
      setError(e?.message || 'Error en la suscripción automática');
      setState('error');
    }
  }, [publicKey, signMessage, signTransaction, connection, client]);

  useEffect(() => {
    if (publicKey && state === 'idle') {
      setState('checking');
      (async () => {
        const walletStr = publicKey.toBase58();
        // 1. localStorage
        const restored = await client.restoreForWallet(walletStr);
        if (restored && client.hasApiToken) {
          setState('done');
          return;
        }
        // 2. On-chain UserProfile como tercer fallback
        try {
          const profile = await fetchUserProfile(connection, publicKey);
          if (profile?.account?.txline_api_token) {
            const token = profile.account.txline_api_token;
            client.setTokens(token, token);
            saveTokens(walletStr, { jwt: token, apiToken: token });
            setState('done');
            return;
          }
        } catch {}
        setState('needed');
      })();
    }
    if (!publicKey) {
      setState('idle');
    }
  }, [publicKey, client, state, connection]);

  return { state, error, subscribe };
}
