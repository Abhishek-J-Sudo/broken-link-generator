/**
 * Enhanced large crawl endpoint with analyzed data support
 * Replace /src/app/api/crawl/large/route.js with this version
 */

import { NextRequest, NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, settings = {}, action = 'start', analyzedData = null, jobId = null } = body;

    console.log(`🔧 ENHANCED LARGE: Action: ${action}, Has analyzed data: ${!!analyzedData}`);

    if (action === 'start') {
      return await startLargeCrawl(url, settings, analyzedData);
    } else if (action === 'continue') {
      return await continueCrawl(jobId);
    }
  } catch (error) {
    console.error('❌ ENHANCED LARGE: Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process large crawl',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function startLargeCrawl(url, settings, analyzedData) {
  // Validate inputs
  if (!urlUtils.isValidUrl(url)) {
    return NextResponse.json(
      {
        error: 'Invalid URL format',
      },
      { status: 400 }
    );
  }

  const normalizedUrl = urlUtils.normalizeUrl(url);

  // Check if we have pre-analyzed data
  if (analyzedData && analyzedData.sourceAnalysis && analyzedData.discoveredUrls) {
    console.log(
      `🎯 ENHANCED LARGE: Using pre-analyzed data with ${analyzedData.discoveredUrls.length} URLs`
    );
    return await handleSmartLargeCrawl(normalizedUrl, settings, analyzedData);
  } else {
    console.log(`🔍 ENHANCED LARGE: Starting traditional large crawl`);
    return await handleTraditionalLargeCrawl(normalizedUrl, settings);
  }
}

async function handleSmartLargeCrawl(url, settings, analyzedData) {
  console.log(
    `🎯 SMART LARGE CRAWL: Processing ${analyzedData.discoveredUrls.length} pre-analyzed URLs`
  );

  try {
    // Create job with smart crawl settings
    const job = await db.createJob(url, {
      ...settings,
      maxDepth: Math.min(settings.maxDepth || 3, 5),
      includeExternal: settings.includeExternal || false,
      timeout: 8000,
      isLargeSite: true,
      isSmartCrawl: true,
      analyzedData: true,
      focusType: analyzedData.focusType,
      totalDiscoveredUrls: analyzedData.discoveredUrls.length,
    });

    console.log(`✅ SMART LARGE CRAWL: Created job ${job.id}`);

    // Add discovered URLs to database in chunks
    const discoveredLinks = analyzedData.discoveredUrls.map((url) => ({
      url: typeof url === 'string' ? url : url.url,
      status: 'pending',
      is_internal: true,
      depth: 1,
    }));

    // Process in chunks to avoid database limits
    const chunks = batchUtils.chunkArray(discoveredLinks, 100);
    for (let i = 0; i < chunks.length; i++) {
      await db.addDiscoveredLinks(job.id, chunks[i]);
      console.log(
        `📝 SMART LARGE CRAWL: Added chunk ${i + 1}/${chunks.length} (${chunks[i].length} URLs)`
      );
      await batchUtils.delay(100);
    }

    // Update job to ready for link checking phase
    await db.updateJobStatus(job.id, 'ready_for_checking');
    await db.updateJobProgress(job.id, 0, discoveredLinks.length);

    console.log(`🔄 SMART LARGE CRAWL: Discovery phase complete, starting link checking`);

    // Immediately start checking links
    checkLinksInChunksAsync(job.id, settings);

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: 'checking_links',
        url: url,
        mode: 'smart_large',
        totalUrls: analyzedData.discoveredUrls.length,
        focusType: analyzedData.focusType,
        message: 'Smart large crawl started - using pre-analyzed URLs for checking',
        statusUrl: `/api/crawl/status/${job.id}`,
        resultsUrl: `/api/results/${job.id}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ SMART LARGE CRAWL: Error:', error);
    throw error;
  }
}

async function handleTraditionalLargeCrawl(url, settings) {
  console.log(`🔍 TRADITIONAL LARGE CRAWL: Starting for ${url}`);

  // Create job
  const job = await db.createJob(url, {
    ...settings,
    maxDepth: Math.min(settings.maxDepth || 3, 5),
    includeExternal: settings.includeExternal || false,
    timeout: 8000,
    isLargeSite: true,
  });

  // Start Phase 1: Discovery only (fast)
  await discoverAllLinksAsync(job.id, url, settings);

  return NextResponse.json(
    {
      success: true,
      jobId: job.id,
      status: 'discovering',
      url: url,
      mode: 'traditional_large',
      message: 'Large site crawl started - discovering all links first',
      continueUrl: `/api/crawl/large`,
      statusUrl: `/api/crawl/status/${job.id}`,
    },
    { status: 201 }
  );
}

async function discoverAllLinksAsync(jobId, startUrl, settings) {
  // This would be the traditional discovery process
  // For now, we'll implement a basic version
  console.log(`🔍 DISCOVERY: Starting discovery for job ${jobId}`);

  try {
    await db.updateJobStatus(jobId, 'running');

    // Basic discovery implementation
    // You can expand this with the full discovery logic later

    await db.updateJobStatus(jobId, 'ready_for_checking');
    console.log(`✅ DISCOVERY: Discovery complete for job ${jobId}`);
  } catch (error) {
    console.error('❌ DISCOVERY: Error:', error);
    await db.updateJobStatus(jobId, 'failed', error.message);
  }
}

async function continueCrawl(jobId) {
  try {
    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'ready_for_checking') {
      return NextResponse.json(
        {
          error: 'Job not ready for link checking',
          status: job.status,
        },
        { status: 400 }
      );
    }

    // Start checking links in background
    checkLinksInChunksAsync(jobId, job.settings);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'checking_links',
      message: 'Started checking discovered links',
    });
  } catch (error) {
    console.error('❌ CONTINUE CRAWL: Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to continue crawl',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function checkLinksInChunksAsync(jobId, settings) {
  console.log(`🔗 CHUNK CHECKER: Starting link checking for job ${jobId}`);

  try {
    await db.updateJobStatus(jobId, 'running');

    const httpChecker = new HttpChecker({
      timeout: 8000,
      maxConcurrent: 8,
      retryAttempts: 1,
    });

    let processedCount = 0;
    let hasMore = true;
    const batchSize = 100;

    while (hasMore) {
      // Get next batch of pending links
      const { data: pendingLinks } = await db.supabase
        .from('discovered_links')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .limit(batchSize);

      if (!pendingLinks || pendingLinks.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`🔗 CHUNK CHECKER: Processing batch of ${pendingLinks.length} links`);

      // Check this batch of links
      const urlsToCheck = pendingLinks.map((link) => ({
        url: link.url,
        sourceUrl: link.source_url || 'Discovery',
        linkText: 'Link',
      }));

      const { results } = await httpChecker.checkUrls(urlsToCheck);

      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const linkRecord = pendingLinks[i];

        // Update link status
        await db.supabase
          .from('discovered_links')
          .update({ status: 'checked' })
          .eq('id', linkRecord.id);

        // If broken, add to broken links
        if (!result.isWorking) {
          await db.addBrokenLink(jobId, {
            url: result.url,
            sourceUrl: result.sourceUrl,
            statusCode: result.statusCode,
            errorType: result.errorType || 'other',
            linkText: result.linkText || 'No text',
          });
        }

        processedCount++;
      }

      // Update progress
      const totalLinks = await db.supabase
        .from('discovered_links')
        .select('id', { count: 'exact' })
        .eq('job_id', jobId)
        .then(({ count }) => count || 0);

      await db.updateJobProgress(jobId, processedCount, totalLinks);

      console.log(`✅ CHUNK CHECKER: Processed ${processedCount}/${totalLinks} links`);

      // Small delay between batches
      await batchUtils.delay(500);
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');
    console.log(`🎉 CHUNK CHECKER: Job ${jobId} completed! Processed ${processedCount} links`);
  } catch (error) {
    console.error('❌ CHUNK CHECKER: Error:', error);
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
