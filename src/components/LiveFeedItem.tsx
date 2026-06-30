"use client";

import React from 'react';
import { getFlag } from '../lib/flags';

const TXLINE_LIVE = new Set(['H1', 'H2', 'HT', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
const TXLINE_FINISHED = new Set(['F', 'FET', 'FPE']);

const STATUS_LABELS: Record<string, string> = {
  H1: '1er Tiempo',
  H2: '2do Tiempo',
  HT: 'Medio Tiempo',
  ET1: '1er Tiempo Extra',
  HTET: 'Medio Tiempo Extra',
  ET2: '2do Tiempo Extra',
  PE: 'Penales',
  WET: 'Esperando Tiempo Extra',
  WPE: 'Esperando Penales',
  F: 'Finalizado',
  FET: 'Finalizado T.E.',
  FPE: 'Finalizado Penales',
};

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
  const s = status?.toUpperCase() || '';
  const isLive = TXLINE_LIVE.has(s);
  const isFinished = TXLINE_FINISHED.has(s);
  const flag1 = getFlag(participant1);
  const flag2 = getFlag(participant2);
  const statusLabel = STATUS_LABELS[s] || s;

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top row: competition placeholder + status badge */}
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
            World Cup
          </span>
        </div>

        {isFinished ? (
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
        ) : (
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
        )}
      </div>

      {/* Teams + score row */}
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
          <span className="text-sm font-semibold truncate">{participant1}</span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: isLive ? 'var(--accent)' : 'var(--text-primary)' }}
            >
              {score1}
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: isLive ? 'var(--accent)' : 'var(--text-primary)' }}
            >
              {score2}
            </span>
          </div>
          {isLive && minute != null && (
            <span className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-dot" />
              <span className="text-[10px] font-medium text-danger">{minute}&apos;</span>
            </span>
          )}
        </div>

        {/* Team 2 */}
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

      {/* Bottom row: fixture ID + action */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          #{fixtureId}
        </span>
      </div>
    </div>
  );
};
