import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
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
    [Buffer.from('usdt_treasury')],
    TXLINE_PROGRAM_ID
  );
}

export function getFaucetTrackerPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('faucet_tracker'), user.toBuffer()],
    TXLINE_PROGRAM_ID
  );
}

export function getUserUsdtAta(user: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(USDT_MINT, user, false, TOKEN_PROGRAM_ID);
}

const FAUCET_DISCRIMINATOR = Buffer.from([49, 178, 104, 8, 23, 120, 186, 21]);

export async function requestUsdtFaucet(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> }
): Promise<string> {
  const user = wallet.publicKey;
  const [faucetTracker] = getFaucetTrackerPda(user);
  const [usdtTreasuryPda] = getUsdtTreasuryPda();
  const userUsdtAta = getUserUsdtAta(user);

  const tx = new Transaction();

  const ataInfo = await connection.getAccountInfo(userUsdtAta);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userUsdtAta,
        user,
        USDT_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
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

  tx.add({
    keys,
    programId: TXLINE_PROGRAM_ID,
    data: FAUCET_DISCRIMINATOR,
  });

  tx.feePayer = user;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const signedTx = await wallet.signTransaction(tx);
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
    // Anchor account: 8-byte discriminator + data.
    // The tracker likely stores last_claim_timestamp as i64 at offset 8.
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

export function suggestFaucetAmount(balance: number): number {
  const TARGET = 1000;
  if (balance >= TARGET) return 100;
  const suggested = TARGET - balance;
  if (suggested < 100) return 100;
  if (suggested > 1000) return 1000;
  return Math.round(suggested / 50) * 50;
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
