import { NextResponse } from 'next/server';
import { csrfProtect, CsrfError } from '@/lib/csrf';
import { corsOrigin } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!process.env.CSRF_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('CSRF_SECRET environment variable is required in production');
  }
  try {
    // Use a holder so csrfProtect can set the _csrfSecret cookie and write the token header.
    // We then copy the cookie to the final response — without this the Set-Cookie is discarded.
    const holder = new NextResponse();
    await csrfProtect(request, holder);
    const csrfToken = holder.headers.get('X-CSRF-Token');

    const response = NextResponse.json({ csrfToken, success: true });
    holder.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: 'CSRF validation failed', success: false }, { status: 403 });
    }
    console.error('Error generating CSRF token:', error);
    return NextResponse.json({ error: 'Failed to generate CSRF token', success: false }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    },
  });
}
