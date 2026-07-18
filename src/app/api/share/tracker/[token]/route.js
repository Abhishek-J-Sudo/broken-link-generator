// src/app/api/share/tracker/[token]/route.js
// PUBLIC (no Basic Auth — allow-listed in src/middleware.ts by prefix).
// Saves one team-editable SEO Fix Tracker field for one issue, keyed by the
// share token. Same trust model as viewing: whoever holds the unguessable link
// can read AND tick off the work board. Validated + rate-limited + size-capped.

import { NextResponse } from 'next/server';
import { query } from '@/lib/pg';
import { validateAdvancedRateLimit } from '@/lib/validation';
import { getClientIp } from '@/lib/clientIp';
import {
  TRACKER_FIELDS,
  FIELD_MAXLEN,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  VALIDATION_OPTIONS,
} from '@/lib/seoTracker';

const ENUM_FIELDS = {
  priority: PRIORITY_OPTIONS,
  status: STATUS_OPTIONS,
  validationStatus: VALIDATION_OPTIONS,
};

const SHAREABLE_STATUSES = ['completed', 'stopped'];
const MAX_KEY_LEN = 2048;

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const ip = getClientIp(request);
    const rateLimit = await validateAdvancedRateLimit(ip, 'results');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { key, field, value } = body || {};

    // --- validate the item key ---
    if (typeof key !== 'string' || !key.includes('::') || key.length > MAX_KEY_LEN) {
      return NextResponse.json({ error: 'Invalid issue key' }, { status: 400 });
    }

    // --- validate the field ---
    if (typeof field !== 'string' || !TRACKER_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    // --- validate the value ---
    if (typeof value !== 'string') {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
    }
    if (value.length > (FIELD_MAXLEN[field] || 200)) {
      return NextResponse.json({ error: 'Value too long' }, { status: 400 });
    }
    if (ENUM_FIELDS[field] && value !== '' && !ENUM_FIELDS[field].includes(value)) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    // Merge just this one field into the item object under `key`.
    const patch = JSON.stringify({ [field]: value });
    const result = await query(
      `UPDATE crawl_jobs
         SET seo_tracker = jsonb_set(
           COALESCE(seo_tracker, '{}'::jsonb),
           ARRAY[$2],
           COALESCE(seo_tracker -> $2, '{}'::jsonb) || $3::jsonb,
           true
         )
       WHERE share_token = $1 AND status = ANY($4)
       RETURNING id`,
      [token, key, patch, SHAREABLE_STATUSES]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true },
      { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Tracker save error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
