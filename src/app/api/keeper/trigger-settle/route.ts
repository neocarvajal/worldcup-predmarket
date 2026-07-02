import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { settleActiveEscrows } from '../../../../lib/keeper';
import { ensureApiToken } from '../../../../lib/keeper-auth';

const recentTriggers = new Map<number, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(req: NextRequest) {
  const fixtureIdParam = req.nextUrl.searchParams.get('fixtureId');
  if (!fixtureIdParam) {
    return NextResponse.json({ error: 'fixtureId required' }, { status: 400 });
  }
  const fixtureId = parseInt(fixtureIdParam, 10);
  if (isNaN(fixtureId)) {
    return NextResponse.json({ error: 'Invalid fixtureId' }, { status: 400 });
  }

  const now = Date.now();
  const last = recentTriggers.get(fixtureId);
  if (last && now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ ok: true, skipped: 'rate_limited' });
  }
  recentTriggers.set(fixtureId, now);

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const txlineUrl = process.env.TXLINE_API_URL || 'https://txline-dev.txodds.com';
  const txlineJwt = process.env.TXLINE_JWT || '';
  const payerSecretKey = process.env.PAYER_SECRET_KEY;

  if (!payerSecretKey) {
    return NextResponse.json({ error: 'PAYER_SECRET_KEY not configured' }, { status: 500 });
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const keeper = Keypair.fromSecretKey(new Uint8Array(JSON.parse(payerSecretKey)));

  let txlineApiToken: string;
  let txlineJwtFresh = txlineJwt;
  try {
    const auth = await ensureApiToken(keeper, connection, txlineUrl);
    txlineJwtFresh = auth.jwt;
    txlineApiToken = auth.apiToken;
  } catch (e: any) {
    return NextResponse.json({
      ok: false, error: `API token setup failed: ${e.message}`,
    }, { status: 500 });
  }

  try {
    const results = await settleActiveEscrows(
      connection, keeper, txlineUrl, txlineJwtFresh, txlineApiToken, undefined, false, fixtureId,
    );
    return NextResponse.json({
      ok: true,
      processed: results.length,
      settled: results.filter(r => r.status === 'settled').length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
    }, { status: 500 });
  }
}
