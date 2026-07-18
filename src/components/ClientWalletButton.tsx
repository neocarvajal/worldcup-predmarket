"use client";

/**
 * ClientWalletButton — Wallet connection button
 * ===============================================
 * Dynamically imports WalletMultiButton from @solana/wallet-adapter-react-ui
 * with SSR disabled. Shows a loading skeleton ("Cargando...") until mounted
 * to prevent hydration mismatches.
 */

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
);

export const ClientWalletButton: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="rounded-full px-4 py-1.5 text-xs animate-pulse" style={{ background: 'var(--bg-surface)' }}>
        Cargando...
      </div>
    );
  }

  return <WalletMultiButton />;
};
