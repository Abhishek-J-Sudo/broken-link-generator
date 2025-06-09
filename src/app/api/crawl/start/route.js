/**
 * Start crawl endpoint
 * Initiates a new broken link checking job
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebCrawler } from '@/lib/crawler';
import { urlUtils, validateUtils } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, settings = {} } = body;

    // Validate required fields
    if (!url) {
      return NextResponse.json(
        {
          error: 'URL is required',
          code: 'MISSING_URL',
        },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!urlUtils.isValidUrl(url)) {
      return NextResponse.json(
        {
          error: 'Invalid URL format',
          code: 'INVALID_URL',
        },
        { status: 400 }
      );
    }

    // Validate settings
    const settingsValidation = validateUtils.validateCrawlSettings(settings);
    if (!settingsValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid settings',
          details: settingsValidation.errors,
          code: 'INVALID_SETTINGS',
        },
        { status: 400 }
      );
    }

    // Normalize URL
    const normalizedUrl = urlUtils.normalizeUrl(url);

    // Create new crawler instance for this job
    const crawler = new WebCrawler({
      maxDepth: settings.maxDepth || 3,
      includeExternal: settings.includeExternal || false,
      timeout: settings.timeout || 10000,
      maxConcurrent: 5,
      batchSize: 50,
    });

    console.log(`Starting crawl for: ${normalizedUrl}`);

    // Start the crawl asynchronously
    const crawlPromise = crawler.startCrawl(normalizedUrl, settings);

    // Don't await the full crawl - return immediately with job info
    crawlPromise.catch((error) => {
      console.error(`Crawl failed for job:`, error);
    });

    // Get initial job info
    const initialResult = await crawlPromise;

    return NextResponse.json(
      {
        success: true,
        jobId: initialResult.jobId,
        status: 'started',
        url: normalizedUrl,
        settings: {
          maxDepth: settings.maxDepth || 3,
          includeExternal: settings.includeExternal || false,
          timeout: settings.timeout || 10000,
        },
        message: 'Crawl job started successfully',
        statusUrl: `/api/crawl/status/${initialResult.jobId}`,
        resultsUrl: `/api/results/${initialResult.jobId}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error starting crawl:', error);

    return NextResponse.json(
      {
        error: 'Failed to start crawl job',
        message: error.message,
        code: 'CRAWL_START_FAILED',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
