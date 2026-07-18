"use client";

/**
 * LiveFeedItem — Live match scoreboard card
 * ===========================================
 * Displays team names with flags, score, match minute, and status badge
 * (H1/HT/H2/F/ET/PE). Shows a green pulse animation for in-play matches.
 * "View events" button opens the event timeline overlay from live/page.tsx.
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { getFlag } from '../lib/flags';
import { tTeam } from '../lib/teams';

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
  onViewEvents: () => void;
}

export const LiveFeedItem: React.FC<LiveFeedItemProps> = ({
  fixtureId, participant1, participant2, score1, score2, minute, status, onViewEvents,
}) => {
  const t = useTranslations('LiveFeedItem');
  const locale = useLocale();
  const s = status?.toUpperCase() || '';
  const isPlaying = TXLINE_PLAYING.has(s);
  const isPaused = TXLINE_PAUSED.has(s);
  const isFinished = TXLINE_FINISHED.has(s);

  const flag1 = getFlag(participant1);
  const flag2 = getFlag(participant2);
  const show1 = tTeam(participant1, locale);
  const show2 = tTeam(participant2, locale);
  const statusLabel = t(s.toLowerCase());

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
        {isPlaying ? (
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
        ) : (
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
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-3 mb-5">
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
          {minute != null && minute > 0 && !isFinished && (
            <span className="flex items-center gap-1 mt-0.5">
              {isPlaying && (
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-dot" />
              )}
              <span
                className="text-[10px] font-medium"
                style={{ color: isPlaying ? 'var(--danger)' : 'var(--text-muted)' }}
              >
                {t('minute', { m: minute })}
              </span>
            </span>
          )}
        </div>

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

      {/* Resumen button + fixture ID */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onViewEvents}
          className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--accent)',
            color: '#000',
          }}
        >
          {t('summary')}
        </button>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          #{fixtureId}
        </span>
      </div>
    </div>
  );
};
