export interface LiveOdds {
  homePrice: number;
  drawPrice: number;
  awayPrice: number;
}

export interface LiveOddsEntry extends LiveOdds {
  fixtureId: number;
  prevHomePrice: number | null;
  prevDrawPrice: number | null;
  prevAwayPrice: number | null;
  gameState: string;
  statusId: number;
  clockSeconds: number | null;
  lastGoalTimestamp: number | null;
  inRunning: boolean;
  ts: number;
  homeScore: number;
  awayScore: number;
}

export interface SuspensionResult {
  suspended: boolean;
  reason?: string;
}

export interface DirectionResult {
  home: 'up' | 'down' | null;
  draw: 'up' | 'down' | null;
  away: 'up' | 'down' | null;
  homePct: number;
  drawPct: number;
  awayPct: number;
}

export function computeDirection(prev: LiveOdds, curr: LiveOdds): DirectionResult {
  const homeDir = Math.abs(curr.homePrice - prev.homePrice) < 0.001 ? null : curr.homePrice > prev.homePrice ? 'up' : 'down';
  const drawDir = Math.abs(curr.drawPrice - prev.drawPrice) < 0.001 ? null : curr.drawPrice > prev.drawPrice ? 'up' : 'down';
  const awayDir = Math.abs(curr.awayPrice - prev.awayPrice) < 0.001 ? null : curr.awayPrice > prev.awayPrice ? 'up' : 'down';
  return {
    home: homeDir,
    draw: drawDir,
    away: awayDir,
    homePct: prev.homePrice !== 0 ? ((curr.homePrice - prev.homePrice) / prev.homePrice) * 100 : 0,
    drawPct: prev.drawPrice !== 0 ? ((curr.drawPrice - prev.drawPrice) / prev.drawPrice) * 100 : 0,
    awayPct: prev.awayPrice !== 0 ? ((curr.awayPrice - prev.awayPrice) / prev.awayPrice) * 100 : 0,
  };
}

const SUSPENDED_FINISHED = new Set([5, 10, 13]);
const SUSPENDED_INTERRUPTED = new Set([14, 15, 16, 19]);
const SUSPENDED_EXTRA_TIME = new Set([6, 7, 8, 9, 11, 12]);

export function checkSuspension(entry: LiveOddsEntry): SuspensionResult {
  const { statusId, clockSeconds, lastGoalTimestamp } = entry;

  if (SUSPENDED_FINISHED.has(statusId)) {
    return { suspended: true, reason: 'Partido finalizado' };
  }

  if (SUSPENDED_INTERRUPTED.has(statusId)) {
    return { suspended: true, reason: 'Partido interrumpido o suspendido' };
  }

  if (SUSPENDED_EXTRA_TIME.has(statusId)) {
    return { suspended: true, reason: 'Tiempo extra o penaltis en curso' };
  }

  if (statusId === 3) {
    return { suspended: true, reason: 'Descanso — las apuestas se reanudan en ~15 min' };
  }

  if (statusId === 4 && clockSeconds != null) {
    const periodSeconds = 2700;
    if (clockSeconds > periodSeconds) {
      return { suspended: true, reason: 'Tiempo de descuento — apuestas suspendidas' };
    }
    const remaining = periodSeconds - clockSeconds;
    if (remaining <= 300) {
      return { suspended: true, reason: 'Últimos 5 minutos del partido' };
    }
  }

  if (lastGoalTimestamp && Date.now() - lastGoalTimestamp < 45000) {
    return { suspended: true, reason: 'Gol recién anotado — apuestas suspendidas temporalmente' };
  }

  return { suspended: false };
}
