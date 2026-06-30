import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { settleActiveEscrows } from '../../../../lib/keeper';

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.KEEPER_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    const isCron = req.headers.get('x-vercel-cron') === '1';
    if (!isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const txlineUrl = process.env.TXLINE_API_URL || 'https://txline-dev.txodds.com';
  const txlineJwt = process.env.TXLINE_JWT || '';
  const txlineApiToken = process.env.TXLINE_API_TOKEN || '';
  const payerSecretKey = process.env.PAYER_SECRET_KEY;
  const fixtureNameToIdRaw = process.env.FIXTURE_NAME_TO_ID || '{}';

  if (!payerSecretKey) {
    return NextResponse.json({ error: 'PAYER_SECRET_KEY not configured' }, { status: 500 });
  }

  let fixtureNameToId: Record<string, number> = {};
  try { fixtureNameToId = JSON.parse(fixtureNameToIdRaw); } catch { /* ignore */ }

  const connection = new Connection(rpcUrl, 'confirmed');
  const keeper = Keypair.fromSecretKey(new Uint8Array(JSON.parse(payerSecretKey)));

  try {
    const results = await settleActiveEscrows(
      connection, keeper, txlineUrl, txlineJwt, txlineApiToken, fixtureNameToId,
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

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') === '1';
  if (!isCron) {
    return NextResponse.json({
      usage: 'POST /api/keeper/settle',
      note: 'Trigger settlement keeper manually or via Vercel cron',
    });
  }
  return handle(req);
}
