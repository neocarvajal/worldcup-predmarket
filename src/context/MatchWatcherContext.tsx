"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useTxLine } from './TxLineContext';
import { useNotifications } from './NotificationContext';
import { fetchUserEscrows } from '../lib/settlement';
import { detectLocale, t, tWithArgs } from '../lib/locale';

const FINISHED_IDS = [5, 10, 13];
const STORAGE_PREFIX = 'match-watcher:';

function loadSet(key: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSet(key: string, ids: Set<number>) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(Array.from(ids))); } catch {}
}

export function MatchWatcherProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { client } = useTxLine();
  const { addNotification, notificationsEnabled } = useNotifications();

  const startedRef = useRef<Set<number>>(loadSet('started'));
  const finishedRef = useRef<Set<number>>(loadSet('finished'));
  const settledNotifiedRef = useRef<Set<string>>(loadSet('settledNotified'));
  const enabledRef = useRef(notificationsEnabled);
  enabledRef.current = notificationsEnabled;
  const prevWalletRef = useRef(publicKey?.toBase58());
  const fixtureIdsRef = useRef<Set<number>>(new Set());
  const escrowPollRef = useRef(0);
  const namesCacheRef = useRef<Map<number, { p1: string; p2: string }>>(new Map());

  useEffect(() => {
    const walletStr = publicKey?.toBase58();
    if (walletStr !== prevWalletRef.current) {
      prevWalletRef.current = walletStr;
      startedRef.current = new Set();
      finishedRef.current = new Set();
      settledNotifiedRef.current = new Set();
      fixtureIdsRef.current = new Set();
      escrowPollRef.current = 0;
      saveSet('started', startedRef.current);
      saveSet('finished', finishedRef.current);
      saveSet('settledNotified', settledNotifiedRef.current);
    }
  }, [publicKey]);

  const poll = useCallback(async () => {
    if (!publicKey) return;

    try {
      escrowPollRef.current++;
      const shouldRefreshEscrows = escrowPollRef.current % 4 === 1 || fixtureIdsRef.current.size === 0;

      if (shouldRefreshEscrows) {
        const escrows = await fetchUserEscrows(connection, publicKey);
        const activeEscrows = escrows.filter(e => {
          const stateKey = Object.keys(e.account.state)[0];
          return stateKey === 'Active';
        });

        // Detect newly settled escrows for in-app notifications
        const loc = detectLocale();
        for (const e of escrows) {
          const stateKey = Object.keys(e.account.state)[0];
          if (stateKey !== 'Settled') continue;
          const escrowB58 = e.pubkey.toBase58();
          if (settledNotifiedRef.current.has(escrowB58)) continue;
          settledNotifiedRef.current.add(escrowB58);
          saveSet('settledNotified', settledNotifiedRef.current);
          const fixtureName = e.account.fixture_name ?? `Fixture #${e.account.fixture_id}`;
          const isWin = e.account.depositor_won === true;
          if (enabledRef.current) {
            addNotification({
              title: isWin ? t('you_won', loc) : t('you_lost', loc),
              body: isWin
                ? `${fixtureName} — ${t('payment_sent', loc)}`
                : `${fixtureName} — ${t('better_luck', loc)}`,
              type: isWin ? 'won' : 'lost',
              escrowPubkey: escrowB58,
              path: '/portfolio',
            });
          }
        }

        const ids = new Set(
          activeEscrows.map(e => Number(e.account.fixture_id)).filter(id => id > 0)
        );

        if (ids.size === 0) {
          fixtureIdsRef.current = new Set();
          return;
        }
        fixtureIdsRef.current = ids;

        // Fetch participant names for unknown fixture IDs
        const missing = Array.from(ids).filter(id => !namesCacheRef.current.has(id));
        if (missing.length > 0) {
          try {
            const fixturesData = await client.getFixtures({ fixtureId: missing });
            const fixtures = Array.isArray(fixturesData) ? fixturesData : (fixturesData?.Fixtures ?? fixturesData?.fixtures ?? []);
            for (const f of fixtures) {
              const fid = f.FixtureId ?? f.fixtureId;
              const p1 = f.Participant1 ?? f.participant1 ?? '';
              const p2 = f.Participant2 ?? f.participant2 ?? '';
              if (fid && p1 && p2) namesCacheRef.current.set(fid, { p1, p2 });
            }
          } catch {}
        }
      }

      const ids = Array.from(fixtureIdsRef.current);
      if (ids.length === 0) return;

      const snapshots = await Promise.allSettled(
        ids.map((id: number) => client.getScoresSnapshot(id))
      );

      for (const r of snapshots) {
        if (r.status !== 'fulfilled') continue;
        const msgs = Array.isArray(r.value) ? r.value : (r.value?.messages ?? [r.value]);
        if (msgs.length === 0) continue;

        let statusId = 0;
        let p1 = '', p2 = '';
        let score1 = 0, score2 = 0;
        let fid = 0;

        for (const m of msgs) {
          if (m.FixtureId) fid = m.FixtureId;
          if (m.Participant1) p1 = m.Participant1;
          if (m.Participant2) p2 = m.Participant2;
          const sid = m.StatusId ?? m.Update?.StatusId ?? 0;
          if (sid > statusId) statusId = sid;
          const s = m.Score ?? m.Update?.Score;
          if (s?.Participant1?.Total?.Goals != null) score1 = s.Participant1.Total.Goals;
          if (s?.Participant2?.Total?.Goals != null) score2 = s.Participant2.Total.Goals;
        }

        if (!fid) continue;
        // Prefer cached fixture names, then snapshot data, then fallback
        const cached = namesCacheRef.current.get(fid);
        const name1 = cached?.p1 || p1 || '';
        const name2 = cached?.p2 || p2 || '';
        const label = name1 && name2 ? `${name1} vs ${name2}` : `Fixture #${fid}`;

        if (FINISHED_IDS.includes(statusId)) {
          if (!finishedRef.current.has(fid)) {
            finishedRef.current.add(fid);
            saveSet('finished', finishedRef.current);
            fixtureIdsRef.current.delete(fid);

            if (enabledRef.current) {
              const loc = detectLocale();
              addNotification({
                title: t('match_finished', loc),
                body: `${label} ${score1}:${score2}`,
                type: 'info',
                path: '/portfolio',
              });
              fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: t('match_finished', loc),
                  body: `${label} ${score1}:${score2}`,
                  data: { path: '/portfolio' },
                }),
              }).catch(() => {});
            }

            const walletB58 = publicKey.toBase58();
            const loc = detectLocale();
            fetch(`/api/keeper/trigger-settle?fixtureId=${fid}`, { method: 'POST' })
              .then(async (res) => {
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (!data?.results) return;
                for (const r of data.results) {
                  if (r.status !== 'settled' || r.depositor !== walletB58) continue;
                  const isWin = r.depositorWon === true;
                  addNotification({
                    title: isWin ? t('you_won', loc) : t('you_lost', loc),
                    body: isWin
                      ? `${r.fixtureName} — ${t('payment_sent', loc)}`
                      : `${r.fixtureName} — ${t('better_luck', loc)}`,
                    type: isWin ? 'won' : 'lost',
                    escrowPubkey: r.escrowPubkey,
                    path: '/portfolio',
                  });
                }
              })
              .catch(() => {});
          }
          continue;
        }

        if (!startedRef.current.has(fid) && statusId >= 2) {
          startedRef.current.add(fid);
          saveSet('started', startedRef.current);

          if (enabledRef.current) {
            const loc = detectLocale();
            addNotification({
              title: t('match_started', loc),
              body: label,
              type: 'info',
              path: '/live',
            });
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: t('match_started', loc),
                body: label,
                data: { path: '/live' },
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {}
  }, [publicKey, connection, client, addNotification]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    async function run() {
      await poll();
      if (!cancelled) timer = setTimeout(run, 15_000);
    }
    run();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [poll]);

  return <>{children}</>;
}
