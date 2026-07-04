import {
  Connection, PublicKey, Keypair, VersionedTransaction, TransactionMessage,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { BN, AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import bs58 from 'bs58';

const SETTLEMENT_PROGRAM_ID = new PublicKey('E4Y1BwM5BDXzTSkoACbwTT6Zg86wHETDWMNPLh4Hriu6');
const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Read a u32 (little-endian) from a buffer at offset */
function readU32(buf: Buffer, off: number): number {
  if (off + 4 > buf.length) return 0;
  return buf.readUInt32LE(off);
}

/** Read a u64 (little-endian) from a buffer at offset */
function readU64(buf: Buffer, off: number): bigint {
  return buf.readBigUInt64LE(off);
}

/** Read an i64 (little-endian) from a buffer at offset */
function readI64(buf: Buffer, off: number): bigint {
  return buf.readBigInt64LE(off);
}

/** Read a 32-byte pubkey from a buffer at offset */
function readPubkey(buf: Buffer, off: number): PublicKey {
  return new PublicKey(buf.subarray(off, off + 32));
}

/** Read a Borsh-string (u32 length prefix + UTF-8 data) */
function readString(buf: Buffer, off: number): [string, number] {
  const len = readU32(buf, off);
  const str = buf.toString('utf-8', off + 4, off + 4 + len);
  return [str, 4 + len];
}

export function getTenDailyFixturesRootsPda(epochDay?: number): PublicKey {
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

function epochDayFromTs(tsSec: number): number {
  return Math.floor(tsSec / 86400);
}

function keypairToWallet(kp: Keypair): Wallet {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => {
      tx.sign([kp]);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      for (const tx of txs) tx.sign([kp]);
      return txs;
    },
    payer: kp,
  } as Wallet;
}

interface ActiveEscrow {
  pubkey: PublicKey;
  depositor: PublicKey;
  recipient: PublicKey;
  nonce: bigint;
  fixtureId: number;
  fixtureName: string;
  selection: number;
  mint: PublicKey;
  amount: bigint;
}

const ESCOW_DISCRIMINATOR = [31, 213, 123, 187, 186, 22, 218, 155];

const ESCOW_STATE_ACTIVE = 0;
const ESCOW_DISCRIMINATOR_BYTES = Buffer.from(ESCOW_DISCRIMINATOR);

/** Minimum size for a fully-initialized Escrow (discriminator 8 + all fields up to and including vault_bump) */
const MIN_ESCROW_SIZE = 219;

function decodeEscrow(buf: Buffer): ActiveEscrow | null {
  if (buf.length < MIN_ESCROW_SIZE) return null;
  if (!buf.subarray(0, 8).equals(ESCOW_DISCRIMINATOR_BYTES)) return null;

  let off = 8;

  // 1. depositor (pubkey, 32 bytes)
  const depositor = readPubkey(buf, off);
  off += 32;

  // 2. recipient (pubkey, 32 bytes)
  const recipient = readPubkey(buf, off);
  off += 32;

  // 3. nonce (u64, 8 bytes)
  const nonce = readU64(buf, off);
  off += 8;

  // 4. fixture_id (u64, 8 bytes)
  const fixtureId = Number(readU64(buf, off));
  off += 8;

  // 5. fixture_name (string)
  const [fixtureName, strAdv] = readString(buf, off);
  off += strAdv;

  // 6. selection (u8)
  const selection = buf[off];
  off += 1;

  // 7. label (string)
  const [, strAdv2] = readString(buf, off);
  off += strAdv2;

  // 8. odds (u64)
  off += 8;

  // 9. mint (pubkey, 32 bytes)
  const mint = readPubkey(buf, off);
  off += 32;

  // 10. vault (pubkey, 32 bytes)
  off += 32;

  // 11. amount (u64)
  const amount = readU64(buf, off);
  off += 8;

  // 12. expiry (i64)
  off += 8;

  // 13. depositor_won (bool, 1 byte)
  off += 1;

  // 14. state (EscrowState enum, 1 byte variant index)
  const state = buf[off];
  off += 1;

  // 15. bump (u8)
  off += 1;

  // 16. vault_bump (u8)
  off += 1;

  if (state !== ESCOW_STATE_ACTIVE) return null;

  return { pubkey: null!, depositor, recipient, nonce, fixtureId, fixtureName, selection, mint, amount };
}

export async function fetchActiveEscrows(connection: Connection): Promise<ActiveEscrow[]> {
  const pgas = await connection.getProgramAccounts(SETTLEMENT_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(ESCOW_DISCRIMINATOR_BYTES) } },
    ],
  });

  const results: ActiveEscrow[] = [];
  for (const { pubkey, account } of pgas) {
    const decoded = decodeEscrow(account.data);
    if (decoded) {
      decoded.pubkey = pubkey;
      results.push(decoded);
    }
  }
  return results;
}

async function txlineRequest(
  txlineUrl: string,
  path: string,
  jwt: string,
  apiToken: string,
): Promise<any> {
  const url = `${txlineUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
  });
  if (!res.ok) throw new Error(`TxLINE ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

interface SettlementResult {
  escrowPubkey: string;
  fixtureId: number | null;
  fixtureName: string;
  status: 'settled' | 'skipped' | 'not_finished' | 'error';
  error?: string;
  txSig?: string;
}

const SETTLEMENT_IDL = require('../idl/settlement.json');

export async function settleActiveEscrows(
  connection: Connection,
  keeper: Keypair,
  txlineUrl: string,
  txlineJwt: string,
  txlineApiToken: string,
  _fixtureNameToIdMap?: Record<string, number>,
  force: boolean = false,
  fixtureFilter?: number,
): Promise<SettlementResult[]> {
  const results: SettlementResult[] = [];
  const idl = SETTLEMENT_IDL;

  // 1. Fetch active escrows
  const escrows = await fetchActiveEscrows(connection);
  if (escrows.length === 0) return [];

  // 2. Optionally filter by fixtureId
  const filtered = fixtureFilter != null
    ? escrows.filter(e => e.fixtureId === fixtureFilter)
    : escrows;
  if (fixtureFilter != null && filtered.length === 0) return [];

  // 3. Prepare Anchor program for instruction building
  const wallet = keypairToWallet(keeper);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, provider);

  // 4. For each escrow, try to settle
  for (const escrow of filtered) {
    const { pubkey, fixtureId, fixtureName, depositor, recipient, mint, selection } = escrow;
    const escrowB58 = pubkey.toBase58();

    // Check if fixture is finished via scores endpoint
    let score1 = 0, score2 = 0, statusId = 0, earliestTs = 0;
    try {
      const scoresRaw: any = await txlineRequest(
        txlineUrl, `/api/scores/snapshot/${fixtureId}`, txlineJwt, txlineApiToken,
      );
      const msgs = Array.isArray(scoresRaw) ? scoresRaw : (scoresRaw?.messages ?? [scoresRaw]);
      // Scan all messages for game_finalised (TxLINE's new END status with StatusId=100)
      const finalisedMsg = msgs.find((m: any) => m.Action === 'game_finalised');
      if (finalisedMsg) {
        statusId = finalisedMsg.StatusId ?? 0;
      } else {
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        statusId = lastMsg?.StatusId ?? 0;
      }
      // Latest score from the last message that has Score data
      const lastScore = [...msgs].reverse().find((m: any) => m.Score?.Participant1?.Total?.Goals != null);
      const s = lastScore?.Score ?? {};
      score1 = s.Participant1?.Total?.Goals ?? 0;
      score2 = s.Participant2?.Total?.Goals ?? 0;
      for (const m of msgs) {
        const ts = m.Ts ?? 0;
        if (ts > 0 && (earliestTs === 0 || ts < earliestTs)) earliestTs = ts;
      }
    } catch (e: any) {
      results.push({
        escrowPubkey: escrowB58, fixtureId, fixtureName,
        status: 'not_finished',
        error: `Scores fetch: ${e.message}`,
      });
      continue;
    }

    const FINISHED_STATUS_IDS = [5, 10, 13, 100];
    const isFinishedStatus = FINISHED_STATUS_IDS.includes(statusId);
    const timeHeuristic = statusId >= 2 && earliestTs > 0 && (Date.now() - earliestTs) > 2.5 * 60 * 60 * 1000;

    if (!isFinishedStatus) {
      if (force || timeHeuristic) {
        console.log(`[keeper] Force-settling ${fixtureName} (StatusId ${statusId}, timeHeuristic=${timeHeuristic})`);
      } else {
        results.push({
          escrowPubkey: escrowB58, fixtureId, fixtureName,
          status: 'not_finished',
          error: `StatusId ${statusId}`,
        });
        continue;
      }
    }

    // Get fixture validation data
    let validation: any;
    try {
      validation = await txlineRequest(
        txlineUrl, `/api/fixtures/validation?fixtureId=${fixtureId}`, txlineJwt, txlineApiToken,
      );
    } catch (e: any) {
      results.push({
        escrowPubkey: escrowB58, fixtureId, fixtureName,
        status: 'error',
        error: `Validation fetch: ${e.message}`,
      });
      continue;
    }

    // Build and send settleWithCpi tx
    try {
      const vault = PublicKey.findProgramAddressSync(
        [enc('vault'), pubkey.toBuffer()],
        SETTLEMENT_PROGRAM_ID,
      )[0];
      const depositorAta = getAssociatedTokenAddressSync(mint, depositor, false, TOKEN_PROGRAM_ID);
      const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID);
      const callerAta = getAssociatedTokenAddressSync(mint, keeper.publicKey, false, TOKEN_PROGRAM_ID);
      const f = validation.snapshot;
      const fixtureTsSec = Math.floor((f.ts ?? f.Ts ?? 0) / 1000);
      const fixtureEpochDay = Math.floor(epochDayFromTs(fixtureTsSec) / 10) * 10;
      const tenDailyFixturesRoots = getTenDailyFixturesRootsPda(fixtureEpochDay);
      const fs = validation.summary;

      // Create ATAs if they don't exist
      const [recipientAtaInfo, depositorAtaInfo, callerAtaInfo] = await Promise.all([
        connection.getAccountInfo(recipientAta),
        connection.getAccountInfo(depositorAta),
        connection.getAccountInfo(callerAta),
      ]);
      const createAtaInstructions: TransactionInstruction[] = [];
      if (!depositorAtaInfo) {
        createAtaInstructions.push(createAssociatedTokenAccountInstruction(
          keeper.publicKey, depositorAta, depositor, mint,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }
      if (!recipientAtaInfo) {
        createAtaInstructions.push(createAssociatedTokenAccountInstruction(
          keeper.publicKey, recipientAta, recipient, mint,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }
      if (!callerAtaInfo) {
        createAtaInstructions.push(createAssociatedTokenAccountInstruction(
          keeper.publicKey, callerAta, keeper.publicKey, mint,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ));
      }

      const instruction = await program.methods
        .settleWithCpi(
          new BN(score1),
          new BN(score2),
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
          fs.update_count ?? fs.updateCount ?? fs.updateStats?.updateCount ?? 0,
          new BN(fs.min_timestamp ?? fs.minTimestamp ?? fs.updateStats?.minTimestamp ?? 0),
          new BN(fs.max_timestamp ?? fs.maxTimestamp ?? fs.updateStats?.maxTimestamp ?? 0),
          Object.values(fs.update_sub_tree_root ?? fs.updateSubTreeRoot ?? fs.eventsSubTreeRoot ?? new Array(32).fill(0)),
          (validation.subTreeProof ?? []).map((p: any) => ({
            hash: Object.values(p.hash ?? p),
            isRightSibling: p.isRightSibling ?? false,
          })),
          (validation.mainTreeProof ?? []).map((p: any) => ({
            hash: Object.values(p.hash ?? p),
            isRightSibling: p.isRightSibling ?? false,
          })),
        )
        .accountsStrict({
          caller: keeper.publicKey,
          escrow: pubkey,
          mint,
          vault,
          depositorTokenAccount: depositorAta,
          recipientTokenAccount: recipientAta,
          callerTokenAccount: callerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          txlineProgram: TXLINE_PROGRAM_ID,
          tenDailyFixturesRoots,
        })
        .instruction();

      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: keeper.publicKey,
        recentBlockhash: blockhash,
        instructions: [...createAtaInstructions, instruction],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);
      tx.sign([keeper]);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      results.push({ escrowPubkey: escrowB58, fixtureId, fixtureName, status: 'settled', txSig: sig });
    } catch (e: any) {
      results.push({
        escrowPubkey: escrowB58, fixtureId, fixtureName,
        status: 'error',
        error: `Settle tx: ${e.message}`,
      });
    }
  }

  return results;
}

export async function settleSingleEscrow(
  connection: Connection,
  keeper: Keypair,
  txlineUrl: string,
  txlineJwt: string,
  txlineApiToken: string,
  escrowPubkey: PublicKey,
  _fixtureNameToIdMap?: Record<string, number>,
  force: boolean = false,
): Promise<SettlementResult> {
  const accountInfo = await connection.getAccountInfo(escrowPubkey);
  if (!accountInfo) {
    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId: null, fixtureName: '', status: 'error', error: 'Escrow account not found' };
  }

  const decoded = decodeEscrow(accountInfo.data);
  if (!decoded) {
    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId: null, fixtureName: '', status: 'error', error: 'Could not decode escrow' };
  }
  decoded.pubkey = escrowPubkey;

  const { fixtureId, fixtureName, depositor, recipient, mint } = decoded;

  let score1 = 0, score2 = 0, statusId = 0, earliestTs = 0;
  try {
    const scoresRaw: any = await txlineRequest(
      txlineUrl, `/api/scores/snapshot/${fixtureId}`, txlineJwt, txlineApiToken,
    );
    const msgs = Array.isArray(scoresRaw) ? scoresRaw : (scoresRaw?.messages ?? [scoresRaw]);
    const finalisedMsg = msgs.find((m: any) => m.Action === 'game_finalised');
    if (finalisedMsg) {
      statusId = finalisedMsg.StatusId ?? 0;
    } else {
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      statusId = lastMsg?.StatusId ?? 0;
    }
    const lastScore = [...msgs].reverse().find((m: any) => m.Score?.Participant1?.Total?.Goals != null);
    const s = lastScore?.Score ?? {};
    score1 = s.Participant1?.Total?.Goals ?? 0;
    score2 = s.Participant2?.Total?.Goals ?? 0;
    for (const m of msgs) {
      const ts = m.Ts ?? 0;
      if (ts > 0 && (earliestTs === 0 || ts < earliestTs)) earliestTs = ts;
    }
  } catch (e: any) {
    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId, fixtureName, status: 'not_finished', error: `Scores fetch: ${e.message}` };
  }

  const FINISHED_STATUS_IDS = [5, 10, 13, 100];
  const isFinishedStatus = FINISHED_STATUS_IDS.includes(statusId);
  const timeHeuristic = statusId >= 2 && earliestTs > 0 && (Date.now() - earliestTs) > 2.5 * 60 * 60 * 1000;

  if (!isFinishedStatus) {
    if (force || timeHeuristic) {
      console.log(`[keeper] Force-settling ${fixtureName} (StatusId ${statusId}, timeHeuristic=${timeHeuristic})`);
    } else {
      return { escrowPubkey: escrowPubkey.toBase58(), fixtureId, fixtureName, status: 'not_finished', error: `StatusId ${statusId}` };
    }
  }

  let validation: any;
  try {
    validation = await txlineRequest(
      txlineUrl, `/api/fixtures/validation?fixtureId=${fixtureId}`, txlineJwt, txlineApiToken,
    );
  } catch (e: any) {
    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId, fixtureName, status: 'error', error: `Validation fetch: ${e.message}` };
  }

  try {
    const idl = SETTLEMENT_IDL;
    const wallet = keypairToWallet(keeper);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idl, provider);

    const vault = PublicKey.findProgramAddressSync(
      [enc('vault'), escrowPubkey.toBuffer()],
      SETTLEMENT_PROGRAM_ID,
    )[0];
    const depositorAta = getAssociatedTokenAddressSync(mint, depositor, false, TOKEN_PROGRAM_ID);
    const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID);
    const callerAta = getAssociatedTokenAddressSync(mint, keeper.publicKey, false, TOKEN_PROGRAM_ID);
    const f = validation.snapshot;
    const fixtureTsSec = Math.floor((f.ts ?? f.Ts ?? 0) / 1000);
    const fixtureEpochDay = Math.floor(epochDayFromTs(fixtureTsSec) / 10) * 10;
    const tenDailyFixturesRoots = getTenDailyFixturesRootsPda(fixtureEpochDay);
    const fs = validation.summary;

    const [recipientAtaInfo, depositorAtaInfo, callerAtaInfo] = await Promise.all([
      connection.getAccountInfo(recipientAta),
      connection.getAccountInfo(depositorAta),
      connection.getAccountInfo(callerAta),
    ]);
    const createAtaInstructions: TransactionInstruction[] = [];
    if (!depositorAtaInfo) {
      createAtaInstructions.push(createAssociatedTokenAccountInstruction(
        keeper.publicKey, depositorAta, depositor, mint,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }
    if (!recipientAtaInfo) {
      createAtaInstructions.push(createAssociatedTokenAccountInstruction(
        keeper.publicKey, recipientAta, recipient, mint,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }
    if (!callerAtaInfo) {
      createAtaInstructions.push(createAssociatedTokenAccountInstruction(
        keeper.publicKey, callerAta, keeper.publicKey, mint,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }

    const instruction = await program.methods
      .settleWithCpi(
        new BN(score1),
        new BN(score2),
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
        fs.update_count ?? fs.updateCount ?? fs.updateStats?.updateCount ?? 0,
        new BN(fs.min_timestamp ?? fs.minTimestamp ?? fs.updateStats?.minTimestamp ?? 0),
        new BN(fs.max_timestamp ?? fs.maxTimestamp ?? fs.updateStats?.maxTimestamp ?? 0),
        Object.values(fs.update_sub_tree_root ?? fs.updateSubTreeRoot ?? fs.eventsSubTreeRoot ?? new Array(32).fill(0)),
        (validation.subTreeProof ?? []).map((p: any) => ({
          hash: Object.values(p.hash ?? p),
          isRightSibling: p.isRightSibling ?? false,
        })),
        (validation.mainTreeProof ?? []).map((p: any) => ({
          hash: Object.values(p.hash ?? p),
          isRightSibling: p.isRightSibling ?? false,
        })),
      )
      .accountsStrict({
        caller: keeper.publicKey,
        escrow: escrowPubkey,
        mint,
        vault,
        depositorTokenAccount: depositorAta,
        recipientTokenAccount: recipientAta,
        callerTokenAccount: callerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        txlineProgram: TXLINE_PROGRAM_ID,
        tenDailyFixturesRoots,
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: keeper.publicKey,
      recentBlockhash: blockhash,
      instructions: [...createAtaInstructions, instruction],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([keeper]);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, 'confirmed');

    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId, fixtureName, status: 'settled', txSig: sig };
  } catch (e: any) {
    return { escrowPubkey: escrowPubkey.toBase58(), fixtureId, fixtureName, status: 'error', error: `Settle tx: ${e.message}` };
  }
}
