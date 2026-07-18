"use client";

/**
 * USDT faucet page
 * ==================
 * Claims testnet USDT (100 tokens) from the TxLINE program faucet.
 * Shows current USDT balance, mint address, cooldown timer (8h), and
 * transaction status. Calls requestUsdtFaucet() which builds and sends
 * the faucet claim instruction on Solana.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { requestUsdtFaucet, getUsdtBalance, USDT_MINT, checkFaucetCooldown } from '../../lib/txlineProgram';
import { PublicKey } from '@solana/web3.js';
import { TokensIcon, CheckCircledIcon, TimerIcon, LightningBoltIcon, ExternalLinkIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { bgImage } from '../../lib/bgImage';

const FIXED_AMOUNT = 100;

export default function FaucetPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const t = useTranslations('Faucet');
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<{ available: boolean; remainingSeconds: number } | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!wallet.publicKey) { setBalance(0); return; }
    const b = await getUsdtBalance(connection, wallet.publicKey).catch(() => 0);
    setBalance(b);
    return b;
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    if (!wallet.publicKey) { setBalance(0); setCooldown(null); return; }
    refreshBalance();
    checkFaucetCooldown(connection, wallet.publicKey).then(setCooldown);
    const id = setInterval(() => {
      refreshBalance();
      checkFaucetCooldown(connection, wallet.publicKey!).then(setCooldown);
    }, 10000);
    return () => clearInterval(id);
  }, [wallet.publicKey, connection, refreshBalance]);

  const handleClaim = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setClaiming(true);
    setError(null);
    setTxSig(null);
    try {
      const sig = await requestUsdtFaucet(connection, {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
      });
      setTxSig(sig);
      await refreshBalance();
      setCooldown({ available: false, remainingSeconds: 8 * 3600 });
    } catch (e: any) {
      const msg = e?.message || '';
      console.error('[Faucet] Simulation failure:', msg);
      if (e?.logs) console.error('[Faucet] Logs:', e.logs);
      if (msg.includes('RateLimitExceeded') || msg.includes('0x17aa') || msg.includes('6058')) {
        setError(t('rateLimit'));
        checkFaucetCooldown(connection, wallet.publicKey!).then(setCooldown);
      } else {
        setError(msg.slice(0, 120) || t('claimError'));
      }
    } finally {
      setClaiming(false);
    }
  }, [wallet, connection, refreshBalance]);

  const formatCooldown = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn relative">
      {/* Background image */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            ...bgImage('faucet-bg'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.25) saturate(0.7)',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-float"
            style={{
              background: 'var(--accent-dim)',
              boxShadow: '0 0 30px rgba(220,235,2,0.1)',
            }}
          >
            <TokensIcon width={30} height={30} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{t('title')}</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Balance card */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center shrink-0 rounded-xl"
              style={{
                width: 48,
                height: 48,
                background: 'var(--accent-dim)',
              }}
            >
              <TokensIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                {t('yourBalance')}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
                  {balance.toFixed(2)}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>USDT</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{t('mint')}</div>
              <span
                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-mono"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {USDT_MINT.toBase58().slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        {!wallet.publicKey ? (
          <button
            onClick={() => setVisible(true)}
            className="w-full text-center py-16 animate-scaleIn transition-all duration-200 active:scale-95 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <LightningBoltIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('connectWallet')}</h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('needConnect')}
            </p>
          </button>
        ) : cooldown && !cooldown.available ? (
          /* Cooldown state */
          <div className="text-center py-12 animate-scaleIn">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)' }}
            >
              <TimerIcon width={28} height={28} style={{ color: 'var(--warning)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('alreadyClaimed')}</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('claimAgainIn')}
            </p>
            <p className="text-2xl font-extrabold tabular-nums mb-4" style={{ color: 'var(--accent)' }}>
              {formatCooldown(cooldown.remainingSeconds)}
            </p>
            <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
              {t('tipUseOtherWallet')}
            </p>
            {balance < 50 && (
              <div
                className="mt-4 flex items-center gap-2 text-xs p-3 rounded-xl text-left"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(220,235,2,0.15)',
                }}
              >
                <InfoCircledIcon width={14} height={14} style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {t('tipUseOtherWallet')}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Claim form */
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Fixed amount display */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-3"
                style={{ background: 'var(--accent-dim)' }}
              >
                <TokensIcon width={36} height={36} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
                  {FIXED_AMOUNT}
                </span>
                <span className="text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>USDT</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('fixedAmount')}
              </p>
            </div>

            {balance > 0 && (
              <div
                className="flex items-center gap-2 text-xs p-3 rounded-xl mb-5"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(220,235,2,0.15)',
                }}
              >
                <InfoCircledIcon width={14} height={14} style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {t('youHave')} <strong>{balance.toFixed(0)} USDT</strong>
                </span>
              </div>
            )}

            {/* Claim button */}
            <button
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full text-base font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: 'var(--accent)',
                color: '#000',
                boxShadow: !claiming ? '0 0 24px rgba(220,235,2,0.15)' : 'none',
              }}
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? (
                <>
                  <span
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }}
                  />
                  {t('claiming')}
                </>
              ) : (
                <>
                  <LightningBoltIcon width={20} height={20} />
                  {t('claim')}
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 text-xs p-3 rounded-xl" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.15)' }}>
                <span style={{ color: 'var(--danger)' }}>⚠️</span>
                <span style={{ color: 'var(--danger)' }}>{error}</span>
              </div>
            )}

            {/* Success */}
            {txSig && (
              <div className="mt-4 animate-scaleIn">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: 'rgba(34,197,94,0.06)',
                    border: '1px solid rgba(34,197,94,0.15)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircledIcon width={18} height={18} style={{ color: 'var(--success)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                      {t('success')}
                    </span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--accent)' }}
                  >
                    {t('viewExplorer')}
                    <ExternalLinkIcon width={12} height={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info cards */}
        <div className="space-y-2">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <TimerIcon width={16} height={16} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('limit')}
            </span>
          </div>
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <TokensIcon width={16} height={16} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Programa TxLINE:{' '}
              <code className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                {USDT_MINT.toBase58().slice(0, 16)}...
              </code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
