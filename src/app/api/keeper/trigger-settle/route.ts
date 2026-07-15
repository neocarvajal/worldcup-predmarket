import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { settleActiveEscrows } from '../../../../lib/keeper';
import { ensureApiToken } from '../../../../lib/keeper-auth';
import { supabaseFetch, isSupabaseConfigured } from '../../../../lib/supabase';
import { sendPushToAll, isVapidConfigured } from '../../../../lib/webPush';
import { t, type Locale } from '../../../../lib/locale';

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

    // Dispatch push notifications for settled escrows (fire-and-forget)
    if (isVapidConfigured() && isSupabaseConfigured()) {
      for (const r of results) {
        if (r.status !== 'settled' || !r.depositor) continue;
        const isWin = r.depositorWon === true;
        try {
          const query = `/push_subscriptions?select=*&wallet=eq.${r.depositor}`;
          const subRes = await supabaseFetch(query, { method: 'GET' });
          if (subRes.ok) {
            const rows = await subRes.json();
            if (rows?.length > 0) {
              // Group by locale
              const byLocale = new Map<Locale, any[]>();
              for (const row of rows) {
                const loc: Locale = row.locale === 'en' ? 'en' : 'es';
                if (!byLocale.has(loc)) byLocale.set(loc, []);
                byLocale.get(loc)!.push({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
              }
              for (const [loc, subs] of byLocale) {
                const title = isWin ? t('you_won', loc) : t('you_lost', loc);
                const body = isWin
                  ? `${r.fixtureName} — ${t('payment_sent', loc)}`
                  : `${r.fixtureName} — ${t('better_luck', loc)}`;
                await sendPushToAll(subs, { title, body, icon: '/favicon.svg', badge: '/favicon.svg' });
              }
            }
          }
        } catch {
          // notification dispatch is best-effort
        }
      }
    }

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
