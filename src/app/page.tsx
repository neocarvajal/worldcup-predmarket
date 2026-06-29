"use client";

import React from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import {
  BackpackIcon,
  ActivityLogIcon,
  TargetIcon,
  CheckCircledIcon,
  GlobeIcon,
  CubeIcon,
  LightningBoltIcon,
  RocketIcon,
  LayersIcon,
} from '@radix-ui/react-icons';

const steps = [
  { icon: BackpackIcon, title: 'Conecta tu Wallet', desc: 'Usa Phantom, Backpack o cualquier wallet Solana' },
  { icon: ActivityLogIcon, title: 'Activa TxLINE', desc: 'Suscripción gratuita Tier 1 para datos del Mundial' },
  { icon: TargetIcon, title: 'Predice', desc: 'Elige ganador, empate o visitante en cada partido' },
  { icon: CheckCircledIcon, title: 'Settlement automático', desc: 'El keeper resuelve las apuestas al finalizar' },
];

const tech = [
  { label: 'Solana', sub: 'Devnet' },
  { label: 'Anchor', sub: 'Programs' },
  { label: 'TxLINE', sub: 'Oracle' },
  { label: 'Next.js', sub: 'App Router' },
  { label: 'Supabase', sub: 'Keeper' },
  { label: 'USDT', sub: 'Escrow' },
];

const perks = [
  { icon: RocketIcon, text: 'Transacciones en segundos' },
  { icon: CubeIcon, text: 'Escrow on-chain' },
  { icon: LayersIcon, text: 'Sin KYC ni registro' },
];

export default function LandingPage() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const handleStart = (e: React.MouseEvent) => {
    if (!connected) {
      e.preventDefault();
      setVisible(true);
    }
  };

  return (
    <>
      {/* ─── Animated Background Orbs ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 300,
            height: 300,
            top: '5%',
            left: '-5%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.06) 0%, transparent 70%)',
            animationDuration: '12s',
          }}
        />
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            width: 400,
            height: 400,
            top: '50%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.04) 0%, transparent 70%)',
            animationDuration: '15s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 200,
            height: 200,
            bottom: '10%',
            left: '15%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.03) 0%, transparent 70%)',
            animationDuration: '10s',
            animationDelay: '-3s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 250,
            height: 250,
            top: '30%',
            left: '40%',
            background: 'radial-gradient(circle, rgba(220,235,2,0.02) 0%, transparent 70%)',
            animationDuration: '18s',
            animationDelay: '-6s',
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(220,235,2,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(220,235,2,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative px-4 pt-24 pb-28 text-center" style={{ zIndex: 1 }}>
        <div className="max-w-2xl mx-auto">
          <div className="animate-title-reveal" style={{ animationDelay: '0s' }}>
            <span
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid rgba(220,235,2,0.15)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: 'var(--accent)' }}
              />
              Predicciones Deportivas Descentralizadas
            </span>
          </div>

          <h1
            className="animate-title-reveal text-[2.5rem] md:text-[3.5rem] font-extrabold leading-[1.05] tracking-[-0.04em] mb-5"
            style={{ animationDelay: '0.15s' }}
          >
            Apuesta en el{' '}
            <span
              className="animate-gradient inline-block text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(135deg, #DCEB02 0%, #E8F333 25%, #DCEB02 50%, #B8C902 75%, #DCEB02 100%)',
                backgroundSize: '200% 200%',
              }}
            >
              Mundial 2026
            </span>
          </h1>

          <p
            className="animate-title-reveal text-base md:text-lg max-w-md mx-auto mb-8 leading-relaxed"
            style={{ animationDelay: '0.3s', color: 'var(--text-secondary)' }}
          >
            Predicciones on-chain con liquidación automática vía oráculo TxLINE.
            Conecta tu wallet, activa la suscripción gratuita y empieza a predecir.
          </p>

          <div
            className="animate-title-reveal flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{ animationDelay: '0.45s' }}
          >
            <Link
              href="/markets"
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-base font-bold transition-all duration-200 active:scale-95 animate-glow-pulse"
              style={{
                background: 'var(--accent)',
                color: '#000',
              }}
            >
              <LightningBoltIcon width={18} height={18} />
              {connected ? 'Comenzar a predecir' : 'Conectar Wallet'}
            </Link>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-200 active:scale-95"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <ActivityLogIcon width={18} height={18} />
              Ver en vivo
            </Link>
          </div>

          {/* Perks row */}
          <div
            className="animate-title-reveal flex items-center justify-center gap-6 mt-10"
            style={{ animationDelay: '0.6s' }}
          >
            {perks.map(p => (
              <div key={p.text} className="flex items-center gap-1.5">
                <p.icon width={14} height={14} style={{ color: 'var(--accent)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="relative px-4 pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-3 gap-3 mb-24">
            {[
              { val: 'Solana\nDevnet', label: 'Red' },
              { val: 'TxLINE\nTier 1', label: 'Gratuito' },
              { val: 'Automático', label: 'Settlement' },
            ].map((s, i) => (
              <div
                key={s.label}
                className="animate-slideUp text-center rounded-2xl py-5 px-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  backdropFilter: 'blur(12px)',
                  animationDelay: `${0.7 + i * 0.1}s`,
                  animationFillMode: 'backwards',
                }}
              >
                <div
                  className="text-sm font-bold leading-tight whitespace-pre-line mb-1"
                  style={{ color: 'var(--accent)' }}
                >
                  {s.val}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ─── How it works ─── */}
          <div className="text-center mb-10">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid rgba(220,235,2,0.15)',
              }}
            >
              <TargetIcon width={12} height={12} />
              Cómo funciona
            </span>
            <h2 className="text-2xl font-bold tracking-tight">En 4 pasos simples</h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
              De cero a tu primera predicción en menos de un minuto
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute left-[23px] top-0 bottom-0 w-px hidden sm:block"
              style={{ background: 'linear-gradient(to bottom, var(--accent-dim), transparent)' }}
            />

            <div className="space-y-4">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="animate-slideUp relative flex items-start gap-4 rounded-2xl p-4"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      backdropFilter: 'blur(12px)',
                      animationDelay: `${1 + i * 0.12}s`,
                      animationFillMode: 'backwards',
                    }}
                  >
                    <div
                      className="shrink-0 flex items-center justify-center rounded-xl"
                      style={{
                        width: 46,
                        height: 46,
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon width={20} height={20} />
                    </div>
                    <div className="min-w-0 pt-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                          style={{
                            background: 'var(--accent)',
                            color: '#000',
                          }}
                        >
                          {i + 1}
                        </span>
                        <h3 className="text-sm font-semibold">{s.title}</h3>
                      </div>
                      <p className="text-xs ml-7" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── CTA Banner ─── */}
          <div
            className="mt-10 rounded-2xl p-6 text-center animate-slideUp"
            style={{
              background: 'linear-gradient(135deg, var(--accent-dim) 0%, rgba(220,235,2,0.04) 100%)',
              border: '1px solid rgba(220,235,2,0.15)',
              animationDelay: '1.6s',
              animationFillMode: 'backwards',
            }}
          >
            <h3 className="text-lg font-bold mb-2">¿Listo para empezar?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Consigue USDT gratis desde el faucet y empieza a predecir partidos del Mundial 2026.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/faucet"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                }}
              >
                <LightningBoltIcon width={16} height={16} />
                Ir al Faucet
              </Link>
              <Link
                href="/markets"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                <GlobeIcon width={16} height={16} />
                Ver partidos
              </Link>
            </div>
          </div>

          {/* ─── Tech Stack ─── */}
          <div className="mt-20 text-center">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid rgba(220,235,2,0.15)',
              }}
            >
              <CubeIcon width={12} height={12} />
              Tech Stack
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tech.map((t, i) => (
                <div
                  key={t.label}
                  className="animate-scaleIn inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    animationDelay: `${i * 0.06}s`,
                    animationFillMode: 'backwards',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{t.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className="relative text-center py-8"
        style={{ zIndex: 1, borderTop: '1px solid var(--border)' }}
      >
        <p className="text-caption">World Cup Prediction Market — Hackathon 2026</p>
      </footer>
    </>
  );
}
