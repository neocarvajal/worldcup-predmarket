import { NextRequest, NextResponse } from 'next/server';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com';
const TXLINE_JWT = process.env.TXLINE_JWT || '';
const TXLINE_API_TOKEN = process.env.TXLINE_API_TOKEN || '';

const FINISHED_STATUS_IDS = [5, 10, 13];

function isFinishedStatus(statusId: number): boolean {
  return FINISHED_STATUS_IDS.includes(statusId);
}

export async function GET(req: NextRequest) {
  const fixtureIdStr = req.nextUrl.searchParams.get('fixtureId');
  if (!fixtureIdStr) {
    return NextResponse.json({ error: 'fixtureId required' }, { status: 400 });
  }
  const fixtureId = parseInt(fixtureIdStr, 10);
  if (isNaN(fixtureId)) {
    return NextResponse.json({ error: 'invalid fixtureId' }, { status: 400 });
  }

  async function fetchSnapshot(jwt: string, apiToken: string) {
    const h: Record<string, string> = { Authorization: `Bearer ${jwt}` };
    if (apiToken) h['X-Api-Token'] = apiToken;
    const res = await fetch(`${TXLINE_API_URL}/api/scores/snapshot/${fixtureId}`, { headers: h });
    if (!res.ok) return null;
    return res.json();
  }

  try {
    let data = await fetchSnapshot(TXLINE_JWT, TXLINE_API_TOKEN);

    // If 403, try guest JWT
    if (!data) {
      const guestRes = await fetch(`${TXLINE_API_URL}/auth/guest/start`, { method: 'POST' });
      if (guestRes.ok) {
        const guestBody: any = await guestRes.json();
        data = await fetchSnapshot(guestBody.token, '');
      }
    }

    if (!data) {
      return NextResponse.json({ fixtureId, finished: false, error: 'TxLINE returned 403' });
    }

    const msgs = Array.isArray(data) ? data : (data?.messages ?? [data]);
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const statusId = lastMsg?.StatusId ?? 0;
    const statusSoccerId = lastMsg?.statusSoccerId ?? null;
    const action = lastMsg?.action ?? null;
    const score = lastMsg?.Score || {};
    const score1 = score.Participant1?.Total?.Goals ?? 0;
    const score2 = score.Participant2?.Total?.Goals ?? 0;

    return NextResponse.json({
      fixtureId,
      finished: isFinishedStatus(statusId),
      statusId,
      statusSoccerId,
      action,
      score1,
      score2,
    });
  } catch (e: any) {
    return NextResponse.json({
      fixtureId,
      finished: false,
      error: e.message,
    });
  }
}

export const dynamic = 'force-dynamic';
