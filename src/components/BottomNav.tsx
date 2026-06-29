"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  GlobeIcon,
  ActivityLogIcon,
  TokensIcon,
  StackIcon,
  PersonIcon,
  LockClosedIcon,
  CopyIcon,
  ExitIcon,
  CheckCircledIcon,
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
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const walletStr = publicKey?.toBase58() || '';
  const shortWallet = walletStr ? `${walletStr.slice(0, 4)}...${walletStr.slice(-4)}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleWalletClick = () => {
    if (!publicKey) {
      setVisible(true);
    } else {
      setDropdownOpen(prev => !prev);
    }
  };

  const handleDisconnect = () => {
    setDropdownOpen(false);
    disconnect();
  };

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

        {/* Wallet button */}
        <button
          onClick={handleWalletClick}
          className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
          style={{ minWidth: 56 }}
        >
          {publicKey && (
            <span
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--success)',
                boxShadow: '0 0 6px rgba(34,197,94,0.5)',
              }}
            />
          )}
          <div
            className="flex items-center justify-center rounded-xl transition-all duration-200"
            style={{
              width: 40,
              height: 32,
              background: publicKey ? 'rgba(34,197,94,0.08)' : 'transparent',
            }}
          >
            {publicKey ? (
              <PersonIcon width={20} height={20} style={{ color: 'var(--success)' }} />
            ) : (
              <LockClosedIcon width={18} height={18} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <span
            className="text-[10px] font-semibold leading-none tracking-tight"
            style={{ color: publicKey ? 'var(--success)' : 'var(--text-muted)' }}
          >
            {publicKey ? shortWallet : 'Conectar'}
          </span>
        </button>
      </div>

      {/* Wallet dropdown */}
      {dropdownOpen && publicKey && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 rounded-2xl p-2 animate-scaleIn"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Address */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--success)' }}
            />
            <span className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {walletStr.slice(0, 8)}...{walletStr.slice(-6)}
            </span>
          </div>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {copied ? (
              <CheckCircledIcon width={15} height={15} style={{ color: 'var(--success)' }} />
            ) : (
              <CopyIcon width={15} height={15} />
            )}
            {copied ? 'Copiado' : 'Copiar dirección'}
          </button>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ExitIcon width={15} height={15} />
            Desconectar
          </button>
        </div>
      )}
    </nav>
  );
};
