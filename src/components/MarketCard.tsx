"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { getFlag } from '../lib/flags';
import { tTeam } from '../lib/teams';
import { ChevronRightIcon } from '@radix-ui/react-icons';

interface MarketCardProps {
  fixtureId: number;
  participant1: string;
  participant2: string;
  startTime: string | number;
  competition?: string;
  odds?: { home: number; draw: number; away: number };
}

function parseDate(v: string | number): Date {
  const n = Number(v);
  if (!isNaN(n)) {
    return n > 1e12 ? new Date(n) : new Date(n * 1000);
  }
  return new Date(v);
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(Date.now());
  const t = useTranslations('MarketCard');
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now;
  if (diff <= 0) {
    const finished = diff < -2 * 60 * 60 * 1000;
    if (finished) {
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {t('finished')}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: 'rgba(34,197,94,0.1)',
          color: 'var(--success)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--success)' }} />
        {t('live')}
      </span>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums"
      style={{
        background: 'var(--bg-surface)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}
    >
      {d > 0 ? `${d}d ` : ''}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function formatDate(date: Date, months: string[]): string {
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const MarketCard: React.FC<MarketCardProps> = ({
  fixtureId, participant1, participant2, startTime, competition, odds,
}) => {
  const startDate = parseDate(startTime);
  const flag1 = getFlag(participant1);
  const flag2 = getFlag(participant2);
  const locale = useLocale();
  const show1 = tTeam(participant1, locale);
  const show2 = tTeam(participant2, locale);
  const t = useTranslations('MarketCard');
  const months = [
    t('monthShort.1'), t('monthShort.2'), t('monthShort.3'), t('monthShort.4'),
    t('monthShort.5'), t('monthShort.6'), t('monthShort.7'), t('monthShort.8'),
    t('monthShort.9'), t('monthShort.10'), t('monthShort.11'), t('monthShort.12'),
  ];

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);
  const [apiFinished, setApiFinished] = useState(false);
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    fetch(`/api/keeper/fixture-status?fixtureId=${fixtureId}`).then(r => r.json()).then((data: any) => {
      if (data && typeof data.finished === 'boolean') setApiFinished(data.finished);
    }).catch(() => {});
  }, [fixtureId]);
  const finished = apiFinished || now > startDate.getTime() + 2 * 60 * 60 * 1000;

  if (finished) {
    return (
      <div className="block opacity-60 pointer-events-none">
        <div
          className="rounded-2xl p-5 transition-all duration-300"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {competition && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(220,235,2,0.15)',
                  }}
                >
                  {competition}
                </span>
              )}
            </div>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {t('finished')}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border)' }}
              >
                <span className="text-lg leading-none">{flag1 || '🏳️'}</span>
              </div>
              <span className="text-sm font-semibold truncate">{show1}</span>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>VS</span>
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <span className="text-sm font-semibold truncate">{show2}</span>
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border)' }}
              >
                <span className="text-lg leading-none">{flag2 || '🏳️'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {formatDate(startDate, months)}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t('finished')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/market/${fixtureId}`} className="block group">
      <div
        className="rounded-2xl p-5 transition-all duration-300"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Top row: competition badge + countdown */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {competition && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(220,235,2,0.15)',
                }}
              >
                {competition}
              </span>
            )}
          </div>
          <Countdown target={startDate} />
        </div>

        {/* Teams row */}
        <div className="flex items-center gap-3 mb-4">
          {/* Team 1 */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border)',
              }}
            >
              <span className="text-lg leading-none">{flag1 || '🏳️'}</span>
            </div>
            <span className="text-sm font-semibold truncate">{show1}</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center shrink-0">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: 'var(--text-muted)' }}
            >
              VS
            </span>
          </div>

          {/* Team 2 */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold truncate">{show2}</span>
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border)',
              }}
            >
              <span className="text-lg leading-none">{flag2 || '🏳️'}</span>
            </div>
          </div>
        </div>

        {/* Bottom: date + odds/cta */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {formatDate(startDate, months)}
          </span>
          <div className="flex items-center gap-2">
            {odds && (
              <div className="flex items-center gap-1.5">
                {(['home', 'draw', 'away'] as const).map((key, i) => (
                  <div
                    key={key}
                    className="px-2.5 py-1 rounded-lg text-center transition-all duration-200"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {odds[key].toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 group-hover:bg-accent-dim"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronRightIcon width={16} height={16} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
