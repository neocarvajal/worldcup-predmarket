"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useTxLine } from './TxLineContext';
import type { LiveOddsEntry, SuspensionResult, DirectionResult } from '../lib/oddsTracker';
import { computeDirection, checkSuspension } from '../lib/oddsTracker';

const POLL_INTERVAL = 15_000;

interface LiveOddsContextValue {
  entries: Map<number, LiveOddsEntry>;
  trackFixture: (id: number) => void;
  stopTracking: (id: number) => void;
  isTracking: (id: number) => boolean;
  getSuspension: (id: number) => SuspensionResult;
  getDirection: (id: number) => DirectionResult | null;
}

const LiveOddsContext = createContext<LiveOddsContextValue | null>(null);

export function LiveOddsProvider({ children }: { children: React.ReactNode }) {
  const { client } = useTxLine();
  const [entries, setEntries] = useState<Map<number, LiveOddsEntry>>(new Map());
  const trackedRef = useRef<Set<number>>(new Set());
  const dataRef = useRef<Map<number, LiveOddsEntry>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());
  const trackCountsRef = useRef<Map<number, number>>(new Map());

  const fetchFixture = useCallback(async (id: number) => {
    if (loadingRef.current.has(id)) return;
    loadingRef.current.add(id);
    try {
      const [oddsRaw, scoresRaw] = await Promise.all([
        client.getOdds(id),
        client.getScoresSnapshot(id),
      ]);

      const items = Array.isArray(oddsRaw) ? oddsRaw : (oddsRaw?.data ?? oddsRaw?.markets ?? []);
      const oddsData = items.find(
        (m: any) => m.FixtureId === id || m.fixtureId === id
      ) || items[0] || oddsRaw;

      const homePrice = oddsData?.H?.Price ?? oddsData?.home?.price ?? oddsData?.home ?? 2.0;
      const drawPrice = oddsData?.D?.Price ?? oddsData?.draw?.price ?? oddsData?.draw ?? 3.5;
      const awayPrice = oddsData?.A?.Price ?? oddsData?.away?.price ?? oddsData?.away ?? 2.5;
      const gameState = oddsData?.GameState ?? oddsData?.gameState ?? '';
      const inRunning = oddsData?.InRunning ?? oddsData?.inRunning ?? false;

      const msgs = Array.isArray(scoresRaw) ? scoresRaw : (scoresRaw?.messages ?? [scoresRaw]);
      const getStatusId = (m: any) => m.StatusId ?? m.Update?.StatusId ?? 0;
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const statusId = lastMsg ? getStatusId(lastMsg) : 1;
      let clockSeconds: number | null = null;
      let homeScore = 0;
      let awayScore = 0;
      for (const m of msgs) {
        const secs = m.Clock?.Seconds ?? m.Update?.Clock?.Seconds ?? null;
        if (secs != null) clockSeconds = secs;
        const s = m.Score ?? m.Update?.Score;
        if (s) {
          const g1 = s.Participant1?.Total?.Goals;
          const g2 = s.Participant2?.Total?.Goals;
          if (g1 != null) homeScore = Math.max(homeScore, g1);
          if (g2 != null) awayScore = Math.max(awayScore, g2);
        }
      }

      const prev = dataRef.current.get(id);
      const prevHomeScore = prev?.homeScore ?? 0;
      const prevAwayScore = prev?.awayScore ?? 0;

      let lastGoalTimestamp = prev?.lastGoalTimestamp ?? null;
      if (homeScore > prevHomeScore || awayScore > prevAwayScore) {
        lastGoalTimestamp = Date.now();
      }

      const newEntry: LiveOddsEntry = {
        fixtureId: id,
        homePrice,
        drawPrice,
        awayPrice,
        prevHomePrice: prev?.homePrice ?? null,
        prevDrawPrice: prev?.drawPrice ?? null,
        prevAwayPrice: prev?.awayPrice ?? null,
        gameState,
        statusId,
        clockSeconds,
        lastGoalTimestamp,
        inRunning,
        ts: Date.now(),
        homeScore,
        awayScore,
      };

      dataRef.current.set(id, newEntry);
      setEntries(new Map(dataRef.current));
    } catch {
      // silent
    } finally {
      loadingRef.current.delete(id);
    }
  }, [client]);

  const trackFixture = useCallback((id: number) => {
    const count = trackCountsRef.current.get(id) ?? 0;
    trackCountsRef.current.set(id, count + 1);
    if (!trackedRef.current.has(id)) {
      trackedRef.current.add(id);
      fetchFixture(id);
    }
  }, [fetchFixture]);

  const stopTracking = useCallback((id: number) => {
    const count = trackCountsRef.current.get(id) ?? 1;
    if (count <= 1) {
      trackCountsRef.current.delete(id);
      trackedRef.current.delete(id);
    } else {
      trackCountsRef.current.set(id, count - 1);
    }
  }, []);

  const isTracking = useCallback((id: number) => {
    return trackedRef.current.has(id);
  }, []);

  const getSuspension = useCallback((id: number): SuspensionResult => {
    const entry = dataRef.current.get(id);
    if (!entry) return { suspended: false };
    return checkSuspension(entry);
  }, []);

  const getDirection = useCallback((id: number): DirectionResult | null => {
    const entry = dataRef.current.get(id);
    if (!entry || entry.prevHomePrice == null) return null;
    return computeDirection(
      { homePrice: entry.prevHomePrice, drawPrice: entry.prevDrawPrice!, awayPrice: entry.prevAwayPrice! },
      { homePrice: entry.homePrice, drawPrice: entry.drawPrice, awayPrice: entry.awayPrice },
    );
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const ids = Array.from(trackedRef.current);
      for (const fid of ids) {
        fetchFixture(fid);
      }
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFixture]);

  return (
    <LiveOddsContext.Provider value={{ entries, trackFixture, stopTracking, isTracking, getSuspension, getDirection }}>
      {children}
    </LiveOddsContext.Provider>
  );
}

export function useLiveOdds(): LiveOddsContextValue {
  const ctx = useContext(LiveOddsContext);
  if (!ctx) throw new Error('useLiveOdds must be used within LiveOddsProvider');
  return ctx;
}
