/**
 * TxLINE Oracle API client
 * ==========================
 * Manages JWT-based authentication with the TxLINE sports data oracle. Handles
 * guest and user JWT lifecycles, transparent token refresh on 401 responses,
 * and persistent storage (localStorage → Supabase → on-chain). Provides methods
 * for fixtures, odds, score snapshots, historical data, and SSE streaming.
 * Browser requests are proxied through `/api/txline/[...path]` to protect
 * credentials from client-side exposure.
 */

import axios from 'axios';
import { saveTokens, loadTokens, clearTokens } from './lib/persistence';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com/api';
const TXLINE_AUTH_URL = process.env.NEXT_PUBLIC_TXLINE_AUTH_URL || 'https://txline-dev.txodds.com';

const isBrowser = typeof window !== 'undefined';

function apiUrl(path: string): string {
  return isBrowser ? `/api/txline/api${path}` : `${TXLINE_API_URL}${path}`;
}

function authUrl(path: string): string {
  return isBrowser ? `/api/txline/auth${path}` : `${TXLINE_AUTH_URL}${path}`;
}

function isSupabaseAvailable(): boolean {
  const url = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    : '';
  return url.startsWith('https://');
}

async function saveToSupabase(wallet: string, jwt: string, apiToken: string): Promise<void> {
  if (!isSupabaseAvailable()) {
    console.warn('[txline] Supabase no configurado — token solo en localStorage');
    return;
  }
  try {
    await fetch('/api/user/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, jwt, apiToken }),
    });
  } catch { }
}

async function loadFromSupabase(wallet: string): Promise<{ jwt: string; apiToken: string } | null> {
  if (!isSupabaseAvailable()) return null;
  try {
    const res = await fetch(`/api/user/token?wallet=${encodeURIComponent(wallet)}`);
    const data = await res.json();
    if (data.found) return { jwt: data.jwt, apiToken: data.apiToken };
  } catch { }
  return null;
}

async function deleteFromSupabase(wallet: string): Promise<void> {
  if (!isSupabaseAvailable()) return;
  try {
    await fetch(`/api/user/token?wallet=${encodeURIComponent(wallet)}`, { method: 'DELETE' });
  } catch { }
}

export class TxLineClient {
  private jwt: string | null = null;
  private apiToken: string | null = null;
  private currentWallet: string | null = null;

  constructor() {
    this.restoreFromEnv();
  }

  private restoreFromEnv(): void {
    this.apiToken = process.env.NEXT_PUBLIC_TXLINE_API_TOKEN || null;
  }

  async restoreForWallet(wallet: string): Promise<boolean> {
    this.currentWallet = wallet;
    const stored = loadTokens(wallet);
    if (stored) {
      this.jwt = stored.jwt;
      this.apiToken = stored.apiToken;
      return true;
    }
    const remote = await loadFromSupabase(wallet);
    if (remote) {
      this.jwt = remote.jwt;
      this.apiToken = remote.apiToken;
      saveTokens(wallet, remote);
      return true;
    }
    return false;
  }

  private persist(): void {
    if (this.currentWallet && this.jwt && this.apiToken) {
      saveTokens(this.currentWallet, { jwt: this.jwt, apiToken: this.apiToken });
      saveToSupabase(this.currentWallet, this.jwt, this.apiToken);
    }
  }

  async clearForWallet(wallet: string): Promise<void> {
    clearTokens(wallet);
    await deleteFromSupabase(wallet);
    if (this.currentWallet === wallet) {
      this.jwt = null;
      this.apiToken = null;
      this.currentWallet = null;
    }
  }

  async getGuestJwt(): Promise<string> {
    const url = authUrl('/guest/start');
    const resp = await axios.post(url);
    this.jwt = resp.data.token;
    return this.jwt!;
  }

  async activateApiToken(params: {
    txSig: string;
    walletSignature: string;
    leagues: string[];
  }): Promise<string> {
    if (!this.jwt) await this.getGuestJwt();
    const url = apiUrl('/token/activate');
    const resp = await axios.post(url, params, {
      headers: { Authorization: `Bearer ${this.jwt}` },
    });
    this.apiToken = resp.data.token ?? resp.data;
    this.persist();
    return this.apiToken!;
  }

  setTokens(jwt: string, apiToken: string): void {
    this.jwt = jwt;
    this.apiToken = apiToken;
  }

  getApiToken(): string | null {
    return this.apiToken;
  }

  get hasApiToken(): boolean {
    return !!this.apiToken;
  }

  private async ensureAuth(): Promise<{ jwt: string; apiToken: string | null }> {
    if (!this.jwt) await this.getGuestJwt();
    return { jwt: this.jwt!, apiToken: this.apiToken };
  }

  private async requestWithRetry<T = any>(
    method: 'GET' | 'POST',
    path: string,
    opts: { query?: Record<string, any>; body?: any } = {}
  ): Promise<T> {
    try {
      return await this.request(method, path, opts);
    } catch (e: any) {
      if (e?.response?.status === 401 && this.jwt) {
        this.jwt = null;
        await this.getGuestJwt();
        return this.request(method, path, opts);
      }
      throw e;
    }
  }

  private async request<T = any>(
    method: 'GET' | 'POST',
    path: string,
    opts: { query?: Record<string, any>; body?: any } = {}
  ): Promise<T> {
    const { jwt, apiToken } = await this.ensureAuth();
    const url = apiUrl(path);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${jwt}`,
    };
    if (apiToken) headers['X-Api-Token'] = apiToken;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const resp = await axios({
      method,
      url,
      params: opts.query,
      data: opts.body,
      headers,
    });
    return resp.data;
  }

  async getFixtures(params: Record<string, any> = {}): Promise<any> {
    return this.requestWithRetry('GET', '/fixtures/snapshot', { query: params });
  }

  async getOdds(fixtureId: number, params: Record<string, any> = {}): Promise<any> {
    return this.requestWithRetry('GET', `/odds/snapshot/${fixtureId}`, { query: params });
  }

  async getLiveOddsForFixture(fixtureId: number): Promise<{
    homePrice: number;
    drawPrice: number;
    awayPrice: number;
    inRunning: boolean;
    gameState: string;
  }> {
    const raw = await this.getOdds(fixtureId);
    const items: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.markets ?? []);
    const odds = items.find(
      (m: any) =>
        m.FixtureId === fixtureId ||
        m.fixtureId === fixtureId ||
        Number(m.fixture_id) === fixtureId
    ) || items[0] || raw;

    const homePrice = odds?.H?.Price ?? odds?.home?.price ?? odds?.home ?? 2.0;
    const drawPrice = odds?.D?.Price ?? odds?.draw?.price ?? odds?.draw ?? 3.5;
    const awayPrice = odds?.A?.Price ?? odds?.away?.price ?? odds?.away ?? 2.5;
    const inRunning = odds?.InRunning ?? odds?.inRunning ?? false;
    const gameState = odds?.GameState ?? odds?.gameState ?? '';

    return { homePrice, drawPrice, awayPrice, inRunning, gameState };
  }

  async getScoresSnapshot(fixtureId: number): Promise<any> {
    return this.requestWithRetry('GET', `/scores/snapshot/${fixtureId}`);
  }

  /** Full message history for a fixture.
   *  Tries the historical endpoint first (may return empty for recent matches),
   *  then falls back to the current snapshot. */
  async getScoresHistory(fixtureIds: number[]): Promise<any[]> {
    for (const fid of fixtureIds) {
      try {
        const raw = await this.requestWithRetry('GET', `/scores/historical/${fid}`);
        if (Array.isArray(raw) && raw.length > 0) return raw;
      } catch { /* fall through */ }
      // Fallback: use snapshot (only has recent messages but better than nothing)
      try {
        const snap = await this.getScoresSnapshot(fid);
        const msgs = Array.isArray(snap) ? snap : (snap?.messages ?? []);
        if (msgs.length > 0) return msgs;
      } catch { /* fall through */ }
    }
    return [];
  }

  async streamScores(): Promise<ReadableStream<Uint8Array>> {
    const { jwt, apiToken } = await this.ensureAuth();
    const url = apiUrl('/scores/stream');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${jwt}`,
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    if (apiToken) headers['X-Api-Token'] = apiToken;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TxLINE SSE error: ${response.status} ${response.statusText}`);
    }
    if (!response.body) throw new Error('No body in SSE response');
    return response.body;
  }
}

export class TxLineAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TxLineAuthError';
  }
}

export const txLineClient = new TxLineClient();
