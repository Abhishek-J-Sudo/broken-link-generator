/**
 * FIXED Results endpoint with proper source URL handling
 * Gets comprehensive link results (both working and broken) for a completed crawl job
 * FIXED: Now properly shows source URLs for all links from discovered_links table
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { validateUtils } from '@/lib/utils';
import { errorHandler, handleValidationError } from '@/lib/errorHandler';

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
    const seoScore = searchParams.get('seoScore') || 'all';

    // NEW: Add sorting parameters
    const sortBy = searchParams.get('sortBy'); // 'response_time' or 'seo_score'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' or 'desc'
    // Check if job exists
    const job = await db.getJob(jobId);
    if (!job) {
      return await errorHandler.handleError(new Error('Job not found'), request, {
        step: 'job_lookup',
        jobId,
      });
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

    // FIXED: Get comprehensive link results from discovered_links table (now includes source_url)
    // Build query for all discovered links with their HTTP status AND source URLs
    let discoveredQuery = db.supabase
      .from('discovered_links')
      .select(
        `
        id,
        url,
        source_url,
        is_internal,
        depth,
        status,
        http_status_code,
        response_time,
        checked_at,
        is_working,
        error_message,
        created_at
      )
    `,
        { count: 'exact' }
      )
      .eq('job_id', jobId)
      .eq('status', 'checked'); // Only show checked links

    // STEP 2: Get SEO data separately
    const { data: seoData } = await db.supabase
      .from('seo_analysis')
      .select(
        `
        url, 
        seo_score, 
        seo_grade, 
        title_text, 
        title_length,
        meta_description, 
        description_length,
        issues_count, 
        is_https,
        h1_count,
        h2_count,
        h3_count,
        word_count,
        total_images,
        missing_alt,
        alt_coverage,
        canonical_url,
        issues,
        status_code,
        analyzed_at
      `
      )
      .eq('job_id', jobId);

    // STEP 3: Create SEO lookup map
    const seoMap = new Map();
    seoData?.forEach((seo) => seoMap.set(seo.url, seo));

    // // ADD THIS DEBUG LOG HERE:
    // console.log(`🔍 SEO MAP DEBUG:`, {
    //   seoDataLength: seoData?.length || 0,
    //   seoMapSize: seoMap.size,
    //   firstSeoUrl: seoData?.[0]?.url,
    //   firstSeoScore: seoData?.[0]?.seo_score,
    //   sampleMapLookup: seoMap.get(seoData?.[0]?.url),
    // });

    // Apply status filter
    if (statusFilter === 'working') {
      discoveredQuery = discoveredQuery.eq('is_working', true);
    } else if (statusFilter === 'broken') {
      discoveredQuery = discoveredQuery.or('is_working.eq.false,is_working.is.null');
    } else if (statusFilter === 'pages') {
      // NEW: Filter for internal pages only (scanned pages)
      discoveredQuery = discoveredQuery.eq('is_internal', true);
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
    discoveredQuery = discoveredQuery.order('checked_at', { ascending: false });

    const {
      data: discoveredLinks,
      error: discoveredError,
      count: discoveredCount,
    } = await discoveredQuery;

    // console.log(`📊 DEBUG: Discovered links query result:`, {
    //   discoveredLinksCount: discoveredLinks?.length || 0,
    //   discoveredError,
    //   firstLinkWithSeo: discoveredLinks?.[0]?.seo_analysis,
    //   allSeoAnalysis: discoveredLinks?.map((link) => ({
    //     url: link.url,
    //     seo_analysis: link.seo_analysis,
    //   })),
    // });

    if (discoveredError) {
      throw new Error(`Database query failed: ${discoveredError.message}`);
    }

    // Add this AFTER the discoveredQuery but BEFORE the brokenLinksQuery
    // console.log(`🔍 DEBUG: Checking SEO analysis table directly...`);
    // const { data: directSeoCheck, error: seoError } = await db.supabase
    //   .from('seo_analysis')
    //   .select('*')
    //   .eq('job_id', jobId)
    //   .limit(5);

    // console.log(`📊 DEBUG: Direct SEO check:`, {
    //   seoCount: directSeoCheck?.length || 0,
    //   seoError,
    //   firstSeoRecord: directSeoCheck?.[0],
    //   allUrls: directSeoCheck?.map((s) => s.url),
    // });

    // Get broken links with additional context (for error types and link text)
    let brokenLinksQuery = db.supabase.from('broken_links').select('*').eq('job_id', jobId);

    // Apply error type filter if specified
    if (errorType && errorType !== 'all') {
      brokenLinksQuery = brokenLinksQuery.eq('error_type', errorType);
    }

    const { data: brokenLinks } = await brokenLinksQuery;

    // Create a map of broken links for easy lookup (for additional metadata like link_text)
    const brokenLinksMap = new Map();
    brokenLinks?.forEach((link) => {
      brokenLinksMap.set(link.url, {
        link_text: link.link_text,
        error_type: link.error_type,
      });
    });

    // FIXED: Enhanced results with proper source URL information
    const enhancedResults = (discoveredLinks || []).map((link) => {
      const brokenLinkData = brokenLinksMap.get(link.url);
      const seoDataForLink = seoMap.get(link.url);

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

        // FIXED: Source URL now comes from discovered_links table
        source_url: link.source_url || 'Discovery',

        // SEO Data
        seo_score: seoDataForLink?.seo_score || null,
        seo_grade: seoDataForLink?.seo_grade || null,
        seo_title: seoDataForLink?.title_text
          ? {
              text: seoDataForLink.title_text,
            }
          : null,
        seo_metaDescription: seoDataForLink?.meta_description
          ? {
              text: seoDataForLink.meta_description,
            }
          : null,
        seo_headings: {
          h1_count: seoDataForLink?.h1_count || 0,
          h2_count: seoDataForLink?.h2_count || 0,
          h3_count: seoDataForLink?.h3_count || 0,
          hasNoH1: (seoDataForLink?.h1_count || 0) === 0,
        },
        seo_content: {
          word_count: seoDataForLink?.word_count || 0,
        },
        seo_images: {
          total_images: seoDataForLink?.total_images || 0,
          missing_alt: seoDataForLink?.missing_alt || 0,
          alt_coverage: seoDataForLink?.alt_coverage || 100,
        },
        seo_technical: {
          isHttps: seoDataForLink?.is_https || false,
          canonical_url: seoDataForLink?.canonical_url || null,
          status_code: seoDataForLink?.status_code || null,
        },
        seo_issues_count: seoDataForLink?.issues_count || 0,
        seo_issues: seoDataForLink?.issues || [],
        seo_analyzed_at: seoDataForLink?.analyzed_at || null,
        has_seo_data: !!seoDataForLink,

        // Additional context for broken links (from broken_links table)
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

    // ADD SEO SCORE FILTERING
    if (seoScore && seoScore !== 'all') {
      filteredResults = filteredResults.filter((link) => {
        const score = link.seo_score;

        switch (seoScore) {
          case 'good':
            return score !== null && score >= 80;
          case 'needs-work':
            return score !== null && score >= 60 && score < 80;
          case 'poor':
            return score !== null && score < 60;
          case 'no-data':
            return score === null || score === undefined;
          default:
            return true;
        }
      });
    }

    // Calculate pagination info
    const totalCount = filteredResults.length;
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    const paginatedResults = filteredResults.slice(
      (validPage - 1) * validLimit,
      validPage * validLimit
    );

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
    const brokenCount = allLinks?.filter((link) => link.is_working !== true).length || 0;

    // Get error type summary from broken_links
    const errorTypeSummary = {};
    brokenLinks?.forEach((link) => {
      errorTypeSummary[link.error_type] = (errorTypeSummary[link.error_type] || 0) + 1;
    });

    const { count: internalPagesCount } = await db.supabase
      .from('discovered_links')
      .select('id', { count: 'exact' })
      .eq('job_id', jobId)
      .eq('status', 'checked')
      .eq('is_internal', true);

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

      // Enhanced results with HTTP status data and FIXED source URLs
      links: paginatedResults,

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
        internalPagesCount: internalPagesCount || 0,

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

      // seo
      seo: {
        totalAnalyzed: enhancedResults.filter((link) => link.seo_score !== null).length,
        averageScore:
          enhancedResults.filter((link) => link.seo_score !== null).length > 0
            ? Math.round(
                enhancedResults
                  .filter((link) => link.seo_score !== null)
                  .reduce((sum, link) => sum + link.seo_score, 0) /
                  enhancedResults.filter((link) => link.seo_score !== null).length
              )
            : null,
        gradeDistribution: {
          A: enhancedResults.filter((link) => link.seo_grade === 'A').length,
          B: enhancedResults.filter((link) => link.seo_grade === 'B').length,
          C: enhancedResults.filter((link) => link.seo_grade === 'C').length,
          D: enhancedResults.filter((link) => link.seo_grade === 'D').length,
          F: enhancedResults.filter((link) => link.seo_grade === 'F').length,
        },
        httpsPages: enhancedResults.filter((link) => link.seo_is_https === true).length,
      },

      filters: {
        statusFilter: statusFilter || null,
        statusCode: statusCode || null,
        errorType: errorType || null,
        search: search || null,
        seoScore: seoScore || null,
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

    return await errorHandler.handleError(error, request, {
      step: 'results_fetch',
      jobId: jobId,
      filters: { statusFilter, statusCode, errorType, search },
    });
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
