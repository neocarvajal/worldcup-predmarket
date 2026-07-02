"use client";

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import { fetchUserEscrows } from '../../lib/settlement';
import { loadBet } from '../../lib/persistence';
import { PositionCard } from '../../components/PositionCard';
import { StackIcon, TargetIcon, ReloadIcon } from '@radix-ui/react-icons';

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const t = useTranslations('Portfolio');

  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [settling, setSettling] = useState(false);
  const [fixtureStatus, setFixtureStatus] = useState<Record<number, { finished: boolean; statusId?: number; score1?: number; score2?: number }>>({});

  async function checkFixture(id: number): Promise<void> {
    try {
      const resp = await fetch(`/api/keeper/fixture-status?fixtureId=${id}`);
      const data = await resp.json();
      if (data && typeof data.finished === 'boolean') {
        setFixtureStatus(prev => ({ ...prev, [id]: { finished: data.finished, statusId: data.statusId, score1: data.score1, score2: data.score2 } }));
      }
    } catch {}
  }

  const handleSettle = async (escrowPubkey: string) => {
    setSettling(true);
    setError(null);
    try {
      const resp = await fetch(`/api/keeper/settle?escrow=${escrowPubkey}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok && data.result?.status === 'settled') {
        setTimeout(() => load(), 2000);
      } else {
        setError(data.result?.error || data.error || 'Error al liquidar');
      }
    } catch (e: any) {
      setError(e.message || 'Error de red al liquidar');
    } finally {
      setSettling(false);
    }
  };

  function isMatchOver(acc: any, matchStartMs?: number, fixtureId?: number): boolean {
    if (!acc) return false;
    if (acc.expiry && acc.expiry > 0) {
      const expiryMs = Number(acc.expiry) * 1000;
      if (Date.now() > expiryMs) return true;
    }
    if (matchStartMs && matchStartMs > 0) {
      const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
      if (Date.now() > matchStartMs + FOUR_HOURS_MS) return true;
    }
    if (fixtureId && fixtureStatus[fixtureId]?.finished) return true;
    return false;
  }

  const load = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserEscrows(connection, publicKey);
      data.sort((a: any, b: any) => Number(b.account.nonce) - Number(a.account.nonce));
      setEscrows(data);
      // Check fixture status for active escrows that might be finished
      const activeWithFid = data.filter((e: any) => {
        const k = e.account?.state ? Object.keys(e.account.state)[0] : null;
        return k === 'Active' && e.account.fixtureId;
      });
      for (const e of activeWithFid) {
        const fid = Number(e.account.fixtureId);
        if (!fixtureStatus[fid]) checkFixture(fid);
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [publicKey, connection]);

  useEffect(() => {
    if (!publicKey) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [publicKey, setVisible]);

  const escrowMatchOver = escrows.reduce((map: Record<string, boolean>, e: any) => {
    const bet = publicKey ? loadBet(publicKey.toBase58(), e.pubkey.toBase58()) : null;
    const raw = bet?.matchStartTime;
    const matchStart = raw ? (raw > 1e12 ? raw : raw * 1000) : undefined;
    const fid = e.account.fixtureId ? Number(e.account.fixtureId) : undefined;
    map[e.pubkey.toBase58()] = isMatchOver(e.account, matchStart, fid);
    return map;
  }, {});

  const activeEscrows = escrows.filter((e: any) => {
    const k = e.account?.state ? Object.keys(e.account.state)[0] : null;
    return k === 'Active' && !escrowMatchOver[e.pubkey.toBase58()];
  });
  const historyEscrows = escrows.filter((e: any) => {
    const k = e.account?.state ? Object.keys(e.account.state)[0] : null;
    return k !== 'Active' || escrowMatchOver[e.pubkey.toBase58()];
  });
  const displayEscrows = tab === 'active' ? activeEscrows : historyEscrows;

  const totalStaked = escrows.reduce((sum: number, e: any) => {
    const k = e.account?.state ? Object.keys(e.account.state)[0] : null;
    if (k === 'Active' && !escrowMatchOver[e.pubkey.toBase58()]) {
      return sum + Number(e.account.amount || 0) / 1_000_000;
    }
    return sum;
  }, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            width: 250,
            height: 250,
            top: '5%',
            right: '-15%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.03) 0%, transparent 70%)',
            animationDuration: '14s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 180,
            height: 180,
            bottom: '15%',
            left: '-10%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.02) 0%, transparent 70%)',
            animationDuration: '11s',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--accent-dim)',
                boxShadow: '0 0 20px rgba(220,235,2,0.08)',
              }}
            >
              <StackIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid rgba(220,235,2,0.15)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            {escrows.length} {t('bets')}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { val: escrows.length.toString(), label: t('total'), accent: false },
            { val: activeEscrows.length.toString(), label: t('active'), accent: false },
            { val: totalStaked.toFixed(2), label: t('usdtStake'), accent: true },
          ].map((s, i) => (
            <div
              key={s.label}
              className="text-center rounded-2xl py-4 px-3 animate-slideUp"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
                animationDelay: `${0.1 + i * 0.06}s`,
                animationFillMode: 'backwards',
              }}
            >
              <div
                className="text-lg font-extrabold tabular-nums mb-0.5"
                style={s.accent ? { color: 'var(--accent)' } : {}}
              >
                {s.val}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['active', 'history'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="px-5 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95"
              style={{
                background: tab === tabKey ? 'var(--accent)' : 'var(--bg-surface)',
                color: tab === tabKey ? '#000' : 'var(--text-muted)',
                border: `1px solid ${tab === tabKey ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {tabKey === 'active' ? t('active') : t('history')}
              <span className="ml-1.5 opacity-70">
                ({tabKey === 'active' ? activeEscrows.length : historyEscrows.length})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-5 animate-scaleIn"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  animationDelay: `${i * 0.08}s`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="skeleton h-4 w-40 rounded" />
                  <div className="skeleton h-4 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="skeleton h-8 rounded" />
                  <div className="skeleton h-8 rounded" />
                  <div className="skeleton h-8 rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="skeleton h-3 w-20 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 animate-scaleIn">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(255,68,68,0.1)' }}
            >
              <TargetIcon width={28} height={28} style={{ color: 'var(--danger)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('errorLoading')}</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <ReloadIcon width={16} height={16} />
              {t('retry')}
            </button>
          </div>
        ) : !publicKey ? (
          <div className="text-center py-16 animate-scaleIn">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <StackIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('connectWallet')}</h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('needConnect')}
            </p>
          </div>
        ) : displayEscrows.length === 0 ? (
          <div className="text-center py-20 animate-scaleIn">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <TargetIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {tab === 'active' ? t('noActiveBets') : t('noHistory')}
            </h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {tab === 'active' ? t('activeBetsWillAppear') : t('noHistory')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--text-muted)' }}
              >
                {tab === 'active' ? t('active') : t('finished')}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {displayEscrows.length} {displayEscrows.length === 1 ? t('bet') : t('bets')}
              </span>
            </div>
            {displayEscrows.map((e: any, idx: number) => {
              const acc = e.account;
              const stateKey = acc?.state ? Object.keys(acc.state)[0] : null;
              const isActive = stateKey === 'Active';
              const isSettled = stateKey === 'Settled';
              const matchOver = escrowMatchOver[e.pubkey.toBase58()] ?? false;
              const hasMatchEnded = isActive && matchOver;
              const bet = publicKey ? loadBet(publicKey.toBase58(), e.pubkey.toBase58()) : null;
              const fixtureName = acc.fixture_name || bet?.fixtureName || `Partido ${e.pubkey.toBase58().slice(0, 8)}`;
              const selection = acc.label || bet?.label || '—';
              const odds = acc.odds ? Number(acc.odds) / 1000 : (bet?.odds || 2.0);
              const payout = Number(acc.amount || 0) / 1_000_000 * odds;
              const raw = bet?.matchStartTime;
              const matchStart = raw ? (raw > 1e12 ? raw : raw * 1000) : undefined;
              return (
                <div
                  key={e.pubkey.toBase58()}
                  className="animate-slideUp"
                  style={{ animationDelay: `${idx * 0.06}s`, animationFillMode: 'backwards' }}
                >
                  <PositionCard
                    fixtureName={fixtureName}
                    selection={selection}
                    amount={Number(acc.amount || 0) / 1_000_000}
                    odds={odds}
                    payout={payout}
                    status={isSettled ? 'won' : hasMatchEnded ? 'pending' : isActive ? 'active' : 'lost'}
                    expiry={matchStart}
                    onSettle={hasMatchEnded ? () => handleSettle(e.pubkey.toBase58()) : undefined}
                    settling={settling}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
