"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTxLine } from '../context/TxLineContext';
import { useBetSlip } from '../context/BetSlipContext';
import { getFlag } from '../lib/flags';
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
  const { client } = useTxLine();
  const { addSelection, selections } = useBetSlip();
  const t = useTranslations('MarketDetail');

  const [fixture, setFixture] = useState<any>(null);
  const [odds, setOdds] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<'1' | 'X' | '2' | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!fixtureId) return;
    const fid = parseInt(fixtureId);
    Promise.all([
      client.getFixtures({ fixtureId: fid }).then((r: any) => {
        const items: any[] = Array.isArray(r) ? r : (r?.data ?? []);
        const found = items.find(
          (f: any) =>
            f.FixtureId === fid ||
            f.fixtureId === fid ||
            Number(f.id) === fid
        );
        setFixture(found || items[0] || r);
      }),
      client.getOdds(fid).then((r: any) => {
        const items: any[] = Array.isArray(r) ? r : (r?.data ?? r?.markets ?? []);
        const found = items.find(
          (m: any) =>
            m.FixtureId === fid ||
            m.fixtureId === fid ||
            Number(m.fixture_id) === fid
        );
        setOdds(found || items[0] || r);
      }),
      client.getScoresSnapshot(fid).then((r: any) => {
        const msgs = Array.isArray(r) ? r : (r?.messages ?? [r]);
        const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        setFinished([5, 10, 13].includes(last?.StatusId ?? 0));
      }).catch(() => setFinished(false)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [fixtureId, client]);

  const p1 = fixture?.Participant1 || fixture?.participant1 || t('home');
  const p2 = fixture?.Participant2 || fixture?.participant2 || t('away');
  const competition = fixture?.Competition || fixture?.competition || '';
  const startTime = fixture?.StartTime || fixture?.startTime;

  const homeOdds = odds?.H?.Price ?? odds?.home?.price ?? odds?.home ?? 2.0;
  const drawOdds = odds?.D?.Price ?? odds?.draw?.price ?? odds?.draw ?? 3.5;
  const awayOdds = odds?.A?.Price ?? odds?.away?.price ?? odds?.away ?? 2.5;

  const handleSelect = (selection: '1' | 'X' | '2') => {
    if (finished) return;
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
        <div className="flex gap-3">
          <OddsButton
            name={p1}
            odds={homeOdds}
            selected={selected === '1'}
            onClick={() => handleSelect('1')}
            flag={flag1}
          />
          <OddsButton
            name={t('draw')}
            odds={drawOdds}
            selected={selected === 'X'}
            onClick={() => handleSelect('X')}
            flag="⚖️"
          />
          <OddsButton
            name={p2}
            odds={awayOdds}
            selected={selected === '2'}
            onClick={() => handleSelect('2')}
            flag={flag2}
          />
        </div>
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
