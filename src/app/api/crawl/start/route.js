/**
 * Start crawl endpoint
 * Initiates a new broken link checking job
 * Enhanced to handle pre-analyzed URLs for smart crawling
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebCrawler } from '@/lib/crawler';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, settings = {}, analyzedData = null } = body;

    console.log('🚀 ENHANCED START: Starting crawl for:', url);
    console.log('📊 ENHANCED START: Has analyzed data:', !!analyzedData);

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

    // Enhanced Path: Use pre-analyzed data if available
    if (analyzedData && analyzedData.categories && analyzedData.categories.pages) {
      console.log(
        '🎯 ENHANCED START: Using pre-analyzed data with',
        analyzedData.categories.pages.length,
        'URLs'
      );
      return await handleSmartCrawl(normalizedUrl, settings, analyzedData);
    }

    // Traditional Path: Normal crawling
    console.log('🔄 ENHANCED START: Using traditional crawl method');

    // Create new crawler instance for this job
    const crawler = new WebCrawler({
      maxDepth: settings.maxDepth || 3,
      includeExternal: settings.includeExternal || false,
      timeout: settings.timeout || 10000,
      maxConcurrent: 5,
      batchSize: 50,
    });

    // Start the crawl asynchronously
    const crawlPromise = crawler.startCrawl(normalizedUrl, settings);

    // Don't await the full crawl - return immediately with job info
    crawlPromise.catch((error) => {
      console.error(`Traditional crawl failed:`, error);
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
    console.error('❌ ENHANCED START: Error starting crawl:', error);

    return NextResponse.json(
      {
        error: 'Failed to start crawl job',
        message: error.message || 'Unknown error occurred',
        code: 'CRAWL_START_FAILED',
      },
      { status: 500 }
    );
  }
}

/**
 * Smart crawl using pre-analyzed URLs
 */
async function handleSmartCrawl(url, settings, analyzedData) {
  try {
    console.log(
      '🎯 SMART CRAWL: Processing',
      analyzedData.categories.pages.length,
      'pre-analyzed URLs'
    );

    // Create job in database
    const job = await db.createJob(url, {
      ...settings,
      maxDepth: settings.maxDepth || 3,
      includeExternal: settings.includeExternal || false,
      timeout: settings.timeout || 10000,
      isSmartCrawl: true,
    });

    console.log('📝 SMART CRAWL: Created job:', job.id);

    // Extract URLs from analyzed data
    const urlsToCheck = [];

    // Get content pages (primary target)
    if (analyzedData.categories.pages && Array.isArray(analyzedData.categories.pages)) {
      analyzedData.categories.pages.forEach((pageData) => {
        if (pageData && pageData.url) {
          urlsToCheck.push({
            url: pageData.url,
            sourceUrl: pageData.sourceUrl || url,
            linkText: 'Content Page',
            category: 'pages',
          });
        }
      });
    }

    // Optionally include external links if requested
    if (settings.includeExternal && analyzedData.categories.withParams) {
      analyzedData.categories.withParams.forEach((paramData) => {
        if (paramData && paramData.url) {
          urlsToCheck.push({
            url: paramData.url,
            sourceUrl: paramData.sourceUrl || url,
            linkText: 'External Link',
            category: 'withParams',
          });
        }
      });
    }

    console.log('🔍 SMART CRAWL: Prepared', urlsToCheck.length, 'URLs for checking');

    if (urlsToCheck.length === 0) {
      throw new Error('No valid URLs found in analyzed data');
    }

    // Save discovered URLs to database
    await db.addDiscoveredLinks(
      job.id,
      urlsToCheck.map((urlData) => ({
        url: urlData.url,
        source_url: urlData.sourceUrl,
        is_internal: true,
        depth: 1,
        status: 'pending',
      }))
    );

    // Update job progress
    await db.updateJobProgress(job.id, 0, urlsToCheck.length);
    await db.updateJobStatus(job.id, 'running');

    // Start checking links in background (don't await)
    processSmartCrawlLinks(job.id, urlsToCheck, settings).catch((error) => {
      console.error('❌ SMART CRAWL: Background processing failed:', error);
      db.updateJobStatus(job.id, 'failed', error.message).catch(console.error);
    });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: 'started',
        url: url,
        mode: 'smart_crawl',
        urlsToCheck: urlsToCheck.length,
        settings: {
          maxDepth: settings.maxDepth || 3,
          includeExternal: settings.includeExternal || false,
          timeout: settings.timeout || 10000,
          isSmartCrawl: true,
        },
        message: `Smart crawl started - checking ${urlsToCheck.length} pre-analyzed URLs`,
        statusUrl: `/api/crawl/status/${job.id}`,
        resultsUrl: `/api/results/${job.id}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ SMART CRAWL: Error:', error);
    throw error; // Re-throw to be caught by main handler
  }
}

/**
 * Process smart crawl links in background
 */
async function processSmartCrawlLinks(jobId, urlsToCheck, settings) {
  try {
    console.log('🔄 SMART CRAWL: Starting background link checking for job', jobId);

    // Create HTTP checker
    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 5,
      retryAttempts: 2,
    });

    // Process URLs in batches
    const batchSize = 25;
    const batches = batchUtils.chunkArray(urlsToCheck, batchSize);
    let processedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `🔄 SMART CRAWL: Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`
      );

      try {
        // Check URLs in this batch
        const { results } = await httpChecker.checkUrls(batch);

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const originalUrl = batch[j];

          processedCount++;

          // If link is broken, save to database
          if (!result.isWorking) {
            await db.addBrokenLink(jobId, {
              url: result.url,
              sourceUrl: originalUrl.sourceUrl,
              statusCode: result.statusCode,
              errorType: result.errorType || 'other',
              linkText: originalUrl.linkText || 'No text',
            });
          }

          // Update progress every 5 URLs
          if (processedCount % 5 === 0) {
            await db.updateJobProgress(jobId, processedCount, urlsToCheck.length);
          }
        }

        // Small delay between batches
        if (i < batches.length - 1) {
          await batchUtils.delay(1000);
        }
      } catch (batchError) {
        console.error(`❌ SMART CRAWL: Error processing batch ${i + 1}:`, batchError);
        // Continue with next batch
      }
    }

    // Final progress update and complete job
    await db.updateJobProgress(jobId, processedCount, urlsToCheck.length);
    await db.updateJobStatus(jobId, 'completed');

    console.log('✅ SMART CRAWL: Completed successfully -', processedCount, 'URLs processed');
  } catch (error) {
    console.error('❌ SMART CRAWL: Background processing error:', error);
    await db.updateJobStatus(jobId, 'failed', error.message);
    throw error;
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
