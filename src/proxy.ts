import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'es'];
const defaultLocale = 'en';
const COOKIE_NAME = 'NEXT_LOCALE';

export default function proxy(request: NextRequest) {
  const localeCookie = request.cookies.get(COOKIE_NAME)?.value;
  const acceptLang = request.headers.get('accept-language') || '';
  const detected = localeCookie
    || acceptLang.split(',')[0]?.split('-')[0]
    || defaultLocale;
  const locale = locales.includes(detected) ? detected : defaultLocale;

  const headers = new Headers(request.headers);
  headers.set('X-NEXT-INTL-LOCALE', locale);

  const response = NextResponse.next({
    request: { headers },
  });

  if (!localeCookie) {
    response.cookies.set(COOKIE_NAME, locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
