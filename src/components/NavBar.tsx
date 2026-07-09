"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { BellIcon, Cross2Icon } from '@radix-ui/react-icons';
import { ClientWalletButton } from './ClientWalletButton';
import { LanguageToggle } from './LanguageToggle';
import { useNotifications } from '../context/NotificationContext';
import { getUsdtBalance } from '../lib/txlineProgram';

export const NavBar: React.FC = () => {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const t = useTranslations('NavBar');
  const isLive = pathname === '/live';
  const isLanding = pathname === '/';
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [usdtBalance, setUsdtBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) { setUsdtBalance(null); return; }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const bal = await getUsdtBalance(connection, publicKey);
        if (!cancelled) setUsdtBalance(bal);
      } catch { if (!cancelled) setUsdtBalance(0); }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicKey, connection]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [dropdownOpen]);

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(8,8,13,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2.5 gap-2">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(220,235,2,0.35)]"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            WC
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('brand')}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {usdtBalance != null && (
            <Link
              href="/faucet"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 hover:opacity-70 active:scale-95"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <span style={{ color: 'var(--success)' }}>●</span>
              {usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>USDT</span>
            </Link>
          )}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:opacity-70 active:scale-95"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              aria-label={t('notifications')}
            >
              <BellIcon width={16} height={16} style={{ color: 'var(--text-primary)' }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {dropdownOpen && (
              // <div className="absolute left-1/2 -translate-x-1/2 top-11 z-50">
              <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 pointer-events-none">
                <div
                  className="w-[90vw] max-w-[360px] rounded-2xl overflow-hidden animate-scaleIn origin-top pointer-events-auto"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span className="text-xs font-semibold">{t('notifications')}</span>
                    {notifications.length > 0 && (
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] font-semibold transition-all hover:opacity-70"
                            style={{ color: 'var(--accent)' }}
                          >
                            {t('markAllRead')}
                          </button>
                        )}
                        <button
                          onClick={clearAll}
                          className="text-[10px] font-semibold transition-all hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {t('clearAll')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-10">
                        <BellIcon width={24} height={24} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-2 opacity-40" />
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('noNotifications')}</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => { markAsRead(n.id); setDropdownOpen(false); if (n.path) router.push(n.path); else if (n.escrowPubkey) router.push('/portfolio'); }}
                          className="w-full text-left px-4 py-3 transition-all duration-150 hover:opacity-80 active:opacity-60"
                          style={{
                            background: n.read ? 'transparent' : 'var(--accent-dim)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {!n.read && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: 'var(--accent)' }}
                                  />
                                )}
                                <span className="text-xs font-semibold truncate">{n.title}</span>
                              </div>
                              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {n.body}
                              </p>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {new Date(n.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <LanguageToggle />
          {isLanding && !publicKey && (
            <Link
              href="/markets"
              className="btn-primary !py-2 !px-4 !text-sm"
            >
              {t('enter')}
            </Link>
          )}
          <ClientWalletButton />
        </div>
      </div>
    </nav>
  );
};
