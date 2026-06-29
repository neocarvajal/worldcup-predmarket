"use client";

import React from 'react';

interface PoolCardProps {
  name: string;
  tokenA: string;
  tokenB: string;
  fee: number;
  reserveA: number;
  reserveB: number;
  price: number;
  lpSupply: number;
  userLp?: number;
  userShare?: number;
}

export const PoolCard: React.FC<PoolCardProps> = ({
  name, tokenA, tokenB, fee, reserveA, reserveB, price, lpSupply, userLp, userShare,
}) => (
  <div className="card animate-slideUp">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="flex">
          <div className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-[10px] font-bold" style={{ color: 'var(--accent)' }}>{tokenA[0]}</div>
          <div className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-[10px] font-bold -ml-2" style={{ color: 'var(--accent)' }}>{tokenB[0]}</div>
        </div>
        <span className="text-sm font-semibold">{name}</span>
      </div>
      <span className="badge badge-muted">{fee / 100}%</span>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="card-inset">
        <span className="text-caption block">{tokenA}</span>
        <span className="text-sm font-semibold">{reserveA.toLocaleString()}</span>
      </div>
      <div className="card-inset">
        <span className="text-caption block">{tokenB}</span>
        <span className="text-sm font-semibold">{reserveB.toLocaleString()}</span>
      </div>
    </div>

    <div className="flex items-center justify-between text-sm mb-2">
      <span className="text-caption">Precio</span>
      <span className="font-semibold">1 {tokenA} = {price.toFixed(4)} {tokenB}</span>
    </div>

    <div className="flex items-center justify-between text-sm">
      <span className="text-caption">LP Supply</span>
      <span className="font-semibold">{lpSupply.toLocaleString()}</span>
    </div>

    {userLp != null && (
      <>
        <div className="divider" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-caption">Tu LP</span>
          <span className="font-semibold">{userLp.toLocaleString()} ({userShare?.toFixed(2)}%)</span>
        </div>
      </>
    )}
  </div>
);
