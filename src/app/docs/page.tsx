import React from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

const sections = [
  {
    title: '¿Qué es este proyecto?',
    content: 'World Cup Predictions es un mercado de predicción descentralizado construido sobre Solana. Permite apostar en resultados de partidos del Mundial 2026 usando USDT como colateral, con liquidación automática basada en datos verificables de TxLINE.',
  },
  {
    title: 'Conexión de wallet',
    content: 'Necesitas una wallet de Solana (Phantom, Backpack o Solflare) configurada en Devnet. Conectala haciendo clic en "Connect Wallet" en la esquina superior derecha. No hay verificación KYC ni registro — solo conecta tu wallet y comienza.',
  },
  {
    title: 'Activar suscripción TxLINE',
    content: 'Antes de tu primera apuesta, necesitas activar una suscripción gratuita a TxLINE (Tier 1). Esto te permite acceder a datos de partidos y odds verificables on-chain. La activación requiere una firma de wallet (sin costo).',
  },
  {
    title: 'Cómo funciona una apuesta',
    content: [
      'Elige un partido en la página Markets.',
      'Selecciona el resultado: 1 (local), X (empate) o 2 (visitante).',
      'Ingresa el monto en USDT y confirma la transacción.',
      'Tu apuesta queda en un escrow (contrato inteligente) hasta que el partido termine.',
      'Al finalizar, el keeper liquida automáticamente: si acertaste, recibes tu stake + ganancias.',
    ],
  },
  {
    title: 'Cálculo de payout',
    content: 'Las odds se muestran con hasta 3 decimales (ej: 2.000 = 2.0x). El payout se calcula como: monto × odds. Si apuestas 10 USDT a odds 2.5, recibes 25 USDT si ganas.',
  },
  {
    title: 'Liquidación automática',
    content: 'No necesitas hacer nada para cobrar. El keeper bot verifica cada 5 minutos si los partidos terminaron. Si tu apuesta está en lo correcto, el escrow se liquida y recibes los fondos automáticamente en tu wallet. También se liquida al cargar tu portfolio si detecta un partido finalizado.',
  },
  {
    title: 'Tecnología',
    content: [
      'Solana — blockchain de alta velocidad y bajo costo.',
      'Anchor — framework para programas Solana.',
      'TxLINE — oráculo deportivo con datos verificables on-chain.',
      'USDT — moneda estable utilizada como colateral.',
      'Supabase — base de datos y backend para el keeper bot.',
    ],
  },
  {
    title: 'Faucet',
    content: 'Necesitas USDT en Devnet para apostar. Visita la página Faucet desde el menú principal para recibir USDT de prueba. Si no tienes SOL para gas, usa el faucet de Solana Devnet.',
  },
  {
    title: 'Seguridad',
    content: 'Los fondos de cada apuesta están bloqueados en un escrow (programa Anchor). Solo el keeper puede liquidar, y solo cuando el fixture está verificado on-chain. No hay intermediarios ni custodia centralizada.',
  },
];

export default function DocsPage() {
  const t = useTranslations('Docs');
  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:opacity-70 active:scale-95"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <ArrowLeftIcon width={16} height={16} style={{ color: 'var(--text-primary)' }} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <div
            key={s.title}
            className="rounded-2xl p-5 animate-slideUp"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
              animationDelay: `${i * 0.06}s`,
              animationFillMode: 'backwards',
            }}
          >
            <h2 className="text-sm font-bold mb-2 tracking-tight">{s.title}</h2>
            {Array.isArray(s.content) ? (
              <ul className="space-y-1.5">
                {s.content.map((item, j) => (
                  <li key={j} className="text-xs leading-relaxed pl-3" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent-dim)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
