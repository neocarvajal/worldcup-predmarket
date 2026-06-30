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

export class TxLineClient {
  private jwt: string | null = null;
  private apiToken: string | null = null;
  private currentWallet: string | null = null;

  constructor() {
    this.restoreFromEnv();
  }

  private restoreFromEnv(): void {
    this.jwt = process.env.NEXT_PUBLIC_TXLINE_JWT || null;
    this.apiToken = process.env.NEXT_PUBLIC_TXLINE_API_TOKEN || null;
  }

  restoreForWallet(wallet: string): boolean {
    this.currentWallet = wallet;
    const stored = loadTokens(wallet);
    if (stored) {
      this.jwt = stored.jwt;
      this.apiToken = stored.apiToken;
      return true;
    }
    return false;
  }

  private persist(): void {
    if (this.currentWallet && this.jwt && this.apiToken) {
      saveTokens(this.currentWallet, { jwt: this.jwt, apiToken: this.apiToken });
    }
  }

  clearForWallet(wallet: string): void {
    clearTokens(wallet);
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

  get hasApiToken(): boolean {
    return !!this.apiToken;
  }

  private async ensureAuth(): Promise<{ jwt: string; apiToken: string }> {
    if (!this.jwt) await this.getGuestJwt();
    if (!this.apiToken) {
      throw new TxLineAuthError(
        'API token no activado. Actívalo desde la página de perfil.'
      );
    }
    return { jwt: this.jwt!, apiToken: this.apiToken };
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
      'X-Api-Token': apiToken,
    };
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
    return this.request('GET', '/fixtures/snapshot', { query: params });
  }

  async getOdds(fixtureId: number, params: Record<string, any> = {}): Promise<any> {
    return this.request('GET', `/odds/snapshot/${fixtureId}`, { query: params });
  }

  async getScoresSnapshot(fixtureId: number): Promise<any> {
    return this.request('GET', `/scores/snapshot/${fixtureId}`);
  }

  async streamScores(): Promise<ReadableStream<Uint8Array>> {
    const { jwt, apiToken } = await this.ensureAuth();
    const url = apiUrl('/scores/stream');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
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
