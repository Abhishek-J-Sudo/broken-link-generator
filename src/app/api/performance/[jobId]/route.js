import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { query } from '@/lib/pg';
import { fetchPageSpeed } from '@/lib/pageSpeed';
import { corsOrigin } from '@/lib/cors';

/**
 * GET /api/performance/[jobId] — Core Web Vitals for the audit's homepage (G7).
 *
 * Lazy + cached like the AI narrative: return the stored result if present,
 * otherwise run one PageSpeed Insights call on the job URL and cache it. A
 * missing key or a PSI failure returns a { reason } marker (200) so the UI can
 * explain the empty cell rather than spin.
 */
export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Cached measurement (or a cached "no_key"/"unavailable" marker) — no re-fetch.
    if (job.performance) {
      return NextResponse.json(job.performance);
    }

    // Only measure once the crawl has settled.
    if (job.status !== 'completed' && job.status !== 'stopped') {
      return new NextResponse(null, { status: 204 });
    }

    const result = await fetchPageSpeed(job.url, { strategy: 'mobile' });

    // Cache a real measurement so repeat views cost no PSI calls. Transient
    // failures ('unavailable') are NOT cached — a later view can retry; only a
    // real result or the deterministic 'no_key' state is worth persisting.
    if (result && (result.score != null || result.reason === 'no_key')) {
      try {
        await query('UPDATE crawl_jobs SET performance = $1 WHERE id = $2', [
          JSON.stringify(result),
          jobId,
        ]);
      } catch (err) {
        console.warn('Failed to cache performance:', err.message);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Performance route error:', error);
    return new NextResponse(null, { status: 204 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
