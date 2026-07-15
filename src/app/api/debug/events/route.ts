import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { ensureApiToken } from '../../../../lib/keeper-auth';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com';

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
      setTimeout(() => { cachedAuth = null; }, 10 * 60 * 1000);
      return { Authorization: `Bearer ${data.token}`, 'X-Api-Token': envToken };
    }
  }
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

const DISPLAY_STATUS_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const EVENT_ACTIONS = new Set(['goal', 'goal_own', 'goal_penalty', 'yellow_card', 'red_card']);

function buildPlayerMap(msgs: any[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of msgs) {
    const action = m.Action ?? m.Update?.Action ?? '';
    if (action !== 'lineups') continue;
    const lineupsArr = m.Lineups ?? m.Update?.Lineups ?? [];
    if (!Array.isArray(lineupsArr)) continue;
    for (const teamLineup of lineupsArr) {
      const players = teamLineup.lineups ?? [];
      if (!Array.isArray(players)) continue;
      for (const p of players) {
        const name = p.player?.preferredName ?? p.playerName ?? '';
        if (!name) continue;
        const nId = p.player?.normativeId;
        const fId = p.fixturePlayerId;
        if (nId != null) map.set(nId, name);
        if (fId != null && fId !== nId) map.set(fId, name);
      }
    }
  }
  return map;
}

function parseMatchEvents(msgs: any[]): any[] {
  const sorted = [...msgs]
    .filter((m: any) => {
      const a = m.Action ?? m.Update?.Action ?? '';
      return a !== 'action_amend';
    })
    .sort((a, b) => {
      const seqA = a.Seq ?? a.Update?.Seq ?? 0;
      const seqB = b.Seq ?? b.Update?.Seq ?? 0;
      return seqA - seqB;
    });

  const events: any[] = [];
  let prevGoals1 = 0, prevGoals2 = 0;
  let prevYC1 = 0, prevYC2 = 0;
  let prevRC1 = 0, prevRC2 = 0;
  let lastGoodMinute = 0;

  for (const m of sorted) {
    const action = m.Action ?? m.Update?.Action ?? '';
    const data = m.Data ?? m.Update?.Data ?? {};
    const seq = m.Seq ?? m.Update?.Seq ?? 0;
    const secs = m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;
    const minute = secs != null ? Math.floor(secs / 60) : 0;
    if (minute > 0) lastGoodMinute = minute;
    const eventMinute = minute || lastGoodMinute;
    const participant = m.Participant ?? m.Update?.Participant ?? data.Participant ?? 0;
    const team = participant as 1 | 2;
    const score = m.Score ?? m.Update?.Score;

    const g1 = score?.Participant1?.Total?.Goals ?? prevGoals1;
    const g2 = score?.Participant2?.Total?.Goals ?? prevGoals2;

    const isGoalAction = action === 'goal' || action === 'goal_penalty' || action === 'goal_own';
    if (EVENT_ACTIONS.has(action)) {
      let eventHome = prevGoals1, eventAway = prevGoals2;
      if (isGoalAction) {
        if (action === 'goal_own') {
          if (team === 1) eventAway++;
          else eventHome++;
        } else if (action === 'goal_penalty') {
          if (team === 1) eventHome++;
          else eventAway++;
        } else {
          if (team === 1) eventHome++;
          else eventAway++;
        }
        prevGoals1 = eventHome;
        prevGoals2 = eventAway;
      }
      const player = data.Player ?? data.PlayerName ?? data.name ?? data.player ?? data.playerName ?? '';
      events.push({
        type: action,
        team,
        minute,
        player,
        playerId: data.PlayerId ?? null,
        homeScore: eventHome,
        awayScore: eventAway,
        seq,
      });
    }

    if (action === 'var_end') {
      events.push({ type: 'var_end', team, minute, homeScore: g1, awayScore: g2, seq });
    }

    const yc1 = score?.Participant1?.Total?.YellowCards ?? prevYC1;
    const yc2 = score?.Participant2?.Total?.YellowCards ?? prevYC2;
    const rc1 = score?.Participant1?.Total?.RedCards ?? prevRC1;
    const rc2 = score?.Participant2?.Total?.RedCards ?? prevRC2;

    // Inferred card — skip var_end/action_discarded (stale Score, prev never updated)
    if (yc1 > prevYC1 && action !== 'var_end' && action !== 'action_discarded' && !(action === 'yellow_card' && team === 1)) {
      events.push({ type: 'yellow_card', team: 1, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }
    if (yc2 > prevYC2 && action !== 'var_end' && action !== 'action_discarded' && !(action === 'yellow_card' && team === 2)) {
      events.push({ type: 'yellow_card', team: 2, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }
    if (rc1 > prevRC1 && action !== 'var_end' && action !== 'action_discarded' && !(action === 'red_card' && team === 1)) {
      events.push({ type: 'red_card', team: 1, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }
    if (rc2 > prevRC2 && action !== 'var_end' && action !== 'action_discarded' && !(action === 'red_card' && team === 2)) {
      events.push({ type: 'red_card', team: 2, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }

    if (!isGoalAction && action !== 'var_end' && action !== 'action_discarded') {
      prevGoals1 = g1;
      prevGoals2 = g2;
    }
    if (action !== 'var_end' && action !== 'action_discarded') {
      prevYC1 = yc1;
      prevYC2 = yc2;
      prevRC1 = rc1;
      prevRC2 = rc2;
    }
  }

  return events;
}

export async function GET(req: NextRequest) {
  const fixtureId = req.nextUrl.searchParams.get('fixtureId') || '18237038';
  try {
    const h = await getTxlineHeaders();
    // Try both /api/scores and /scores (without /api) since the base URL may include /api
    const base = TXLINE_API_URL.replace(/\/+$/, '');
    const [scoresRes, historyTsResApi, historyTsResNoApi, historicalRes, scoresNoTsRes] = await Promise.all([
      fetch(`${base}/api/scores/snapshot/${fixtureId}`, { headers: h }),
      fetch(`${base}/api/scores?Ts=0&FixtureId=${fixtureId}`, { headers: h }),
      fetch(`${base}/scores?Ts=0&FixtureId=${fixtureId}`, { headers: h }),
      fetch(`${base}/api/scores/historical/${fixtureId}`, { headers: h }),
      fetch(`${base}/api/scores?FixtureId=${fixtureId}`, { headers: h }),
    ]);

    const safeJson = async (r: Response) => {
      try { return r.ok ? await r.json() : null; } catch { return null; }
    };
    const scores = await safeJson(scoresRes);
    const historyTsApi = await safeJson(historyTsResApi);
    const historyTsNoApi = await safeJson(historyTsResNoApi);
    const historical = await safeJson(historicalRes);
    const scoresNoTs = await safeJson(scoresNoTsRes);

    const scoresMsgs = Array.isArray(scores) ? scores : (scores?.messages ?? []);
    const historyTsApiMsgs = Array.isArray(historyTsApi) ? historyTsApi : (historyTsApi?.messages ?? []);
    const historyTsNoApiMsgs = Array.isArray(historyTsNoApi) ? historyTsNoApi : (historyTsNoApi?.messages ?? []);
    const historicalMsgs = Array.isArray(historical) ? historical : (historical?.messages ?? []);
    const scoresNoTsMsgs = Array.isArray(scoresNoTs) ? scoresNoTs : (scoresNoTs?.messages ?? []);

    // Use the endpoint that returned the most messages
    const bestMsgs = historicalMsgs.length > 0 ? historicalMsgs
      : historyTsNoApiMsgs.length > 0 ? historyTsNoApiMsgs
      : historyTsApiMsgs.length > 0 ? historyTsApiMsgs
      : scoresNoTsMsgs.length > 0 ? scoresNoTsMsgs
      : scoresMsgs;

    const playerMap = buildPlayerMap(bestMsgs);
    const events = parseMatchEvents(bestMsgs);

    // Extract latest Score from snapshot
    let latestScore: any = null;
    let latestSeq = -1;
    for (const m of (Array.isArray(scoresMsgs) ? scoresMsgs : [])) {
      const seq = m.Seq ?? m.Update?.Seq ?? 0;
      if (seq > latestSeq) {
        const sc = m.Score ?? m.Update?.Score ?? null;
        if (sc?.Participant1?.Total?.Goals != null || sc?.Participant2?.Total?.Goals != null) {
          latestSeq = seq;
          latestScore = sc;
        }
      }
    }

    // Show all raw messages (abridged) so we can see what actions exist
    const rawMessages = bestMsgs.map((m: any) => {
      const action = m.Action ?? m.Update?.Action ?? '';
      const participant = m.Participant ?? m.Update?.Participant ?? 0;
      const seq = m.Seq ?? m.Update?.Seq ?? 0;
      const sc = m.Score ?? m.Update?.Score;
      const g1 = sc?.Participant1?.Total?.Goals;
      const g2 = sc?.Participant2?.Total?.Goals;
      const yc1 = sc?.Participant1?.Total?.YellowCards;
      const yc2 = sc?.Participant2?.Total?.YellowCards;
      const subType = m.Data?.Type ?? m.Update?.Data?.Type ?? '';
      const data = m.Data ?? m.Update?.Data ?? {};
      const playerId = data.PlayerId ?? null;
      const playerName = data.Player ?? data.PlayerName ?? data.name ?? data.player ?? data.playerName ?? null;
      return { action, team: participant, seq, g1, g2, yc1, yc2, subType, playerId, playerName };
    });

    return NextResponse.json({
      fixtureId: Number(fixtureId),
      snapshot: { status: scoresRes.status, ok: scoresRes.ok, msgCount: scoresMsgs.length },
      historyTsApi: { status: historyTsResApi.status, ok: historyTsResApi.ok, msgCount: historyTsApiMsgs.length },
      historyTsNoApi: { status: historyTsResNoApi.status, ok: historyTsResNoApi.ok, msgCount: historyTsNoApiMsgs.length },
      historical: { status: historicalRes.status, ok: historicalRes.ok, msgCount: historicalMsgs.length },
      scoresNoTs: { status: scoresNoTsRes.status, ok: scoresNoTsRes.ok, msgCount: scoresNoTsMsgs.length },
      latestScore: latestScore ? { g1: latestScore.Participant1?.Total?.Goals, g2: latestScore.Participant2?.Total?.Goals } : null,
      latestScoreSeq: latestSeq,
      bestSource: historicalMsgs.length > 0 ? 'historical'
        : historyTsNoApiMsgs.length > 0 ? 'historyTsNoApi'
        : historyTsApiMsgs.length > 0 ? 'historyTsApi' : 'snapshot',
      totalEvents: events.length,
      yellowCards: events.filter((e: any) => e.type === 'yellow_card').length,
      goals: events.filter((e: any) => e.type === 'goal' || e.type === 'goal_penalty' || e.type === 'goal_own').length,
      events: events.map((e: any) => ({
        type: e.type,
        team: e.team,
        minute: e.minute,
        player: e.player || null,
        playerId: e.playerId ?? null,
        homeScore: e.homeScore,
        awayScore: e.awayScore,
        seq: e.seq,
      })),
      rawMessages,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
