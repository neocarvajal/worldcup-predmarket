"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAutoSubscribe } from '../hooks/useAutoSubscribe';
import { GlobeIcon, Cross2Icon, UpdateIcon, CheckCircledIcon, ReloadIcon } from '@radix-ui/react-icons';

export const SubscriptionBanner: React.FC = () => {
  const { publicKey } = useWallet();
  const { state, error, subscribe } = useAutoSubscribe();
  const t = useTranslations('SubscriptionBanner');
  const [dismissed, setDismissed] = React.useState(false);

  if (!publicKey || dismissed || state === 'done') return null;

  if (state === 'error') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-xs animate-slideDown"
        style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.12)' }}
      >
        <span style={{ color: 'var(--danger)' }}>⚠</span>
        <span className="flex-1" style={{ color: 'var(--text-muted)' }}>
          {error || t('errorChecking')}
        </span>
        <button
          onClick={subscribe}
          className="text-xs font-semibold px-3 py-1 rounded-full transition-all active:scale-95"
          style={{ background: 'rgba(255,68,68,0.1)', color: 'var(--danger)' }}
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (state === 'checking') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-xs animate-slideDown"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <ReloadIcon width={14} height={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-muted)' }}>{t('checking')}</span>
      </div>
    );
  }

  if (state === 'subscribing') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-xs animate-slideDown"
        style={{ background: 'var(--accent-dim)', border: '1px solid rgba(220,235,2,0.15)' }}
      >
        <UpdateIcon width={14} height={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>{t('activating')}</span>
      </div>
    );
  }

  if (state === 'activating') {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-xs animate-slideDown"
        style={{ background: 'var(--accent-dim)', border: '1px solid rgba(220,235,2,0.15)' }}
      >
        <UpdateIcon width={14} height={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>{t('linkingWallet')}</span>
      </div>
    );
  }

  // state === 'needed'
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-xs animate-slideDown"
      style={{ background: 'var(--accent-dim)', border: '1px solid rgba(220,235,2,0.15)' }}
    >
      <GlobeIcon width={14} height={14} style={{ color: 'var(--accent)' }} />
      <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>
        {t('cta')}
      </span>
      <button
        onClick={subscribe}
        className="text-xs font-bold px-3 py-1 rounded-full transition-all duration-200 active:scale-95"
        style={{ background: 'var(--accent)', color: '#000' }}
      >
        {t('activate')}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex items-center justify-center rounded-full transition-all active:scale-95"
        style={{ width: 24, height: 24, color: 'var(--text-muted)' }}
      >
        <Cross2Icon width={12} height={12} />
      </button>
    </div>
  );
};
