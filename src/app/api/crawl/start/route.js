/**
 * Enhanced start crawl endpoint - Simplified and More Robust
 * UPDATED: Now stores HTTP status codes and timing data in database
 */

import { NextResponse } from 'next/server';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';

export async function POST(request) {
  let jobId = null;

  try {
    console.log('🔧 START ROUTE: Parsing request body...');
    const body = await request.json();
    const { url, settings = {}, preAnalyzedUrls = null } = body;

    console.log(`🚀 ENHANCED START: Starting crawl for: ${url}`);
    console.log(`📊 ENHANCED START: Has analyzed data: ${!!preAnalyzedUrls}`);
    console.log(
      `🎯 ENHANCED START: Using pre-analyzed data with ${preAnalyzedUrls?.length || 0} URLs`
    );

    // Validate required fields
    if (!url) {
      console.log('❌ No URL provided');
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    if (!urlUtils.isValidUrl(url)) {
      console.log('❌ Invalid URL format');
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Normalize URL
    const normalizedUrl = urlUtils.normalizeUrl(url);
    console.log(`📝 Normalized URL: ${normalizedUrl}`);

    // Create database job
    const jobSettings = {
      maxDepth: settings.maxDepth || 3,
      includeExternal: settings.includeExternal || false,
      timeout: settings.timeout || 10000,
      usePreAnalyzedUrls: !!preAnalyzedUrls,
    };

    console.log('📋 Creating database job...');
    const job = await db.createJob(normalizedUrl, jobSettings);
    jobId = job.id;

    console.log(`✅ Created job ${jobId} for ${normalizedUrl}`);

    // Determine processing mode
    if (preAnalyzedUrls && Array.isArray(preAnalyzedUrls) && preAnalyzedUrls.length > 0) {
      console.log(`🎯 SMART CRAWL: Processing ${preAnalyzedUrls.length} pre-analyzed URLs`);

      // Start processing in the background (don't await)
      processSmartCrawlBackground(jobId, normalizedUrl, preAnalyzedUrls, jobSettings).catch(
        (error) => {
          console.error(`❌ Background processing failed for job ${jobId}:`, error);
        }
      );

      // Return immediately
      return NextResponse.json(
        {
          success: true,
          jobId: jobId,
          status: 'started',
          url: normalizedUrl,
          settings: jobSettings,
          urlsToCheck: preAnalyzedUrls.length,
          message: `Smart crawl started with ${preAnalyzedUrls.length} pre-analyzed URLs`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
        },
        { status: 201 }
      );
    } else {
      console.log('❌ No valid pre-analyzed URLs provided');
      await db.updateJobStatus(jobId, 'failed', 'No valid URLs provided for checking');

      return NextResponse.json(
        {
          error: 'No valid URLs provided for checking',
          suggestion: 'Please use the Smart Analyzer first to discover URLs',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ ENHANCED START: Error starting crawl:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
    });

    // Try to update job status if we have a jobId
    if (jobId) {
      try {
        await db.updateJobStatus(jobId, 'failed', error.message);
      } catch (dbError) {
        console.error('❌ Failed to update job status:', dbError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to start crawl job',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Process smart crawl with pre-analyzed URLs in the background
 * UPDATED: Now saves HTTP status data to database
 */
async function processSmartCrawlBackground(jobId, baseUrl, preAnalyzedUrls, settings) {
  try {
    console.log(`🎯 SMART CRAWL: Starting background processing for job ${jobId}`);

    await db.updateJobStatus(jobId, 'running');

    // Validate preAnalyzedUrls structure
    if (!Array.isArray(preAnalyzedUrls)) {
      throw new Error('preAnalyzedUrls must be an array');
    }

    // Add all discovered URLs to the database first (without HTTP status)
    const discoveredLinks = preAnalyzedUrls
      .map((urlData, index) => {
        // FIXED: Better handling of different possible structures for source URLs
        let url, sourceUrl;

        if (typeof urlData === 'string') {
          url = urlData;
          sourceUrl = baseUrl; // Default to base URL for simple strings
        } else if (typeof urlData === 'object' && urlData.url) {
          url = urlData.url;
          // FIXED: Check multiple possible source URL properties from analyzer
          sourceUrl = urlData.sourceUrl || urlData.source_url || urlData.sourcePageUrl || baseUrl;
        } else {
          console.warn(`⚠️ Invalid URL at index ${index}:`, urlData);
          return null;
        }

        if (!url) {
          console.warn(`⚠️ Invalid URL at index ${index}:`, urlData);
          return null;
        }

        return {
          url: url,
          sourceUrl: sourceUrl, // FIXED: This now properly extracts source URL
          isInternal: urlUtils.isInternalUrl(url, baseUrl),
          depth: 1,
          status: 'pending', // Will be updated when checked
          // NEW: Initialize HTTP status fields as null
          http_status_code: null,
          response_time: null,
          checked_at: null,
          is_working: null,
          error_message: null,
        };
      })
      .filter(Boolean); // Remove null entries

    console.log(`📦 Prepared ${discoveredLinks.length} valid URLs for processing`);

    // DEBUGGING: Log sample of source URLs for verification
    console.log(
      '📍 Sample source URLs:',
      discoveredLinks.slice(0, 3).map((link) => ({
        url: link.url.substring(0, 50) + '...',
        sourceUrl: link.sourceUrl,
      }))
    );

    // Save discovered links to database
    if (discoveredLinks.length > 0) {
      await db.addDiscoveredLinks(jobId, discoveredLinks);
      console.log(`💾 Saved ${discoveredLinks.length} discovered links to database`);
    } else {
      throw new Error('No valid URLs to process');
    }

    // Update initial progress
    await db.updateJobProgress(jobId, 0, discoveredLinks.length);

    // Create HTTP checker
    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 4, // Conservative concurrency
      retryAttempts: 1,
    });

    // Process URLs in smaller batches
    const batchSize = 10; // Smaller batches for more stable processing
    const batches = batchUtils.chunkArray(discoveredLinks, batchSize);

    let processedCount = 0;
    let brokenLinksFound = 0;

    console.log(
      `📦 SMART CRAWL: Processing ${batches.length} batches of up to ${batchSize} URLs each`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`);

      try {
        // FIXED: Prepare URLs for checking with proper source URLs
        const urlsToCheck = batch.map((linkData) => ({
          url: linkData.url,
          sourceUrl: linkData.sourceUrl, // FIXED: Now uses the properly extracted source URL
          linkText: 'Pre-analyzed link',
        }));

        // Check this batch
        const { results } = await httpChecker.checkUrls(urlsToCheck);

        console.log(`✅ Checked ${results.length} URLs in batch ${i + 1}`);

        // Process results and update database
        for (const result of results) {
          processedCount++;

          // UPDATE: Save HTTP status data to discovered_links table
          try {
            await db.supabase
              .from('discovered_links')
              .update({
                status: 'checked',
                http_status_code: result.http_status_code,
                response_time: result.response_time,
                checked_at: result.checked_at,
                is_working: result.is_working,
                error_message: result.error_message,
              })
              .eq('job_id', jobId)
              .eq('url', result.url);

            console.log(
              `💾 Updated status for: ${result.url} (${result.http_status_code || 'ERROR'})`
            );
          } catch (updateError) {
            console.error(`❌ Failed to update status for ${result.url}:`, updateError);
          }

          // If URL is broken, also record in broken_links table
          if (!result.is_working) {
            const brokenLink = {
              url: result.url,
              sourceUrl: result.sourceUrl, // FIXED: Now uses the correct source URL from result
              statusCode: result.http_status_code,
              errorType: result.errorType || 'other',
              linkText: result.linkText || 'Pre-analyzed link',
            };

            try {
              await db.addBrokenLink(jobId, brokenLink);
              brokenLinksFound++;
              console.log(
                `💔 Found broken link: ${result.url} (${
                  result.http_status_code || result.errorType
                }) from source: ${result.sourceUrl}`
              );
            } catch (dbError) {
              console.error('❌ Error saving broken link:', dbError);
            }
          }
        }

        // Update progress
        await db.updateJobProgress(jobId, processedCount, discoveredLinks.length);

        console.log(
          `📊 Progress: ${processedCount}/${discoveredLinks.length} URLs checked, ${brokenLinksFound} broken links found`
        );

        // Small delay between batches
        await batchUtils.delay(500);
      } catch (batchError) {
        console.error(`❌ Error processing batch ${i + 1}:`, batchError);
        // Continue with next batch instead of failing completely
      }
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(
      `🎉 SMART CRAWL COMPLETE: ${processedCount} URLs checked, ${brokenLinksFound} broken links found`
    );
  } catch (error) {
    console.error('❌ SMART CRAWL: Error in background processing:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
    });

    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('❌ Failed to update job status after error:', dbError);
    }
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
