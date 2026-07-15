import { NextRequest, NextResponse } from 'next/server';
import { supabaseFetch, isSupabaseConfigured } from '../../../../lib/supabase';

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ exists: false, error: 'Supabase not configured' }, { status: 200 });
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ exists: false, error: 'Missing endpoint' }, { status: 400 });
  }

  try {
    const res = await supabaseFetch(
      `/push_subscriptions?select=id&endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'GET' },
    );
    if (!res.ok) {
      return NextResponse.json({ exists: false, error: await res.text() }, { status: 200 });
    }
    const rows = await res.json();
    return NextResponse.json({ exists: Array.isArray(rows) && rows.length > 0 });
  } catch (e: any) {
    return NextResponse.json({ exists: false, error: e.message }, { status: 200 });
  }
}
