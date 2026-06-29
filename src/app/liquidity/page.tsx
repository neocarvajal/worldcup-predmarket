"use client";

import React, { useState } from 'react';
import { PoolCard } from '../../components/PoolCard';

const MOCK_POOLS = [
  { name: 'USDT/BRL', tokenA: 'USDT', tokenB: 'BRL', fee: 30, reserveA: 125000, reserveB: 650000, lpSupply: 285000, price: 5.2 },
  { name: 'USDT/ARG', tokenA: 'USDT', tokenB: 'ARG', fee: 30, reserveA: 98000, reserveB: 420000, lpSupply: 202000, price: 4.28 },
  { name: 'USDT/FRA', tokenA: 'USDT', tokenB: 'FRA', fee: 30, reserveA: 112000, reserveB: 510000, lpSupply: 238000, price: 4.55 },
];

export default function LiquidityPage() {
  const [tab, setTab] = useState<'all' | 'mine'>('all');

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn">
      <h1 className="title-hero mb-4">Liquidity Pools</h1>

      <div className="flex gap-2 mb-4">
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          Todos los Pools
        </button>
        <button className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          Mis Posiciones
        </button>
      </div>

      <div className="space-y-3">
        {MOCK_POOLS.map((pool, idx) => (
          <PoolCard
            key={`${pool.tokenA}-${pool.tokenB}`}
            name={pool.name}
            tokenA={pool.tokenA}
            tokenB={pool.tokenB}
            fee={pool.fee}
            reserveA={pool.reserveA}
            reserveB={pool.reserveB}
            price={pool.price}
            lpSupply={pool.lpSupply}
            userLp={tab === 'mine' ? Math.floor(pool.lpSupply * 0.05) : undefined}
            userShare={tab === 'mine' ? 5 : undefined}
          />
        ))}
      </div>
    </div>
  );
}
