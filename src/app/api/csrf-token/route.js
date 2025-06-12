// src/app/api/csrf-token/route.js - Endpoint to get CSRF tokens
import { NextResponse } from 'next/server';
import { createCsrfProtect } from '@edge-csrf/nextjs';

const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  },
  secret: process.env.CSRF_SECRET || 'default-dev-secret-change-in-production',
});

export async function GET(request) {
  try {
    const response = NextResponse.json({ csrfToken: 'will-be-set-by-middleware' });

    // The middleware will set the actual token
    await csrfProtect(request, response);

    // Get the token from the response headers
    const csrfToken = response.headers.get('X-CSRF-Token');

    return NextResponse.json({
      csrfToken,
      success: true,
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate CSRF token',
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    },
  });
}
