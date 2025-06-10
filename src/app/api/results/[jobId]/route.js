/**
 * Results endpoint
 * Gets different views of crawl job data (broken, working, all links, pages)
 * UPDATED to support multiple data views
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

    // Parse parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const { page: validPage, limit: validLimit } = validateUtils.validatePagination(page, limit);

    // NEW: Parse view parameter
    const view = searchParams.get('view') || 'broken'; // 'broken', 'all', 'working', 'pages'
    const errorType = searchParams.get('errorType');
    const search = searchParams.get('search');

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

    // Database connection check
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

    let query;
    let data;
    let count;
    let responseData;

    // Handle different views
    switch (view) {
      case 'all':
        // All discovered links
        query = db.supabase
          .from('discovered_links')
          .select(
            `
            id,
            url,
            status,
            is_internal,
            depth,
            created_at
          `,
            { count: 'exact' }
          )
          .eq('job_id', jobId);

        if (search) {
          query = query.ilike('url', `%${search}%`);
        }

        const offset1 = (validPage - 1) * validLimit;
        query = query
          .order('created_at', { ascending: false })
          .range(offset1, offset1 + validLimit - 1);

        const { data: allLinksData, error: allError, count: allCount } = await query;
        if (allError) throw new Error(`Database query failed: ${allError.message}`);

        data = allLinksData || [];
        count = allCount || 0;
        break;

      case 'working':
        // Working links (discovered but not broken)
        const { data: brokenUrls } = await db.supabase
          .from('broken_links')
          .select('url')
          .eq('job_id', jobId);

        const brokenUrlList = brokenUrls ? brokenUrls.map((item) => item.url) : [];

        query = db.supabase
          .from('discovered_links')
          .select(
            `
            id,
            url,
            status,
            is_internal,
            depth,
            created_at
          `,
            { count: 'exact' }
          )
          .eq('job_id', jobId);

        if (brokenUrlList.length > 0) {
          query = query.not('url', 'in', `(${brokenUrlList.map((url) => `"${url}"`).join(',')})`);
        }

        if (search) {
          query = query.ilike('url', `%${search}%`);
        }

        const offset2 = (validPage - 1) * validLimit;
        query = query
          .order('created_at', { ascending: false })
          .range(offset2, offset2 + validLimit - 1);

        const { data: workingLinksData, error: workingError, count: workingCount } = await query;
        if (workingError) throw new Error(`Database query failed: ${workingError.message}`);

        data = workingLinksData || [];
        count = workingCount || 0;
        break;

      case 'pages':
        // Scanned pages data
        query = db.supabase
          .from('discovered_links')
          .select(
            `
            id,
            url,
            status,
            is_internal,
            depth,
            created_at
          `,
            { count: 'exact' }
          )
          .eq('job_id', jobId)
          .eq('is_internal', true);

        if (search) {
          query = query.ilike('url', `%${search}%`);
        }

        const offset3 = (validPage - 1) * validLimit;
        query = query
          .order('created_at', { ascending: false })
          .range(offset3, offset3 + validLimit - 1);

        const { data: pagesData, error: pagesError, count: pagesCount } = await query;
        if (pagesError) throw new Error(`Database query failed: ${pagesError.message}`);

        data = pagesData || [];
        count = pagesCount || 0;
        break;

      default: // 'broken'
        // Original broken links logic
        query = db.supabase
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

        if (errorType && errorType !== 'all') {
          query = query.eq('error_type', errorType);
        }

        if (search) {
          query = query.or(
            `url.ilike.%${search}%,link_text.ilike.%${search}%,source_url.ilike.%${search}%`
          );
        }

        const offset4 = (validPage - 1) * validLimit;
        query = query
          .order('created_at', { ascending: false })
          .range(offset4, offset4 + validLimit - 1);

        const { data: brokenLinksData, error: brokenError, count: brokenCount } = await query;
        if (brokenError) throw new Error(`Database query failed: ${brokenError.message}`);

        data = brokenLinksData || [];
        count = brokenCount || 0;
        break;
    }

    // Calculate pagination info
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    // Get summary statistics (only for broken view)
    let summary = {};
    if (view === 'broken') {
      const summaryQuery = db.supabase
        .from('broken_links')
        .select('error_type')
        .eq('job_id', jobId);
      const { data: allBrokenLinks } = await summaryQuery;

      const errorTypeSummary = {};
      allBrokenLinks?.forEach((link) => {
        errorTypeSummary[link.error_type] = (errorTypeSummary[link.error_type] || 0) + 1;
      });

      summary = {
        totalBrokenLinks: totalCount,
        errorTypes: errorTypeSummary,
        mostCommonErrors: Object.entries(errorTypeSummary)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
      };
    }

    const response = {
      jobId,
      view, // NEW: Include view type
      dataType: view, // NEW: Include data type
      job: {
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        settings: job.settings,
      },
      data: data, // Changed from brokenLinks to generic data
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
      summary,
      filters: {
        view,
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
