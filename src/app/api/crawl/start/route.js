/**
 * Enhanced Start crawl endpoint with analyzed data support
 * Replace /src/app/api/crawl/start/route.js with this version
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

    console.log(`🚀 ENHANCED START: Starting crawl for: ${url}`);
    console.log(`📊 ENHANCED START: Has analyzed data: ${!!analyzedData}`);

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

    const normalizedUrl = urlUtils.normalizeUrl(url);

    // Check if we have pre-analyzed data
    if (analyzedData && analyzedData.sourceAnalysis && analyzedData.discoveredUrls) {
      console.log(
        `🎯 ENHANCED START: Using pre-analyzed data with ${analyzedData.discoveredUrls.length} URLs`
      );
      return await handleSmartCrawl(normalizedUrl, settings, analyzedData);
    } else {
      console.log(`🔍 ENHANCED START: Starting traditional crawl`);
      return await handleTraditionalCrawl(normalizedUrl, settings);
    }
  } catch (error) {
    console.error('❌ ENHANCED START: Error starting crawl:', error);

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

async function handleSmartCrawl(url, settings, analyzedData) {
  console.log(`🎯 SMART CRAWL: Processing ${analyzedData.discoveredUrls.length} pre-analyzed URLs`);

  try {
    // Create job in database
    const job = await db.createJob(url, {
      ...settings,
      isSmartCrawl: true,
      analyzedData: true,
      focusType: analyzedData.focusType,
      totalDiscoveredUrls: analyzedData.discoveredUrls.length,
    });

    console.log(`✅ SMART CRAWL: Created job ${job.id}`);

    // Add discovered URLs to database
    const discoveredLinks = analyzedData.discoveredUrls.map((url) => ({
      url,
      status: 'pending',
      is_internal: true,
      depth: 1,
    }));

    // Add links in batches
    const batchSize = 100;
    for (let i = 0; i < discoveredLinks.length; i += batchSize) {
      const batch = discoveredLinks.slice(i, i + batchSize);
      await db.addDiscoveredLinks(job.id, batch);
      console.log(
        `📝 SMART CRAWL: Added batch ${Math.floor(i / batchSize) + 1} (${batch.length} URLs)`
      );
    }

    // Update job progress
    await db.updateJobProgress(job.id, 0, discoveredLinks.length);
    await db.updateJobStatus(job.id, 'running');

    // Start checking links asynchronously
    checkLinksAsync(job.id, analyzedData.discoveredUrls, settings);

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: 'running',
        url: url,
        settings: settings,
        mode: 'smart',
        totalUrls: analyzedData.discoveredUrls.length,
        focusType: analyzedData.focusType,
        message: 'Smart crawl job started successfully using pre-analyzed URLs',
        statusUrl: `/api/crawl/status/${job.id}`,
        resultsUrl: `/api/results/${job.id}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ SMART CRAWL: Error:', error);
    throw error;
  }
}

async function handleTraditionalCrawl(url, settings) {
  console.log(`🔍 TRADITIONAL CRAWL: Starting for ${url}`);

  // Create new crawler instance for this job
  const crawler = new WebCrawler({
    maxDepth: settings.maxDepth || 3,
    includeExternal: settings.includeExternal || false,
    timeout: settings.timeout || 10000,
    maxConcurrent: 5,
    batchSize: 50,
  });

  // Start the crawl asynchronously
  const crawlPromise = crawler.startCrawl(url, settings);

  // Don't await the full crawl - return immediately with job info
  crawlPromise.catch((error) => {
    console.error(`❌ TRADITIONAL CRAWL: Failed for job:`, error);
  });

  // Get initial job info
  const initialResult = await crawlPromise;

  return NextResponse.json(
    {
      success: true,
      jobId: initialResult.jobId,
      status: 'started',
      url: url,
      settings: {
        maxDepth: settings.maxDepth || 3,
        includeExternal: settings.includeExternal || false,
        timeout: settings.timeout || 10000,
      },
      mode: 'traditional',
      message: 'Traditional crawl job started successfully',
      statusUrl: `/api/crawl/status/${initialResult.jobId}`,
      resultsUrl: `/api/results/${initialResult.jobId}`,
    },
    { status: 201 }
  );
}

async function checkLinksAsync(jobId, urls, settings) {
  console.log(`🔗 ASYNC CHECKER: Starting to check ${urls.length} URLs for job ${jobId}`);

  try {
    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 5,
      retryAttempts: 2,
    });

    // Process URLs in batches
    const batchSize = 50;
    let processedCount = 0;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      console.log(
        `🔗 ASYNC CHECKER: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          urls.length / batchSize
        )} (${batch.length} URLs)`
      );

      try {
        // Prepare URLs for checking
        const urlsToCheck = batch.map((url) => ({
          url: typeof url === 'string' ? url : url.url,
          sourceUrl: 'Analyzer Discovery',
          linkText: 'Analyzed Link',
        }));

        // Check this batch
        const { results } = await httpChecker.checkUrls(urlsToCheck);

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          processedCount++;

          // Update discovered link status
          await db.supabase
            .from('discovered_links')
            .update({ status: 'checked' })
            .eq('job_id', jobId)
            .eq('url', result.url);

          // If broken, add to broken links
          if (!result.isWorking) {
            await db.addBrokenLink(jobId, {
              url: result.url,
              sourceUrl: result.sourceUrl || 'Analyzer Discovery',
              statusCode: result.statusCode,
              errorType: result.errorType || 'other',
              linkText: result.linkText || 'Analyzed Link',
            });

            console.log(
              `❌ ASYNC CHECKER: Found broken link: ${result.url} (${result.statusCode})`
            );
          }
        }

        // Update progress
        await db.updateJobProgress(jobId, processedCount, urls.length);

        console.log(
          `✅ ASYNC CHECKER: Completed batch - ${processedCount}/${urls.length} total processed`
        );
      } catch (batchError) {
        console.error(`❌ ASYNC CHECKER: Error processing batch:`, batchError);
        // Continue with next batch
      }

      // Small delay between batches
      await batchUtils.delay(500);
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');
    console.log(`🎉 ASYNC CHECKER: Job ${jobId} completed! Processed ${processedCount} URLs`);
  } catch (error) {
    console.error(`❌ ASYNC CHECKER: Error in job ${jobId}:`, error);
    await db.updateJobStatus(jobId, 'failed', error.message);
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
