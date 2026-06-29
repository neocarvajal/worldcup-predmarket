"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GlobeIcon,
  ActivityLogIcon,
  TokensIcon,
  StackIcon,
  PersonIcon,
} from '@radix-ui/react-icons';

const tabs = [
  { href: '/markets', label: 'Partidos', icon: GlobeIcon },
  { href: '/live', label: 'En Vivo', icon: ActivityLogIcon },
  { href: '/faucet', label: 'Faucet', icon: TokensIcon },
  { href: '/portfolio', label: 'Mis Bets', icon: StackIcon },
  { href: '/profile', label: 'Perfil', icon: PersonIcon },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--nav-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="max-w-lg mx-auto flex items-center justify-around px-2 pt-1"
        style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
              style={{ minWidth: 56 }}
            >
              {active && (
                <span
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ring-1"
                  style={{
                    background: 'var(--accent)',
                    boxShadow: '0 0 6px var(--accent-glow)',
                  }}
                />
              )}
              <div
                className="flex items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  width: 40,
                  height: 32,
                  background: active ? 'var(--accent-dim)' : 'transparent',
                }}
              >
                <Icon
                  width={20}
                  height={20}
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'color 0.2s, transform 0.2s',
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold leading-none tracking-tight transition-colors duration-200"
                style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
