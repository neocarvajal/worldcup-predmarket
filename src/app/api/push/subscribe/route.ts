/**
 * POST /api/push/subscribe — Store push subscription
 * DELETE /api/push/subscribe?endpoint=X — Remove subscription
 * =============================================================
 * Manages browser push subscription persistence in Supabase. POST inserts
 * a new subscription (wallet, endpoint, p256dh, auth) with upsert on 409
 * conflict. DELETE removes by endpoint. Used by the usePushNotifications hook.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseFetch, isSupabaseConfigured } from '../../../../lib/supabase';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const { wallet, endpoint, p256dh, auth } = await req.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing endpoint, p256dh, or auth' }, { status: 400 });
    }

    const body: Record<string, string> = {
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    };
    if (wallet) body.wallet = wallet;

    const res = await supabaseFetch('/push_subscriptions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      const updateRes = await supabaseFetch(
        `/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ p256dh, auth, wallet: wallet || null, updated_at: new Date().toISOString() }),
        }
      );
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return NextResponse.json({ error: `Update failed: ${errText}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 409) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: `Insert failed: ${errText}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint param' }, { status: 400 });
  }

  try {
    const res = await supabaseFetch(
      `/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE' }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Delete failed: ${errText}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
