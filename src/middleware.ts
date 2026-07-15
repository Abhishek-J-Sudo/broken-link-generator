import { NextResponse, NextRequest } from 'next/server';
import { getClientIp } from '@/lib/clientIp';

const BASIC_AUTH_USER     = process.env.BASIC_AUTH_USER ?? '';
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD ?? '';
const ENABLE_BASIC_AUTH   = process.env.ENABLE_BASIC_AUTH === 'true';
const IS_PRODUCTION       = process.env.NODE_ENV === 'production';
const MIN_PASSWORD_LENGTH = 12;

// Fail loudly at module init if production credentials are dangerously weak.
if (IS_PRODUCTION && ENABLE_BASIC_AUTH && BASIC_AUTH_PASSWORD) {
  if (BASIC_AUTH_PASSWORD === 'change-me' || BASIC_AUTH_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `[auth] BASIC_AUTH_PASSWORD is too weak for production (min ${MIN_PASSWORD_LENGTH} chars, must not be "change-me")`
    );
  }
}

// Paths that skip Basic Auth — uptime monitors can't send credentials.
const PUBLIC_PATHS = ['/api/health'];

// Prefix-matched public paths: shareable client reports are read-only and
// gated by their own unguessable token (validated in the route, not here).
const PUBLIC_PREFIXES = ['/share/', '/api/share/view/'];

// Paths using their own token — don't double-gate with Basic Auth.
const TOKEN_AUTH_PATHS = ['/api/admin/cleanup'];

// In-memory brute-force counter per client IP.
// Single-instance only; upgrading to Redis requires experimental.nodeMiddleware
// (canary-only in Next.js 15.x) — deferred until that stabilises.
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 10;
const LOCKOUT_MS   = 5 * 60 * 1000;

function unauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SeoScrub", charset="UTF-8"' },
  });
}

function tooManyRequests(): NextResponse {
  return new NextResponse('Too many failed authentication attempts', {
    status: 429,
    headers: { 'Retry-After': '300' },
  });
}

// Constant-time comparison via Web Crypto SHA-256 (works in both Edge and Node runtimes).
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const aArr = new Uint8Array(aHash);
  const bArr = new Uint8Array(bHash);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i] ^ bArr[i];
  return diff === 0;
}

function recordFailure(ip: string, now: number): void {
  const rec = failedAttempts.get(ip);
  if (!rec || now >= rec.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
  } else {
    rec.count += 1;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (TOKEN_AUTH_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Fail-safe — in production, default-deny when auth is not properly configured.
  if (IS_PRODUCTION && (!ENABLE_BASIC_AUTH || !BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD)) {
    console.error('[auth] Production request denied: ENABLE_BASIC_AUTH or credentials not set');
    return unauthorized();
  }

  // In non-production, allow through if auth is disabled.
  if (!ENABLE_BASIC_AUTH || !BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    return NextResponse.next();
  }

  // Brute-force backoff — check before parsing credentials.
  const ip  = getClientIp(request);
  const now = Date.now();
  const attempts = failedAttempts.get(ip);
  if (attempts && now < attempts.resetAt && attempts.count >= MAX_FAILURES) {
    return tooManyRequests();
  }

  // Return 401 directly (no rewrite dance).
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) {
    recordFailure(ip, now);
    return unauthorized();
  }

  try {
    // atob is available in both Edge and Node runtimes.
    const decoded  = atob(authHeader.slice(6));
    const colonIdx = decoded.indexOf(':'); // first colon only — passwords may contain ':'
    if (colonIdx === -1) {
      recordFailure(ip, now);
      return unauthorized();
    }
    const username = decoded.slice(0, colonIdx);
    const password = decoded.slice(colonIdx + 1);

    // Constant-time comparison — prevent timing side-channel.
    const [userOk, passOk] = await Promise.all([
      timingSafeEqual(username, BASIC_AUTH_USER),
      timingSafeEqual(password, BASIC_AUTH_PASSWORD),
    ]);

    if (userOk && passOk) {
      failedAttempts.delete(ip);
      return NextResponse.next();
    }

    recordFailure(ip, now);
    return unauthorized();
  } catch {
    return unauthorized();
  }
}

export const config = {
  // Run on everything except Next.js internals and static assets.
  // API routes are intentionally included — /api/* is no longer excluded.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)'],
};
