/**
 * On-chain TxLINE program interactions
 * =====================================
 * PDA derivation helpers and transaction builders for the TxLINE program on Solana.
 * `requestUsdtFaucet` claims testnet USDT from the TxLINE faucet (8h cooldown).
 * `checkFaucetCooldown` reads the on-chain faucet tracker. `getUsdtBalance`
 * queries the user's associated token account balance for the USDT mint.
 */

import { Connection, PublicKey, SystemProgram, TransactionInstruction, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

export const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
export const USDT_MINT = new PublicKey('ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh');

export function getUsdtTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('usdt_treasury')],
    TXLINE_PROGRAM_ID
  );
}

export function getFaucetTrackerPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('faucet_tracker'), user.toBuffer()],
    TXLINE_PROGRAM_ID
  );
}

export function getUserUsdtAta(user: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(USDT_MINT, user, false, TOKEN_PROGRAM_ID);
}

const FAUCET_DISCRIMINATOR = new Uint8Array([49, 178, 104, 8, 23, 120, 186, 21]);

export async function requestUsdtFaucet(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  }
): Promise<string> {
  const { TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
  const user = wallet.publicKey;
  const [faucetTracker] = getFaucetTrackerPda(user);
  const [usdtTreasuryPda] = getUsdtTreasuryPda();
  const userUsdtAta = getUserUsdtAta(user);

  const instructions: TransactionInstruction[] = [];

  const ataInfo = await connection.getAccountInfo(userUsdtAta);
  if (!ataInfo) {
    instructions.push(createAssociatedTokenAccountInstruction(
      user,
      userUsdtAta,
      user,
      USDT_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ));
  }

  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: faucetTracker, isSigner: false, isWritable: true },
    { pubkey: USDT_MINT, isSigner: false, isWritable: true },
    { pubkey: userUsdtAta, isSigner: false, isWritable: true },
    { pubkey: usdtTreasuryPda, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  instructions.push(new TransactionInstruction({
    keys,
    programId: TXLINE_PROGRAM_ID,
    data: Buffer.from(FAUCET_DISCRIMINATOR),
  }));

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(message);
  const signedTx = await wallet.signTransaction(versionedTx);
  const sig = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

const FAUCET_COOLDOWN_SEC = 8 * 3600; // 8 hours

export interface FaucetCooldown {
  available: boolean;
  remainingSeconds: number;
  lastClaimTimestamp: number | null;
}

export async function checkFaucetCooldown(
  connection: Connection,
  user: PublicKey
): Promise<FaucetCooldown> {
  const [faucetTracker] = getFaucetTrackerPda(user);
  try {
    const info = await connection.getAccountInfo(faucetTracker);
    if (!info) {
      return { available: true, remainingSeconds: 0, lastClaimTimestamp: null };
    }
    const data = info.data;
    if (data.length >= 16) {
      const lastClaim = Number(data.readBigInt64LE(8));
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastClaim;
      const remaining = FAUCET_COOLDOWN_SEC - elapsed;
      if (remaining <= 0) {
        return { available: true, remainingSeconds: 0, lastClaimTimestamp: lastClaim };
      }
      return { available: false, remainingSeconds: remaining, lastClaimTimestamp: lastClaim };
    }
    return { available: true, remainingSeconds: 0, lastClaimTimestamp: null };
  } catch {
    return { available: true, remainingSeconds: 0, lastClaimTimestamp: null };
  }
}

export async function getUsdtBalance(connection: Connection, owner: PublicKey): Promise<number> {
  const ata = getUserUsdtAta(owner);
  try {
    const info = await connection.getTokenAccountBalance(ata);
    return Number(info.value.amount) / 10 ** info.value.decimals;
  } catch {
    return 0;
  }
}
