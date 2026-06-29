import { NextRequest } from 'next/server';

const TXLINE_API_URL = process.env.NEXT_PUBLIC_TXLINE_API_URL || 'https://txline-dev.txodds.com/api';
const TXLINE_AUTH_URL = process.env.NEXT_PUBLIC_TXLINE_AUTH_URL || 'https://txline-dev.txodds.com';

function getTargetBaseUrl(paths: string[]): string {
  return paths[0] === 'auth' ? TXLINE_AUTH_URL : TXLINE_API_URL;
}

function getTargetPath(paths: string[]): string {
  // Strip leading 'api' — TXLINE_API_URL already includes /api prefix
  return paths[0] === 'auth' ? paths.join('/') : paths.slice(1).join('/');
}

async function proxyRequest(
  req: NextRequest,
  params: { path: string[] },
  method: string
) {
  const { path } = params;
  const targetBase = getTargetBaseUrl(path);
  const targetPath = getTargetPath(path);
  const queryString = req.nextUrl.searchParams.toString();
  const targetUrl = `${targetBase}/${targetPath}${queryString ? '?' + queryString : ''}`;

  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  const apiToken = req.headers.get('x-api-token');
  const accept = req.headers.get('accept');
  if (auth) headers['Authorization'] = auth;
  if (apiToken) headers['X-Api-Token'] = apiToken;
  if (accept) headers['Accept'] = accept;

  const fetchOpts: RequestInit = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    const text = await req.text();
    if (text) {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = text;
    }
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, fetchOpts);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch ${targetUrl}`, detail: err?.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) {
      responseHeaders[key] = value;
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params, 'POST');
}
