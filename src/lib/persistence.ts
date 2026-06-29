const PREFIX = 'txline';

export interface StoredTokens {
  jwt: string;
  apiToken: string;
}

export interface StoredBet {
  fixtureName: string;
  selection: string;
  label: string;
  odds: number;
  amount: number;
  escrowPubkey: string;
  timestamp: number;
  txSig: string;
  matchStartTime?: number;
}

export function saveTokens(wallet: string, tokens: StoredTokens): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${PREFIX}:${wallet}`;
    const data = JSON.stringify({ ...tokens, wallet });
    localStorage.setItem(key, data);
  } catch {}
}

export function loadTokens(wallet: string): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${PREFIX}:${wallet}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.jwt && parsed.apiToken) {
      return { jwt: parsed.jwt, apiToken: parsed.apiToken };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearTokens(wallet: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${PREFIX}:${wallet}`;
    localStorage.removeItem(key);
  } catch {}
}

function betsMap(wallet: string): Record<string, StoredBet> {
  const oldKey = `${PREFIX}:bet:${wallet}`;
  const newKey = `${PREFIX}:bets:${wallet}`;
  const newRaw = localStorage.getItem(newKey);
  const map: Record<string, StoredBet> = newRaw ? JSON.parse(newRaw) : {};
  const oldRaw = localStorage.getItem(oldKey);
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw);
      if (old && old.escrowPubkey && !map[old.escrowPubkey]) {
        map[old.escrowPubkey] = old;
      }
    } catch {}
    localStorage.removeItem(oldKey);
  }
  return map;
}

export function saveBet(wallet: string, bet: StoredBet): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${PREFIX}:bets:${wallet}`;
    const map = betsMap(wallet);
    map[bet.escrowPubkey] = bet;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

export function loadBet(wallet: string, escrowPubkey: string): StoredBet | null {
  if (typeof window === 'undefined') return null;
  try {
    const map = betsMap(wallet);
    return map[escrowPubkey] || null;
  } catch { return null; }
}

export function saveProfileImage(wallet: string, dataUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${PREFIX}:profile_img:${wallet}`;
    localStorage.setItem(key, dataUrl);
  } catch {}
}

export function loadProfileImage(wallet: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${PREFIX}:profile_img:${wallet}`;
    return localStorage.getItem(key);
  } catch { return null; }
}
