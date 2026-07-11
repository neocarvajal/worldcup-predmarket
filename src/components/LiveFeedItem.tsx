"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { getFlag } from '../lib/flags';
import { tTeam } from '../lib/teams';

const TXLINE_PLAYING = new Set(['H1', 'H2', 'ET1', 'ET2', 'PE']);
const TXLINE_PAUSED = new Set(['HT', 'HTET', 'WET', 'WPE']);
const TXLINE_FINISHED = new Set(['F', 'FET', 'FPE']);

interface MatchEvent {
  type: 'goal' | 'goal_own' | 'goal_penalty' | 'yellow_card' | 'red_card' | 'var' | 'var_end';
  team: 1 | 2;
  minute: number;
  player?: string;
  playerId?: number;
  annulled?: boolean;
  varType?: string;
  varOutcome?: string;
  homeScore: number;
  awayScore: number;
  seq: number;
}

interface LiveFeedItemProps {
  fixtureId: number;
  participant1: string;
  participant2: string;
  score1: number;
  score2: number;
  minute?: number;
  status: string;
  events?: MatchEvent[];
}

function getPeriodSeconds(statusId: number): number {
  if (statusId >= 7 && statusId <= 9) return 900;
  return 2700;
}

function computeMinute(statusId: number, clockSeconds: number): number {
  return Math.max(0, Math.floor((getPeriodSeconds(statusId) - clockSeconds) / 60));
}

function EventIcon({ type, annulled }: { type: string; annulled?: boolean }) {
  if (type === 'goal_own') return <span className="text-sm">⚽</span>;
  if (type === 'goal_penalty' || type === 'goal') {
    if (annulled) return <span className="text-sm line-through opacity-60">⚽</span>;
    return <span className="text-sm">⚽</span>;
  }
  if (type === 'yellow_card') return <span className="text-sm">🟨</span>;
  if (type === 'red_card') return <span className="text-sm">🟥</span>;
  if (type === 'var') return <span className="text-xs font-bold" style={{ color: 'var(--warning)' }}>VAR</span>;
  if (type === 'var_end') return <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>VAR</span>;
  return null;
}

export const LiveFeedItem: React.FC<LiveFeedItemProps> = ({
  fixtureId, participant1, participant2, score1, score2, minute, status, events,
}) => {
  const t = useTranslations('LiveFeedItem');
  const locale = useLocale();
  const s = status?.toUpperCase() || '';
  const isPlaying = TXLINE_PLAYING.has(s);
  const isPaused = TXLINE_PAUSED.has(s);
  const isFinished = TXLINE_FINISHED.has(s);
  const isAbnormal = ['I', 'A', 'C', 'TXCC', 'TXCS'].includes(s);
  const isPostponed = s === 'P';
  const isNotStarted = s === 'NS' || (!s || s === '');

  const [tab, setTab] = React.useState<'summary' | 'events'>('summary');

  const flag1 = getFlag(participant1);
  const flag2 = getFlag(participant2);
  const show1 = tTeam(participant1, locale);
  const show2 = tTeam(participant2, locale);
  const statusLabel = t(s.toLowerCase());

  const displayEvents = React.useMemo(() => {
    if (!events || events.length === 0) return [];
    return events.filter(e => e.type !== 'var' && e.type !== 'var_end').slice(0, 30);
  }, [events]);

  const anyEvent = displayEvents.length > 0;
  const eventCount = events?.length ?? 0;

  function Badge() {
    if (isPlaying) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(34,197,94,0.1)',
            color: 'var(--success)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--success)' }} />
          {statusLabel}
        </span>
      );
    }
    if (isPaused) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(245,158,11,0.1)',
            color: 'var(--warning)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warning)' }} />
          {statusLabel}
        </span>
      );
    }
    if (isFinished) {
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {statusLabel}
        </span>
      );
    }
    if (s === 'I') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(245,158,11,0.1)',
            color: 'var(--warning)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--warning)' }} />
          {statusLabel}
        </span>
      );
    }
    if (s === 'A') {
      return (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(255,68,68,0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(255,68,68,0.2)',
          }}
        >
          {statusLabel}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        {statusLabel}
      </span>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top row: competition + status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid rgba(220,235,2,0.15)',
            }}
          >
            {t('worldCup')}
          </span>
        </div>
        <Badge />
      </div>

      {tab === 'summary' ? (
        <>
          {/* Teams + score row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--border)',
                }}
              >
                <span className="text-lg leading-none">{flag1 || '🏳️'}</span>
              </div>
              <span className="text-sm font-semibold truncate">{show1}</span>
            </div>

            <div className="flex flex-col items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  {score1}
                </span>
                <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
                <span
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  {score2}
                </span>
              </div>
              {minute != null && minute > 0 && !isFinished && (
                <span className="flex items-center gap-1 mt-0.5">
                  {isPlaying && (
                    <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-dot" />
                  )}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: isPlaying ? 'var(--danger)' : 'var(--text-muted)' }}
                  >
                    {t('minute', { m: minute })}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <span className="text-sm font-semibold truncate">{show2}</span>
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '2px solid var(--border)',
                }}
              >
                <span className="text-lg leading-none">{flag2 || '🏳️'}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Events tab */
        <div className="mb-2">
          {anyEvent ? (
            <div className="space-y-1.5">
              {displayEvents.map((ev, i) => (
                <div key={`${ev.seq}-${i}`} className="flex items-center gap-2 py-1.5 px-2 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                  <div className="flex items-center justify-center shrink-0" style={{ width: 22, height: 22 }}>
                    <EventIcon type={ev.type} annulled={ev.annulled} />
                  </div>
                  <span className="text-[11px] font-mono font-medium tabular-nums" style={{ color: 'var(--text-muted)', minWidth: 32 }}>
                    {ev.minute}&apos;
                  </span>
                  <span className="text-xs font-semibold truncate" style={{ minWidth: 0 }}>
                    {ev.team === 1 ? show1 : show2}
                  </span>
                  {ev.annulled && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--danger)' }}>
                      Anulado
                    </span>
                  )}
                  {ev.type === 'goal_own' && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      (own goal)
                    </span>
                  )}
                  {ev.type === 'goal_penalty' && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      (pen.)
                    </span>
                  )}
                  {ev.type === 'red_card' && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--danger)' }}>
                      Red
                    </span>
                  )}
                  {ev.player && (
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      — {ev.player}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {ev.homeScore}-{ev.awayScore}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No events yet</span>
            </div>
          )}
        </div>
      )}

      {/* Tab pills + bottom row */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab('summary')}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${tab === 'summary' ? '' : 'opacity-60 hover:opacity-100'}`}
            style={{
              background: tab === 'summary' ? 'var(--accent)' : 'var(--bg-surface)',
              color: tab === 'summary' ? '#000' : 'var(--text-muted)',
              border: `1px solid ${tab === 'summary' ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            Resumen
          </button>
          {anyEvent && (
            <button
              onClick={() => setTab('events')}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${tab === 'events' ? '' : 'opacity-60 hover:opacity-100'}`}
              style={{
                background: tab === 'events' ? 'var(--accent)' : 'var(--bg-surface)',
                color: tab === 'events' ? '#000' : 'var(--text-muted)',
                border: `1px solid ${tab === 'events' ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              Eventos ({eventCount})
            </button>
          )}
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          #{fixtureId}
        </span>
      </div>
    </div>
  );
};
