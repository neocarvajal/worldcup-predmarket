import { NextRequest, NextResponse } from 'next/server';
import { supabaseFetch, isSupabaseConfigured } from '../../../../lib/supabase';
import { sendPushToAll, isVapidConfigured, PushPayload } from '../../../../lib/webPush';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !isVapidConfigured()) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 500 });
  }

  try {
    const { fixtureId, title, body, wallet } = await req.json() as PushPayload & { fixtureId?: number; wallet?: string };

    let query = '/push_subscriptions?select=*';
    if (wallet) {
      query += `&wallet=eq.${wallet}`;
    }

    const res = await supabaseFetch(query, { method: 'GET' });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Fetch failed: ${errText}` }, { status: 500 });
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      return NextResponse.json({ sent: 0, expired: 0, total: 0 });
    }

    const subscriptions = rows.map((r: any) => ({
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    }));

    const payload: PushPayload = {
      title,
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { fixtureId },
    };

    const result = await sendPushToAll(subscriptions, payload);

    return NextResponse.json({ sent: result.sent, expired: result.expired, total: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
