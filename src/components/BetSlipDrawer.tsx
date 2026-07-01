"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { useBetSlip } from '../context/BetSlipContext';
import { initEscrowWithDeposit } from '../lib/settlement';
import { getUsdtBalance } from '../lib/txlineProgram';
import { saveBet } from '../lib/persistence';
import { PublicKey } from '@solana/web3.js';

const USDC_MINT = new PublicKey('ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh');
const QUICK_AMOUNTS = [10, 20, 50, 100];
const SEL_MAP: Record<string, number> = { '1': 0, X: 1, '2': 2 };

export const BetSlipDrawer: React.FC = () => {
  const { selections, amount, isOpen, setIsOpen, removeSelection, setAmount, clear } = useBetSlip();
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const t = useTranslations('BetSlipDrawer');
  const countRef = useRef(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [placing, setPlacing] = React.useState(false);
  const [txSig, setTxSig] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [insufficient, setInsufficient] = React.useState<{ balance: number; needed: number; countdown: number } | null>(null);

  useEffect(() => {
    if (insufficient) {
      countRef.current = 10;
      timerRef.current = setInterval(() => {
        countRef.current -= 1;
        setInsufficient(prev => prev ? { ...prev, countdown: countRef.current } : null);
        if (countRef.current <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          router.push('/faucet');
        }
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [insufficient, router]);

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const parsedAmount = parseFloat(amount) || 0;
  const potentialPayout = parsedAmount * totalOdds;

  const handlePlaceBet = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || selections.length === 0 || parsedAmount <= 0) return;
    setPlacing(true);
    setError(null);
    setTxSig(null);
    setInsufficient(null);

    try {
      const balance = await getUsdtBalance(connection, wallet.publicKey);
      if (balance < parsedAmount) {
        setInsufficient({ balance, needed: parsedAmount, countdown: 10 });
        setPlacing(false);
        return;
      }

      const recipient = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
      const amountLamports = BigInt(Math.floor(parsedAmount * 1_000_000));

      const s = selections[0];
      const result = await initEscrowWithDeposit(connection, wallet, {
        recipient,
        mint: USDC_MINT,
        amount: amountLamports,
        expiry,
        fixtureName: s.fixtureName,
        selection: SEL_MAP[s.selection] ?? 0,
        label: s.label,
        odds: s.odds,
      });

      setTxSig(result.sig);

      saveBet(wallet.publicKey.toBase58(), {
        fixtureName: selections[0].fixtureName,
        selection: selections[0].selection,
        label: selections[0].label,
        odds: selections[0].odds,
        amount: parsedAmount,
        escrowPubkey: result.escrowPda.toBase58(),
        timestamp: Date.now(),
        txSig: result.sig,
        matchStartTime: selections[0].startTime,
      });

      setTimeout(() => { clear(); setPlacing(false); }, 2000);
    } catch (e: any) {
      setError(e?.message || t('betError'));
      setPlacing(false);
    }
  }, [wallet, connection, selections, parsedAmount, clear]);

  const handleGoToFaucet = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.push('/faucet');
  };

  const isActive = (v: number) => {
    const p = parsedAmount;
    return Math.abs(p - v) < 0.001;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={() => !placing ? setIsOpen(false) : undefined} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />

        <h3 className="text-lg font-bold mb-4">{t('yourBet')}</h3>

        {insufficient ? (
          <div className="text-center py-6 animate-scaleIn">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)' }}
            >
              <span style={{ fontSize: 24 }}>🪙</span>
            </div>
            <h4 className="text-base font-semibold mb-2" style={{ color: 'var(--warning)' }}>
              {t('insufficientBalance')}
            </h4>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('youHave')} <strong>{insufficient.balance.toFixed(2)} USDT</strong> {t('andNeed')} <strong>{insufficient.needed.toFixed(2)} USDT</strong>.
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              {t('get100Free')}
            </p>
            <button
              onClick={handleGoToFaucet}
              className="w-full py-3 rounded-full text-sm font-bold transition-all duration-200 active:scale-95 mb-2"
              style={{
                background: 'var(--accent)',
                color: '#000',
                boxShadow: '0 0 24px rgba(220,235,2,0.15)',
              }}
            >
              {t('goToFaucet')}
            </button>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('redirectingIn')} {insufficient.countdown}s...
            </p>
          </div>
        ) : selections.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">
            {t('selectOutcome')}
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {selections.map((s) => (
              <div key={`${s.fixtureId}-${s.selection}`} className="card-inset flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-medium truncate">{s.fixtureName}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {s.label} · {s.odds.toFixed(2)}x
                  </p>
                </div>
                <button
                  onClick={() => removeSelection(s.fixtureId, s.selection)}
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ color: 'var(--danger)', background: 'rgba(255,68,68,0.1)' }}
                  disabled={placing}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {selections.length > 0 && !insufficient && (
          <>
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>
                {t('amount')}
              </label>

              <div className="flex gap-2 mb-2">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    disabled={placing}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={{
                      background: isActive(v) ? 'var(--accent)' : 'var(--bg-surface)',
                      color: isActive(v) ? '#000' : 'var(--text-primary)',
                      border: `1px solid ${isActive(v) ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              <input
                type="number"
                className="input-ghost"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={0.01}
                disabled={placing}
              />
            </div>

            <div className="card-inset space-y-1 mb-4">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{t('totalOdds')}</span>
                <span className="font-semibold">{totalOdds.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{t('potentialPayout')}</span>
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {potentialPayout.toFixed(2)} USDT
                </span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger mb-3">{error}</p>
            )}

            {txSig && (
              <p className="text-xs mb-3" style={{ color: 'var(--success)' }}>
                {t('betPlaced')} TX: {txSig.slice(0, 8)}...{txSig.slice(-4)}
              </p>
            )}

            <button
              className="btn-primary w-full"
              onClick={handlePlaceBet}
              disabled={placing || parsedAmount <= 0}
            >
              {placing ? t('placingBet') : t('placeBet')}
            </button>
          </>
        )}
      </div>
    </>
  );
};
