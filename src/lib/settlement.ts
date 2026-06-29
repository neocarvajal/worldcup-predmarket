import { Program, AnchorProvider, Idl, BorshCoder, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';

const SETTLEMENT_PROGRAM_ID = new PublicKey('568BYcuHndKngsEYfEv7aMTqFXRCC5MzRxZdJuZDgU2J');
let cachedIdl: Idl | null = null;

async function getIdl(): Promise<Idl> {
  if (!cachedIdl) {
    cachedIdl = (await import('../../target/idl/settlement.json')) as unknown as Idl;
  }
  return cachedIdl!;
}

export function getSettlementProgram(
  connection: Connection,
  wallet: any
): Promise<Program> {
  return getIdl().then((idl) => {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    return new Program(idl, provider);
  });
}

function bigintToLeBytes(v: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  return buf;
}

export function getEscrowPda(depositor: PublicKey, recipient: PublicKey, nonce: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), depositor.toBuffer(), recipient.toBuffer(), bigintToLeBytes(nonce)],
    SETTLEMENT_PROGRAM_ID
  );
}

export function getVaultPda(escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrow.toBuffer()],
    SETTLEMENT_PROGRAM_ID
  );
}

export async function initEscrowWithDeposit(
  connection: Connection,
  wallet: any,
  params: {
    recipient: PublicKey;
    mint: PublicKey;
    amount: bigint;
    expiry: bigint;
    fixtureName: string;
    selection: number;
    label: string;
    odds: number;
  }
): Promise<{ sig: string; escrowPda: PublicKey; nonce: bigint }> {
  const program = await getSettlementProgram(connection, wallet);
  const depositor = wallet.publicKey;
  const nonce = BigInt(Date.now());
  const [escrowPda] = getEscrowPda(depositor, params.recipient, nonce);
  const [vaultPda] = getVaultPda(escrowPda);

  const depositorTokenAccount = getAssociatedTokenAddressSync(
    params.mint, depositor, false, TOKEN_PROGRAM_ID
  );

  const tx = new Transaction();

  const ataInfo = await connection.getAccountInfo(depositorTokenAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        depositor,
        depositorTokenAccount,
        depositor,
        params.mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const oddsScaled = BigInt(Math.round(params.odds * 1000));

  tx.add(
    await program.methods
      .initEscrow(
        new BN(params.expiry.toString()),
        new BN(nonce.toString()),
        params.fixtureName,
        params.selection,
        params.label,
        new BN(oddsScaled.toString())
      )
      .accountsStrict({
        depositor,
        recipient: params.recipient,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
  );

  tx.add(
    await program.methods
      .deposit(new BN(params.amount.toString()))
      .accountsStrict({
        depositor,
        escrow: escrowPda,
        mint: params.mint,
        vault: vaultPda,
        userTokenAccount: depositorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
  );

  tx.feePayer = depositor;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const signedTx = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return { sig, escrowPda, nonce };
}

export async function fetchUserEscrows(
  connection: Connection,
  depositor: PublicKey
): Promise<{ pubkey: PublicKey; account: any }[]> {
  const idl = await getIdl();
  const coder = new BorshCoder(idl);

  const escrowDiscriminator = [31, 213, 123, 187, 186, 22, 218, 155];
  const programAccounts = await connection.getProgramAccounts(SETTLEMENT_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(escrowDiscriminator)) } },
      { memcmp: { offset: 8, bytes: depositor.toBase58() } },
    ],
  });

  return programAccounts.flatMap(({ pubkey, account }) => {
    try {
      const decoded = coder.accounts.decode('Escrow', account.data);
      return [{ pubkey, account: decoded }];
    } catch {
      return [];
    }
  });
}

export function getProfilePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), authority.toBuffer()],
    SETTLEMENT_PROGRAM_ID
  );
}

export async function initProfile(
  connection: Connection,
  wallet: any,
  imageUri: string,
  xHandle: string
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const [profilePda] = getProfilePda(wallet.publicKey);
  const tx = await program.methods
    .initProfile(imageUri, xHandle)
    .accountsStrict({
      authority: wallet.publicKey,
      profile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
  tx.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function updateProfile(
  connection: Connection,
  wallet: any,
  imageUri: string,
  xHandle: string
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const [profilePda] = getProfilePda(wallet.publicKey);
  const tx = await program.methods
    .updateProfile(imageUri, xHandle)
    .accountsStrict({
      authority: wallet.publicKey,
      profile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
  tx.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function fetchUserProfile(
  connection: Connection,
  authority: PublicKey
): Promise<{ pubkey: PublicKey; account: any } | null> {
  const idl = await getIdl();
  const coder = new BorshCoder(idl);
  const [profilePda] = getProfilePda(authority);
  try {
    const accountInfo = await connection.getAccountInfo(profilePda);
    if (!accountInfo) return null;
    const decoded = coder.accounts.decode('UserProfile', accountInfo.data);
    return { pubkey: profilePda, account: decoded };
  } catch {
    return null;
  }
}
