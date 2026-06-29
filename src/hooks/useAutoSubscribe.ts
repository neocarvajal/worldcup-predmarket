"use client";

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTxLine } from '../context/TxLineContext';
import nacl from 'tweetnacl';

export type SubscriptionState = 'idle' | 'checking' | 'needed' | 'subscribing' | 'activating' | 'done' | 'error';

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

      const { PublicKey, Transaction, TransactionInstruction, SystemProgram } = await import('@solana/web3.js');
      const { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = await import('@solana/spl-token');

      const programId = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
      const txlTokenMint = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
      const DURATION_WEEKS = 4;

      const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pricing_matrix')], programId
      );
      const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('token_treasury_v2')], programId
      );
      const tokenTreasuryVault = getAssociatedTokenAddressSync(
        txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        txlTokenMint, publicKey, false, TOKEN_2022_PROGRAM_ID
      );

      const buffer = Buffer.alloc(12);
      buffer.set([254, 28, 191, 138, 156, 179, 183, 53], 0);
      buffer.writeUInt16LE(1, 8);
      buffer.writeUInt16LE(DURATION_WEEKS, 10);

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

      const instruction = new TransactionInstruction({ keys, programId, data: buffer });

      const accInfo = await connection.getAccountInfo(userTokenAccount);
      const tx = new Transaction();
      if (!accInfo) {
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
        tx.add(createAssociatedTokenAccountInstruction(
          publicKey, userTokenAccount, publicKey, txlTokenMint,
          TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        ));
      }
      tx.add(instruction);
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const signedTx = await signTransaction(tx);
      const txSig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSig, 'confirmed');

      setState('activating');

      const messageBytes = new TextEncoder().encode(`${txSig}::${jwt}`);
      const sigBytes = await signMessage(messageBytes);
      const walletSignature = Buffer.from(sigBytes).toString('base64');

      await client.activateApiToken({
        txSig,
        walletSignature,
        leagues: [],
      });

      setState('done');
    } catch (e: any) {
      setError(e?.message || 'Error en la suscripción automática');
      setState('error');
    }
  }, [publicKey, signMessage, signTransaction, connection, client]);

  useEffect(() => {
    if (publicKey && state === 'idle') {
      setState('checking');
      const restored = client.restoreForWallet(publicKey.toBase58());
      if (restored && client.hasApiToken) {
        setState('done');
      } else {
        setState('needed');
      }
    }
    if (!publicKey) {
      setState('idle');
    }
  }, [publicKey, client, state]);

  return { state, error, subscribe };
}
