"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTxLine } from '../../context/TxLineContext';
import { TxLineAuthError } from '../../txlineSkill';
import { LiveFeedItem } from '../../components/LiveFeedItem';
import { ActivityLogIcon, ReloadIcon } from '@radix-ui/react-icons';

export default function LivePage() {
  const { client } = useTxLine();
  const [events, setEvents] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'no-auth'>('connecting');
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const cancelledRef = useRef(false);

  const connect = useCallback(async () => {
    setConnectionState('connecting');
    cancelledRef.current = false;
    let authError = false;
    try {
      const stream = await client.streamScores();
      const reader = stream.getReader();
      readerRef.current = reader;
      setConnectionState('connected');
      const decoder = new TextDecoder();
      while (!cancelledRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5));
            setEvents(prev => {
              const existing = prev.findIndex(e => e.FixtureId === data.FixtureId);
              if (existing >= 0) {
                const next = [...prev];
                next[existing] = data;
                return next;
              }
              return [data, ...prev].slice(0, 50);
            });
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e instanceof TxLineAuthError || e?.message?.includes('JWT') || e?.message?.includes('token') || e?.message?.includes('401') || e?.message?.includes('403')) {
        setConnectionState('no-auth');
        authError = true;
      } else {
        setConnectionState('error');
      }
    }
    if (!cancelledRef.current && !authError) {
      setTimeout(connect, 10000);
    }
    return () => { cancelledRef.current = true; readerRef.current?.cancel(); };
  }, [client]);

  useEffect(() => {
    const cleanup = connect();
    return () => { cleanup.then(fn => fn?.()); };
  }, [connect]);

  const handleRetry = () => {
    connect();
  };

  const indicatorColor = connectionState === 'connected' ? 'var(--success)' :
    connectionState === 'connecting' ? 'var(--warning)' :
    connectionState === 'no-auth' ? 'var(--text-muted)' : 'var(--danger)';

  const indicatorBg = connectionState === 'connected' ? 'rgba(34,197,94,0.08)' :
    connectionState === 'connecting' ? 'rgba(245,158,11,0.08)' :
    connectionState === 'no-auth' ? 'var(--bg-surface)' : 'rgba(255,68,68,0.08)';

  const indicatorBorder = connectionState === 'connected' ? 'rgba(34,197,94,0.2)' :
    connectionState === 'connecting' ? 'rgba(245,158,11,0.2)' :
    connectionState === 'no-auth' ? 'var(--border)' : 'rgba(255,68,68,0.2)';

  const indicatorText = connectionState === 'connected' ? 'Conectado' :
    connectionState === 'connecting' ? 'Conectando...' :
    connectionState === 'no-auth' ? 'Sin auth' : 'Error';

  const barHeights = [8, 14, 20, 26, 32, 26, 20, 14, 8];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn">
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
            <ActivityLogIcon width={22} height={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">En Vivo</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Scores en tiempo real</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300"
          style={{
            background: indicatorBg,
            border: `1px solid ${indicatorBorder}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: indicatorColor,
              boxShadow: connectionState === 'connected'
                ? `0 0 8px ${indicatorColor}`
                : 'none',
              animation: connectionState === 'connecting'
                ? 'pulse-dot 1.4s ease-in-out infinite'
                : 'none',
            }}
          />
          <span
            className="text-[11px] font-semibold"
            style={{ color: indicatorColor }}
          >
            {indicatorText}
          </span>
        </div>
      </div>

      {connectionState === 'no-auth' ? (
        <div className="text-center py-20 animate-scaleIn">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--accent-dim)' }}
          >
            <ActivityLogIcon width={28} height={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">TxLINE no configurado</h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Conecta tu wallet y activa una suscripción TxLINE gratuita para recibir datos en vivo.
          </p>
        </div>
      ) : connectionState === 'error' ? (
        <div className="text-center py-20 animate-scaleIn">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'rgba(255,68,68,0.1)' }}
          >
            <ActivityLogIcon width={28} height={28} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">Error de conexión</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            No se pudo conectar al servicio en vivo. Reintentando automáticamente...
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95"
            style={{
              background: 'var(--accent)',
              color: '#000',
            }}
          >
            <ReloadIcon width={16} height={16} />
            Reintentar ahora
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 animate-scaleIn">
          <div className="flex items-end justify-center gap-1.5 mb-8 h-8">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: h,
                  background: 'var(--accent-dim)',
                  animation: 'pulse-dot 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <ActivityLogIcon width={26} height={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2">Esperando señal en vivo</h2>
          <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            No hay partidos en vivo en este momento. Los scores aparecerán automáticamente cuando comience un partido.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              En vivo
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {events.length} {events.length === 1 ? 'partido' : 'partidos'}
            </span>
          </div>
          {events.map((e, idx) => (
            <div
              key={e.FixtureId ?? `event-${idx}`}
              className="animate-slideUp"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <LiveFeedItem
                fixtureId={e.FixtureId}
                participant1={e.Participant1 || 'Local'}
                participant2={e.Participant2 || 'Visitante'}
                score1={e.Score1 ?? 0}
                score2={e.Score2 ?? 0}
                minute={e.Minute ?? 0}
                status={e.Status || 'live'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
