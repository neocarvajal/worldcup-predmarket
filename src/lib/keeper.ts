import {
  Connection, PublicKey, Keypair, VersionedTransaction, TransactionMessage,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { BorshCoder, Idl, BN, AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import bs58 from 'bs58';

const SETTLEMENT_PROGRAM_ID = new PublicKey('568BYcuHndKngsEYfEv7aMTqFXRCC5MzRxZdJuZDgU2J');
const TXLINE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');

let cachedIdl: Idl | null = null;

async function getIdl(): Promise<Idl> {
  if (!cachedIdl) {
    cachedIdl = (await import('../idl/settlement.json')) as unknown as Idl;
  }
  return cachedIdl;
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function getTenDailyFixturesRootsPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc('ten_daily_fixtures_roots')],
    TXLINE_PROGRAM_ID,
  )[0];
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
  fixtureName: string;
  selection: number;
  mint: PublicKey;
  amount: bigint;
}

const ESCOW_DISCRIMINATOR = [31, 213, 123, 187, 186, 22, 218, 155];

export async function fetchActiveEscrows(connection: Connection): Promise<ActiveEscrow[]> {
  const idl = await getIdl();
  const coder = new BorshCoder(idl);

  const pgas = await connection.getProgramAccounts(SETTLEMENT_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ESCOW_DISCRIMINATOR)) } },
    ],
  });

  const results: ActiveEscrow[] = [];
  for (const { pubkey, account } of pgas) {
    try {
      const decoded = coder.accounts.decode('Escrow', account.data);
      const stateKey = decoded.state ? Object.keys(decoded.state)[0] : null;
      if (stateKey !== 'Active') continue;
      results.push({
        pubkey,
        depositor: decoded.depositor,
        recipient: decoded.recipient,
        nonce: BigInt(decoded.nonce.toString()),
        fixtureName: decoded.fixture_name || '',
        selection: typeof decoded.selection === 'number' ? decoded.selection : 0,
        mint: decoded.mint,
        amount: BigInt(decoded.amount.toString()),
      });
    } catch { /* skip */ }
  }
  return results;
}

interface TxLineFixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  StatusId?: number;
  StartTime?: number;
  Ts?: number;
  Competition?: string;
  CompetitionId?: number;
  FixtureGroupId?: number;
  Participant1Id?: number;
  Participant2Id?: number;
  Participant1IsHome?: boolean;
}

interface ScoreSnapshot {
  FixtureInfo: any;
  Update?: {
    Score?: {
      Participant1?: { Total?: { Goals?: number } };
      Participant2?: { Total?: { Goals?: number } };
    };
  };
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

function normalizeParticipantName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseFixtureName(fixtureName: string): [string, string] {
  const parts = fixtureName.split(/\s+vs\s+/i);
  if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
  return [fixtureName, ''];
}

interface SettlementResult {
  escrowPubkey: string;
  fixtureId: number | null;
  fixtureName: string;
  status: 'settled' | 'skipped' | 'not_finished' | 'error';
  error?: string;
  txSig?: string;
}

export async function settleActiveEscrows(
  connection: Connection,
  keeper: Keypair,
  txlineUrl: string,
  txlineJwt: string,
  txlineApiToken: string,
  fixtureNameToIdMap?: Record<string, number>,
): Promise<SettlementResult[]> {
  const results: SettlementResult[] = [];
  const idl = await getIdl();

  // 1. Fetch fixtures from TxLINE to build name→fixtureId map
  let fixtures: TxLineFixture[] = [];
  try {
    const snap = await txlineRequest(txlineUrl, '/api/fixtures/snapshot', txlineJwt, txlineApiToken);
    fixtures = snap?.Fixtures ?? snap?.fixtures ?? snap ?? [];
  } catch (e: any) {
    console.warn('Could not fetch TxLINE fixtures:', e.message);
  }

  const nameToFixture = new Map<string, TxLineFixture>();
  for (const f of fixtures) {
    const n1 = normalizeParticipantName(f.Participant1 || '');
    const n2 = normalizeParticipantName(f.Participant2 || '');
    if (n1 && n2) {
      nameToFixture.set(`${n1} vs ${n2}`, f);
      nameToFixture.set(`${n2} vs ${n1}`, f);
    }
  }

  // 2. Fetch active escrows
  const escrows = await fetchActiveEscrows(connection);
  if (escrows.length === 0) return [];

  // 3. Prepare Anchor program for instruction building
  const wallet = keypairToWallet(keeper);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, provider);

  // 4. For each escrow, try to settle
  for (const escrow of escrows) {
    const { pubkey, fixtureName, depositor, recipient, mint, selection } = escrow;
    const escrowB58 = pubkey.toBase58();

    const [p1Name, p2Name] = parseFixtureName(fixtureName);
    const p1n = normalizeParticipantName(p1Name);
    const p2n = normalizeParticipantName(p2Name);

    // Resolve fixtureId
    let fixtureId: number | null = null;
    let fixture: TxLineFixture | undefined;

    if (fixtureNameToIdMap?.[fixtureName]) {
      fixtureId = fixtureNameToIdMap[fixtureName];
    }

    if (!fixtureId) {
      const key1 = `${p1n} vs ${p2n}`;
      const key2 = `${p2n} vs ${p1n}`;
      fixture = nameToFixture.get(key1) ?? nameToFixture.get(key2);
      if (fixture) fixtureId = fixture.FixtureId;
    }

    if (!fixtureId) {
      results.push({
        escrowPubkey: escrowB58,
        fixtureId: null, fixtureName,
        status: 'skipped',
        error: 'No matching fixture found in TxLINE',
      });
      continue;
    }

    // Fetch fixture to get status if not already fetched
    if (!fixture) {
      const snap = await txlineRequest(txlineUrl, `/api/fixtures/snapshot?fixtureId=${fixtureId}`, txlineJwt, txlineApiToken);
      const list = snap?.Fixtures ?? snap?.fixtures ?? [];
      fixture = Array.isArray(list) ? list.find((f: any) => f.FixtureId === fixtureId) : undefined;
    }

    const statusId = fixture?.StatusId;
    if (!statusId || ![5, 10, 13].includes(statusId)) {
      results.push({
        escrowPubkey: escrowB58, fixtureId, fixtureName,
        status: 'not_finished',
      });
      continue;
    }

    // Get final scores
    let score1 = 0, score2 = 0;
    try {
      const scores: ScoreSnapshot = await txlineRequest(
        txlineUrl, `/api/scores/snapshot/${fixtureId}`, txlineJwt, txlineApiToken,
      );
      const upd = scores?.Update || {};
      const s = upd.Score || {};
      score1 = s.Participant1?.Total?.Goals ?? 0;
      score2 = s.Participant2?.Total?.Goals ?? 0;
    } catch (e: any) {
      results.push({
        escrowPubkey: escrowB58, fixtureId, fixtureName,
        status: 'error',
        error: `Scores fetch: ${e.message}`,
      });
      continue;
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
      const tenDailyFixturesRoots = getTenDailyFixturesRootsPda();

      const f = validation.snapshot;
      const fs = validation.summary;

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
          new BN(fs.fixture_id ?? fs.fixtureId ?? 0),
          fs.competition_id ?? fs.competitionId ?? 0,
          fs.competition ?? '',
          fs.update_count ?? fs.updateStats?.updateCount ?? 0,
          new BN(fs.min_timestamp ?? fs.updateStats?.minTimestamp ?? 0),
          new BN(fs.max_timestamp ?? fs.updateStats?.maxTimestamp ?? 0),
          Object.values(fs.update_sub_tree_root ?? fs.eventsSubTreeRoot ?? new Array(32).fill(0)),
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
          tokenProgram: TOKEN_PROGRAM_ID,
          txlineProgram: TXLINE_PROGRAM_ID,
          tenDailyFixturesRoots,
        })
        .instruction();

      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: keeper.publicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
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
