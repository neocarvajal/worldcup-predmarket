"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ClientWalletButton } from './ClientWalletButton';

export const NavBar: React.FC = () => {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const isLive = pathname === '/live';
  const isLanding = pathname === '/';

  return (
    <nav
      className="sticky top-0 z-30"
      style={{
        background: 'rgba(8,8,13,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(220,235,2,0.35)]"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            WC
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            PredMarket
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 ml-1">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse-dot" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-danger">Live</span>
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          {isLanding && !publicKey && (
            <Link
              href="/markets"
              className="btn-primary !py-2 !px-4 !text-sm"
            >
              Entrar
            </Link>
          )}
          <ClientWalletButton />
        </div>
      </div>
    </nav>
  );
};
