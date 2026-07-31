import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

/**
 * Lets the static export deployed elsewhere (InfinityFree) call this API
 * cross-origin. Empty/unset falls back to allowing any origin.
 */
const ALLOWED_ORIGIN = process.env.STATIC_SITE_ORIGIN || '*';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * Locale negotiation and redirects. Next 16 renamed this file convention from
 * `middleware` to `proxy`; the export shape is unchanged. API routes skip the
 * locale logic entirely and just get CORS headers attached.
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except Next internals and files with an extension.
  matcher: '/((?!_next|_vercel|.*\\..*).*)'
};
