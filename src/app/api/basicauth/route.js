// src/app/api/basicauth/route.js - NEW FILE
// This triggers the browser's Basic Auth login popup

import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Broken Link Checker Access"',
      'Content-Type': 'text/plain',
    },
  });
}

// Handle all HTTP methods the same way
export async function POST() {
  return GET();
}

export async function PUT() {
  return GET();
}

export async function DELETE() {
  return GET();
}

export async function PATCH() {
  return GET();
}
