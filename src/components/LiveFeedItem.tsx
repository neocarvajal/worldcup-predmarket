"use client";

import React from 'react';

const TXLINE_LIVE = new Set(['H1', 'H2', 'HT', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
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
  const s = status?.toUpperCase() || '';
  const isLive = TXLINE_LIVE.has(s);
  const isFinished = TXLINE_FINISHED.has(s);

  return (
    <div className="card animate-slideUp" key={fixtureId}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 text-right">
          <span className="text-sm font-medium">{participant1}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: isLive ? 'var(--accent)' : 'var(--text-primary)' }}>
              {score1}
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: isLive ? 'var(--accent)' : 'var(--text-primary)' }}>
              {score2}
            </span>
          </div>
          {isLive && minute != null && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-dot" />
              <span className="text-[10px] font-medium text-danger">{minute}&apos;</span>
            </span>
          )}
          {isFinished && (
            <span className="badge badge-muted text-[10px]">Finalizado</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{participant2}</span>
        </div>
      </div>
    </div>
  );
};
