"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircledIcon, CrossCircledIcon, TimerIcon, UpdateIcon, Share2Icon, ReloadIcon } from '@radix-ui/react-icons';

interface PositionCardProps {
  fixtureName: string;
  selection: string;
  amount: number;
  odds: number;
  payout: number;
  status: 'active' | 'won' | 'lost' | 'cancelled' | 'pending';
  expiry?: number;
  onSettle?: () => void;
  settling?: boolean;
}

function ShareOnX({ fixtureName, amount, odds, t }: { fixtureName: string; amount: number; odds: number; t: (key: string) => string }) {
  const txt = encodeURIComponent(
    `${t('won')} ${amount} USDT en ${fixtureName} (${odds.toFixed(2)}x) 🏆\n\nPredicciones on-chain en Solana 🟣`
  );
  return (
    <a
      href={`https://twitter.com/intent/tweet?text=${txt}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold transition-all duration-200 hover:opacity-70 active:scale-95"
      style={{ color: 'var(--accent)' }}
    >
      <Share2Icon width={14} height={14} />
      {t('share')}
    </a>
  );
}

const statusConfig: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  active: { icon: TimerIcon, color: 'var(--accent)', bg: 'var(--accent-dim)' },
  won: { icon: CheckCircledIcon, color: 'var(--success)', bg: 'rgba(34,197,94,0.08)' },
  lost: { icon: CrossCircledIcon, color: 'var(--danger)', bg: 'rgba(255,68,68,0.08)' },
  cancelled: { icon: CrossCircledIcon, color: 'var(--text-muted)', bg: 'var(--bg-surface)' },
  pending: { icon: UpdateIcon, color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' },
};

function CountdownSmall({ target }: { target: Date }) {
  const t = useTranslations('PositionCard');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now;
  if (diff <= 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: 'rgba(245,158,11,0.1)',
          color: 'var(--warning)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--warning)' }} />
        {t('awaitingSettlement')}
      </span>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums"
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

export const PositionCard: React.FC<PositionCardProps> = ({
  fixtureName, selection, amount, odds, payout, status, expiry,
  onSettle, settling,
}) => {
  const t = useTranslations('PositionCard');
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{fixtureName}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === 'active' && expiry && <CountdownSmall target={new Date(expiry)} />}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.color}22`,
            }}
          >
            <StatusIcon width={12} height={12} />
            {t(status)}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-[10px] mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{t('selection')}</div>
          <div className="text-xs font-semibold truncate">{selection}</div>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-[10px] mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{t('amount')}</div>
          <div className="text-xs font-bold">{amount} USDT</div>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-[10px] mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{t('odds')}</div>
          <div className="text-xs font-bold">{odds.toFixed(2)}x</div>
        </div>
      </div>

      {/* Bottom row */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('potentialPayout')}</span>
        <div className="flex items-center gap-3">
          {(status === 'won' || status === 'pending') && (
            <ShareOnX fixtureName={fixtureName} amount={amount} odds={odds} t={t} />
          )}
          {status === 'pending' && onSettle && (
            <button
              onClick={onSettle}
              disabled={settling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 active:scale-95"
              style={{
                background: settling ? 'var(--bg-surface)' : 'var(--accent)',
                color: settling ? 'var(--text-muted)' : '#000',
                border: `1px solid ${settling ? 'var(--border)' : 'var(--accent)'}`,
              }}
            >
              {settling ? (
                <ReloadIcon width={12} height={12} className="animate-spin" />
              ) : (
                <UpdateIcon width={12} height={12} />
              )}
              {settling ? t('settling') : t('settle')}
            </button>
          )}
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: status === 'won' ? 'var(--success)' :
                     status === 'lost' ? 'var(--danger)' :
                     'var(--text-primary)',
            }}
          >
            {payout.toFixed(2)} USDT
          </span>
        </div>
      </div>
    </div>
  );
};
