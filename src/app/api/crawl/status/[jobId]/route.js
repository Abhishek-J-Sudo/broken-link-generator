/**
 * CORRECTED Crawl status endpoint with dynamic rate limiting
 * FIXED: Now uses the new validateStatusRateLimit function
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { validateStatusRateLimit } from '@/lib/validation';
import { errorHandler } from '@/lib/errorHandler';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';

    // Validate jobId first
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required', code: 'MISSING_JOB_ID' },
        { status: 400 }
      );
    }

    // 🚀 SMART APPROACH: Get job info first to determine appropriate rate limits
    const job = await db.getJob(jobId);
    if (!job) {
      return await errorHandler.handleError(new Error('Job not found'), request, {
        step: 'job_lookup',
        jobId,
      });
    }

    // Get link counts for dynamic rate limiting
    const [brokenLinksCount, totalLinksCount] = await Promise.all([
      db.supabase
        .from('broken_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count || 0),
      db.supabase
        .from('discovered_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count || 0),
    ]);

    // 🎯 DETERMINE CRAWL LEVEL DYNAMICALLY
    const maxDepth = job.settings?.maxDepth || 3;
    let crawlLevel = maxDepth;

    // Override based on actual discovered links (more accurate)
    if (totalLinksCount > 1000) crawlLevel = 5;
    else if (totalLinksCount > 500) crawlLevel = 4;
    else if (totalLinksCount > 200) crawlLevel = 3;
    else if (totalLinksCount > 50) crawlLevel = 2;
    else crawlLevel = 1;

    // 🚀 DYNAMIC RATE LIMITING: Create job context for smart rate limiting
    const jobContext = {
      jobId,
      estimatedLinks: totalLinksCount,
      crawlLevel,
      isRunning: job.status === 'running',
    };

    // 🔧 FIXED: Use the new validateStatusRateLimit function with job context
    const rateLimit = validateStatusRateLimit(clientIP, jobContext);

    // 🔧 ADDITIONAL OVERRIDE: For Level 5 jobs, be even more lenient
    if (!rateLimit.allowed && crawlLevel >= 5) {
      console.log(
        `🎯 LEVEL 5 OVERRIDE: Allowing status check for massive job ${jobId} (${totalLinksCount} links)`
      );

      // Override for Level 5 jobs - your core business promise!
      rateLimit.allowed = true;
      rateLimit.remaining = 100;
      rateLimit.headers = {
        ...rateLimit.headers,
        'X-RateLimit-Override': 'level-5-job',
        'X-RateLimit-Limit': '3000', // Show the enhanced limit
        'X-RateLimit-Remaining': '100',
      };
    }

    if (!rateLimit.allowed) {
      console.log(
        `⚠️ Rate limit exceeded for job ${jobId} (Level ${crawlLevel}) from IP ${clientIP}`
      );
      return NextResponse.json(
        {
          error: 'Rate limit exceeded for status checks',
          retryAfter: rateLimit.retryAfter,
          message: `Please wait ${rateLimit.retryAfter}s before checking again`,
          jobId: jobId,
          crawlLevel: crawlLevel,
          dynamicLimit: rateLimit.dynamicLimit,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
            'X-Rate-Limit-Type': 'status_dynamic',
            'X-Crawl-Level': crawlLevel.toString(),
            ...(rateLimit.headers || {}),
          },
        }
      );
    }

    // Calculate progress and metrics
    const progress = job.progress || { current: 0, total: 0, percentage: 0 };
    const isRunning = job.status === 'running';
    const isComplete = job.status === 'completed';
    const isFailed = job.status === 'failed';

    // Enhanced time estimation
    let estimatedTimeRemaining = null;
    if (isRunning && progress.current > 0 && progress.total > progress.current) {
      const elapsed = new Date() - new Date(job.created_at);
      const rate = progress.current / elapsed;
      const remaining = progress.total - progress.current;
      estimatedTimeRemaining = Math.round(remaining / rate / 1000);
    }

    const response = {
      jobId,
      status: job.status,
      url: job.url,
      crawlLevel, // Include detected crawl level
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

    // 🔧 ENHANCED: Adaptive polling based on crawl level and progress
    if (isRunning) {
      const baseInterval = 2000;
      const elapsedMinutes = (new Date() - new Date(job.created_at)) / (1000 * 60);

      let adaptiveInterval = baseInterval;

      // Scale polling based on crawl level AND elapsed time
      if (crawlLevel >= 5) {
        // Level 5: Very large sites - start at 2s, go up to 8s after 60 minutes
        const timeMultiplier = Math.min(elapsedMinutes / 60, 1) * 3 + 1; // 1x to 4x
        adaptiveInterval = Math.round(baseInterval * timeMultiplier);
      } else if (crawlLevel >= 4) {
        // Level 4: Large sites - start at 2s, go up to 6s after 45 minutes
        const timeMultiplier = Math.min(elapsedMinutes / 45, 1) * 2 + 1; // 1x to 3x
        adaptiveInterval = Math.round(baseInterval * timeMultiplier);
      } else if (crawlLevel >= 3) {
        // Level 3: Medium sites - start at 2s, go up to 4s after 30 minutes
        const timeMultiplier = Math.min(elapsedMinutes / 30, 1) * 1 + 1; // 1x to 2x
        adaptiveInterval = Math.round(baseInterval * timeMultiplier);
      }

      // Cap at reasonable maximum
      adaptiveInterval = Math.min(adaptiveInterval, 10000);
      response.pollInterval = adaptiveInterval;

      // Enhanced debug info
      if (process.env.NODE_ENV === 'development') {
        response.debugInfo = {
          totalLinks: totalLinksCount,
          crawlLevel,
          elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
          baseInterval,
          adaptiveInterval,
          dynamicLimit: rateLimit.dynamicLimit,
          rateLimitRemaining: rateLimit.remaining,
          level:
            crawlLevel >= 5
              ? 'very_large'
              : crawlLevel >= 4
              ? 'large'
              : crawlLevel >= 3
              ? 'medium'
              : 'small',
        };
      }
    } else {
      response.pollInterval = null;
    }

    // Add rate limit info to response
    response.rateLimitInfo = {
      remaining: rateLimit.remaining,
      limit: rateLimit.dynamicLimit || 500,
      enhanced: crawlLevel >= 4,
      level: crawlLevel,
    };

    console.log(
      `✅ Status check for Level ${crawlLevel} job ${jobId}: ${job.status} (${brokenLinksCount}/${totalLinksCount} checked)`
    );

    return NextResponse.json(response, {
      headers: {
        ...(isComplete || isFailed ? { 'Cache-Control': 'public, max-age=60' } : {}),
        ...(rateLimit.headers || {}),
        'X-Crawl-Level': crawlLevel.toString(),
        'X-Dynamic-Limit': (rateLimit.dynamicLimit || 500).toString(),
      },
    });
  } catch (error) {
    console.error('❌ Error getting crawl status:', error);
    return await errorHandler.handleError(error, request, {
      step: 'status_fetch',
      jobId,
      endpoint: 'crawl_status',
    });
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
