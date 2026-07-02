"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { getFlag } from '../lib/flags';

const TXLINE_PLAYING = new Set(['H1', 'H2', 'ET1', 'ET2', 'PE']);
const TXLINE_PAUSED = new Set(['HT', 'HTET', 'WET', 'WPE']);
const TXLINE_FINISHED = new Set(['F', 'FET', 'FPE']);

interface LiveFeedItemProps {
  fixtureId: number;
  participant1: string;
  participant2: string;
  score1: number;
  score2: number;
  minute?: number;
  status: string;
}

export const LiveFeedItem: React.FC<LiveFeedItemProps> = ({
  fixtureId, participant1, participant2, score1, score2, minute, status,
}) => {
  const t = useTranslations('LiveFeedItem');
  const s = status?.toUpperCase() || '';
  const isPlaying = TXLINE_PLAYING.has(s);
  const isPaused = TXLINE_PAUSED.has(s);
  const isFinished = TXLINE_FINISHED.has(s);
  const isAbnormal = ['I', 'A', 'C', 'TXCC', 'TXCS'].includes(s);
  const isPostponed = s === 'P';
  const isNotStarted = s === 'NS' || (!s || s === '');

  const flag1 = getFlag(participant1);
  const flag2 = getFlag(participant2);
  const statusLabel = t(s.toLowerCase());

  function Badge() {
    if (isPlaying) {
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
          {statusLabel}
        </span>
      );
    }
    if (isPaused) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(245,158,11,0.1)',
            color: 'var(--warning)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warning)' }} />
          {statusLabel}
        </span>
      );
    }
    if (isFinished) {
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {statusLabel}
        </span>
      );
    }
    if (s === 'I') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(245,158,11,0.1)',
            color: 'var(--warning)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--warning)' }} />
          {statusLabel}
        </span>
      );
    }
    if (s === 'A') {
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(255,68,68,0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(255,68,68,0.2)',
          }}
        >
          {statusLabel}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        {statusLabel}
      </span>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top row: competition + status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid rgba(220,235,2,0.15)',
            }}
          >
            {t('worldCup')}
          </span>
        </div>
        <Badge />
      </div>

      {/* Teams + score row */}
      <div className="flex items-center gap-3 mb-4">
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
          <span className="text-sm font-semibold truncate">{participant1}</span>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-primary)' }}
            >
              {score1}
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-primary)' }}
            >
              {score2}
            </span>
          </div>
          {isPlaying && minute != null && minute > 0 && (
            <span className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-dot" />
              <span className="text-[10px] font-medium text-danger">{minute}&apos;</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate">{participant2}</span>
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

      <div className="flex items-center justify-between">
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          #{fixtureId}
        </span>
      </div>
    </div>
  );
};
