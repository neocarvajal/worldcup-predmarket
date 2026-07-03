"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { useTxLine } from './TxLineContext';
import { useNotifications } from './NotificationContext';
import { useTranslations } from 'next-intl';

const FINISHED_IDS = [5, 10, 13];
const DISPLAY_STATUS_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const STATUS_NAMES: Record<number, string> = {
  1: 'NS', 2: 'H1', 3: 'HT', 4: 'H2', 5: 'F',
  6: 'WET', 7: 'ET1', 8: 'HTET', 9: 'ET2', 10: 'FET',
  11: 'WPE', 12: 'PE', 13: 'FPE', 14: 'I', 15: 'A',
  16: 'C', 17: 'TXCC', 18: 'TXCS', 19: 'P',
};
const STORAGE_KEY = 'match-watcher:started';

function loadNotified(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveNotified(ids: Set<number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids))); } catch {}
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
  for (const m of msgs) {
    const s = getScoreVal(m);
    if (s) {
      const g1 = s.Participant1?.Total?.Goals;
      const g2 = s.Participant2?.Total?.Goals;
      if (g1 != null && g1 > maxScore1) maxScore1 = g1;
      if (g2 != null && g2 > maxScore2) maxScore2 = g2;
    }
    const secs = getSeconds(m);
    if (secs != null && secs > maxSeconds) maxSeconds = secs;
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
    Minute: minute,
    Status: STATUS_NAMES[statusId] ?? 'LIVE',
    StatusId: statusId,
  };
}

export function MatchWatcherProvider({ children }: { children: React.ReactNode }) {
  const { client } = useTxLine();
  const { addNotification } = useNotifications();
  const tn = useTranslations('Notifications');

  const startedRef = useRef<Set<number>>(loadNotified());
  const settledRef = useRef<Set<number>>(new Set());
  const cacheRef = useRef<Map<number, any>>(new Map());
  const trackedRef = useRef<Set<number>>(new Set());

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
          saveNotified(startedRef.current);
          const label = `${d.Participant1 || ''} vs ${d.Participant2 || ''}`;
          addNotification({ title: tn('matchStarted'), body: label, type: 'info' });
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixtureId: d.FixtureId, title: tn('matchStarted'), body: label }),
          }).catch(() => {});
        }
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
