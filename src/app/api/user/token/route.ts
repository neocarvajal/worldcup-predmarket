/**
 * POST|GET|DELETE /api/user/token — TxLINE token persistence
 * ============================================================
 * CRUD interface for storing a wallet's TxLINE JWT + API token in Supabase.
 * Called by the TxLineClient after successful authentication to persist tokens
 * across sessions for automatic restoration via restoreForWallet().
 */
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const { wallet, jwt, apiToken } = await req.json();
    if (!wallet || !jwt || !apiToken) {
      return NextResponse.json({ error: 'Missing wallet, jwt, or apiToken' }, { status: 400 });
    }

    const res = await supabaseFetch('/user_api_tokens', {
      method: 'POST',
      body: JSON.stringify({ wallet, jwt, api_token: apiToken }),
    });

    if (res.status === 409) {
      const updateRes = await supabaseFetch(`/user_api_tokens?wallet=eq.${wallet}`, {
        method: 'PATCH',
        body: JSON.stringify({ jwt, api_token: apiToken, updated_at: new Date().toISOString() }),
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return NextResponse.json({ error: `Update failed: ${errText}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, saved: true });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Insert failed: ${errText}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet param' }, { status: 400 });
  }

  try {
    const res = await supabaseFetch(`/user_api_tokens?wallet=eq.${wallet}&select=*`, { method: 'GET' });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Fetch failed: ${errText}` }, { status: 500 });
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      wallet: rows[0].wallet,
      jwt: rows[0].jwt,
      apiToken: rows[0].api_token,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet param' }, { status: 400 });
  }

  try {
    const res = await supabaseFetch(`/user_api_tokens?wallet=eq.${wallet}`, { method: 'DELETE' });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Delete failed: ${errText}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
