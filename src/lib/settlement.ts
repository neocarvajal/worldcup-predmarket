import { Program, AnchorProvider, Idl, BorshCoder, BN } from '@coral-xyz/anchor';
import {
  Connection, PublicKey, SystemProgram,
  TransactionMessage, VersionedTransaction, TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';

const SETTLEMENT_PROGRAM_ID = new PublicKey('E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6');
let cachedIdl: Idl | null = null;

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function getIdl(): Promise<Idl> {
  if (!cachedIdl) {
    cachedIdl = (await import('../idl/settlement.json')) as unknown as Idl;
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
    [enc('escrow'), depositor.toBuffer(), recipient.toBuffer(), bigintToLeBytes(nonce)],
    SETTLEMENT_PROGRAM_ID
  );
}

export function getVaultPda(escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [enc('vault'), escrow.toBuffer()],
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
    fixtureId: number;
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

  const instructions: TransactionInstruction[] = [];

  const ataInfo = await connection.getAccountInfo(depositorTokenAccount);
  if (!ataInfo) {
    instructions.push(
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

  instructions.push(
    await program.methods
      .initEscrow(
        new BN(params.expiry.toString()),
        new BN(nonce.toString()),
        new BN(params.fixtureId),
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

  instructions.push(
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

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: depositor,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(message);
  const signedTx = await wallet.signTransaction(versionedTx);
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
      return [{ pubkey, account: coder.accounts.decode('Escrow', account.data) }];
    } catch {
      return [];
    }
  });
}

export function getProfilePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [enc('profile'), authority.toBuffer()],
    SETTLEMENT_PROGRAM_ID
  );
}

async function buildAndSend(
  connection: Connection,
  wallet: any,
  instruction: TransactionInstruction
): Promise<string> {
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();
  const versionedTx = new VersionedTransaction(message);
  const signed = await wallet.signTransaction(versionedTx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

export async function initProfile(
  connection: Connection,
  wallet: any,
  imageUri: string,
  xHandle: string,
  notificationsEnabled: boolean
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const [profilePda] = getProfilePda(wallet.publicKey);
  const instruction = await program.methods
    .initProfile(imageUri, xHandle, notificationsEnabled)
    .accountsStrict({
      authority: wallet.publicKey,
      profile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return buildAndSend(connection, wallet, instruction);
}

export async function updateProfile(
  connection: Connection,
  wallet: any,
  imageUri: string,
  xHandle: string,
  notificationsEnabled: boolean
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const [profilePda] = getProfilePda(wallet.publicKey);
  const instruction = await program.methods
    .updateProfile(imageUri, xHandle, notificationsEnabled)
    .accountsStrict({
      authority: wallet.publicKey,
      profile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return buildAndSend(connection, wallet, instruction);
}

const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');

export function getTxLineTenDailyFixturesRootsPda(epochDay?: number): PublicKey {
  const seeds = [enc('ten_daily_fixtures_roots')];
  if (epochDay != null) {
    const aligned = Math.floor(epochDay / 10) * 10;
    const buf = new Uint8Array(2);
    buf[0] = aligned & 0xff;
    buf[1] = (aligned >> 8) & 0xff;
    seeds.push(buf);
  }
  return PublicKey.findProgramAddressSync(seeds, TXLINE_PROGRAM_ID)[0];
}

export async function claimEscrow(
  connection: Connection,
  wallet: any,
  escrowPubkey: PublicKey,
  mint: PublicKey,
  vaultPubkey: PublicKey,
  claimantTokenAccount: PublicKey,
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const instruction = await program.methods
    .claim()
    .accountsStrict({
      claimant: wallet.publicKey,
      escrow: escrowPubkey,
      mint,
      vault: vaultPubkey,
      claimantTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return buildAndSend(connection, wallet, instruction);
}

export async function settleWithCpi(
  connection: Connection,
  wallet: any,
  params: {
    escrowPubkey: PublicKey;
    mint: PublicKey;
    vaultPubkey: PublicKey;
    depositorTokenAccount: PublicKey;
    recipientTokenAccount: PublicKey;
    score1: number;
    score2: number;
    marketLine?: number;
    fixture: any;
    fixtureSummary: any;
    subTreeProof: any[];
    mainTreeProof: any[];
  },
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const f = params.fixture;
  const fs = params.fixtureSummary;
  const fixtureTsSec = Math.floor((f.ts ?? f.Ts ?? 0) / 1000);
  const fixtureEpochDay = Math.floor(Math.floor(fixtureTsSec / 86400) / 10) * 10;
  const tenDailyFixturesRoots = getTxLineTenDailyFixturesRootsPda(fixtureEpochDay);

  const fixtureProofNodes = params.subTreeProof.map((p: any) => ({
    hash: Object.values(p.hash ?? p),
    isRightSibling: p.isRightSibling ?? false,
  }));
  const mainProofNodes = params.mainTreeProof.map((p: any) => ({
    hash: Object.values(p.hash ?? p),
    isRightSibling: p.isRightSibling ?? false,
  }));

  const instruction = await program.methods
    .settleWithCpi(
      new BN(params.score1),
      new BN(params.score2),
      new BN(params.marketLine ?? 0),
      new BN(f.ts ?? f.Ts ?? 0),
      new BN(f.start_time ?? f.StartTime ?? 0),
      f.competition ?? f.Competition ?? '',
      f.competition_id ?? f.CompetitionId ?? 0,
      f.fixture_group_id ?? f.FixtureGroupId ?? 0,
      f.participant1_id ?? f.Participant1Id ?? 0,
      f.participant1 ?? f.Participant1 ?? '',
      f.participant2_id ?? f.Participant2Id ?? 0,
      f.participant2 ?? f.Participant2 ?? '',
      new BN(f.fixture_id ?? f.FixtureId ?? 0),
      f.participant1_is_home ?? f.Participant1IsHome ?? true,
      fixtureEpochDay,
      new BN(fs.fixture_id ?? fs.fixtureId ?? 0),
      fs.competition_id ?? fs.competitionId ?? 0,
      fs.competition ?? '',
      fs.update_count ?? fs.updateStats?.updateCount ?? 0,
      new BN(fs.min_timestamp ?? fs.updateStats?.minTimestamp ?? 0),
      new BN(fs.max_timestamp ?? fs.updateStats?.maxTimestamp ?? 0),
      Object.values(fs.update_sub_tree_root ?? fs.updateSubTreeRoot ?? fs.eventsSubTreeRoot ?? new Array(32).fill(0)),
      fixtureProofNodes,
      mainProofNodes,
    )
    .accountsStrict({
      caller: wallet.publicKey,
      escrow: params.escrowPubkey,
      mint: params.mint,
      vault: params.vaultPubkey,
      depositorTokenAccount: params.depositorTokenAccount,
      recipientTokenAccount: params.recipientTokenAccount,
      callerTokenAccount: getAssociatedTokenAddressSync(params.mint, wallet.publicKey, false, TOKEN_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
      txlineProgram: TXLINE_PROGRAM_ID,
      tenDailyFixturesRoots,
    })
    .instruction();

  return buildAndSend(connection, wallet, instruction);
}

export async function cancelEscrow(
  connection: Connection,
  wallet: any,
  escrowPubkey: PublicKey,
  mint: PublicKey,
  vaultPubkey: PublicKey,
  depositorTokenAccount: PublicKey,
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const instruction = await program.methods
    .cancel()
    .accountsStrict({
      depositor: wallet.publicKey,
      escrow: escrowPubkey,
      mint,
      vault: vaultPubkey,
      depositorTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return buildAndSend(connection, wallet, instruction);
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

export async function setTxLineToken(
  connection: Connection,
  wallet: any,
  token: string,
): Promise<string> {
  const program = await getSettlementProgram(connection, wallet);
  const [profilePda] = getProfilePda(wallet.publicKey);
  const instruction = await program.methods
    .setTxlineToken(token)
    .accountsStrict({
      profile: profilePda,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return buildAndSend(connection, wallet, instruction);
}
