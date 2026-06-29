"use client";

import React from 'react';

interface OddsButtonProps {
  name: string;
  odds: number;
  selected?: boolean;
  onClick?: () => void;
  flag?: string;
}

export const OddsButton: React.FC<OddsButtonProps> = ({ name, odds, selected, onClick, flag }) => (
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
      }}
    >
      {flag || '🏳️'}
    </div>
    <span
      className="text-[11px] font-semibold truncate max-w-[90px] leading-tight"
      style={{ color: 'var(--text-primary)' }}
    >
      {name}
    </span>
    <span
      className="text-base font-bold tabular-nums leading-none"
      style={{ color: selected ? 'var(--accent)' : 'var(--text-primary)' }}
    >
      {odds.toFixed(2)}
    </span>
  </button>
);
