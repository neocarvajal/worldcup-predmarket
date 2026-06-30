import { NextRequest } from 'next/server';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com';
const TXLINE_AUTH_URL = process.env.NEXT_PUBLIC_TXLINE_AUTH_URL || 'https://txline-dev.txodds.com';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const base = path[0] === 'auth' ? TXLINE_AUTH_URL : TXLINE_API_URL;
  const qs = req.nextUrl.searchParams.toString();
  const url = `${base}/${path.join('/')}${qs ? '?' + qs : ''}`;

  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  const apiToken = req.headers.get('x-api-token');
  const accept = req.headers.get('accept');
  if (auth) headers['Authorization'] = auth;
  if (apiToken) headers['X-Api-Token'] = apiToken;
  if (accept) headers['Accept'] = accept;

  const resp = await fetch(url, { method: 'GET', headers });

  const body = await resp.text();
  const outHeaders: Record<string, string> = {};
  resp.headers.forEach((v, k) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) {
      outHeaders[k] = v;
    }
  });

  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const base = path[0] === 'auth' ? TXLINE_AUTH_URL : TXLINE_API_URL;
  const qs = req.nextUrl.searchParams.toString();
  const url = `${base}/${path.join('/')}${qs ? '?' + qs : ''}`;

  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  const apiToken = req.headers.get('x-api-token');
  const accept = req.headers.get('accept');
  if (auth) headers['Authorization'] = auth;
  if (apiToken) headers['X-Api-Token'] = apiToken;
  if (accept) headers['Accept'] = accept;

  const text = await req.text();
  if (text) {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: text || undefined,
  });

  const body = await resp.text();
  const outHeaders: Record<string, string> = {};
  resp.headers.forEach((v, k) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) {
      outHeaders[k] = v;
    }
  });

  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}
