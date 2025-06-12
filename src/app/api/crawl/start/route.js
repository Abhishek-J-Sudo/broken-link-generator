/**
 * Enhanced start crawl endpoint with Traditional + Smart crawl support
 */

import { NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { db } from '@/lib/supabase';
import { validateCrawlRequest, validateAdvancedRateLimit } from '@/lib/validation';
import { logBlockedUrl, logInvalidInput, logRobotsBlocked } from '@/lib/securityLogger';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function POST(request) {
  let jobId = null;

  try {
    console.log('🔧 START ROUTE: Parsing request body...');
    const body = await request.json();

    console.log(`🚀 ENHANCED START: Starting crawl for: ${body.url}`);
    console.log(`📊 ENHANCED START: Has analyzed data: ${!!body.preAnalyzedUrls}`);

    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = validateAdvancedRateLimit(clientIP, 'crawl');

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': rateLimit.retryAfter.toString(), ...securityHeaders },
        }
      );
    }

    // Validate request with Zod
    const requestValidation = validateCrawlRequest(body);
    if (!requestValidation.success) {
      // 🔒 NEW: Log invalid input
      await logInvalidInput(request, requestValidation.errors, body);

      return NextResponse.json(
        { error: 'Invalid request data', details: requestValidation.errors },
        { status: 400, headers: securityHeaders }
      );
    }

    // Extract validated data
    const {
      url: validatedUrl,
      settings: validatedSettings,
      preAnalyzedUrls: validatedPreAnalyzedUrls,
    } = requestValidation.data;

    // Normalize URL
    const normalizedUrl = urlUtils.normalizeUrl(validatedUrl);
    console.log(`📝 Normalized URL: ${normalizedUrl}`);

    // NEW: Security validation
    const validation = securityUtils.isSafeUrl(normalizedUrl);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED crawl attempt: ${normalizedUrl} - ${validation.reason}`);

      // 🔒 NEW: Log blocked URL
      await logBlockedUrl(request, normalizedUrl, validation.reason);

      return NextResponse.json(
        {
          error: 'URL blocked for security reasons',
          reason: validation.reason,
          code: 'SECURITY_BLOCKED',
        },
        { status: 403, headers: securityHeaders }
      );
    }

    // NEW: Check robots.txt if enabled (optional but recommended)
    if (validatedSettings.respectRobots !== false) {
      try {
        const robotsCheck = await securityUtils.checkRobotsTxt(normalizedUrl);
        if (!robotsCheck.allowed) {
          // 🔒 NEW: Log robots.txt violation
          await logRobotsBlocked(request, normalizedUrl, robotsCheck.reason);

          return NextResponse.json(
            {
              error: 'Crawling not allowed by robots.txt',
              reason: robotsCheck.reason,
              code: 'ROBOTS_BLOCKED',
            },
            { status: 403, headers: securityHeaders }
          );
        }

        // Apply crawl delay from robots.txt
        if (robotsCheck.crawlDelay) {
          validatedSettings.delayBetweenRequests = Math.max(
            validatedSettings.delayBetweenRequests || 100,
            robotsCheck.crawlDelay
          );
        }
      } catch (robotsError) {
        console.log('Could not check robots.txt, proceeding with crawl');
      }
    }

    // Create database job
    const jobSettings = {
      maxDepth: validatedSettings.maxDepth || 3,
      includeExternal: validatedSettings.includeExternal || false,
      timeout: validatedSettings.timeout || 10000,
      usePreAnalyzedUrls: !!validatedPreAnalyzedUrls,
    };

    console.log('📋 Creating database job...');
    const job = await db.createJob(normalizedUrl, jobSettings);
    jobId = job.id;

    console.log(`✅ Created job ${jobId} for ${normalizedUrl}`);

    // BRANCH 1: SMART ANALYZER PATH (KEEP EXISTING LOGIC UNTOUCHED)
    if (
      validatedPreAnalyzedUrls &&
      Array.isArray(validatedPreAnalyzedUrls) &&
      validatedPreAnalyzedUrls.length > 0
    ) {
      console.log(
        `🎯 SMART CRAWL: Processing ${validatedPreAnalyzedUrls.length} pre-analyzed URLs`
      );

      // Start smart processing in the background (EXISTING LOGIC - DON'T CHANGE)
      processSmartCrawlBackground(
        jobId,
        normalizedUrl,
        validatedPreAnalyzedUrls,
        jobSettings
      ).catch((error) => {
        console.error(`❌ Smart crawl background processing failed for job ${jobId}:`, error);
      });

      const responseHeaders = {
        ...securityHeaders,
        ...(rateLimit.headers || {}),
      };
      // Return immediately for smart crawl
      return NextResponse.json(
        {
          success: true,
          jobId: jobId,
          status: 'started',
          url: normalizedUrl,
          settings: jobSettings,
          urlsToCheck: validatedPreAnalyzedUrls.length,
          message: `Smart crawl started with ${validatedPreAnalyzedUrls.length} pre-analyzed URLs`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
          crawlType: 'smart',
        },
        { status: 201, headers: responseHeaders }
      );
    }

    // BRANCH 2: NEW TRADITIONAL CRAWL PATH
    else {
      console.log('🕷️ TRADITIONAL CRAWL: Starting discovery-based crawling');

      // Start traditional processing in the background
      processTraditionalCrawlBackground(jobId, normalizedUrl, jobSettings).catch((error) => {
        console.error(`❌ Traditional crawl background processing failed for job ${jobId}:`, error);
      });

      // Return immediately for traditional crawl
      return NextResponse.json(
        {
          success: true,
          jobId: jobId,
          status: 'started',
          url: normalizedUrl,
          settings: jobSettings,
          message: `Traditional crawl started - discovering and checking links`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
          crawlType: 'traditional',
        },
        { status: 201, headers: securityHeaders }
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
      { status: 500, headers: securityHeaders }
    );
  }
}

/**
 * EXISTING SMART CRAWL LOGIC
 * Process smart crawl with pre-analyzed URLs in the background
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
        let url, sourceUrl;

        if (typeof urlData === 'string') {
          url = urlData;
          sourceUrl = baseUrl;
        } else if (typeof urlData === 'object' && urlData.url) {
          url = urlData.url;
          sourceUrl = urlData.sourceUrl || urlData.source_url || urlData.sourcePageUrl || baseUrl;
        } else {
          console.warn(`⚠️ Invalid URL at index ${index}:`, urlData);
          return null;
        }

        if (!url) {
          console.warn(`⚠️ Invalid URL at index ${index}:`, urlData);
          return null;
        }

        if (!sourceUrl || sourceUrl === '') {
          sourceUrl = baseUrl;
        }

        return {
          url: url,
          sourceUrl: sourceUrl,
          isInternal: urlUtils.isInternalUrl(url, baseUrl),
          depth: 1,
          status: 'pending',
          http_status_code: null,
          response_time: null,
          checked_at: null,
          is_working: null,
          error_message: null,
        };
      })
      .filter(Boolean);

    console.log(`📦 Prepared ${discoveredLinks.length} valid URLs for processing`);

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
      maxConcurrent: 4,
      retryAttempts: 1,
    });

    // Process URLs in smaller batches
    const batchSize = 10;
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
        const urlsToCheck = batch.map((linkData) => ({
          url: linkData.url,
          sourceUrl: linkData.sourceUrl,
          linkText: 'Pre-analyzed link',
        }));

        const { results } = await httpChecker.checkUrls(urlsToCheck);

        console.log(`✅ Checked ${results.length} URLs in batch ${i + 1}`);

        for (const result of results) {
          processedCount++;

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

          if (!result.is_working) {
            const brokenLink = {
              url: result.url,
              sourceUrl: result.sourceUrl,
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

        await db.updateJobProgress(jobId, processedCount, discoveredLinks.length);

        console.log(
          `📊 Progress: ${processedCount}/${discoveredLinks.length} URLs checked, ${brokenLinksFound} broken links found`
        );

        await batchUtils.delay(500);
      } catch (batchError) {
        console.error(`❌ Error processing batch ${i + 1}:`, batchError);
      }
    }

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

/**
 * NEW TRADITIONAL CRAWL LOGIC
 * Process traditional crawl with discovery-based approach
 */
async function processTraditionalCrawlBackground(jobId, startUrl, settings) {
  try {
    console.log(`🕷️ TRADITIONAL CRAWL: Starting background processing for job ${jobId}`);

    await db.updateJobStatus(jobId, 'running');

    // Initialize crawler components
    const linkExtractor = new LinkExtractor({
      includeExternal: settings.includeExternal || false,
      maxLinksPerPage: 1000,
    });

    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 3, // Conservative for traditional crawl
      retryAttempts: 2,
    });

    // Traditional crawler state
    const visitedUrls = new Set();
    const pendingUrls = new Map(); // url -> {depth, sourceUrl}
    const maxDepth = settings.maxDepth || 3;
    const maxPages = 500; // Reasonable limit

    // Add starting URL to pending queue
    pendingUrls.set(startUrl, { depth: 0, sourceUrl: null });

    let totalDiscovered = 0;
    let totalProcessed = 0;
    let brokenLinksFound = 0;

    console.log(`🚀 TRADITIONAL CRAWL: Starting from ${startUrl} with max depth ${maxDepth}`);

    // Main crawling loop
    while (pendingUrls.size > 0 && totalProcessed < maxPages) {
      // Get next batch of URLs to process
      const batchUrls = [];
      const batchSize = 5; // Small batches for traditional crawl

      const urlEntries = Array.from(pendingUrls.entries()).slice(0, batchSize);
      urlEntries.forEach(([url, metadata]) => {
        batchUrls.push({ url, ...metadata });
        pendingUrls.delete(url);
      });

      if (batchUrls.length === 0) break;

      console.log(`📦 TRADITIONAL: Processing batch of ${batchUrls.length} URLs`);

      // Process each URL in the batch
      for (const urlData of batchUrls) {
        const { url, depth, sourceUrl } = urlData;

        if (visitedUrls.has(url)) continue;

        try {
          visitedUrls.add(url);
          totalProcessed++;

          console.log(`🔍 TRADITIONAL: [${totalProcessed}] Checking: ${url} (depth: ${depth})`);

          // Check if URL is working and get content
          const httpResult = await httpChecker.quickCheck(url);

          // Save discovered URL to database
          const discoveredLink = {
            url: url,
            sourceUrl: sourceUrl,
            isInternal: urlUtils.isInternalUrl(url, startUrl),
            depth: depth,
            status: 'checked',
            http_status_code: httpResult.http_status_code,
            response_time: httpResult.response_time,
            checked_at: httpResult.checked_at,
            is_working: httpResult.is_working,
            error_message: httpResult.error_message,
          };

          try {
            await db.addDiscoveredLinks(jobId, [discoveredLink]);
          } catch (dbError) {
            console.error('❌ Error saving discovered link:', dbError);
          }

          // If broken, record it
          if (!httpResult.is_working) {
            const brokenLink = {
              url: url,
              sourceUrl: sourceUrl || 'Discovery',
              statusCode: httpResult.http_status_code,
              errorType: httpResult.errorType || 'other',
              linkText: 'Traditional crawl link',
            };

            try {
              await db.addBrokenLink(jobId, brokenLink);
              brokenLinksFound++;
              console.log(
                `💔 TRADITIONAL: Found broken link: ${url} (${
                  httpResult.http_status_code || httpResult.errorType
                })`
              );
            } catch (dbError) {
              console.error('❌ Error saving broken link:', dbError);
            }
          }

          // If URL is working and we haven't reached max depth, extract links
          if (httpResult.is_working && depth < maxDepth && urlUtils.isInternalUrl(url, startUrl)) {
            try {
              // Fetch full page content for link extraction
              const pageResponse = await fetch(url, {
                timeout: settings.timeout || 10000,
                headers: {
                  'User-Agent': 'Broken Link Checker Bot/1.0',
                  Accept: 'text/html,application/xhtml+xml',
                },
              });

              if (pageResponse.ok) {
                const pageContent = await pageResponse.text();
                const extractionResult = linkExtractor.extractLinks(pageContent, url, depth);

                console.log(
                  `🔗 TRADITIONAL: Found ${extractionResult.links.length} links on ${url}`
                );

                // Add new links to pending queue
                extractionResult.links.forEach((link) => {
                  if (
                    !visitedUrls.has(link.url) &&
                    !pendingUrls.has(link.url) &&
                    link.depth <= maxDepth &&
                    (settings.includeExternal || link.isInternal)
                  ) {
                    pendingUrls.set(link.url, {
                      depth: link.depth,
                      sourceUrl: url,
                    });
                    totalDiscovered++;
                  }
                });

                console.log(
                  `📈 TRADITIONAL: Queue size: ${pendingUrls.size}, Total discovered: ${totalDiscovered}`
                );
              }
            } catch (extractError) {
              console.error(`❌ Error extracting links from ${url}:`, extractError);
            }
          }

          // Update progress
          await db.updateJobProgress(
            jobId,
            totalProcessed,
            Math.max(totalProcessed, totalDiscovered)
          );

          console.log(
            `📊 TRADITIONAL: Progress: ${totalProcessed} processed, ${brokenLinksFound} broken, ${pendingUrls.size} pending`
          );

          // Small delay between requests
          await batchUtils.delay(200);
        } catch (error) {
          console.error(`❌ TRADITIONAL: Error processing ${url}:`, error);

          // Record as broken due to processing error
          try {
            const brokenLink = {
              url: url,
              sourceUrl: sourceUrl || 'Discovery',
              statusCode: null,
              errorType: 'other',
              linkText: 'Traditional crawl link',
            };
            await db.addBrokenLink(jobId, brokenLink);
            brokenLinksFound++;
          } catch (dbError) {
            console.error('❌ Error saving error link:', dbError);
          }
        }
      }

      // Update progress after batch
      await db.updateJobProgress(jobId, totalProcessed, Math.max(totalProcessed, totalDiscovered));
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(
      `🎉 TRADITIONAL CRAWL COMPLETE: ${totalProcessed} URLs processed, ${brokenLinksFound} broken links found`
    );
  } catch (error) {
    console.error('❌ TRADITIONAL CRAWL: Error in background processing:', error);
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
