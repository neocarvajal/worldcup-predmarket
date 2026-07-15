"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTxLine } from '../../context/TxLineContext';
import { TxLineAuthError } from '../../txlineSkill';
import { LiveFeedItem } from '../../components/LiveFeedItem';
import { getFlag } from '../../lib/flags';
import { tTeam } from '../../lib/teams';
import { ActivityLogIcon, ReloadIcon } from '@radix-ui/react-icons';
import { useTranslations, useLocale } from 'next-intl';
import { bgImage } from '../../lib/bgImage';

const FINISHED_IDS = [5, 10, 13];

const STATUS_NAMES: Record<number, string> = {
  1: 'NS', 2: 'H1', 3: 'HT', 4: 'H2', 5: 'F',
  6: 'WET', 7: 'ET1', 8: 'HTET', 9: 'ET2', 10: 'FET',
  11: 'WPE', 12: 'PE', 13: 'FPE', 14: 'I', 15: 'A',
  16: 'C', 17: 'TXCC', 18: 'TXCS', 19: 'P',
};

const DISPLAY_STATUS_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

const EVENT_ACTIONS = new Set(['goal', 'goal_own', 'goal_penalty', 'yellow_card', 'red_card']);
const VAR_ACTIONS = new Set(['var', 'var_end']);

interface MatchEvent {
  type: 'goal' | 'goal_own' | 'goal_penalty' | 'yellow_card' | 'red_card' | 'var' | 'var_end';
  team: 1 | 2;
  minute: number;
  player?: string;
  playerId?: number;
  annulled?: boolean;
  varType?: string;
  varOutcome?: string;
  homeScore: number;
  awayScore: number;
  seq: number;
}


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

function parseMatchEvents(msgs: any[], getSeconds: (m: any) => number | null, playerMap: Map<number, string>): MatchEvent[] {
  const sorted = [...msgs]
    .filter((m: any) => {
      const a = m.Action ?? m.Update?.Action ?? '';
      // action_amend carries stale Score that can trigger false inferred events
      return a !== 'action_amend';
    })
    .sort((a, b) => {
      const seqA = a.Seq ?? a.Update?.Seq ?? 0;
      const seqB = b.Seq ?? b.Update?.Seq ?? 0;
      return seqA - seqB;
    });

  const events: MatchEvent[] = [];
  let prevGoals1 = 0, prevGoals2 = 0;
  let prevYC1 = 0, prevYC2 = 0;
  let prevRC1 = 0, prevRC2 = 0;
  let lastGoodMinute = 0; // last realistic minute from any message

  for (const m of sorted) {
    const action = m.Action ?? m.Update?.Action ?? '';
    const data = m.Data ?? m.Update?.Data ?? {};
    const seq = m.Seq ?? m.Update?.Seq ?? 0;
    const secs = getSeconds(m);
    const statusId = m.StatusId ?? m.Update?.StatusId ?? 0;
    const minute = secs != null ? Math.floor(secs / 60) : 0;
    if (minute > 0) lastGoodMinute = minute;
    const participant = m.Participant ?? m.Update?.Participant ?? data.Participant ?? 0;
    const team = participant as 1 | 2;
    const score = m.Score ?? m.Update?.Score;

    const g1 = score?.Participant1?.Total?.Goals ?? prevGoals1;
    const g2 = score?.Participant2?.Total?.Goals ?? prevGoals2;

    const isGoalAction = action === 'goal' || action === 'goal_penalty' || action === 'goal_own';
    if (EVENT_ACTIONS.has(action)) {
      // Compute score from tracked goals instead of message Score, which can be stale
      let eventHome = prevGoals1, eventAway = prevGoals2;
      if (isGoalAction) {
        if (action === 'goal_own') {
          if (team === 1) eventAway++;
          else eventHome++;
        } else if (action === 'goal_penalty') {
          if (team === 1) eventHome++;
          else eventAway++;
        } else {
          // regular goal
          if (team === 1) eventHome++;
          else eventAway++;
        }
        // Update prevGoals immediately so subsequent messages see correct baseline
        prevGoals1 = eventHome;
        prevGoals2 = eventAway;
      }
      const player = data.Player ?? data.PlayerName ?? data.name ?? data.player ?? data.playerName ?? (data.PlayerId != null ? playerMap.get(data.PlayerId) : '') ?? '';
      events.push({
        type: action as MatchEvent['type'],
        team,
        minute,
        player,
        playerId: data.PlayerId,
        homeScore: eventHome,
        awayScore: eventAway,
        seq,
      });
    }

    if (action === 'var') {
      const varType = data.Type ?? '';
      events.push({ type: 'var', team, minute, varType, homeScore: g1, awayScore: g2, seq });
    }

    if (action === 'var_end') {
      const outcome = data.Outcome ?? '';
      events.push({ type: 'var_end', team, minute, varOutcome: outcome, homeScore: g1, awayScore: g2, seq });
    }

    // Inferred events: use lastGoodMinute as fallback (halftime messages have Clock=0).
    const eventMinute = minute || lastGoodMinute;
    if (g1 > prevGoals1 && !isGoalAction && action !== 'var_end' && action !== 'action_discarded') {
      events.push({ type: 'goal', team: 1, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }
    if (g2 > prevGoals2 && !isGoalAction && action !== 'var_end' && action !== 'action_discarded') {
      events.push({ type: 'goal', team: 2, minute: eventMinute, player: '', homeScore: g1, awayScore: g2, seq });
    }

    // Detect annulled goals from score decreasing
    if (g1 < prevGoals1) {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.team === 1 && (ev.type === 'goal' || ev.type === 'goal_penalty' || ev.type === 'goal_own') && !ev.annulled) {
          ev.annulled = true;
          break;
        }
      }
    }
    if (g2 < prevGoals2) {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.team === 2 && (ev.type === 'goal' || ev.type === 'goal_penalty' || ev.type === 'goal_own') && !ev.annulled) {
          ev.annulled = true;
          break;
        }
      }
    }

    // Detect cards from score participant card counts
    const yc1 = score?.Participant1?.Total?.YellowCards ?? prevYC1;
    const yc2 = score?.Participant2?.Total?.YellowCards ?? prevYC2;
    const rc1 = score?.Participant1?.Total?.RedCards ?? prevRC1;
    const rc2 = score?.Participant2?.Total?.RedCards ?? prevRC2;

    // Only skip inferred card when the action IS a card for THIS team
    // (the primary handler already added it). A card action for team 2
    // should not suppress an inferred card for team 1 from Score change.
    // Skip var_end/action_discarded for card inference too — same stale-Score issue as goals,
    // and their prev counters are never updated, causing duplicate inferences.
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

  // Remove var/var_end events that have no corresponding result
  return events;
}

function getTeamName(fixture: any, teamNum: number): string {
  if (!fixture) return '';
  const isHome = fixture.Participant1IsHome !== false;
  const p1 = fixture.Participant1 || '';
  const p2 = fixture.Participant2 || '';
  if (teamNum === 1) return isHome ? p1 : p2;
  if (teamNum === 2) return isHome ? p2 : p1;
  return p1;
}

export default function LivePage() {
  const { client } = useTxLine();
  const t = useTranslations('Live');
  const locale = useLocale();
  const [events, setEvents] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'no-auth'>('connecting');
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const cacheRef = useRef<Map<number, any>>(new Map());
  const trackedRef = useRef<Set<number>>(new Set());
  const settledRef = useRef<Set<number>>(new Set());

  const parseSnapshot = useCallback((snap: any): any => {
    const msgs = Array.isArray(snap)
      ? snap
      : (snap?.messages ?? snap?.Messages ?? [snap]);
    // Top-level Score on snapshot (if present) overrides message-based lookup
    const topScore = snap?.Score ?? snap?.score ?? null;
    // Handle both flat (snapshot) and nested (SSE) message formats
    const getStatusId = (m: any) => m.StatusId ?? m.Update?.StatusId ?? 0;
    const getScoreVal = (m: any) => m.Score ?? m.Update?.Score ?? null;
    const getSeconds = (m: any) => m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;
    // StatusId is monotonic (only increases). action_amend messages inherit the
    // original action's StatusId (e.g., amend of H1 action during HT has StatusId=2).
    // Picking the **highest** StatusId among all displayable messages naturally
    // eliminates amends since they can only carry equal or lower StatusIds than
    // the game's current phase.
    const displayable = msgs.filter((m: any) => DISPLAY_STATUS_IDS.has(getStatusId(m)));
    if (displayable.length === 0) return null;
    const maxStatus = displayable.reduce((best: any, m: any) => getStatusId(m) > getStatusId(best) ? m : best);
    const statusId = getStatusId(maxStatus);
    const fid = maxStatus.FixtureId ?? maxStatus.Update?.FixtureId ?? 0;
    const cached = cacheRef.current.get(fid) || {};
    const playerMap = buildPlayerMap(msgs);
    const matchEvents = parseMatchEvents(msgs, getSeconds, playerMap);
    // Display score from the latest message per participant.
    // Don't take both from one message — that message may only carry one side
    let maxScore1 = 0, maxScore2 = 0;
    let bestSeq1 = -1, bestSeq2 = -1;
    for (const m of msgs) {
      const seq = m.Seq ?? m.Update?.Seq ?? 0;
      const sc = getScoreVal(m);
      if (sc?.Participant1?.Total?.Goals != null && seq > bestSeq1) {
        bestSeq1 = seq;
        maxScore1 = sc.Participant1.Total.Goals;
      }
      if (sc?.Participant2?.Total?.Goals != null && seq > bestSeq2) {
        bestSeq2 = seq;
        maxScore2 = sc.Participant2.Total.Goals;
      }
    }
    const hasScore = bestSeq1 >= 0 || bestSeq2 >= 0;
    if (!hasScore) {
      if (topScore != null) {
        maxScore1 = topScore.Participant1?.Total?.Goals ?? 0;
        maxScore2 = topScore.Participant2?.Total?.Goals ?? 0;
      } else {
        maxScore1 = cached.Score1 ?? 0;
        maxScore2 = cached.Score2 ?? 0;
      }
    }
    let maxSeconds = 0;
    for (const m of msgs) {
      const secs = getSeconds(m);
      if (secs != null && secs > maxSeconds) maxSeconds = secs;
    }
    const minute = Math.floor(maxSeconds / 60);
    return {
      FixtureId: fid,
      Participant1: cached.Participant1 ?? '',
      Participant2: cached.Participant2 ?? '',
      Participant1IsHome: cached.Participant1IsHome ?? true,
      Score1: maxScore1,
      Score2: maxScore2,
      Minute: minute,
      Status: STATUS_NAMES[statusId] ?? 'LIVE',
      StatusId: statusId,
      Events: matchEvents,
    };
  }, []);

  const load = useCallback(async () => {
    setConnectionState('connecting');
    try {
      const data = await client.getFixtures();
      const fixtures: any[] = data?.Fixtures ?? data?.fixtures ?? data ?? [];
      if (!Array.isArray(fixtures)) {
        setConnectionState('connected');
        return;
      }
      for (const f of fixtures) {
        const id = f.FixtureId ?? f.fixtureId;
        if (id != null) {
          cacheRef.current.set(id, {
            Participant1: f.Participant1 ?? f.participant1 ?? '',
            Participant2: f.Participant2 ?? f.participant2 ?? '',
            Participant1IsHome: f.Participant1IsHome ?? f.participant1IsHome ?? true,
            Score1: f.Score1 ?? f.score1 ?? f.Score?.Participant1?.Total?.Goals ?? 0,
            Score2: f.Score2 ?? f.score2 ?? f.Score?.Participant2?.Total?.Goals ?? 0,
          });
        }
      }
      const now = Date.now();
      const win = 4.5 * 60 * 60 * 1000;
      const candidates = fixtures.filter(f => {
        const cid = f.CompetitionId ?? f.competitionId ?? 0;
        if (cid !== 72) return false;
        const rawStart: number = f.StartTime ?? f.startTime ?? 0;
        if (rawStart <= 0) return false;
        const startTimeMs = rawStart > 1e12 ? rawStart : rawStart * 1000;
        return Math.abs(now - startTimeMs) < win;
      });
      if (candidates.length === 0) {
        setConnectionState('connected');
        return;
      }
      const fixtureIds = candidates.map(f => f.FixtureId ?? f.fixtureId);
      const snapshots = await Promise.allSettled(
        fixtureIds.map((id: number) => client.getScoresSnapshot(id))
      );
      const live: any[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const fid = candidate.FixtureId ?? candidate.fixtureId;
        trackedRef.current.add(fid);
        const result = snapshots[i];
        if (result.status !== 'fulfilled') continue;
        const d = parseSnapshot(result.value);
        if (!d) continue;
        if (FINISHED_IDS.includes(d.StatusId)) {
          if (!settledRef.current.has(fid)) {
            settledRef.current.add(fid);
            fetch(`/api/keeper/trigger-settle?fixtureId=${fid}`, { method: 'POST' })
              .catch(() => { });
          }
          continue;
        }
        d.FixtureId = fid;
        d.Participant1 = candidate.Participant1 ?? candidate.participant1 ?? '';
        d.Participant2 = candidate.Participant2 ?? candidate.participant2 ?? '';
        d.Participant1IsHome = candidate.Participant1IsHome ?? candidate.participant1IsHome ?? true;
        live.push(d);
      }
      setEvents(live);
      setConnectionState('connected');
      // Fetch full event history for each live fixture so the event timeline
      // shows the complete match history, not just recent snapshot messages.
      for (const fixture of live) {
        const fid = fixture.FixtureId;
        if (!fid || fullHistoryCache.current.has(fid)) continue;
        client.getScoresHistory([fid]).then(msgs => {
          if (!msgs || msgs.length === 0) return;
          const getSecs = (m: any) => m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;
          const playerMap = buildPlayerMap(msgs);
          const events = parseMatchEvents(msgs, getSecs, playerMap);
          fullHistoryCache.current.set(fid, events);
          setEvents(prev =>
            prev.map(e =>
              e.FixtureId === fid ? { ...e, Events: events } : e
            )
          );
        }).catch(() => {});
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (e instanceof TxLineAuthError || msg.includes('JWT') || msg.includes('token') || msg.includes('401') || msg.includes('403')) {
        setConnectionState('no-auth');
      } else {
        setConnectionState('error');
      }
    }
  }, [client, parseSnapshot]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (connectionState === 'connected' && events.length === 0 && !loadingTimeout) {
      const t = setTimeout(() => setLoadingTimeout(true), 12_000);
      return () => clearTimeout(t);
    }
    if (events.length > 0 && loadingTimeout) setLoadingTimeout(false);
  }, [connectionState, events.length, loadingTimeout]);

  const refreshCandidates = useCallback(async () => {
    try {
      const data = await client.getFixtures();
      const fixtures: any[] = data?.Fixtures ?? data?.fixtures ?? data ?? [];
      if (!Array.isArray(fixtures)) return;
      const now = Date.now();
      const win = 4.5 * 60 * 60 * 1000;
      for (const f of fixtures) {
        const cid = f.CompetitionId ?? f.competitionId ?? 0;
        if (cid !== 72) continue;
        const rawStart = f.StartTime ?? f.startTime ?? 0;
        if (rawStart <= 0) continue;
        const startTimeMs = rawStart > 1e12 ? rawStart : rawStart * 1000;
        if (Math.abs(now - startTimeMs) < win) {
          const fid = f.FixtureId ?? f.fixtureId;
          if (fid != null) {
            const existing = cacheRef.current.get(fid);
            cacheRef.current.set(fid, {
              Participant1: f.Participant1 ?? f.participant1 ?? '',
              Participant2: f.Participant2 ?? f.participant2 ?? '',
              Participant1IsHome: f.Participant1IsHome ?? f.participant1IsHome ?? true,
              Score1: f.Score1 ?? f.score1 ?? f.Score?.Participant1?.Total?.Goals ?? existing?.Score1 ?? 0,
              Score2: f.Score2 ?? f.score2 ?? f.Score?.Participant2?.Total?.Goals ?? existing?.Score2 ?? 0,
            });
            trackedRef.current.add(fid);
          }
        }
      }
    } catch { }
  }, [client]);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    let pollCount = 0;
    const poll = async () => {
      const ids = Array.from(trackedRef.current);
      if (ids.length === 0) return;
      try {
        const snapshots = await Promise.allSettled(
          ids.map((id: number) => client.getScoresSnapshot(id))
        );
        const updates: any[] = [];
        const finishedIds: number[] = [];
        for (const r of snapshots) {
          if (r.status !== 'fulfilled') continue;
          const d = parseSnapshot(r.value);
          if (!d) continue;
          if (FINISHED_IDS.includes(d.StatusId)) {
            finishedIds.push(d.FixtureId);
            if (!settledRef.current.has(d.FixtureId)) {
              settledRef.current.add(d.FixtureId);
              fetch(`/api/keeper/trigger-settle?fixtureId=${d.FixtureId}`, { method: 'POST' })
                .catch(() => { });
            }
            continue;
          }
          updates.push(d);
        }
        setEvents(prev => {
          let next = [...prev];
          if (finishedIds.length > 0) {
            const set = new Set(finishedIds);
            next = next.filter(e => !set.has(e.FixtureId));
            if (updates.length === 0) return next;
          }
          if (updates.length === 0) return next;
          for (const u of updates) {
            const idx = next.findIndex(e => e.FixtureId === u.FixtureId);
            if (idx >= 0) {
              // Preserve full-history Events from cache; fall back to new snapshot events
              const cached = fullHistoryCache.current.get(u.FixtureId);
              next[idx] = { ...u, Events: cached ?? u.Events ?? next[idx].Events };
            } else next.push(u);
          }
          return next.slice(0, 50);
        });
      } catch { }
      pollCount++;
      if (pollCount % 20 === 0) refreshCandidates();
    };
    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [connectionState, client, parseSnapshot, refreshCandidates]);

  const [selectedFixture, setSelectedFixture] = useState<any | null>(null);
  const fullHistoryCache = useRef<Map<number, MatchEvent[]>>(new Map());

  const handleViewEvents = useCallback(async (fixture: any) => {
    const fid = fixture.FixtureId;
    if (!fid) return;
    const cached = fullHistoryCache.current.get(fid);
    if (cached) {
      setSelectedFixture({ ...fixture, Events: cached });
      return;
    }
    setSelectedFixture(fixture);
    try {
      const msgs = await client.getScoresHistory([fid]);
      if (!msgs || msgs.length === 0) return;
      const getSecs = (m: any) => m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;
      const playerMap = buildPlayerMap(msgs);
      const events = parseMatchEvents(msgs, getSecs, playerMap);
      fullHistoryCache.current.set(fid, events);
      setSelectedFixture((prev: any) =>
        prev && prev.FixtureId === fid ? { ...prev, Events: events } : prev,
      );
    } catch {}
  }, [client]);

  const handleRetry = () => { load(); };

  const indicatorColor = connectionState === 'connected' ? 'var(--success)' :
    connectionState === 'connecting' ? 'var(--warning)' :
      connectionState === 'no-auth' ? 'var(--text-muted)' : 'var(--danger)';

  const indicatorBg = connectionState === 'connected' ? 'rgba(34,197,94,0.08)' :
    connectionState === 'connecting' ? 'rgba(245,158,11,0.08)' :
      connectionState === 'no-auth' ? 'var(--bg-surface)' : 'rgba(255,68,68,0.08)';

  const indicatorBorder = connectionState === 'connected' ? 'rgba(34,197,94,0.2)' :
    connectionState === 'connecting' ? 'rgba(245,158,11,0.2)' :
      connectionState === 'no-auth' ? 'var(--border)' : 'rgba(255,68,68,0.2)';

  const indicatorText = connectionState === 'connected' ? t('connected') :
    connectionState === 'connecting' ? t('connecting') :
      connectionState === 'no-auth' ? t('noAuth') : t('error');

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      {/* Background image */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            ...bgImage('live-bg'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.25) saturate(0.7)',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'var(--accent-dim)',
              boxShadow: '0 0 20px rgba(220,235,2,0.08)',
            }}
          >
            <ActivityLogIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300"
          style={{
            background: indicatorBg,
            border: `1px solid ${indicatorBorder}`,
          }}
        >
          {connectionState === 'connecting' ? (
            <div
              className="w-3 h-3 rounded-full animate-spin"
              style={{
                border: '2px solid transparent',
                borderTopColor: 'var(--warning)',
                borderRightColor: 'var(--warning)',
              }}
            />
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: indicatorColor,
                boxShadow: connectionState === 'connected'
                  ? `0 0 8px ${indicatorColor}`
                  : 'none',
              }}
            />
          )}
          <span
            className="text-[11px] font-semibold"
            style={{ color: indicatorColor }}
          >
            {indicatorText}
          </span>
        </div>
      </div>

      {connectionState === 'no-auth' ? (
        <div className="text-center py-20 animate-scaleIn">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--accent-dim)' }}
          >
            <ActivityLogIcon width={28} height={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('txlineNotConfigured')}</h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('connectWallet')}
          </p>
        </div>
      ) : connectionState === 'error' ? (
        <div className="text-center py-20 animate-scaleIn">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'rgba(255,68,68,0.1)' }}
          >
            <ActivityLogIcon width={28} height={28} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('connectionError')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {t('couldNotConnect')}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
            style={{
              background: 'var(--accent)',
              color: '#000',
            }}
          >
            <ReloadIcon width={16} height={16} />
            {t('retryNow')}
          </button>
        </div>
      ) : events.length === 0 && loadingTimeout ? (
        <div className="text-center py-20 animate-scaleIn">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <ActivityLogIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('awaitingSignal')}</h2>
          <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('noLiveMatches')}
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 animate-scaleIn">
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-10 h-10 rounded-full animate-spin"
              style={{
                border: '3px solid var(--accent-dim)',
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
              }}
            />
          </div>
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <ActivityLogIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('awaitingSignal')}</h2>
          <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('noLiveMatches')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('live')}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {events.length} {events.length === 1 ? t('match') : t('matches')}
            </span>
          </div>
          {events.map((e, idx) => (
            <div
              key={e.FixtureId ?? `event-${idx}`}
              className="animate-slideUp"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <LiveFeedItem
                fixtureId={e.FixtureId}
                participant1={e.Participant1 || ''}
                participant2={e.Participant2 || ''}
                score1={e.Score1 ?? 0}
                score2={e.Score2 ?? 0}
                minute={e.Minute ?? 0}
                status={e.Status || 'live'}
                onViewEvents={() => handleViewEvents(e)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Event detail view */}
      {selectedFixture && (
        <div className="fixed inset-0 z-[35] animate-slideUp"
          style={{
            background: 'var(--bg-primary)',
            overflowY: 'auto',
          }}
        >
          <div className="max-w-lg mx-auto px-4 pt-16 pb-6">
            {/* Back button */}
            <button
              onClick={() => setSelectedFixture(null)}
              className="flex items-center gap-1.5 mb-4 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-70 active:scale-95"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-muted)' }}>
                <path d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
              </svg>
              {t('back')}
            </button>

            {/* Score card */}
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border)' }}
                  >
                    <span className="text-lg leading-none">{getFlag(selectedFixture.Participant1) || '🏳️'}</span>
                  </div>
                  <span className="text-sm font-semibold truncate">{tTeam(selectedFixture.Participant1, locale)}</span>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-extrabold tracking-tight">{selectedFixture.Score1}</span>
                    <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
                    <span className="text-2xl font-extrabold tracking-tight">{selectedFixture.Score2}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-semibold truncate">{tTeam(selectedFixture.Participant2, locale)}</span>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border)' }}
                  >
                    <span className="text-lg leading-none">{getFlag(selectedFixture.Participant2) || '🏳️'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Events list */}
            <div className="space-y-2">
              {(selectedFixture.Events ?? []).length > 0 ? (
                (selectedFixture.Events as any[]).filter((ev: any) => ev.type !== 'var' && ev.type !== 'var_end').slice(0, 30).map((ev: any, i: number) => (
                  <div key={`ev-${i}`} className="flex items-center gap-2.5 py-2 px-3 rounded-xl"
                    style={{
                      background: ev.type === 'goal' || ev.type === 'goal_penalty' || ev.type === 'goal_own' ? 'rgba(34,197,94,0.06)' : 'var(--bg-surface)',
                      border: `1px solid ${ev.type === 'red_card' ? 'rgba(255,68,68,0.15)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28 }}>
                      {ev.type === 'goal' && <span className="text-lg">⚽</span>}
                      {ev.type === 'goal_penalty' && <span className="text-lg">⚽</span>}
                      {ev.type === 'goal_own' && <span className="text-lg">😬</span>}
                      {ev.type === 'yellow_card' && <span className="text-lg">🟨</span>}
                      {ev.type === 'red_card' && <span className="text-lg">🟥</span>}
                    </div>
                    <span className="text-xs font-mono font-bold tabular-nums"
                      style={{
                        color: ev.type === 'goal' || ev.type === 'goal_penalty' || ev.type === 'goal_own' ? 'var(--success)' : 'var(--text-muted)',
                        minWidth: 36,
                      }}
                    >
                      {ev.minute}&apos;
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold truncate">
                        {tTeam(ev.team === 1 ? selectedFixture.Participant1 : selectedFixture.Participant2, locale)}
                      </span>
                      {ev.player && (
                        <span className="text-[11px] ml-1" style={{ color: 'var(--text-secondary)' }}>— {ev.player}</span>
                      )}
                      {ev.type === 'goal_own' && <span className="text-[10px] ml-1.5 font-medium" style={{ color: 'var(--danger)' }}>{t('ownGoal')}</span>}
                      {ev.type === 'goal_penalty' && <span className="text-[10px] ml-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{t('penalty')}</span>}
                      {ev.annulled && <span className="text-[10px] ml-1.5 font-medium" style={{ color: 'var(--danger)' }}>{t('annulled')}</span>}
                      {ev.type === 'red_card' && <span className="text-[10px] ml-1.5 font-medium" style={{ color: 'var(--danger)' }}>{t('sentOff')}</span>}
                    </div>
                    <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {ev.homeScore}-{ev.awayScore}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('noEvents')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
