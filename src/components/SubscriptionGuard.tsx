"use client";

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAutoSubscribe } from '../hooks/useAutoSubscribe';
import { ClientWalletButton } from './ClientWalletButton';
import {
  LockClosedIcon,
  ReloadIcon,
  GlobeIcon,
  RocketIcon,
  ExclamationTriangleIcon,
  UpdateIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';

function Orbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full animate-float-slow"
        style={{
          width: 300, height: 300, top: '0%', right: '-15%',
          background: 'radial-gradient(circle, rgba(220,235,2,0.04) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full animate-float"
        style={{
          width: 200, height: 200, bottom: '10%', left: '-10%',
          background: 'radial-gradient(circle, rgba(220,235,2,0.025) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

function GlassCard({ children, error: isError }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      className="rounded-2xl p-8 text-center animate-scaleIn"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'var(--bg-card)',
        border: `1px solid ${isError ? 'rgba(255,68,68,0.2)' : 'var(--border)'}`,
        backdropFilter: 'blur(12px)',
        ...(isError ? {} : {}),
      }}
    >
      {children}
    </div>
  );
}

function IconBox({ children, pulse, error: isError }: { children: React.ReactNode; pulse?: boolean; error?: boolean }) {
  return (
    <div
      className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${pulse ? 'animate-pulse' : ''}`}
      style={{ background: isError ? 'rgba(255,68,68,0.1)' : 'var(--accent-dim)' }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-full text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
      style={{
        background: 'var(--accent)',
        color: '#000',
        boxShadow: '0 0 24px rgba(220,235,2,0.15)',
      }}
    >
      {children}
    </button>
  );
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { publicKey } = useWallet();
  const { state, error, subscribe } = useAutoSubscribe();
  const [showSteps, setShowSteps] = React.useState(false);

  if (!publicKey) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <GlassCard>
          <IconBox>
            <LockClosedIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
          </IconBox>
          <h2 className="text-lg font-semibold mb-2">Conectá tu Wallet</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Necesitás una wallet Solana en Devnet para usar la DApp
          </p>
          <ClientWalletButton />
        </GlassCard>
      </div>
    );
  }

  if (state === 'checking') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <GlassCard>
          <div className="relative w-14 h-14 mx-auto mb-4">
            <div
              className="absolute inset-0 rounded-2xl animate-spin"
              style={{
                border: '3px solid transparent',
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
                opacity: 0.4,
              }}
            />
            <div className="w-full h-full rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
              <ReloadIcon width={20} height={20} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Verificando suscripción TxLINE...
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Consultando el oráculo deportivo
          </p>
        </GlassCard>
      </div>
    );
  }

  if (state === 'needed' && !showSteps) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <GlassCard>
          <IconBox>
            <GlobeIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
          </IconBox>
          <h2 className="text-lg font-semibold mb-2">Suscripción TxLINE</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Activá tu suscripción gratuita al oráculo deportivo para acceder a datos en tiempo real.
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Tier 1 — World Cup & Int Friendlies. Solo pagás el fee de transacción Solana.
          </p>
          <PrimaryButton onClick={() => setShowSteps(true)}>
            Activar Suscripción
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  if (state === 'needed' && showSteps) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <GlassCard>
          <IconBox>
            <CheckCircledIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
          </IconBox>
          <h2 className="text-lg font-semibold mb-3">Confirmá la Activación</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            Se va a enviar una transacción a Solana Devnet para registrar tu suscripción gratuita (Tier 1 — Mundial).
          </p>

          {/* Instruction breakdown */}
          <div
            className="rounded-xl p-3 mb-4 text-left space-y-2"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                1
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Crear cuenta de token TxL</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Solo si no tenés una — sin costo, 0 TxL transferidos
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                2
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Registrar suscripción on-chain</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Vincula tu wallet al oráculo TxLINE — 0 TxL cobrados (tier gratis)
                </p>
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 text-xs p-3 rounded-xl mb-4 text-left"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
          >
            <span style={{ color: 'var(--warning)', fontSize: 14 }}>ℹ</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Tu wallet te va a pedir que firmes 1 o 2 instrucciones. No se transfieren tokens — solo pagás el fee de SOL (~0.00001 SOL).
            </span>
          </div>

          <PrimaryButton onClick={subscribe}>
            Confirmar y Activar
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  if (state === 'subscribing') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <div className="relative" style={{ zIndex: 1 }}>
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(220,235,2,0.12)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 30px rgba(220,235,2,0.04)',
            }}
          >
            {/* Pulsing glow ring + spinner */}
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div
                className="absolute inset-0 rounded-full animate-countdown-pulse"
                style={{
                  border: '2px solid var(--accent)',
                  opacity: 0.3,
                }}
              />
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  border: '2px solid transparent',
                  borderTopColor: 'var(--accent)',
                  borderRightColor: 'var(--accent)',
                  opacity: 0.5,
                }}
              />
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-dim)' }}
              >
                <RocketIcon width={24} height={24} style={{ color: 'var(--accent)' }} />
              </div>
            </div>

            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Esperando firma en tu wallet
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Revisá tu wallet y firmá la transacción para continuar
            </p>

            {/* Steps */}
            <div className="flex items-center justify-center gap-2 mt-8">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: 'var(--accent-dim)',
                    boxShadow: '0 0 12px rgba(220,235,2,0.15)',
                  }}
                >
                  <RocketIcon width={12} height={12} style={{ color: 'var(--accent)' }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>Firmar</span>
              </div>
              <svg width="20" height="2" viewBox="0 0 20 2" fill="none">
                <line x1="0" y1="1" x2="20" y2="1" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
              </svg>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>2</span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Activar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'activating') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <div className="relative" style={{ zIndex: 1 }}>
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(220,235,2,0.12)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 30px rgba(220,235,2,0.04)',
            }}
          >
            {/* Pulsing glow ring + spinner */}
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div
                className="absolute inset-0 rounded-full animate-countdown-pulse"
                style={{
                  border: '2px solid var(--accent)',
                  opacity: 0.3,
                }}
              />
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  border: '2px solid transparent',
                  borderTopColor: 'var(--accent)',
                  borderRightColor: 'var(--accent)',
                  opacity: 0.5,
                }}
              />
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-dim)' }}
              >
                <UpdateIcon width={24} height={24} style={{ color: 'var(--accent)' }} />
              </div>
            </div>

            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Vinculando wallet con el oráculo
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Activando el API token para recibir datos en vivo
            </p>

            {/* Steps */}
            <div className="flex items-center justify-center gap-2 mt-8">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  <CheckCircledIcon width={13} height={13} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>Firmar</span>
              </div>
              <svg width="20" height="2" viewBox="0 0 20 2" fill="none">
                <line x1="0" y1="1" x2="20" y2="1" stroke="var(--accent-dim)" strokeWidth="1" />
              </svg>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: 'var(--accent-dim)',
                    boxShadow: '0 0 12px rgba(220,235,2,0.15)',
                  }}
                >
                  <UpdateIcon width={12} height={12} style={{ color: 'var(--accent)' }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>Activar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center animate-fadeIn relative">
        <Orbs />
        <GlassCard error>
          <IconBox error>
            <ExclamationTriangleIcon width={22} height={22} style={{ color: 'var(--danger)' }} />
          </IconBox>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--danger)' }}>Error de Activación</h2>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            {error || 'No se pudo completar la suscripción'}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Asegurate de tener SOL en Devnet para el fee de red. Revisá también que tu wallet tenga aprobadas las 2 instrucciones (crear cuenta TxL + subscribir).
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay SOL en Devnet? Usá el <a href="/faucet" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>faucet de SOL</a> o pedí en el{' '}
            <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>faucet oficial</a>.
          </p>
          <PrimaryButton onClick={subscribe}>
            Reintentar
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
};
