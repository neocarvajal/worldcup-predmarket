import React from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

const sectionKeys = [
  'whatIs',
  'wallet',
  'txline',
  'betting',
  'bettingModes',
  'payout',
  'settlement',
  'liveTracking',
  'notifications',
  'portfolio',
  'profile',
  'faucet',
  'tech',
  'security',
] as const;

export default function DocsPage() {
  const t = useTranslations('Docs');
  return (
    <>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/images/landing-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.25) saturate(0.7)',
          }}
        />
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:opacity-70 active:scale-95"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <ArrowLeftIcon width={16} height={16} style={{ color: 'var(--text-primary)' }} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {sectionKeys.map((key, i) => {
          const title = t(`sections.${key}.title`);
          const content = t.raw(`sections.${key}.content`);
          return (
            <div
              key={key}
              className="rounded-2xl p-5 animate-slideUp"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
                animationDelay: `${i * 0.06}s`,
                animationFillMode: 'backwards',
              }}
            >
              <h2 className="text-sm font-bold mb-2 tracking-tight">{title}</h2>
              {Array.isArray(content) ? (
                <ul className="space-y-1.5">
                  {content.map((item: string, j: number) => (
                    <li key={j} className="text-xs leading-relaxed pl-3" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent-dim)' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{content}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
