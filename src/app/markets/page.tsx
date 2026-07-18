"use client";

/**
 * Markets listing page
 * =====================
 * Shell page that renders the MarketList component (client-side) along
 * with a SubscriptionBanner for users who haven't activated TxLINE.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { GlobeIcon } from '@radix-ui/react-icons';
import { SubscriptionBanner } from '../../components/SubscriptionBanner';
import { bgImage } from '../../lib/bgImage';

const MarketList = dynamic(() => import('../../components/MarketList').then(m => ({ default: m.MarketList })), { ssr: false });

export default function MarketsPage() {
  const t = useTranslations('Markets');
  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      {/* Background image */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            ...bgImage('trophy-bg'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.25) saturate(0.7)',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--accent-dim)',
                boxShadow: '0 0 20px rgba(220,235,2,0.08)',
              }}
            >
              <GlobeIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid rgba(220,235,2,0.15)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            World Cup
          </span>
        </div>

        <SubscriptionBanner />
        <MarketList />
      </div>
    </div>
  );
}
