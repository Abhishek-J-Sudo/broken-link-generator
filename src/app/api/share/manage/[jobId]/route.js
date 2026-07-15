// src/app/api/share/manage/[jobId]/route.js
// Create / revoke the read-only share token for an audit.
// Sits behind Basic Auth (middleware) + CSRF like every other mutating route.

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/supabase';
import { query } from '@/lib/pg';
import { csrfProtect, CsrfError } from '@/lib/csrf';
import { corsOrigin } from '@/lib/cors';

const SHAREABLE_STATUSES = ['completed', 'stopped'];

async function guardCsrf(request) {
  try {
    await csrfProtect(request, new NextResponse());
    return null;
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
    throw e;
  }
}

export async function POST(request, { params }) {
  const csrfFail = await guardCsrf(request);
  if (csrfFail) return csrfFail;

  try {
    const { jobId } = await params;
    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (!SHAREABLE_STATUSES.includes(job.status)) {
      return NextResponse.json(
        { error: 'Only completed or stopped audits can be shared' },
        { status: 409 }
      );
    }

    // Reuse an existing token so the link stays stable across clicks
    let token = job.share_token;
    if (!token) {
      token = crypto.randomBytes(24).toString('base64url');
      await query('UPDATE crawl_jobs SET share_token = $1, shared_at = NOW() WHERE id = $2', [
        token,
        jobId,
      ]);
    }

    return NextResponse.json({ token, path: `/share/${token}` });
  } catch (error) {
    console.error('Share create error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const csrfFail = await guardCsrf(request);
  if (csrfFail) return csrfFail;

  try {
    const { jobId } = await params;
    await query('UPDATE crawl_jobs SET share_token = NULL, shared_at = NULL WHERE id = $1', [
      jobId,
    ]);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error('Share revoke error:', error);
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    },
  });
}
