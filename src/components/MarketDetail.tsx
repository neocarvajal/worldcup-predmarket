"use client";

/**
 * MarketDetail — Full fixture betting interface
 * ==============================================
 * Displays team details, countdown, and market tabs (1X2, Over/Under, BTTS).
 * Fetches fixture data and odds from TxLINE. Renders OddsButton for each
 * outcome. Integrates with BetSlipContext for selection management and
 * LiveOddsContext for suspension rules. Shows BalancePill and BetSlipDrawer.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useTxLine } from '../context/TxLineContext';
import { useBetSlip } from '../context/BetSlipContext';
import { useLiveOdds } from '../context/LiveOddsContext';
import { getFlag } from '../lib/flags';
import { tTeam } from '../lib/teams';
import { OddsButton } from './OddsButton';
import { BetSlipDrawer } from './BetSlipDrawer';
import { BalancePill } from './BalancePill';

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
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [marketTab, setMarketTab] = useState<string>('1x2');
  const [ouLineIdx, setOuLineIdx] = useState(0);
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
    let pending = 3;
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

    client.getOdds(fid).then((r: any) => {
      const items: any[] = Array.isArray(r) ? r : (r?.data ?? r?.markets ?? []);
      const filtered = items.filter(
        (m: any) => (m.FixtureId === fid || m.fixtureId === fid || Number(m.fixture_id) === fid)
      );
      setMarkets(filtered.length > 0 ? filtered : [items[0] || r].filter(Boolean));
      dec();
    }).catch(() => dec());
  }, [fixtureId, client]);

  const locale = useLocale();
  const p1 = tTeam(fixture?.Participant1 || fixture?.participant1 || t('home'), locale);
  const p2 = tTeam(fixture?.Participant2 || fixture?.participant2 || t('away'), locale);
  const competition = fixture?.Competition || fixture?.competition || '';
  const startTime = fixture?.StartTime || fixture?.startTime;

  // We use the fixture-status API as the authoritative source of truth
  // (checking [5, 10, 13, 100] + game_finalised action).

  // Redirect to /markets when match is finished and data has loaded
  useEffect(() => {
    if (!loading && finished) {
      router.replace('/markets');
    }
  }, [loading, finished, router]);

  // Flexible price extractor: try named object first, then Prices array, then raw field
  function extractPrice(market: any, fieldName: string, arrayIdx: number, fallback: number): number {
    if (!market) return fallback;
    const byName = market[fieldName];
    if (byName?.Price != null) return Number(byName.Price);
    if (byName?.price != null) return Number(byName.price);
    if (typeof byName === 'number') return byName;
    if (typeof byName === 'string' && !isNaN(Number(byName))) return Number(byName);
    if (market.Prices?.[arrayIdx] != null) return Number(market.Prices[arrayIdx]);
    return fallback;
  }

  function parseLineFromName(name: string): string | null {
    const m = name.match(/([\d.]+)/);
    return m ? m[1] : null;
  }

  // Detect market types by PriceNames content (more reliable than SuperOddsType)
  const market1x2 = markets.find((m: any) => {
    const names = m.PriceNames ?? [];
    return m.SuperOddsType === 'MatchResult' || names.includes('1') && names.includes('X') && names.includes('2');
  });

  const ouMarkets = markets.filter((m: any) => {
    const names = m.PriceNames ?? [];
    return names.some((n: string) => /^over\b/i.test(n)) && names.some((n: string) => /^under\b/i.test(n));
  });

  const marketBTTS = markets.find((m: any) => {
    const names = m.PriceNames ?? [];
    return names.includes('Yes') && names.includes('No');
  });

  // Use live entry for 1X2 if available, else fall back to fetched static odds
  const homeOdds = liveEntry?.homePrice ?? extractPrice(market1x2, 'H', 0, 2.0);
  const drawOdds = liveEntry?.drawPrice ?? extractPrice(market1x2, 'D', 1, 3.5);
  const awayOdds = liveEntry?.awayPrice ?? extractPrice(market1x2, 'A', 2, 2.5);

  // Over/Under — support multiple lines
  const activeOU = ouMarkets[ouLineIdx] ?? ouMarkets[0] ?? null;
  const ouLine = activeOU
    ? (activeOU.MarketParameters || parseLineFromName(activeOU.PriceNames?.[0] ?? '') || '2.5')
    : null;
  const ouPriceOver = activeOU ? extractPrice(activeOU, 'Over', 0, 2.0) : 0;
  const ouPriceUnder = activeOU ? extractPrice(activeOU, 'Under', 1, 2.0) : 0;

  // BTTS
  const bttsPriceYes = marketBTTS ? extractPrice(marketBTTS, 'Yes', 0, 2.0) : 0;
  const bttsPriceNo = marketBTTS ? extractPrice(marketBTTS, 'No', 1, 2.0) : 0;

  const directionHome = direction?.home ?? null;
  const directionDraw = direction?.draw ?? null;
  const directionAway = direction?.away ?? null;
  const pctHome = direction?.homePct ?? 0;
  const pctDraw = direction?.drawPct ?? 0;
  const pctAway = direction?.awayPct ?? 0;

  const marketTabs: { key: string; label: string; enabled: boolean }[] = [
    { key: '1x2', label: '1×2', enabled: !!market1x2 || !!liveEntry },
    { key: 'ou', label: 'Over/Under', enabled: ouMarkets.length > 0 },
    { key: 'btts', label: 'BTTS', enabled: !!marketBTTS },
  ];

  const handleSelect = (selKey: string, odds: number, label: string) => {
    if (finished || suspension.suspended) return;
    setSelected(selKey);
    addSelection({
      fixtureId: parseInt(fixtureId),
      fixtureName: `${p1} vs ${p2}`,
      selection: selKey,
      odds,
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
      {/* Subnav: back + balance */}
      <div className="flex items-center justify-between mb-4 -mx-1">
        <Link href="/markets" className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-70 active:scale-95"
          style={{ color: 'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-muted)' }}>
            <path d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
          </svg>
          {t('back')}
        </Link>
        <BalancePill />
      </div>
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

          {/* Market type tabs */}
          <div className="flex gap-1.5 mb-4 justify-center">
            {marketTabs.filter(t => t.enabled).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setMarketTab(tab.key); setSelected(null); }}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200"
                style={{
                  background: marketTab === tab.key ? 'var(--accent)' : 'var(--bg-surface)',
                  color: marketTab === tab.key ? '#000' : 'var(--text-secondary)',
                  border: `1px solid ${marketTab === tab.key ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1X2 odds */}
          {marketTab === '1x2' && (
            <div className="flex gap-3">
              <OddsButton name={p1} odds={homeOdds} selected={selected === '1'} onClick={() => handleSelect('1', homeOdds, p1)} flag={flag1}
                direction={directionHome} pctChange={pctHome} live={!!liveEntry} />
              <OddsButton name={t('draw')} odds={drawOdds} selected={selected === 'X'} onClick={() => handleSelect('X', drawOdds, t('draw'))} flag="⚖️"
                direction={directionDraw} pctChange={pctDraw} live={!!liveEntry} />
              <OddsButton name={p2} odds={awayOdds} selected={selected === '2'} onClick={() => handleSelect('2', awayOdds, p2)} flag={flag2}
                direction={directionAway} pctChange={pctAway} live={!!liveEntry} />
            </div>
          )}

          {/* Over/Under odds */}
          {marketTab === 'ou' && (
            <>
              {ouMarkets.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-3 justify-center max-w-full overflow-hidden">
                  {ouMarkets.map((_, i) => {
                    const line = _.MarketParameters || parseLineFromName(_.PriceNames?.[0] ?? '') || '?';
                    return (
                      <button key={i} onClick={() => { setOuLineIdx(i); setSelected(null); }}
                        className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200"
                        style={{
                          background: ouLineIdx === i ? 'var(--accent)' : 'var(--bg-surface)',
                          color: ouLineIdx === i ? '#000' : 'var(--text-secondary)',
                          border: `1px solid ${ouLineIdx === i ? 'var(--accent)' : 'var(--border)'}`,
                        }}>
                        {line}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeOU ? (
                <>
                  <p className="text-center text-[10px] mb-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t.rich('ouDesc', { strong: (chunks: React.ReactNode) => <strong>{chunks}</strong> })}
                  </p>
                  {ouLine && !isNaN(Number(ouLine)) && (
                    <p className="text-center text-[9px] mb-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {t('ouHelp', { line: ouLine, over: Number(ouLine) + 1, under: Number(ouLine) })}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <OddsButton name={`Over ${ouLine}`} odds={ouPriceOver} selected={selected === 'Over'}
                      onClick={() => handleSelect('Over', ouPriceOver, `Over ${ouLine}`)} flag="⬆️"
                      live={!!liveEntry} />
                    <OddsButton name={`Under ${ouLine}`} odds={ouPriceUnder} selected={selected === 'Under'}
                      onClick={() => handleSelect('Under', ouPriceUnder, `Under ${ouLine}`)} flag="⬇️"
                      live={!!liveEntry} />
                  </div>
                </>
              ) : (
                <p className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
                  {t('ouUnavailable')}
                </p>
              )}
            </>
          )}

          {/* BTTS odds */}
          {marketTab === 'btts' && (
            <>
              {marketBTTS ? (
                <>
                  <p className="text-center text-[10px] mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t.rich('bttsDesc', { strong: (chunks: React.ReactNode) => <strong>{chunks}</strong> })}
                  </p>
                  <div className="flex gap-3">
                    <OddsButton name="BTTS Yes" odds={bttsPriceYes} selected={selected === 'BTTS Yes'}
                      onClick={() => handleSelect('BTTS Yes', bttsPriceYes, 'BTTS Yes')} flag="✅"
                      live={!!liveEntry} />
                    <OddsButton name="BTTS No" odds={bttsPriceNo} selected={selected === 'BTTS No'}
                      onClick={() => handleSelect('BTTS No', bttsPriceNo, 'BTTS No')} flag="❌"
                      live={!!liveEntry} />
                  </div>
                </>
              ) : (
                <p className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
                  {t('bttsUnavailable')}
                </p>
              )}
            </>
          )}
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
