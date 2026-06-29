"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const MarketDetail = dynamic(() => import('../../../components/MarketDetail').then(m => ({ default: m.MarketDetail })), {
  ssr: false,
  loading: () => (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="animate-pulse space-y-4">
        <div className="card h-32" />
        <div className="card h-24" />
        <div className="card h-40" />
      </div>
    </div>
  ),
});

export default function MarketPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <MarketDetail />
    </div>
  );
}
