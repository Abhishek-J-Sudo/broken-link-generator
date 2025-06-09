/**
 * Results endpoint
 * Gets broken links results for a completed crawl job
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { validateUtils } from '@/lib/utils';

export async function GET(request, { params }) {
  try {
    const { jobId } = params;
    const { searchParams } = new URL(request.url);

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

    // Validate and parse pagination parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const { page: validPage, limit: validLimit } = validateUtils.validatePagination(page, limit);

    // Parse filter parameters
    const errorType = searchParams.get('errorType'); // Filter by error type
    const search = searchParams.get('search'); // Search in URLs or link text

    // Check if job exists
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

    // Build query for broken links
    let query = db.supabase
      .from('broken_links')
      .select(
        `
        id,
        url,
        source_url,
        status_code,
        error_type,
        link_text,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('job_id', jobId);

    // Apply filters
    if (errorType && errorType !== 'all') {
      query = query.eq('error_type', errorType);
    }

    if (search) {
      query = query.or(
        `url.ilike.%${search}%,link_text.ilike.%${search}%,source_url.ilike.%${search}%`
      );
    }

    // Apply pagination and ordering
    const offset = (validPage - 1) * validLimit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + validLimit - 1);

    const { data: brokenLinks, error, count } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Calculate pagination info
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    // Get summary statistics
    const summaryQuery = db.supabase.from('broken_links').select('error_type').eq('job_id', jobId);

    const { data: allBrokenLinks } = await summaryQuery;

    // Group by error type for summary
    const errorTypeSummary = {};
    allBrokenLinks?.forEach((link) => {
      errorTypeSummary[link.error_type] = (errorTypeSummary[link.error_type] || 0) + 1;
    });

    const response = {
      jobId,
      job: {
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        settings: job.settings,
      },
      brokenLinks: brokenLinks || [],
      pagination: {
        currentPage: validPage,
        totalPages,
        totalCount,
        limit: validLimit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? validPage + 1 : null,
        prevPage: hasPrevPage ? validPage - 1 : null,
      },
      summary: {
        totalBrokenLinks: totalCount,
        errorTypes: errorTypeSummary,
        mostCommonErrors: Object.entries(errorTypeSummary)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
      },
      filters: {
        errorType: errorType || null,
        search: search || null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting results:', error);

    return NextResponse.json(
      {
        error: 'Failed to get results',
        message: error.message,
        code: 'RESULTS_FETCH_FAILED',
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
