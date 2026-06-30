import {
  Connection, Keypair, PublicKey, TransactionInstruction, SystemProgram,
  TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import nacl from 'tweetnacl';

const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const TXL_TOKEN_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function getGuestJwt(txlineBase: string): Promise<string> {
  const res = await fetch(`${txlineBase}/auth/guest/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`Guest JWT: ${res.status}`);
  const data: any = await res.json();
  return data.token;
}

async function activateApiToken(
  txlineBase: string,
  jwt: string,
  txSig: string,
  walletSignature: string,
): Promise<string> {
  const res = await fetch(`${txlineBase}/api/token/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: [] }),
  });
  if (!res.ok) throw new Error(`Activate API token: ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  return data.token ?? data;
}

async function ensureAta(
  connection: Connection,
  owner: PublicKey,
  instructions: TransactionInstruction[],
): Promise<void> {
  const ata = getAssociatedTokenAddressSync(TXL_TOKEN_MINT, owner, false, TOKEN_2022_PROGRAM_ID);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    instructions.push(createAssociatedTokenAccountInstruction(
      owner, ata, owner, TXL_TOKEN_MINT,
      TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }
}

async function sendSubscribeTx(connection: Connection, keeper: Keypair): Promise<string> {
  const DURATION_WEEKS = 4;

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [enc('pricing_matrix')], TXLINE_PROGRAM_ID,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [enc('token_treasury_v2')], TXLINE_PROGRAM_ID,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT, keeper.publicKey, false, TOKEN_2022_PROGRAM_ID,
  );

  const data = new Uint8Array(12);
  data.set([254, 28, 191, 138, 156, 179, 183, 53], 0);
  data[8] = 1;
  data[9] = 0;
  data[10] = DURATION_WEEKS & 0xff;
  data[11] = (DURATION_WEEKS >> 8) & 0xff;

  const keys = [
    { pubkey: keeper.publicKey, isSigner: true, isWritable: true },
    { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
    { pubkey: TXL_TOKEN_MINT, isSigner: false, isWritable: false },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const subscribeIx = new TransactionInstruction({
    keys, programId: TXLINE_PROGRAM_ID, data: Buffer.from(data),
  });

  const instructions: TransactionInstruction[] = [];
  await ensureAta(connection, keeper.publicKey, instructions);
  instructions.push(subscribeIx);

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: keeper.publicKey, recentBlockhash: blockhash, instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([keeper]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function ensureApiToken(
  keeper: Keypair,
  connection: Connection,
  txlineBase: string,
): Promise<{ jwt: string; apiToken: string }> {
  const jwt = await getGuestJwt(txlineBase);
  const envToken = process.env.TXLINE_API_TOKEN;

  if (envToken) return { jwt, apiToken: envToken };

  console.log('[keeper-auth] No TXLINE_API_TOKEN set — subscribing on-chain...');
  const txSig = await sendSubscribeTx(connection, keeper);

  const messageBytes = enc(`${txSig}::${jwt}`);
  const sigBytes = nacl.sign.detached(messageBytes, keeper.secretKey);
  const walletSignature = Buffer.from(sigBytes).toString('base64');

  const apiToken = await activateApiToken(txlineBase, jwt, txSig, walletSignature);
  console.log('[keeper-auth] API token activated');

  return { jwt, apiToken };
}
