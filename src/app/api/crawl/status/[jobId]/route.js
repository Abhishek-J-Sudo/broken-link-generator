/**
 * Crawl status endpoint
 * Gets real-time progress of a crawl job
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  try {
    // FIX 1: Await params for Next.js 15 compatibility
    const { jobId } = await params;

    // Validate jobId
    if (!jobId) {
      return NextResponse.json(
        {
          error: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        },
        { status: 400 }
      );
    }

    // Get job details from database
    const job = await db.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // FIX 2: Use 'supabase' instead of 'db.supabase'
    // Get additional stats
    const [brokenLinksCount, totalLinksCount] = await Promise.all([
      // Count broken links
      supabase
        .from('broken_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count || 0),

      // Count total discovered links
      supabase
        .from('discovered_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count || 0),
    ]);

    // Calculate additional progress metrics
    const progress = job.progress || { current: 0, total: 0, percentage: 0 };
    const isRunning = job.status === 'running';
    const isComplete = job.status === 'completed';
    const isFailed = job.status === 'failed';

    // Estimate time remaining (rough calculation)
    let estimatedTimeRemaining = null;
    if (isRunning && progress.current > 0 && progress.total > progress.current) {
      const elapsed = new Date() - new Date(job.created_at);
      const rate = progress.current / elapsed; // items per ms
      const remaining = progress.total - progress.current;
      estimatedTimeRemaining = Math.round(remaining / rate / 1000); // seconds
    }

    const response = {
      jobId,
      status: job.status,
      url: job.url,
      progress: {
        current: progress.current,
        total: progress.total,
        percentage: progress.percentage,
        estimatedTimeRemaining,
      },
      stats: {
        brokenLinksFound: brokenLinksCount,
        totalLinksDiscovered: totalLinksCount,
        pagesProcessed: progress.current,
      },
      timestamps: {
        createdAt: job.created_at,
        completedAt: job.completed_at,
        elapsedTime: job.completed_at
          ? new Date(job.completed_at) - new Date(job.created_at)
          : new Date() - new Date(job.created_at),
      },
      settings: job.settings,
      errorMessage: job.error_message,
    };

    // Add next poll interval suggestion
    if (isRunning) {
      response.pollInterval = 2000; // Suggest checking every 2 seconds
    } else {
      response.pollInterval = null; // No need to poll completed/failed jobs
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting crawl status:', error);

    return NextResponse.json(
      {
        error: 'Failed to get crawl status',
        message: error.message,
        code: 'STATUS_FETCH_FAILED',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
