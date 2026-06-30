"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTxLine } from '../../context/TxLineContext';
import { TxLineAuthError } from '../../txlineSkill';
import { LiveFeedItem } from '../../components/LiveFeedItem';
import { ActivityLogIcon, ReloadIcon } from '@radix-ui/react-icons';

const STATUS_NAMES: Record<number, string> = {
  1: 'NS', 2: 'H1', 3: 'HT', 4: 'H2', 5: 'F',
  6: 'WET', 7: 'ET1', 8: 'HTET', 9: 'ET2', 10: 'FET',
  11: 'WPE', 12: 'PE', 13: 'FPE', 14: 'I', 15: 'A',
  16: 'C', 17: 'TXCC', 18: 'TXCS', 19: 'P',
};

const LIVE_STATUS_IDS = new Set([2, 4, 7, 9, 12]);

function periodSeconds(statusId: number): number {
  if (statusId >= 7 && statusId <= 9) return 900;
  return 2700;
}

function normalizeScoreEvent(raw: any, cache: Map<number, any>): any {
  const info = raw.FixtureInfo || {};
  const upd = raw.Update || {};
  const fixtureId = info.FixtureId ?? upd.FixtureId ?? raw.FixtureId;
  if (fixtureId == null) return null;
  if (info.FixtureId != null) cache.set(fixtureId, info);
  const cached = cache.get(fixtureId) || {};
  const statusId = upd.StatusId ?? info.StatusId ?? 2;
  const clock = upd.Clock || {};
  let minute = 0;
  if (clock.Seconds != null) {
    minute = Math.max(0, Math.floor((periodSeconds(statusId) - clock.Seconds) / 60));
  }
  const score = upd.Score || {};
  return {
    FixtureId: fixtureId,
    Participant1: info.Participant1 ?? cached.Participant1 ?? 'Local',
    Participant2: info.Participant2 ?? cached.Participant2 ?? 'Visitante',
    Score1: score.Participant1?.Total?.Goals ?? 0,
    Score2: score.Participant2?.Total?.Goals ?? 0,
    Minute: minute,
    Status: upd.Data?.StatusName ?? STATUS_NAMES[statusId] ?? 'LIVE',
    StatusId: statusId,
  };
}

export default function LivePage() {
  const { client } = useTxLine();
  const [events, setEvents] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'no-auth'>('connecting');
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const cancelledRef = useRef(false);
  const cacheRef = useRef<Map<number, any>>(new Map());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    client.getFixtures().then((data: any) => {
      const fixtures = data?.Fixtures ?? data?.fixtures ?? data ?? [];
      if (!Array.isArray(fixtures)) return;
      const live: any[] = [];
      for (const f of fixtures) {
        const id = f.FixtureId ?? f.fixtureId ?? f.id;
        if (id == null) continue;
        cacheRef.current.set(id, f);
        const sid = f.StatusId ?? f.statusId;
        if (sid != null && LIVE_STATUS_IDS.has(sid)) {
          live.push({
            FixtureId: id,
            Participant1: f.Participant1 ?? f.participant1 ?? 'Local',
            Participant2: f.Participant2 ?? f.participant2 ?? 'Visitante',
            Score1: 0, Score2: 0, Minute: 0,
            Status: STATUS_NAMES[sid] ?? 'LIVE',
            StatusId: sid,
          });
        }
      }
      if (live.length > 0) {
        setEvents(prev => [...live, ...prev].slice(0, 50));
      }
    }).catch(() => {});
  }, [client]);

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
            const raw = JSON.parse(line.slice(5));
            const d = normalizeScoreEvent(raw, cacheRef.current);
            if (!d) continue;
            setEvents(prev => {
              const idx = prev.findIndex(e => e.FixtureId === d.FixtureId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = d;
                return next;
              }
              return [d, ...prev].slice(0, 50);
            });
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (e instanceof TxLineAuthError || msg.includes('JWT') || msg.includes('token') || msg.includes('401') || msg.includes('403')) {
        setConnectionState('no-auth');
        authError = true;
      } else {
        setConnectionState('error');
      }
    }
    if (!cancelledRef.current && !authError) {
      retryTimerRef.current = setTimeout(() => {
        if (!cancelledRef.current) connect();
      }, 10000);
    }
  }, [client]);

  useEffect(() => {
    connect();
    return () => {
      cancelledRef.current = true;
      readerRef.current?.cancel();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
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
          {connectionState === 'connecting' ? (
            <div
              className="w-3 h-3 rounded-full animate-spin"
              style={{
                border: '2px solid transparent',
                borderTopColor: 'var(--warning)',
                borderRightColor: 'var(--warning)',
              }}
            />
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: indicatorColor,
                boxShadow: connectionState === 'connected'
                  ? `0 0 8px ${indicatorColor}`
                  : 'none',
              }}
            />
          )}
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
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-10 h-10 rounded-full animate-spin"
              style={{
                border: '3px solid var(--accent-dim)',
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
              }}
            />
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
