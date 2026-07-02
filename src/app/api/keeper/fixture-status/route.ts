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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${TXLINE_JWT}`,
  };
  if (TXLINE_API_TOKEN) headers['X-Api-Token'] = TXLINE_API_TOKEN;

  try {
    const resp = await fetch(
      `${TXLINE_API_URL}/api/scores/snapshot/${fixtureId}`,
      { headers },
    );
    if (!resp.ok) {
      return NextResponse.json({
        fixtureId,
        finished: false,
        error: `TxLINE returned ${resp.status}`,
      });
    }

    const data = await resp.json();
    const msgs = Array.isArray(data) ? data : (data?.messages ?? [data]);
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const statusId = lastMsg?.StatusId ?? 0;
    const score = lastMsg?.Score || {};
    const score1 = score.Participant1?.Total?.Goals ?? 0;
    const score2 = score.Participant2?.Total?.Goals ?? 0;

    return NextResponse.json({
      fixtureId,
      finished: isFinishedStatus(statusId),
      statusId,
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
