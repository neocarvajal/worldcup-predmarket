"use client";

import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';

interface OddsButtonProps {
  name: string;
  odds: number;
  selected?: boolean;
  onClick?: () => void;
  flag?: string;
  direction?: 'up' | 'down' | null;
  pctChange?: number;
  live?: boolean;
}

export const OddsButton: React.FC<OddsButtonProps> = ({ name, odds, selected, onClick, flag, direction, pctChange, live }) => (
  <button
    className="odds-pill"
    onClick={onClick}
    style={selected ? {
      background: 'linear-gradient(135deg, rgba(220,235,2,0.2), rgba(220,235,2,0.06))',
      borderColor: 'var(--accent)',
      boxShadow: '0 0 24px rgba(220,235,2,0.15)',
      transform: 'translateY(-2px)',
    } : undefined}
  >
    <div
      className="flex items-center justify-center text-xl mx-auto mb-1.5"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: '2px solid var(--border)',
        position: 'relative',
      }}
    >
      {flag || '🏳️'}
      {live && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 8px var(--success)',
          }}
          className="animate-pulse-dot"
        />
      )}
    </div>
    <span
      className="text-[11px] font-semibold truncate max-w-[90px] leading-tight"
      style={{ color: 'var(--text-primary)' }}
    >
      {name}
    </span>
    <span
      className="text-base font-bold tabular-nums leading-none inline-flex items-center gap-0.5"
      style={{ color: selected ? 'var(--accent)' : 'var(--text-primary)' }}
    >
      {odds.toFixed(2)}
      {direction === 'up' && (
        <ChevronUpIcon width={14} height={14} style={{ color: 'var(--success)' }} />
      )}
      {direction === 'down' && (
        <ChevronDownIcon width={14} height={14} style={{ color: 'var(--danger)' }} />
      )}
    </span>
    {pctChange != null && Math.abs(pctChange) > 0.1 && (
      <span
        className="text-[9px] font-semibold"
        style={{ color: direction === 'up' ? 'var(--success)' : 'var(--danger)' }}
      >
        {direction === 'up' ? '+' : ''}{pctChange.toFixed(1)}%
      </span>
    )}
  </button>
);
