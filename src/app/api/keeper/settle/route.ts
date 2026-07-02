import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { settleActiveEscrows, settleSingleEscrow } from '../../../../lib/keeper';
import { ensureApiToken } from '../../../../lib/keeper-auth';

async function handle(req: NextRequest) {
  if (req.method !== 'POST') {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.KEEPER_SECRET;
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      const isCron = req.headers.get('x-vercel-cron') === '1';
      if (!isCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

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

  const force = req.nextUrl.searchParams.get('force') === '1' || req.headers.get('x-force') === '1';
  const escrowParam = req.nextUrl.searchParams.get('escrow');
  const fixtureIdParam = req.nextUrl.searchParams.get('fixtureId');

  try {
    if (escrowParam) {
      const result = await settleSingleEscrow(
        connection, keeper, txlineUrl, txlineJwtFresh, txlineApiToken,
        new PublicKey(escrowParam), undefined, true,
      );
      return NextResponse.json({
        ok: result.status === 'settled',
        result,
        timestamp: new Date().toISOString(),
      });
    } else if (fixtureIdParam) {
      const fixtureId = parseInt(fixtureIdParam, 10);
      if (isNaN(fixtureId)) {
        return NextResponse.json({ error: 'Invalid fixtureId' }, { status: 400 });
      }
      const results = await settleActiveEscrows(
        connection, keeper, txlineUrl, txlineJwtFresh, txlineApiToken, undefined, force, fixtureId,
      );
      return NextResponse.json({
        ok: true,
        processed: results.length,
        settled: results.filter(r => r.status === 'settled').length,
        results,
        timestamp: new Date().toISOString(),
      });
    } else {
      const results = await settleActiveEscrows(
        connection, keeper, txlineUrl, txlineJwtFresh, txlineApiToken, undefined, force,
      );
      return NextResponse.json({
        ok: true,
        processed: results.length,
        settled: results.filter(r => r.status === 'settled').length,
        results,
        timestamp: new Date().toISOString(),
      });
    }
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
