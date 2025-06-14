/**
 * Enhanced start crawl endpoint with Traditional + Single-Pass Smart crawl support
 * UPDATED: Only processSmartCrawlBackground() function - all other code remains the same
 */

import { NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils, errorUtils, contentPageUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { db } from '@/lib/supabase';
import { validateCrawlRequest, validateAdvancedRateLimit } from '@/lib/validation';
import { logBlockedUrl, logInvalidInput, logRobotsBlocked } from '@/lib/securityLogger';
import { errorHandler, handleValidationError, handleSecurityError } from '@/lib/errorHandler';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

// EXISTING POST HANDLER - NO CHANGES
export async function POST(request) {
  let jobId = null;

  try {
    console.log('🔧 START ROUTE: Parsing request body...');
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return await errorHandler.handleError(new Error('Invalid JSON in request body'), request, {
        step: 'json_parsing',
      });
    }

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
      await logInvalidInput(request, requestValidation.errors, body);
      return await handleValidationError(new Error('Request validation failed'), request);
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

    // BRANCH 1: UPDATED SMART ANALYZER PATH
    if (
      validatedPreAnalyzedUrls &&
      Array.isArray(validatedPreAnalyzedUrls) &&
      validatedPreAnalyzedUrls.length > 0
    ) {
      console.log(
        `🎯 SINGLE-PASS SMART CRAWL: Processing ${validatedPreAnalyzedUrls.length} content pages`
      );

      // Start single-pass smart processing in the background
      processSinglePassSmartCrawl(
        jobId,
        normalizedUrl,
        validatedPreAnalyzedUrls,
        jobSettings
      ).catch((error) => {
        console.error(`❌ Single-pass smart crawl failed for job ${jobId}:`, error);
      });

      const responseHeaders = {
        ...securityHeaders,
        ...(rateLimit.headers || {}),
      };

      return NextResponse.json(
        {
          success: true,
          jobId: jobId,
          status: 'started',
          url: normalizedUrl,
          settings: jobSettings,
          contentPagesToProcess: validatedPreAnalyzedUrls.length,
          message: `Single-pass smart crawl started with ${validatedPreAnalyzedUrls.length} content pages`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
          crawlType: 'smart_single_pass',
        },
        { status: 201, headers: responseHeaders }
      );
    }

    // BRANCH 2: EXISTING TRADITIONAL CRAWL PATH - NO CHANGES
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

    // Try to update job status if we have a jobId
    if (jobId) {
      try {
        await db.updateJobStatus(jobId, 'failed', 'Internal error');
      } catch (dbError) {
        console.error('❌ Failed to update job status:', dbError);
      }
    }

    return await errorHandler.handleError(error, request, {
      step: 'crawl_start',
      jobId,
      url: body?.url,
    });
  }
}

/**
 * NEW: Single-Pass Smart Crawl Implementation
 * Replaces the old processSmartCrawlBackground function
 *
 * APPROACH:
 * 1. Visit each content page once
 * 2. Extract ALL links from each content page
 * 3. Queue all extracted links for status checking
 * 4. Check status of all queued links
 */
async function processSinglePassSmartCrawl(jobId, baseUrl, contentPages, settings) {
  try {
    console.log(
      `🎯 SINGLE-PASS: Starting for job ${jobId} with ${contentPages.length} content pages`
    );

    await db.updateJobStatus(jobId, 'running');

    // Initialize crawling components
    const linkExtractor = new LinkExtractor({
      includeExternal: settings.includeExternal || false,
      maxLinksPerPage: 2000, // Higher limit for single-pass
    });

    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 5,
      retryAttempts: 1,
    });

    // Phase 1: Process content pages and extract ALL their links
    console.log(`📄 PHASE 1: Processing ${contentPages.length} content pages for link extraction`);

    const allExtractedLinks = new Map(); // url -> {url, sourceUrl, linkText, ...}
    const contentPageResults = [];
    let contentPagesProcessed = 0;

    // Process each content page to extract links
    for (const contentPage of contentPages) {
      const pageUrl = typeof contentPage === 'string' ? contentPage : contentPage.url;

      try {
        console.log(
          `📄 PROCESSING: [${contentPagesProcessed + 1}/${contentPages.length}] ${pageUrl}`
        );

        // Fetch the content page
        const pageContent = await fetchContentPageForExtraction(pageUrl, settings.timeout);

        if (pageContent.success) {
          // Extract all links from this content page
          const extractionResult = linkExtractor.extractLinks(pageContent.html, pageUrl, 0);

          console.log(`🔗 EXTRACTED: ${extractionResult.links.length} links from ${pageUrl}`);

          // Add each extracted link to our collection
          extractionResult.links.forEach((link) => {
            if (!allExtractedLinks.has(link.url)) {
              allExtractedLinks.set(link.url, {
                url: link.url,
                sourceUrl: pageUrl,
                linkText: link.linkText || 'Link',
                isInternal: link.isInternal,
                depth: link.depth,
                shouldCrawl: link.shouldCrawl,
                type: link.type || 'page_link',
              });
            }
          });

          // Record the content page as processed successfully
          contentPageResults.push({
            url: pageUrl,
            status: 'processed',
            linksExtracted: extractionResult.links.length,
            error: null,
          });
        } else {
          console.log(`❌ FAILED to fetch content page: ${pageUrl} - ${pageContent.error}`);

          contentPageResults.push({
            url: pageUrl,
            status: 'failed',
            linksExtracted: 0,
            error: pageContent.error,
          });
        }

        contentPagesProcessed++;

        // Update progress for Phase 1 (content page processing)
        await db.updateJobProgress(jobId, contentPagesProcessed, contentPages.length);

        // Small delay between content pages
        await batchUtils.delay(200);
      } catch (error) {
        console.error(`❌ Error processing content page ${pageUrl}:`, error);

        contentPageResults.push({
          url: pageUrl,
          status: 'error',
          linksExtracted: 0,
          error: error.message,
        });

        contentPagesProcessed++;
      }
    }

    const totalLinksExtracted = allExtractedLinks.size;
    console.log(
      `✅ PHASE 1 COMPLETE: Extracted ${totalLinksExtracted} unique links from ${contentPagesProcessed} content pages`
    );

    // Store all discovered links in database
    if (totalLinksExtracted > 0) {
      const discoveredLinksForDB = Array.from(allExtractedLinks.values()).map((link) => ({
        url: link.url,
        sourceUrl: link.sourceUrl,
        isInternal: link.isInternal,
        depth: 1, // All links are from content pages (depth 1)
        status: 'pending',
        http_status_code: null,
        response_time: null,
        checked_at: null,
        is_working: null,
        error_message: null,
      }));

      // Add discovered links in batches to avoid database limits
      const linkBatches = batchUtils.chunkArray(discoveredLinksForDB, 100);
      for (const batch of linkBatches) {
        await db.addDiscoveredLinks(jobId, batch);
      }

      console.log(`💾 STORED: ${totalLinksExtracted} discovered links in database`);
    }

    // Phase 2: Check status of all extracted links
    console.log(`🔍 PHASE 2: Checking status of ${totalLinksExtracted} extracted links`);

    // Update progress tracking for Phase 2
    await db.updateJobProgress(jobId, 0, totalLinksExtracted);

    let linksChecked = 0;
    let brokenLinksFound = 0;

    if (totalLinksExtracted > 0) {
      // Process links in batches for status checking
      const linkArray = Array.from(allExtractedLinks.values());
      const checkBatches = batchUtils.chunkArray(linkArray, 20);

      for (let batchIndex = 0; batchIndex < checkBatches.length; batchIndex++) {
        const batch = checkBatches[batchIndex];

        console.log(
          `🔍 CHECKING: Batch ${batchIndex + 1}/${checkBatches.length} (${batch.length} links)`
        );

        try {
          // Check this batch of links
          const urlsToCheck = batch.map((link) => ({
            url: link.url,
            sourceUrl: link.sourceUrl,
            linkText: link.linkText,
          }));

          const { results } = await httpChecker.checkUrls(urlsToCheck);

          // Process results
          for (const result of results) {
            linksChecked++;

            // Update discovered link with HTTP status
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
            } catch (updateError) {
              console.error(`❌ Failed to update status for ${result.url}:`, updateError);
            }

            // If broken, add to broken links table
            if (!result.is_working) {
              const errorType =
                result.errorType || errorUtils.classifyError(result.http_status_code, result);

              const brokenLink = {
                url: result.url,
                sourceUrl: result.sourceUrl,
                statusCode: result.http_status_code,
                errorType: errorType,
                linkText: result.linkText || 'Extracted link',
              };

              try {
                await db.addBrokenLink(jobId, brokenLink);
                brokenLinksFound++;

                console.log(
                  `💔 BROKEN: ${result.url} (${result.http_status_code || errorType}) from ${
                    result.sourceUrl
                  }`
                );
              } catch (dbError) {
                console.error('❌ Error saving broken link:', dbError);
              }
            }
          }

          // Update progress
          await db.updateJobProgress(jobId, linksChecked, totalLinksExtracted);

          console.log(
            `📊 PROGRESS: ${linksChecked}/${totalLinksExtracted} links checked, ${brokenLinksFound} broken`
          );

          // Delay between batches
          await batchUtils.delay(300);
        } catch (batchError) {
          console.error(`❌ Error checking batch ${batchIndex + 1}:`, batchError);

          // Mark batch links as failed
          batch.forEach((link) => {
            linksChecked++;
            // Could add them as broken links with error status
          });
        }
      }
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(
      `🎉 SINGLE-PASS COMPLETE: Processed ${contentPagesProcessed} content pages, checked ${linksChecked} links, found ${brokenLinksFound} broken links`
    );

    return {
      success: true,
      contentPagesProcessed,
      totalLinksExtracted,
      linksChecked,
      brokenLinksFound,
    };
  } catch (error) {
    console.error('❌ SINGLE-PASS: Error in background processing:', error);

    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('❌ Failed to update job status after error:', dbError);
    }

    throw error;
  }
}

/**
 * NEW: Fetches content page specifically for link extraction
 */
async function fetchContentPageForExtraction(url, timeout = 10000) {
  try {
    // Security validation
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return { success: false, error: `Security: ${validation.reason}` };
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SmartLinkChecker/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: timeout,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { success: false, error: 'Not HTML content' };
    }

    const html = await response.text();

    return {
      success: true,
      html,
      contentType,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// EXISTING TRADITIONAL CRAWL FUNCTION - NO CHANGES
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

// EXISTING OPTIONS HANDLER - NO CHANGES
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
