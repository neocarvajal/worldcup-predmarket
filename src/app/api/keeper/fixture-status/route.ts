import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { ensureApiToken } from '../../../../lib/keeper-auth';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com';

const FINISHED_STATUS_IDS = [5, 10, 13, 100];

function isFinishedStatus(statusId: number): boolean {
  return FINISHED_STATUS_IDS.includes(statusId);
}

/** Get TxLINE auth headers, preferring env var and caching across calls */
let cachedAuth: { jwt: string; apiToken: string } | null = null;

async function getTxlineHeaders(): Promise<Record<string, string>> {
  if (cachedAuth) {
    return { Authorization: `Bearer ${cachedAuth.jwt}`, 'X-Api-Token': cachedAuth.apiToken };
  }
  const envToken = process.env.TXLINE_API_TOKEN;
  if (envToken) {
    const res = await fetch(`${TXLINE_API_URL}/auth/guest/start`, { method: 'POST' });
    if (res.ok) {
      const data: any = await res.json();
      cachedAuth = { jwt: data.token, apiToken: envToken };
      setTimeout(() => { cachedAuth = null; }, 10 * 60 * 1000); // expire cache after 10min
      return { Authorization: `Bearer ${data.token}`, 'X-Api-Token': envToken };
    }
  }
  // Fall back to on-chain auth
  const payerSecretKey = process.env.PAYER_SECRET_KEY;
  if (!payerSecretKey) return {};
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const keeper = Keypair.fromSecretKey(new Uint8Array(JSON.parse(payerSecretKey)));
  const auth = await ensureApiToken(keeper, connection, TXLINE_API_URL);
  cachedAuth = auth;
  setTimeout(() => { cachedAuth = null; }, 10 * 60 * 1000);
  return { Authorization: `Bearer ${auth.jwt}`, 'X-Api-Token': auth.apiToken };
}

export async function GET(req: NextRequest) {
  const fixtureIdStr = req.nextUrl.searchParams.get('fixtureId');
  if (!fixtureIdStr) {
    return NextResponse.json({ error: 'fixtureId required' }, { status: 400 });
  }
  const fixtureId = parseInt(fixtureIdStr, 10);
  if (isNaN(fixtureId)) {
    return NextResponse.json({ error: 'invalid fixtureId' }, { status: 400 });
  }

  try {
    const h = await getTxlineHeaders();

    // Always fetch fixtures snapshot in parallel to get startTime as fallback
    const fixturesPromise = fetch(`${TXLINE_API_URL}/api/fixtures/snapshot/${fixtureId}`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    const scoresRes = await fetch(`${TXLINE_API_URL}/api/scores/snapshot/${fixtureId}`, { headers: h });

    let startTime: number | undefined;

    // Get startTime from fixtures snapshot (most reliable source)
    try {
      const fixturesData = await fixturesPromise;
      if (fixturesData) {
        const msgs = Array.isArray(fixturesData) ? fixturesData : (fixturesData?.messages ?? [fixturesData]);
        const firstMsg = msgs.length > 0 ? msgs[0] : null;
        const rawStart = firstMsg?.FixtureInfo?.StartTime ?? firstMsg?.StartTime ?? firstMsg?.StartTimeUtc;
        if (rawStart != null) {
          startTime = Number(rawStart) > 1e12 ? Number(rawStart) : Number(rawStart) * 1000;
        }
      }
    } catch {}

    if (!scoresRes.ok) {
      return NextResponse.json({ fixtureId, finished: false, startTime, error: `TxLINE scores returned ${scoresRes.status}` });
    }

    const data = await scoresRes.json();
    const msgs = Array.isArray(data) ? data : (data?.messages ?? [data]);

    // Prefer game_finalised Action message (TxLINE's new END status with StatusId=100)
    const finalisedMsg = msgs.find((m: any) => m.Action === 'game_finalised');

    let statusId: number;
    let finished: boolean;

    // Extract startTime from scores first message's FixtureInfo if not already set
    if (!startTime) {
      const firstMsg = msgs.length > 0 ? msgs[0] : null;
      const rawStart = firstMsg?.FixtureInfo?.StartTime ?? firstMsg?.StartTime;
      if (rawStart != null) {
        startTime = Number(rawStart) > 1e12 ? Number(rawStart) : Number(rawStart) * 1000;
      }
    }

    if (finalisedMsg) {
      statusId = finalisedMsg.StatusId ?? 0;
      finished = true;
    } else {
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      statusId = lastMsg?.StatusId ?? 0;
      finished = isFinishedStatus(statusId);
    }

    // Latest score from the last message that has Score data
    const lastScore = [...msgs].reverse().find((m: any) => m.Score?.Participant1?.Total?.Goals != null);
    const score = lastScore?.Score || {};
    const score1 = score.Participant1?.Total?.Goals ?? 0;
    const score2 = score.Participant2?.Total?.Goals ?? 0;

    return NextResponse.json({ fixtureId, finished, statusId, startTime, score1, score2 });
  } catch (e: any) {
    return NextResponse.json({ fixtureId, finished: false, error: e.message });
  }
}

export const dynamic = 'force-dynamic';
