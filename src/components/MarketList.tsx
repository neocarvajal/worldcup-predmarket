"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTxLine, TxLineAuthError } from '../context/TxLineContext';
import { MarketCard } from './MarketCard';
import { GlobeIcon, ReloadIcon } from '@radix-ui/react-icons';

interface Fixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  Participant1: string;
  Participant2: string;
}

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton h-4 w-20 rounded-full" />
        <div className="skeleton h-4 w-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-11 h-11 rounded-full" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
        <div className="skeleton h-3 w-6 rounded" />
        <div className="flex items-center gap-2.5">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton w-11 h-11 rounded-full" />
        </div>
      </div>
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  );
}

export const MarketList: React.FC = () => {
  const { client } = useTxLine();
  const t = useTranslations('MarketList');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const FINISHED_IDS = [5, 10, 13];

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await client.getFixtures();
      const all: any[] = Array.isArray(data) ? data : data?.fixtures ?? data?.Fixtures ?? [];
      const worldCup = all.filter((f: any) => (f.CompetitionId ?? f.competitionId ?? 0) === 72);

      const now = Date.now();
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      const candidates = worldCup.filter((f: any) => f.StartTime > now - THREE_HOURS_MS);

      const getStatusId = (m: any) => m.StatusId ?? m.Update?.StatusId ?? 0;

      const results = await Promise.all(
        candidates.map(async (f: any) => {
          const maxDuration = 2.25 * 60 * 60 * 1000;
          try {
            const data = await client.getScoresSnapshot(f.FixtureId);
            const msgs = Array.isArray(data) ? data : (data?.messages ?? [data]);
            const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const statusId = last ? getStatusId(last) : 0;
            const statusFinished = FINISHED_IDS.includes(statusId);
            const timeFinished = f.StartTime + maxDuration < now;
            return { ...f, _finished: statusFinished || timeFinished };
          } catch {
            return { ...f, _finished: f.StartTime + maxDuration < now };
          }
        }),
      );
      setFixtures(results.filter((f: any) => !f._finished));
    } catch (e: any) {
      if (e instanceof TxLineAuthError || e?.response?.status === 403) {
        setError('auth');
      } else {
        setError('network');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [client]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-scaleIn" style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'backwards' }}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    );
  }

  if (error === 'auth') {
    return (
      <div className="text-center py-16 animate-scaleIn">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'var(--accent-dim)' }}
        >
          <GlobeIcon width={28} height={28} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="text-lg font-semibold mb-2">{t('subscriptionRequired')}</h2>
        <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {t('needActivate')}
        </p>
        <div
          className="rounded-2xl p-4 text-left text-xs space-y-2 max-w-sm mx-auto"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('steps')}:</p>
          <p style={{ color: 'var(--text-muted)' }}>1. {t('step1')}</p>
          <p style={{ color: 'var(--text-muted)' }}>2. {t('step2')}</p>
          <p style={{ color: 'var(--text-muted)' }}>3. {t('step3')}</p>
        </div>
      </div>
    );
  }

  if (error === 'network') {
    return (
      <div className="text-center py-16 animate-scaleIn">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'rgba(255,68,68,0.1)' }}
        >
          <GlobeIcon width={28} height={28} style={{ color: 'var(--danger)' }} />
        </div>
        <h2 className="text-lg font-semibold mb-2">{t('connectionError')}</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('couldNotLoad')}
        </p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--accent)',
            color: '#000',
          }}
        >
          <ReloadIcon width={16} height={16} />
          {t('retry')}
        </button>
      </div>
    );
  }

  if (fixtures.length === 0 && !loading) {
    return (
      <div className="text-center py-16 animate-scaleIn">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <GlobeIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h2 className="text-lg font-semibold mb-2">{t('noMatches')}</h2>
        <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {t('noMatchesFound')}
        </p>
      </div>
    );
  }

  const now = Date.now();
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const upcoming = fixtures.filter(
    (f) => f.StartTime > now - THREE_HOURS_MS
  );
  const sorted = [...upcoming].sort((a, b) => a.StartTime - b.StartTime);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-muted)' }}
        >
          {sorted.length > 0 ? t('upcomingMatches') : t('noMatches')}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {sorted.length} {sorted.length === 1 ? t('match') : t('matches')}
        </span>
      </div>
      {sorted.map((f, idx) => (
        <div
          key={f.FixtureId}
          className="animate-slideUp"
          style={{ animationDelay: `${idx * 0.06}s`, animationFillMode: 'backwards' }}
        >
          <MarketCard
            fixtureId={f.FixtureId}
            participant1={f.Participant1}
            participant2={f.Participant2}
            startTime={String(f.StartTime)}
            competition={f.Competition}
          />
        </div>
      ))}
    </div>
  );
};
