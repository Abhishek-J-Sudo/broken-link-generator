/**
 * Enhanced crawl endpoint for large sites (1000+ pages)
 * Uses chunked processing to avoid timeouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, settings = {}, action = 'start' } = body;

    if (action === 'start') {
      return await startLargeCrawl(url, settings);
    } else if (action === 'continue') {
      return await continueCrawl(body.jobId);
    }
  } catch (error) {
    console.error('Error in large crawl:', error);
    return NextResponse.json(
      {
        error: 'Failed to process large crawl',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function startLargeCrawl(url, settings) {
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

  // Create job
  const job = await db.createJob(normalizedUrl, {
    ...settings,
    maxDepth: Math.min(settings.maxDepth || 3, 5), // Cap at 5 for large sites
    includeExternal: settings.includeExternal || false,
    timeout: 8000, // Shorter timeout for large sites
    isLargeSite: true,
  });

  // Start Phase 1: Discovery only (fast)
  await discoverAllLinks(job.id, normalizedUrl, settings);

  return NextResponse.json(
    {
      success: true,
      jobId: job.id,
      status: 'discovering',
      url: normalizedUrl,
      message: 'Large site crawl started - discovering all links first',
      continueUrl: `/api/crawl/large`,
      statusUrl: `/api/crawl/status/${job.id}`,
    },
    { status: 201 }
  );
}

async function discoverAllLinks(jobId, startUrl, settings) {
  try {
    await db.updateJobStatus(jobId, 'running');

    const linkExtractor = new LinkExtractor({
      includeExternal: settings.includeExternal || false,
      maxLinksPerPage: 2000, // Higher limit for discovery
    });

    const visitedUrls = new Set();
    const pendingUrls = new Map([[startUrl, { depth: 0, sourceUrl: null }]]);
    const allDiscoveredLinks = [];

    const maxDepth = settings.maxDepth || 3;
    let pagesProcessed = 0;
    const maxPagesForDiscovery = 2000; // Safety limit

    // Phase 1: Just discover all links (don't check them yet)
    while (pendingUrls.size > 0 && pagesProcessed < maxPagesForDiscovery) {
      const batch = [];
      const iterator = pendingUrls.entries();

      // Get batch of URLs to process
      for (let i = 0; i < 10 && batch.length < 10; i++) {
        // Smaller batches
        const next = iterator.next();
        if (next.done) break;

        const [url, metadata] = next.value;
        batch.push({ url, ...metadata });
        pendingUrls.delete(url);
      }

      if (batch.length === 0) break;

      // Process batch for link discovery only
      for (const urlData of batch) {
        try {
          if (visitedUrls.has(urlData.url)) continue;
          visitedUrls.add(urlData.url);
          pagesProcessed++;

          // Quick check if page exists and get content
          const pageContent = await fetchPageQuickly(urlData.url);
          if (!pageContent) continue;

          // Extract links
          const extractionResult = linkExtractor.extractLinks(
            pageContent,
            urlData.url,
            urlData.depth
          );

          allDiscoveredLinks.push(...extractionResult.links);

          // Add new URLs to pending if within depth limit
          extractionResult.links.forEach((link) => {
            if (
              link.depth <= maxDepth &&
              link.shouldCrawl &&
              !visitedUrls.has(link.url) &&
              !pendingUrls.has(link.url)
            ) {
              pendingUrls.set(link.url, {
                depth: link.depth,
                sourceUrl: urlData.url,
                linkText: link.linkText,
              });
            }
          });

          // Update progress every 10 pages
          if (pagesProcessed % 10 === 0) {
            await db.updateJobProgress(jobId, pagesProcessed, visitedUrls.size + pendingUrls.size);
          }
        } catch (error) {
          console.error(`Error processing ${urlData.url}:`, error);
        }
      }

      // Small delay between batches
      await batchUtils.delay(200);
    }

    // Save all discovered links to database
    if (allDiscoveredLinks.length > 0) {
      // Process in chunks to avoid database limits
      const chunks = batchUtils.chunkArray(allDiscoveredLinks, 100);
      for (const chunk of chunks) {
        await db.addDiscoveredLinks(jobId, chunk);
        await batchUtils.delay(100);
      }
    }

    // Update job to ready for link checking phase
    await db.updateJobStatus(jobId, 'ready_for_checking');
    await db.updateJobProgress(jobId, 0, allDiscoveredLinks.length);

    console.log(
      `Discovery complete: ${allDiscoveredLinks.length} links found across ${pagesProcessed} pages`
    );
  } catch (error) {
    console.error('Error in discovery phase:', error);
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
    checkLinksInChunks(jobId);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'checking_links',
      message: 'Started checking discovered links',
    });
  } catch (error) {
    console.error('Error continuing crawl:', error);
    return NextResponse.json(
      {
        error: 'Failed to continue crawl',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function checkLinksInChunks(jobId) {
  try {
    await db.updateJobStatus(jobId, 'running');

    const httpChecker = new HttpChecker({
      timeout: 8000,
      maxConcurrent: 8, // Higher concurrency for link checking
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

      // Check this batch of links
      const urlsToCheck = pendingLinks.map((link) => ({
        url: link.url,
        sourceUrl: link.source_url || 'Unknown',
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

      // Small delay between batches
      await batchUtils.delay(500);
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');
    console.log(`Large crawl completed: ${processedCount} links checked`);
  } catch (error) {
    console.error('Error checking links:', error);
    await db.updateJobStatus(jobId, 'failed', error.message);
  }
}

async function fetchPageQuickly(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      timeout: 8000,
      headers: {
        'User-Agent': 'Broken Link Checker Bot/1.0',
      },
    });

    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      return await response.text();
    }
    return null;
  } catch (error) {
    return null;
  }
}
