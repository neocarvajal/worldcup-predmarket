"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useTxLine } from '../context/TxLineContext';
import { useBetSlip } from '../context/BetSlipContext';
import { useLiveOdds } from '../context/LiveOddsContext';
import { getFlag } from '../lib/flags';
import { tTeam } from '../lib/teams';
import { OddsButton } from './OddsButton';
import { BetSlipDrawer } from './BetSlipDrawer';

function parseDate(v: string | number): Date {
  const n = Number(v);
  if (!isNaN(n)) {
    return n > 1e12 ? new Date(n) : new Date(n * 1000);
  }
  return new Date(v);
}

function formatDate(date: Date, t: (key: string) => string): string {
  const months = [
    t('month.1'), t('month.2'), t('month.3'), t('month.4'), t('month.5'), t('month.6'),
    t('month.7'), t('month.8'), t('month.9'), t('month.10'), t('month.11'), t('month.12'),
  ];
  const days = [t('dayShort.0'), t('dayShort.1'), t('dayShort.2'), t('dayShort.3'), t('dayShort.4'), t('dayShort.5'), t('dayShort.6')];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function CountdownLarge({ target }: { target: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now;
  if (diff <= 0) return null;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-2 text-sm tabular-nums" style={{ color: 'var(--accent)' }}>
      {d > 0 && <span className="font-bold">{d}d</span>}
      <span className="font-bold">{String(h).padStart(2, '0')}h</span>
      <span className="font-bold">{String(m).padStart(2, '0')}m</span>
      <span className="font-bold">{String(s).padStart(2, '0')}s</span>
    </div>
  );
}

export const MarketDetail: React.FC = () => {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const router = useRouter();
  const { client } = useTxLine();
  const { addSelection, selections } = useBetSlip();
  const { entries, trackFixture, stopTracking, isTracking, getSuspension, getDirection } = useLiveOdds();
  const t = useTranslations('MarketDetail');

  const [fixture, setFixture] = useState<any>(null);
  const [odds, setOdds] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<'1' | 'X' | '2' | null>(null);
  const [finished, setFinished] = useState(false);

  const fid = fixtureId ? parseInt(fixtureId) : 0;
  const liveEntry = entries.get(fid);
  const suspension = getSuspension(fid);
  const direction = getDirection(fid);

  // Track fixture in LiveOddsContext for live odds + suspension
  useEffect(() => {
    if (!fid) return;
    if (!isTracking(fid)) trackFixture(fid);
    return () => { if (isTracking(fid)) stopTracking(fid); };
  }, [fid]);

  useEffect(() => {
    if (!fixtureId) return;
    const fid = parseInt(fixtureId);
    let pending = 2;
    const dec = () => { pending--; if (pending === 0) setLoading(false); };

    // Check fixture-status via our authoritative API (handles StatusId=100, game_finalised)
    fetch(`/api/keeper/fixture-status?fixtureId=${fid}`).then(r => r.json()).then((data: any) => {
      if (data && typeof data.finished === 'boolean') {
        setFinished(data.finished);
      }
      dec();
    }).catch(() => dec());

    client.getFixtures({ fixtureId: fid }).then((r: any) => {
      const items: any[] = Array.isArray(r) ? r : (r?.data ?? []);
      const found = items.find(
        (f: any) => f.FixtureId === fid || f.fixtureId === fid || Number(f.id) === fid
      );
      setFixture(found || items[0] || r);
      dec();
    }).catch(() => dec());
  }, [fixtureId, client]);

  const locale = useLocale();
  const p1 = tTeam(fixture?.Participant1 || fixture?.participant1 || t('home'), locale);
  const p2 = tTeam(fixture?.Participant2 || fixture?.participant2 || t('away'), locale);
  const competition = fixture?.Competition || fixture?.competition || '';
  const startTime = fixture?.StartTime || fixture?.startTime;

  // Time heuristic: if match started > 2.5h ago, treat as finished
  useEffect(() => {
    if (startTime) {
      const st = Number(startTime) > 1e12 ? Number(startTime) : Number(startTime) * 1000;
      if (Date.now() > st + 2.5 * 60 * 60 * 1000) {
        setFinished(true);
      }
    }
  }, [startTime]);

  // Redirect to /markets when match is finished and data has loaded
  useEffect(() => {
    if (!loading && finished) {
      router.replace('/markets');
    }
  }, [loading, finished, router]);

  // Use live odds if available, else fall back to fetched static odds
  const homeOdds = liveEntry?.homePrice ?? odds?.H?.Price ?? odds?.home?.price ?? odds?.home ?? 2.0;
  const drawOdds = liveEntry?.drawPrice ?? odds?.D?.Price ?? odds?.draw?.price ?? odds?.draw ?? 3.5;
  const awayOdds = liveEntry?.awayPrice ?? odds?.A?.Price ?? odds?.away?.price ?? odds?.away ?? 2.5;

  const directionHome = direction?.home ?? null;
  const directionDraw = direction?.draw ?? null;
  const directionAway = direction?.away ?? null;
  const pctHome = direction?.homePct ?? 0;
  const pctDraw = direction?.drawPct ?? 0;
  const pctAway = direction?.awayPct ?? 0;

  const handleSelect = (selection: '1' | 'X' | '2') => {
    if (finished || suspension.suspended) return;
    setSelected(selection);
    const label = selection === '1' ? p1 : selection === '2' ? p2 : t('draw');
    const oddVal = selection === '1' ? homeOdds : selection === '2' ? awayOdds : drawOdds;
    addSelection({
      fixtureId: parseInt(fixtureId),
      fixtureName: `${p1} vs ${p2}`,
      selection,
      odds: oddVal,
      label,
      startTime: startTime ? Number(startTime) : undefined,
    });
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 animate-fadeIn">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-52 w-full" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  // While redirecting to /markets for finished matches, show minimal UI
  if (finished) {
    return null;
  }

  const flag1 = getFlag(p1);
  const flag2 = getFlag(p2);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-fadeIn">
      {competition && (
        <span className="badge badge-accent mb-3">{competition}</span>
      )}

      <div className="card card-highlight mb-6 text-center">
        <div className="flex items-center justify-center gap-4 mb-3">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="flex items-center justify-center text-xl"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border)',
              }}
            >
              {flag1 || '🏳️'}
            </div>
            <span className="text-sm font-bold">{p1}</span>
          </div>
          <div className="flex flex-col items-center px-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t('vs')}</span>
            <div className="w-8 h-px my-2" style={{ background: 'var(--border)' }} />
            {startTime && <CountdownLarge target={parseDate(startTime)} />}
          </div>
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="flex items-center justify-center text-xl"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '2px solid var(--border)',
              }}
            >
              {flag2 || '🏳️'}
            </div>
            <span className="text-sm font-bold">{p2}</span>
          </div>
        </div>
          {startTime && (
          <p className="text-caption mt-2">{startTime ? formatDate(parseDate(startTime), t) : ''}</p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="title-card mb-3 text-center">
          {finished ? t('matchFinished') : t('selectPrediction')}
        </h3>
        {finished ? (
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
              {t('matchFinishedDesc')}
            </p>
          </div>
        ) : (
          <>
          {suspension.suspended && (
            <div
              className="mb-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-center animate-slideUp"
              style={{
                background: 'rgba(255,68,68,0.1)',
                color: 'var(--danger)',
                border: '1px solid rgba(255,68,68,0.2)',
              }}
            >
              ⏸️ {suspension.reason}
            </div>
          )}
          <div className="flex gap-3">
            <OddsButton
              name={p1}
              odds={homeOdds}
              selected={selected === '1'}
              onClick={() => handleSelect('1')}
              flag={flag1}
              direction={directionHome}
              pctChange={pctHome}
              live={!!liveEntry}
            />
            <OddsButton
              name={t('draw')}
              odds={drawOdds}
              selected={selected === 'X'}
              onClick={() => handleSelect('X')}
              flag="⚖️"
              direction={directionDraw}
              pctChange={pctDraw}
              live={!!liveEntry}
            />
            <OddsButton
              name={p2}
              odds={awayOdds}
              selected={selected === '2'}
              onClick={() => handleSelect('2')}
              flag={flag2}
              direction={directionAway}
              pctChange={pctAway}
              live={!!liveEntry}
            />
          </div>
          </>
        )}
      </div>

      <div className="card text-center py-4" style={{ borderColor: selections.length > 0 ? 'var(--accent)' : 'var(--border)' }}>
        <p className="text-sm" style={{ color: selections.length > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {selections.length > 0
            ? `${selections.length} ${t('selections')}`
            : t('selectOutcome')}
        </p>
      </div>

      <BetSlipDrawer />
    </div>
  );
};
