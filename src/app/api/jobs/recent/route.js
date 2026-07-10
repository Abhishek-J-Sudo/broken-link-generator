/**
 * Recent crawl jobs — feeds the "Previous Audits" ledger on /analyze.
 * Read-only, gated by the app-wide Basic Auth middleware like every route.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { errorHandler } from '@/lib/errorHandler';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const jobs = await db.getRecentJobsWithCounts(8);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        brokenCount: job.broken_count,
        totalLinks: job.total_links,
      })),
    });
  } catch (error) {
    return await errorHandler.handleError(error, request, {
      step: 'recent_jobs',
      endpoint: 'jobs_recent',
    });
  }
}
