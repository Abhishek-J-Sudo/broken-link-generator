// middleware.ts - Complete Basic Auth version
import { NextResponse, NextRequest } from 'next/server';

// Basic Auth credentials from environment variables
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD;
const ENABLE_BASIC_AUTH = process.env.ENABLE_BASIC_AUTH === 'true';

export function middleware(request: NextRequest) {
  // 🔐 STEP 1: Basic Auth Check (if enabled)
  if (ENABLE_BASIC_AUTH && BASIC_AUTH_USER && BASIC_AUTH_PASSWORD) {
    const basicAuthResult = checkBasicAuth(request);
    if (basicAuthResult) {
      return basicAuthResult; // Return 401 response if auth fails
    }
  }

  // Continue to next
  return NextResponse.next();
}

// 🔐 Basic Auth Check Function
function checkBasicAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return NextResponse.rewrite(new URL('/api/basicauth', request.url));
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD) {
      return null; // Auth successful - continue
    } else {
      return NextResponse.rewrite(new URL('/api/basicauth', request.url));
    }
  } catch {
    return NextResponse.rewrite(new URL('/api/basicauth', request.url));
  }
}

export const config = {
  matcher: ['/', '/((?!api|_next|static|favicon.ico).*)'],
};
