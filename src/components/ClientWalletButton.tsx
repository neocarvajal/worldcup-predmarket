"use client";

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
);

export const ClientWalletButton: React.FC = () => {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  if (!mounted) {
    return (
      <div className="rounded-full px-4 py-1.5 text-xs animate-pulse" style={{ background: 'var(--bg-surface)' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {publicKey && (
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{short}</span>
        </div>
      )}
      <WalletMultiButton />
    </div>
  );
};
