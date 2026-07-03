"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { useTxLine } from './TxLineContext';
import { useNotifications } from './NotificationContext';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { tTeam } from '../lib/teams';

const FINISHED_IDS = [5, 10, 13];
const DISPLAY_STATUS_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const STATUS_NAMES: Record<number, string> = {
  1: 'NS', 2: 'H1', 3: 'HT', 4: 'H2', 5: 'F',
  6: 'WET', 7: 'ET1', 8: 'HTET', 9: 'ET2', 10: 'FET',
  11: 'WPE', 12: 'PE', 13: 'FPE', 14: 'I', 15: 'A',
  16: 'C', 17: 'TXCC', 18: 'TXCS', 19: 'P',
};
const STORAGE_STARTED = 'match-watcher:started';
const STORAGE_STATS = 'match-watcher:stats';

interface FixtureStats {
  score1: number;
  score2: number;
  yellow1: number;
  yellow2: number;
  red1: number;
  red2: number;
}

function loadSet(key: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSet(key: string, ids: Set<number>) {
  try { localStorage.setItem(key, JSON.stringify(Array.from(ids))); } catch {} }

function loadStatsMap(): Map<number, FixtureStats> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_STATS);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const map = new Map<number, FixtureStats>();
    for (const [k, v] of Object.entries(parsed)) {
      map.set(Number(k), v as FixtureStats);
    }
    return map;
  } catch { return new Map(); }
}

function saveStatsMap(map: Map<number, FixtureStats>) {
  try {
    const obj: Record<string, FixtureStats> = {};
    map.forEach((v, k) => { obj[String(k)] = v; });
    localStorage.setItem(STORAGE_STATS, JSON.stringify(obj));
  } catch {}
}

function parseSnapshot(snap: any, cache: Map<number, any>): any {
  const msgs = Array.isArray(snap) ? snap : (snap?.messages ?? [snap]);
  const getStatusId = (m: any) => m.StatusId ?? m.Update?.StatusId ?? 0;
  const getScoreVal = (m: any) => m.Score ?? m.Update?.Score ?? null;
  const getSeconds = (m: any) => m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;

  const displayable = msgs.filter((m: any) => DISPLAY_STATUS_IDS.has(getStatusId(m)));
  if (displayable.length === 0) return null;
  const maxStatus = displayable.reduce((best: any, m: any) => getStatusId(m) > getStatusId(best) ? m : best);
  const statusId = getStatusId(maxStatus);

  let maxScore1 = 0, maxScore2 = 0, maxSeconds = 0;
  let maxYellow1 = 0, maxYellow2 = 0, maxRed1 = 0, maxRed2 = 0;
  let currentScore1 = 0, currentScore2 = 0;
  for (const m of msgs) {
    const s = getScoreVal(m);
    if (s) {
      const t1 = s.Participant1?.Total;
      const t2 = s.Participant2?.Total;
      if (t1) {
        if (t1.Goals != null && t1.Goals > maxScore1) maxScore1 = t1.Goals;
        if (t1.YellowCards != null && t1.YellowCards > maxYellow1) maxYellow1 = t1.YellowCards;
        if (t1.RedCards != null && t1.RedCards > maxRed1) maxRed1 = t1.RedCards;
      }
      if (t2) {
        if (t2.Goals != null && t2.Goals > maxScore2) maxScore2 = t2.Goals;
        if (t2.YellowCards != null && t2.YellowCards > maxYellow2) maxYellow2 = t2.YellowCards;
        if (t2.RedCards != null && t2.RedCards > maxRed2) maxRed2 = t2.RedCards;
      }
    }
    const secs = getSeconds(m);
    if (secs != null && secs > maxSeconds) maxSeconds = secs;
    if (secs != null && secs >= maxSeconds) {
      const ls = getScoreVal(m);
      if (ls) {
        if (ls.Participant1?.Total?.Goals != null) currentScore1 = ls.Participant1.Total.Goals;
        if (ls.Participant2?.Total?.Goals != null) currentScore2 = ls.Participant2.Total.Goals;
      }
    }
  }
  const minute = Math.floor(maxSeconds / 60);
  const fid = maxStatus.FixtureId ?? maxStatus.Update?.FixtureId ?? 0;
  const cached = cache.get(fid) || {};
  return {
    FixtureId: fid,
    Participant1: cached.Participant1 ?? '',
    Participant2: cached.Participant2 ?? '',
    Score1: maxScore1,
    Score2: maxScore2,
    CurrentScore1: currentScore1,
    CurrentScore2: currentScore2,
    Yellow1: maxYellow1,
    Yellow2: maxYellow2,
    Red1: maxRed1,
    Red2: maxRed2,
    Minute: minute,
    Status: STATUS_NAMES[statusId] ?? 'LIVE',
    StatusId: statusId,
  };
}

export function MatchWatcherProvider({ children }: { children: React.ReactNode }) {
  const { client } = useTxLine();
  const { addNotification, notificationsEnabled } = useNotifications();
  const tn = useTranslations('Notifications');

  const startedRef = useRef<Set<number>>(loadSet(STORAGE_STARTED));
  const settledRef = useRef<Set<number>>(new Set());
  const cacheRef = useRef<Map<number, any>>(new Map());
  const trackedRef = useRef<Set<number>>(new Set());
  const statsRef = useRef<Map<number, FixtureStats>>(loadStatsMap());
  const enabledRef = useRef(notificationsEnabled);
  enabledRef.current = notificationsEnabled;
  const localeRef = useRef('en');
  localeRef.current = useLocale();

  const poll = useCallback(async () => {
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
          const id = f.FixtureId ?? f.fixtureId;
          if (id == null) continue;
          cacheRef.current.set(id, {
            Participant1: f.Participant1 ?? f.participant1 ?? '',
            Participant2: f.Participant2 ?? f.participant2 ?? '',
          });
          trackedRef.current.add(id);
        }
      }

      const ids = Array.from(trackedRef.current);
      if (ids.length === 0) return;

      const snapshots = await Promise.allSettled(
        ids.map((id: number) => client.getScoresSnapshot(id))
      );

      for (const r of snapshots) {
        if (r.status !== 'fulfilled') continue;
        const d = parseSnapshot(r.value, cacheRef.current);
        if (!d) continue;

        if (FINISHED_IDS.includes(d.StatusId)) {
          if (!settledRef.current.has(d.FixtureId)) {
            settledRef.current.add(d.FixtureId);
            fetch(`/api/keeper/trigger-settle?fixtureId=${d.FixtureId}`, { method: 'POST' })
              .catch(() => {});
          }
          continue;
        }

        if (!startedRef.current.has(d.FixtureId) && d.StatusId >= 2) {
          startedRef.current.add(d.FixtureId);
          saveSet(STORAGE_STARTED, startedRef.current);
          if (enabledRef.current) {
            const label = `${d.Participant1 || ''} vs ${d.Participant2 || ''}`;
            addNotification({ title: tn('matchStarted'), body: label, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('matchStarted'), body: label }),
            }).catch(() => {});
          }
        }

        const prev = statsRef.current.get(d.FixtureId);
        const locale = localeRef.current;
        const p1 = tTeam(d.Participant1 || '', locale);
        const p2 = tTeam(d.Participant2 || '', locale);
        const minute = d.Minute;

        if (prev && enabledRef.current) {
          if (d.CurrentScore1 > prev.score1) {
            addNotification({ title: tn('goal'), body: `${p1} ${d.CurrentScore1}:${d.CurrentScore2} ${p2} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('goal'), body: `${p1} ${d.CurrentScore1}:${d.CurrentScore2} ${p2} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.CurrentScore2 > prev.score2) {
            addNotification({ title: tn('goal'), body: `${p2} ${d.CurrentScore1}:${d.CurrentScore2} ${p1} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('goal'), body: `${p2} ${d.CurrentScore1}:${d.CurrentScore2} ${p1} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.CurrentScore1 < prev.score1) {
            addNotification({ title: tn('goalAnnulled'), body: `${p1} ${d.CurrentScore1}:${d.CurrentScore2} ${p2} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('goalAnnulled'), body: `${p1} ${d.CurrentScore1}:${d.CurrentScore2} ${p2} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.CurrentScore2 < prev.score2) {
            addNotification({ title: tn('goalAnnulled'), body: `${p2} ${d.CurrentScore1}:${d.CurrentScore2} ${p1} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('goalAnnulled'), body: `${p2} ${d.CurrentScore1}:${d.CurrentScore2} ${p1} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.Yellow1 > prev.yellow1) {
            addNotification({ title: tn('yellowCard'), body: `${p1} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('yellowCard'), body: `${p1} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.Yellow2 > prev.yellow2) {
            addNotification({ title: tn('yellowCard'), body: `${p2} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('yellowCard'), body: `${p2} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.Red1 > prev.red1) {
            addNotification({ title: tn('redCard'), body: `${p1} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('redCard'), body: `${p1} (${minute}')` }),
            }).catch(() => {});
          }
          if (d.Red2 > prev.red2) {
            addNotification({ title: tn('redCard'), body: `${p2} (${minute}')`, type: 'info' });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('redCard'), body: `${p2} (${minute}')` }),
            }).catch(() => {});
          }
        }

        statsRef.current.set(d.FixtureId, {
          score1: d.CurrentScore1,
          score2: d.CurrentScore2,
          yellow1: d.Yellow1,
          yellow2: d.Yellow2,
          red1: d.Red1,
          red2: d.Red2,
        });
        saveStatsMap(statsRef.current);
      }
    } catch {}
  }, [client, addNotification, tn]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [poll]);

  return <>{children}</>;
}
