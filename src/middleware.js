// src/middleware.js - Add CSRF protection middleware
import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs';
import { NextResponse } from 'next/server';

const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  },
  secret: process.env.CSRF_SECRET || 'default-dev-secret-change-in-production',
});

export async function middleware(request) {
  // Skip CSRF for GET requests and health checks
  if (request.method === 'GET' || request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  try {
    // Apply CSRF protection to all POST requests
    const response = NextResponse.next();
    await csrfProtect(request, response);
    return response;
  } catch (err) {
    if (err instanceof CsrfError) {
      console.log('CSRF validation failed:', err.message);
      return new NextResponse('CSRF validation failed', { status: 403 });
    }
    throw err;
  }
}

export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to all app pages
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// src/lib/csrf.js - CSRF utilities for client-side
export async function getCsrfToken() {
  try {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return null;
  }
}

export function addCsrfToFormData(formData, csrfToken) {
  if (csrfToken) {
    formData.append('csrf_token', csrfToken);
  }
  return formData;
}

export function addCsrfToHeaders(headers, csrfToken) {
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}
