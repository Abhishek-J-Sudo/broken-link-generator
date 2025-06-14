/**
 * Enhanced start crawl endpoint with Traditional + Smart Analyzer support
 * MERGED: Main branch working smart crawl + New single-pass smart crawl + Traditional crawl
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

// MAIN BRANCH POST HANDLER - PRESERVED WITH ENHANCEMENTS
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
    console.log(
      `📊 ENHANCED START: Has analyzed data: ${!!(
        body.preAnalyzedUrls && body.preAnalyzedUrls.length > 0
      )}`
    );

    // EXISTING validation from main branch - NO CHANGES
    const validation = validateCrawlRequest(body);
    if (!validation.isValid) {
      return await handleValidationError(validation.errors, request);
    }

    // Rate limiting validation
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = validateAdvancedRateLimit(clientIP, 'crawl');

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: rateLimit.headers || {} }
      );
    }

    const { url, settings = {}, preAnalyzedUrls } = body;

    // EXISTING URL validation - NO CHANGES
    if (!urlUtils.isValidUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400, headers: securityHeaders }
      );
    }

    const normalizedUrl = urlUtils.normalizeUrl(url);

    // Security validation
    const securityValidation = securityUtils.isSafeUrl(normalizedUrl);
    if (!securityValidation.safe) {
      logBlockedUrl(normalizedUrl, securityValidation.reason, clientIP);
      return await handleSecurityError(securityValidation.reason, request);
    }

    // Validate pre-analyzed URLs if provided
    let validatedPreAnalyzedUrls = null;
    if (preAnalyzedUrls && Array.isArray(preAnalyzedUrls) && preAnalyzedUrls.length > 0) {
      console.log(`🔍 ENHANCED START: Validating ${preAnalyzedUrls.length} pre-analyzed URLs`);

      validatedPreAnalyzedUrls = preAnalyzedUrls.filter((urlData) => {
        try {
          const targetUrl = typeof urlData === 'string' ? urlData : urlData.url;
          return targetUrl && urlUtils.isValidUrl(targetUrl);
        } catch {
          return false;
        }
      });

      console.log(
        `✅ ENHANCED START: ${validatedPreAnalyzedUrls.length} valid URLs after filtering`
      );
    }

    // EXISTING settings validation - NO CHANGES
    const jobSettings = {
      maxDepth: Math.min(settings.maxDepth || 3, 5),
      includeExternal: settings.includeExternal || false,
      timeout: Math.min(Math.max(settings.timeout || 10000, 5000), 30000),
      usePreAnalyzedUrls: !!validatedPreAnalyzedUrls,
    };

    console.log('📋 Creating database job...');
    const job = await db.createJob(normalizedUrl, jobSettings);
    jobId = job.id;

    console.log(`✅ Created job ${jobId} for ${normalizedUrl}`);

    // ENHANCED: Smart analyzer routing with content page detection
    if (
      validatedPreAnalyzedUrls &&
      Array.isArray(validatedPreAnalyzedUrls) &&
      validatedPreAnalyzedUrls.length > 0
    ) {
      // NEW: Detect if this is content page data vs. regular URL list
      const hasContentPageStructure = validatedPreAnalyzedUrls.some(
        (item) => typeof item === 'object' && (item.type === 'content' || item.isContent === true)
      );

      if (hasContentPageStructure) {
        console.log(
          `🎯 SINGLE-PASS SMART CRAWL: Processing ${validatedPreAnalyzedUrls.length} content pages`
        );

        // NEW: Single-pass smart crawl for content pages
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
      } else {
        // MAIN BRANCH: Original smart crawl logic (preserved exactly)
        console.log(
          `🎯 SMART CRAWL: Processing ${validatedPreAnalyzedUrls.length} pre-analyzed URLs`
        );

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
    }

    // MAIN BRANCH: Traditional crawl path (preserved exactly)
    else {
      console.log('🕷️ TRADITIONAL CRAWL: Starting discovery-based crawling');

      processTraditionalCrawlBackground(jobId, normalizedUrl, jobSettings).catch((error) => {
        console.error(`❌ Traditional crawl background processing failed for job ${jobId}:`, error);
      });

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

// MAIN BRANCH: Original smart crawl logic (preserved exactly)
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

    if (discoveredLinks.length === 0) {
      throw new Error('No valid URLs to process');
    }

    // Add discovered links to database
    try {
      await db.addDiscoveredLinks(jobId, discoveredLinks);
      console.log(`✅ Added ${discoveredLinks.length} discovered links to database`);
    } catch (dbError) {
      console.error('❌ Error adding discovered links:', dbError);
      throw new Error(`Failed to save discovered links: ${dbError.message}`);
    }

    // Initialize HTTP checker for status checking
    const httpChecker = new HttpChecker({
      timeout: settings.timeout || 10000,
      maxConcurrent: 6,
      retryAttempts: 2,
    });

    // Check status of all URLs in batches
    const batchSize = 25;
    const batches = batchUtils.chunkArray(discoveredLinks, batchSize);
    let totalProcessed = 0;
    let brokenLinksFound = 0;

    console.log(
      `🔍 Starting HTTP status checks for ${discoveredLinks.length} URLs in ${batches.length} batches`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`);

      // Check HTTP status for each URL in parallel
      const results = await Promise.allSettled(
        batch.map(async (linkData) => {
          try {
            const result = await httpChecker.quickCheck(linkData.url);
            totalProcessed++;

            // Update the discovered link with HTTP status
            const updatedLink = {
              ...linkData,
              status: 'checked',
              http_status_code: result.http_status_code,
              response_time: result.response_time,
              checked_at: result.checked_at,
              is_working: result.is_working,
              error_message: result.error_message,
            };

            // If broken, also add to broken_links table
            if (!result.is_working) {
              brokenLinksFound++;
              const brokenLink = {
                url: linkData.url,
                sourceUrl: linkData.sourceUrl,
                statusCode: result.http_status_code,
                errorType: result.http_status_code ? 'http_error' : 'network_error',
                linkText: 'Smart crawl link',
              };

              try {
                await db.addBrokenLink(jobId, brokenLink);
              } catch (brokenLinkError) {
                console.error(`❌ Error saving broken link ${linkData.url}:`, brokenLinkError);
              }
            }

            return updatedLink;
          } catch (error) {
            console.error(`❌ Error checking ${linkData.url}:`, error);
            totalProcessed++;
            brokenLinksFound++;

            // Record as broken due to processing error
            try {
              const brokenLink = {
                url: linkData.url,
                sourceUrl: linkData.sourceUrl,
                statusCode: null,
                errorType: 'other',
                linkText: 'Smart crawl link',
              };
              await db.addBrokenLink(jobId, brokenLink);
            } catch (brokenLinkError) {
              console.error(`❌ Error saving error link ${linkData.url}:`, brokenLinkError);
            }

            return null;
          }
        })
      );

      // Update progress
      await db.updateJobProgress(jobId, totalProcessed, discoveredLinks.length);

      console.log(
        `📊 SMART CRAWL: Batch ${i + 1} complete. Total: ${totalProcessed}/${
          discoveredLinks.length
        }, Broken: ${brokenLinksFound}`
      );

      // Small delay between batches
      if (i < batches.length - 1) {
        await batchUtils.delay(200);
      }
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(
      `🎉 SMART CRAWL COMPLETE: ${totalProcessed} URLs processed, ${brokenLinksFound} broken links found`
    );

    return {
      success: true,
      urlsProcessed: totalProcessed,
      brokenLinksFound,
    };
  } catch (error) {
    console.error('❌ SMART CRAWL: Error in background processing:', error);

    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('❌ Failed to update job status after error:', dbError);
    }

    throw error;
  }
}

// NEW: Single-Pass Smart Crawl Implementation (added for smart analyzer)
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
    let contentPagesProcessed = 0;

    // Process each content page to extract links
    for (const contentPage of contentPages) {
      const pageUrl = typeof contentPage === 'string' ? contentPage : contentPage.url;

      try {
        contentPagesProcessed++;
        console.log(
          `📄 SINGLE-PASS: [${contentPagesProcessed}/${contentPages.length}] Extracting from: ${pageUrl}`
        );

        // Fetch the content page
        const pageContent = await fetchContentPageForExtraction(pageUrl);

        if (pageContent.success && pageContent.html) {
          // Extract ALL links from this content page
          const extractedLinks = await linkExtractor.extractLinksFromHtml(
            pageContent.html,
            pageUrl,
            {
              includeExternal: settings.includeExternal,
              maxLinks: 2000,
            }
          );

          console.log(`🔗 SINGLE-PASS: Extracted ${extractedLinks.length} links from ${pageUrl}`);

          // Add all extracted links to our master collection
          extractedLinks.forEach((link) => {
            if (!allExtractedLinks.has(link.url)) {
              allExtractedLinks.set(link.url, {
                url: link.url,
                sourceUrl: pageUrl,
                linkText: link.linkText || 'No text',
                isInternal: urlUtils.isInternalUrl(link.url, baseUrl),
                depth: 1,
                status: 'pending',
              });
            }
          });
        } else {
          console.log(
            `⚠️ SINGLE-PASS: Could not fetch content from ${pageUrl}: ${pageContent.error}`
          );
        }

        // Update progress after processing each content page
        await db.updateJobProgress(
          jobId,
          contentPagesProcessed,
          contentPages.length + allExtractedLinks.size
        );

        // Small delay to be respectful
        await batchUtils.delay(300);
      } catch (error) {
        console.error(`❌ SINGLE-PASS: Error processing content page ${pageUrl}:`, error);
      }
    }

    const totalLinksExtracted = allExtractedLinks.size;
    console.log(
      `✅ PHASE 1 COMPLETE: Extracted ${totalLinksExtracted} unique links from ${contentPagesProcessed} content pages`
    );

    // Phase 2: Check status of all extracted links
    console.log(`🔍 PHASE 2: Checking HTTP status of ${totalLinksExtracted} extracted links`);

    const linksToCheck = Array.from(allExtractedLinks.values());

    // Add all discovered links to database first
    try {
      await db.addDiscoveredLinks(jobId, linksToCheck);
      console.log(`✅ Added ${linksToCheck.length} discovered links to database`);
    } catch (dbError) {
      console.error('❌ Error adding discovered links:', dbError);
    }

    // Check HTTP status in batches
    const batchSize = 20;
    const batches = batchUtils.chunkArray(linksToCheck, batchSize);
    let linksChecked = 0;
    let brokenLinksFound = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `📦 SINGLE-PASS: Checking batch ${i + 1}/${batches.length} (${batch.length} links)`
      );

      // Check each link in the batch
      await Promise.allSettled(
        batch.map(async (linkData) => {
          try {
            const result = await httpChecker.quickCheck(linkData.url);
            linksChecked++;

            // If broken, add to broken_links table
            if (!result.is_working) {
              brokenLinksFound++;
              const brokenLink = {
                url: linkData.url,
                sourceUrl: linkData.sourceUrl,
                statusCode: result.http_status_code,
                errorType: result.http_status_code ? 'http_error' : 'network_error',
                linkText: linkData.linkText || 'Single-pass crawl link',
              };

              try {
                await db.addBrokenLink(jobId, brokenLink);
              } catch (brokenLinkError) {
                console.error(`❌ Error saving broken link ${linkData.url}:`, brokenLinkError);
              }
            }
          } catch (error) {
            console.error(`❌ Error checking ${linkData.url}:`, error);
            linksChecked++;
            brokenLinksFound++;
          }
        })
      );

      // Update progress
      const totalEstimated = contentPages.length + totalLinksExtracted;
      const currentProgress = contentPagesProcessed + linksChecked;
      await db.updateJobProgress(jobId, currentProgress, totalEstimated);

      console.log(
        `📊 SINGLE-PASS: ${linksChecked}/${totalLinksExtracted} links checked, ${brokenLinksFound} broken found`
      );

      // Small delay between batches
      if (i < batches.length - 1) {
        await batchUtils.delay(250);
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

// NEW: Helper function for content page fetching
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

// MAIN BRANCH: Traditional crawl function (preserved exactly)
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

          console.log(
            `🔍 TRADITIONAL: [${totalProcessed}] Checking: ${url.substring(
              0,
              80
            )}... (depth: ${depth})`
          );

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

          // If broken, add to broken links
          if (!httpResult.is_working) {
            brokenLinksFound++;
            const brokenLink = {
              url: url,
              sourceUrl: sourceUrl || 'Discovery',
              statusCode: httpResult.http_status_code,
              errorType: httpResult.http_status_code ? 'http_error' : 'network_error',
              linkText: 'Traditional crawl link',
            };

            try {
              await db.addBrokenLink(jobId, brokenLink);
            } catch (brokenLinkError) {
              console.error('❌ Error saving broken link:', brokenLinkError);
            }
          }

          // If working and we're not at max depth, extract links for further crawling
          if (httpResult.is_working && depth < maxDepth) {
            try {
              // Try to get page content for link extraction
              const pageContent = await fetch(url, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; SmartLinkChecker/1.0)',
                  Accept: 'text/html,application/xhtml+xml',
                },
                timeout: settings.timeout || 10000,
              });

              if (pageContent.ok) {
                const html = await pageContent.text();
                const extractedLinks = await linkExtractor.extractLinksFromHtml(html, url, {
                  includeExternal: settings.includeExternal,
                  maxLinks: 200,
                });

                extractedLinks.forEach((link) => {
                  if (!visitedUrls.has(link.url) && !pendingUrls.has(link.url)) {
                    pendingUrls.set(link.url, {
                      depth: depth + 1,
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
      ...securityHeaders,
    },
  });
}
