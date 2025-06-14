/**
 * Enhanced start crawl endpoint with Traditional + Smart crawl support
 */

import { NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { HttpChecker } from '@/lib/httpChecker';
import { urlUtils, validateUtils, batchUtils, errorUtils } from '@/lib/utils';
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
 * EXISTING SMART CRAWL LOGIC
 * Process smart crawl with pre-analyzed URLs in the background
 */
async function processSmartCrawlBackground(jobId, baseUrl, contentPages, settings) {
  try {
    console.log(
      `🎯 SMART CRAWL: Starting link extraction from ${contentPages.length} content pages`
    );

    await db.updateJobStatus(jobId, 'running');

    // Phase 1: Extract ALL links from content pages
    const allExtractedLinks = [];
    let processedContentPages = 0;

    for (const contentPage of contentPages) {
      try {
        console.log(`📄 Extracting links from: ${contentPage.url}`);

        // Fetch the content page
        const pageContent = await fetchPageWithTimeout(contentPage.url, settings.timeout || 10000);

        if (!pageContent) {
          console.log(`⚠️ Could not fetch content page: ${contentPage.url}`);
          continue;
        }

        // Extract ALL links from this content page
        const extractionResult = extractLinksManually(pageContent, contentPage.url);

        console.log(`🔗 Found ${extractionResult.length} links on ${contentPage.url}`);

        // Add extracted links to our collection
        extractionResult.forEach((link) => {
          allExtractedLinks.push({
            url: link.url,
            sourceUrl: contentPage.url,
            linkText: link.linkText || 'No text',
            isInternal: link.isInternal,
          });
        });

        processedContentPages++;

        // Update progress (content page processing)
        await db.updateJobProgress(jobId, processedContentPages, contentPages.length);

        // Small delay to be respectful
        await batchUtils.delay(200);
      } catch (error) {
        console.error(`❌ Error processing content page ${contentPage.url}:`, error);
      }
    }

    console.log(
      `📊 Total links extracted: ${allExtractedLinks.length} from ${processedContentPages} content pages`
    );

    // Phase 2: Deduplicate extracted links
    const uniqueLinks = [];
    const seenUrls = new Set();

    allExtractedLinks.forEach((link) => {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    });

    console.log(`🔗 Unique links to check: ${uniqueLinks.length}`);

    // Phase 3: Save discovered links to database
    const discoveredLinks = uniqueLinks.map((link) => ({
      url: link.url,
      sourceUrl: link.sourceUrl,
      isInternal: link.isInternal,
      depth: 1,
      status: 'pending',
      http_status_code: null,
      response_time: null,
      checked_at: null,
      is_working: null,
      error_message: null,
    }));

    if (discoveredLinks.length > 0) {
      await db.addDiscoveredLinks(jobId, discoveredLinks);
      console.log(`💾 Saved ${discoveredLinks.length} links to database`);
    }

    // Phase 4: Check HTTP status of all extracted links
    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 4,
      retryAttempts: 1,
    });

    // Process in batches to avoid overwhelming the system
    const batchSize = 20;
    const batches = batchUtils.chunkArray(uniqueLinks, batchSize);

    let checkedCount = 0;
    let brokenLinksFound = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      console.log(`🔍 Checking batch ${i + 1}/${batches.length} (${batch.length} links)`);

      try {
        const { results } = await httpChecker.checkUrls(batch);

        for (const result of results) {
          checkedCount++;

          // Update discovered_links table with HTTP status
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

          // If broken, add to broken_links table
          if (!result.is_working) {
            let errorType = result.errorType;
            if (!errorType) {
              errorType = errorUtils.classifyError(result.http_status_code, result);
            }

            const brokenLink = {
              url: result.url,
              sourceUrl: result.sourceUrl,
              statusCode: result.http_status_code,
              errorType: errorType,
              linkText: result.linkText || 'Link from content page',
            };

            try {
              await db.addBrokenLink(jobId, brokenLink);
              brokenLinksFound++;
              console.log(
                `💔 Broken link: ${result.url} (${result.http_status_code || result.errorType})`
              );
            } catch (dbError) {
              console.error('❌ Error saving broken link:', dbError);
            }
          }
        }

        // Update progress (link checking phase)
        await db.updateJobProgress(jobId, checkedCount, uniqueLinks.length);

        console.log(
          `📊 Progress: ${checkedCount}/${uniqueLinks.length} links checked, ${brokenLinksFound} broken`
        );

        // Delay between batches
        await batchUtils.delay(500);
      } catch (batchError) {
        console.error(`❌ Error checking batch ${i + 1}:`, batchError);
      }
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(
      `🎉 SMART CRAWL COMPLETE: ${checkedCount} links checked from ${processedContentPages} content pages, ${brokenLinksFound} broken links found`
    );
  } catch (error) {
    console.error('❌ SMART CRAWL: Error in background processing:', error);
    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('❌ Failed to update job status after error:', dbError);
    }
  }
}

async function fetchPageWithTimeout(url, timeout = 15000) {
  try {
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED fetch: ${url} - ${validation.reason}`);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return await response.text();
      }
    }
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error.message);
    return null;
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
