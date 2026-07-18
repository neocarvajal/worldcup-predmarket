"use client";

/**
 * BalancePill — USDT balance display
 * ====================================
 * Small pill component showing the user's USDT token balance. Polls every
 * 30 seconds via getUsdtBalance(). Links to /faucet for claiming testnet
 * USDT. Used inside MarketDetail and BetSlipDrawer.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { getUsdtBalance } from '../lib/txlineProgram';

export const BalancePill: React.FC = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const bal = await getUsdtBalance(connection, publicKey);
        if (!cancelled) setBalance(bal);
      } catch { if (!cancelled) setBalance(0); }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicKey, connection]);

  if (balance == null) return null;

  return (
    <Link
      href="/faucet"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 hover:opacity-70 active:scale-95"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
    >
      <span style={{ color: 'var(--success)' }}>●</span>
      {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>USDT</span>
    </Link>
  );
};
