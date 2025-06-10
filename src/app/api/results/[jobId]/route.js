/**
 * Enhanced Results endpoint with HTTP status tracking
 * Gets comprehensive link results (both working and broken) for a completed crawl job
 * UPDATED: Now shows all links with their HTTP status codes from discovered_links table
 * FIXED for Next.js 15 - awaits params
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { validateUtils } from '@/lib/utils';

export async function GET(request, { params }) {
  try {
    // FIX 1: Await params for Next.js 15 compatibility
    const { jobId } = await params;
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
    const statusFilter = searchParams.get('statusFilter'); // 'working', 'broken', 'all'
    const statusCode = searchParams.get('statusCode'); // Filter by specific HTTP status code
    const errorType = searchParams.get('errorType'); // Filter by error type (from broken_links)
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

    // Ensure database connection
    if (!db.supabase) {
      console.error('Database connection not available');
      return NextResponse.json(
        {
          error: 'Database connection error',
          code: 'DB_CONNECTION_FAILED',
        },
        { status: 500 }
      );
    }

    // NEW: Get comprehensive link results from discovered_links table (includes HTTP status)
    // Build query for all discovered links with their HTTP status
    let discoveredQuery = db.supabase
      .from('discovered_links')
      .select(
        `
        id,
        url,
        is_internal,
        depth,
        status,
        http_status_code,
        response_time,
        checked_at,
        is_working,
        error_message,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('job_id', jobId)
      .eq('status', 'checked'); // Only show checked links

    // Apply status filter
    if (statusFilter === 'working') {
      discoveredQuery = discoveredQuery.eq('is_working', true);
    } else if (statusFilter === 'broken') {
      discoveredQuery = discoveredQuery.eq('is_working', false);
    }

    // Apply HTTP status code filter
    if (statusCode) {
      discoveredQuery = discoveredQuery.eq('http_status_code', parseInt(statusCode));
    }

    // Apply search filter
    if (search) {
      discoveredQuery = discoveredQuery.ilike('url', `%${search}%`);
    }

    // Apply pagination and ordering
    const offset = (validPage - 1) * validLimit;
    discoveredQuery = discoveredQuery
      .order('checked_at', { ascending: false })
      .range(offset, offset + validLimit - 1);

    const {
      data: discoveredLinks,
      error: discoveredError,
      count: discoveredCount,
    } = await discoveredQuery;

    if (discoveredError) {
      throw new Error(`Database query failed: ${discoveredError.message}`);
    }

    // Get broken links with additional context (for error types and link text)
    let brokenLinksQuery = db.supabase.from('broken_links').select('*').eq('job_id', jobId);

    // Apply error type filter if specified
    if (errorType && errorType !== 'all') {
      brokenLinksQuery = brokenLinksQuery.eq('error_type', errorType);
    }

    const { data: brokenLinks } = await brokenLinksQuery;

    // Create a map of broken links for easy lookup
    const brokenLinksMap = new Map();
    brokenLinks?.forEach((link) => {
      brokenLinksMap.set(link.url, {
        source_url: link.source_url,
        link_text: link.link_text,
        error_type: link.error_type,
      });
    });

    // Enhanced results with HTTP status information
    const enhancedResults = (discoveredLinks || []).map((link) => {
      const brokenLinkData = brokenLinksMap.get(link.url);

      return {
        id: link.id,
        url: link.url,
        is_internal: link.is_internal,
        depth: link.depth,

        // HTTP Status Information
        http_status_code: link.http_status_code,
        response_time: link.response_time,
        checked_at: link.checked_at,
        is_working: link.is_working,
        error_message: link.error_message,

        // Status Category
        status_category: getStatusCategory(link.http_status_code, link.is_working),
        status_label: getStatusLabel(link.http_status_code, link.is_working, link.error_message),

        // Additional context for broken links
        source_url: brokenLinkData?.source_url || null,
        link_text: brokenLinkData?.link_text || 'Unknown',
        error_type: brokenLinkData?.error_type || null,

        created_at: link.created_at,
      };
    });

    // Filter by error type if specified (after enhancement)
    let filteredResults = enhancedResults;
    if (errorType && errorType !== 'all') {
      filteredResults = enhancedResults.filter((link) => link.error_type === errorType);
    }

    // Calculate pagination info
    const totalCount = discoveredCount || 0;
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    // Get comprehensive statistics
    const statsQuery = db.supabase
      .from('discovered_links')
      .select('http_status_code, is_working, response_time')
      .eq('job_id', jobId)
      .eq('status', 'checked');

    const { data: allLinks } = await statsQuery;

    // Analyze HTTP status codes and performance
    const statusCodeSummary = {};
    const performanceStats = {
      totalResponseTime: 0,
      validResponseTimes: 0,
      fastLinks: 0, // < 1000ms
      slowLinks: 0, // > 5000ms
    };

    allLinks?.forEach((link) => {
      // Count status codes
      const code = link.http_status_code || 'ERROR';
      statusCodeSummary[code] = (statusCodeSummary[code] || 0) + 1;

      // Performance analysis
      if (link.response_time) {
        performanceStats.totalResponseTime += link.response_time;
        performanceStats.validResponseTimes++;

        if (link.response_time < 1000) performanceStats.fastLinks++;
        if (link.response_time > 5000) performanceStats.slowLinks++;
      }
    });

    // Calculate averages
    const averageResponseTime =
      performanceStats.validResponseTimes > 0
        ? Math.round(performanceStats.totalResponseTime / performanceStats.validResponseTimes)
        : 0;

    // Get working vs broken breakdown
    const workingCount = allLinks?.filter((link) => link.is_working === true).length || 0;
    const brokenCount = allLinks?.filter((link) => link.is_working === false).length || 0;

    // Get error type summary from broken_links
    const errorTypeSummary = {};
    brokenLinks?.forEach((link) => {
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

      // Enhanced results with HTTP status data
      links: filteredResults,

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

      // Enhanced summary with HTTP status analysis
      summary: {
        totalLinksChecked: allLinks?.length || 0,
        workingLinks: workingCount,
        brokenLinks: brokenCount,
        successRate: allLinks?.length > 0 ? Math.round((workingCount / allLinks.length) * 100) : 0,

        // HTTP Status Code Breakdown
        statusCodes: statusCodeSummary,
        mostCommonStatuses: Object.entries(statusCodeSummary)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([code, count]) => ({
            code: code === 'ERROR' ? null : parseInt(code),
            label: getStatusLabel(code === 'ERROR' ? null : parseInt(code)),
            count,
          })),

        // Error Type Breakdown (for broken links)
        errorTypes: errorTypeSummary,
        mostCommonErrors: Object.entries(errorTypeSummary)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),

        // Performance Analysis
        performance: {
          averageResponseTime,
          fastLinks: performanceStats.fastLinks,
          slowLinks: performanceStats.slowLinks,
          responseTimeRange:
            allLinks?.length > 0
              ? {
                  fastest: Math.min(
                    ...allLinks.filter((l) => l.response_time).map((l) => l.response_time)
                  ),
                  slowest: Math.max(
                    ...allLinks.filter((l) => l.response_time).map((l) => l.response_time)
                  ),
                }
              : null,
        },
      },

      filters: {
        statusFilter: statusFilter || null,
        statusCode: statusCode || null,
        errorType: errorType || null,
        search: search || null,
      },

      // Available filter options
      filterOptions: {
        statusCodes: Object.keys(statusCodeSummary).map((code) => ({
          code: code === 'ERROR' ? null : parseInt(code),
          label: getStatusLabel(code === 'ERROR' ? null : parseInt(code)),
          count: statusCodeSummary[code],
        })),
        errorTypes: Object.keys(errorTypeSummary).map((type) => ({
          type,
          count: errorTypeSummary[type],
        })),
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

/**
 * Helper function to categorize HTTP status codes
 */
function getStatusCategory(statusCode, isWorking) {
  if (statusCode === null) return 'error';
  if (isWorking === false) return 'broken';
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'redirect';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500) return 'server_error';
  return 'unknown';
}

/**
 * Helper function to get human-readable status labels
 */
function getStatusLabel(statusCode, isWorking = null, errorMessage = null) {
  if (statusCode === null) {
    return errorMessage ? `Error: ${errorMessage}` : 'Connection Error';
  }

  const statusLabels = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found (Redirect)',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  const label = statusLabels[statusCode] || `HTTP ${statusCode}`;

  // Add working/broken indicator
  if (isWorking === true) {
    return `✅ ${label}`;
  } else if (isWorking === false) {
    return `❌ ${label}`;
  }

  return label;
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
