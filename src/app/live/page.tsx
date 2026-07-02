"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTxLine } from '../../context/TxLineContext';
import { TxLineAuthError } from '../../txlineSkill';
import { LiveFeedItem } from '../../components/LiveFeedItem';
import { ActivityLogIcon, ReloadIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

const STATUS_NAMES: Record<number, string> = {
  1: 'NS', 2: 'H1', 3: 'HT', 4: 'H2', 5: 'F',
  6: 'WET', 7: 'ET1', 8: 'HTET', 9: 'ET2', 10: 'FET',
  11: 'WPE', 12: 'PE', 13: 'FPE', 14: 'I', 15: 'A',
  16: 'C', 17: 'TXCC', 18: 'TXCS', 19: 'P',
};

const LIVE_STATUS_IDS = new Set([2, 4, 7, 9, 12]);

function periodSeconds(statusId: number): number {
  if (statusId >= 7 && statusId <= 9) return 900;
  return 2700;
}

export default function LivePage() {
  const { client } = useTxLine();
  const t = useTranslations('Live');
  const [events, setEvents] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'no-auth'>('connecting');
  const cacheRef = useRef<Map<number, any>>(new Map());
  const trackedRef = useRef<Set<number>>(new Set());

  const parseSnapshot = useCallback((snap: any): any => {
    const msgs = Array.isArray(snap) ? snap : (snap?.messages ?? [snap]);
    const lastLive = [...msgs].reverse().find(m =>
      LIVE_STATUS_IDS.has(m.StatusId)
    );
    if (!lastLive) return null;
    const statusId = lastLive.StatusId;
    const clock = lastLive.Clock ?? {};
    const score = lastLive.Score ?? {};
    let minute = 0;
    if (clock.Seconds != null) {
      minute = Math.max(0, Math.floor((periodSeconds(statusId) - clock.Seconds) / 60));
    }
    const fid = lastLive.FixtureId ?? 0;
    const cached = cacheRef.current.get(fid) || {};
    return {
      FixtureId: fid,
      Participant1: cached.Participant1 ?? '',
      Participant2: cached.Participant2 ?? '',
      Score1: score.Participant1?.Total?.Goals ?? 0,
      Score2: score.Participant2?.Total?.Goals ?? 0,
      Minute: minute,
      Status: STATUS_NAMES[statusId] ?? 'LIVE',
      StatusId: statusId,
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
          });
        }
      }
      const now = Date.now();
      const window = 3.5 * 60 * 60 * 1000;
      const candidates = fixtures.filter(f => {
        const cid = f.CompetitionId ?? f.competitionId ?? 0;
        if (cid !== 72) return false;
        const rawStart: number = f.StartTime ?? f.startTime ?? 0;
        if (rawStart <= 0) return false;
        const startTimeMs = rawStart > 1e12 ? rawStart : rawStart * 1000;
        return Math.abs(now - startTimeMs) < window;
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
      for (let i = 0; i < snapshots.length; i++) {
        const result = snapshots[i];
        if (result.status !== 'fulfilled') continue;
        const d = parseSnapshot(result.value);
        if (!d) continue;
        const candidate = candidates[i];
        const fid = candidate.FixtureId ?? candidate.fixtureId;
        d.FixtureId = fid;
        d.Participant1 = candidate.Participant1 ?? candidate.participant1 ?? '';
        d.Participant2 = candidate.Participant2 ?? candidate.participant2 ?? '';
        trackedRef.current.add(fid);
        live.push(d);
      }
      if (live.length > 0) setEvents(live);
      setConnectionState('connected');
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
    if (connectionState !== 'connected') return;
    const poll = async () => {
      const ids = Array.from(trackedRef.current);
      if (ids.length === 0) return;
      try {
        const snapshots = await Promise.allSettled(
          ids.map((id: number) => client.getScoresSnapshot(id))
        );
        const updates: any[] = [];
        for (const r of snapshots) {
          if (r.status !== 'fulfilled') continue;
          const d = parseSnapshot(r.value);
          if (d) updates.push(d);
        }
        if (updates.length === 0) return;
        setEvents(prev => {
          const next = [...prev];
          for (const u of updates) {
            const idx = next.findIndex(e => e.FixtureId === u.FixtureId);
            if (idx >= 0) next[idx] = u;
          }
          return next.slice(0, 50);
        });
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [connectionState, client, parseSnapshot]);

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
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn">
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
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
