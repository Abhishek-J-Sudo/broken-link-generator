/**
 * Stop crawl endpoint
 * Stops a running crawl job by updating its status
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { validateAdvancedRateLimit } from '@/lib/validation';
import { errorHandler } from '@/lib/errorHandler';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function POST(request) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = validateAdvancedRateLimit(clientIP, 'crawl');

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': rateLimit.retryAfter.toString() } }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400, headers: securityHeaders }
      );
    }

    console.log(`🛑 STOP REQUEST: Attempting to stop job ${jobId}`);

    // Get current job status
    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404, headers: securityHeaders }
      );
    }

    // Only allow stopping running jobs
    if (job.status !== 'running') {
      return NextResponse.json(
        {
          error: 'Job is not running',
          currentStatus: job.status,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // Update job status to stopped
    await db.updateJobStatus(jobId, 'failed', 'Stopped by user');

    console.log(`✅ STOP SUCCESS: Job ${jobId} marked as stopped`);

    return NextResponse.json(
      {
        success: true,
        jobId: jobId,
        message: 'Crawl stopped successfully',
        previousStatus: job.status,
      },
      { headers: securityHeaders }
    );
  } catch (error) {
    console.error('❌ STOP ERROR:', error);
    return await errorHandler.handleError(error, request, {
      step: 'stop_crawl',
      jobId: body?.jobId,
    });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
