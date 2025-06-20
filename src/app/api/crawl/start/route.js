/**
 * Enhanced start crawl endpoint with Content Pages Extraction + Discovered Links modes
 * UPDATED: Now supports both crawl modes from smart analyzer
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
import { seoDetector } from '@/lib/seoDetector';

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

    console.log(`🚀 CRAWL START: Starting crawl for: ${body.url}`);
    console.log(`📊 CRAWL START: Has analyzed data: ${!!body.preAnalyzedUrls}`);
    console.log(`🎯 CRAWL START: Crawl mode: ${body.settings?.crawlMode || 'auto'}`);
    console.log(`🎯 CRAWL START: SEO Enabled: ${body.settings?.enableSEO}`);

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
      crawlMode: validatedSettings.crawlMode || 'auto', //  Store crawl mode
      enableSEO: validatedSettings.enableSEO || false, // seo setting
    };

    console.log('📋 Creating database job...');
    const job = await db.createJob(normalizedUrl, jobSettings);
    jobId = job.id;

    console.log(`✅ Created job ${jobId} for ${normalizedUrl}`);

    // 🔥 ENHANCED: Branch based on crawl mode and data availability
    if (
      validatedPreAnalyzedUrls &&
      Array.isArray(validatedPreAnalyzedUrls) &&
      validatedPreAnalyzedUrls.length > 0
    ) {
      console.log(
        `🎯 SMART CRAWL: Processing ${
          validatedPreAnalyzedUrls.length
        } pre-analyzed URLs with mode: ${validatedSettings.crawlMode || 'auto'}`
      );

      // Start smart processing in the background with enhanced mode support
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
          crawlMode: validatedSettings.crawlMode || 'auto',
          message:
            validatedSettings.crawlMode === 'content_pages'
              ? `Content pages crawl started - will visit ${validatedPreAnalyzedUrls.length} pages to extract and check links`
              : validatedSettings.crawlMode === 'discovered_links'
              ? `Discovered links crawl started - will check ${validatedPreAnalyzedUrls.length} pre-analyzed links directly`
              : `Smart crawl started with ${validatedPreAnalyzedUrls.length} pre-analyzed URLs`,
          statusUrl: `/api/crawl/status/${jobId}`,
          resultsUrl: `/api/results/${jobId}`,
          crawlType: 'smart',
        },
        { status: 201, headers: responseHeaders }
      );
    }

    // BRANCH 2: Traditional crawl path (unchanged)
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
 * 🔥 ENHANCED SMART CRAWL LOGIC with Content Pages Extraction Mode
 * Process smart crawl with pre-analyzed URLs in the background
 */
async function processSmartCrawlBackground(jobId, baseUrl, preAnalyzedUrls, settings) {
  try {
    console.log(
      `🎯 SMART CRAWL: Starting background processing for job ${jobId} with mode: ${settings.crawlMode}`
    );

    await db.updateJobStatus(jobId, 'running');

    // Validate preAnalyzedUrls structure
    if (!Array.isArray(preAnalyzedUrls)) {
      throw new Error('preAnalyzedUrls must be an array');
    }

    const crawlMode = settings.crawlMode || 'auto';

    // 🔥 BRANCH 1: CONTENT PAGES MODE - Extract links from content pages
    if (crawlMode === 'content_pages') {
      await processContentPagesMode(jobId, baseUrl, preAnalyzedUrls, settings);
    }
    // 🔥 BRANCH 2: DISCOVERED LINKS MODE - Check pre-discovered links directly
    else if (crawlMode === 'discovered_links') {
      await processDiscoveredLinksMode(jobId, baseUrl, preAnalyzedUrls, settings);
    }
    // 🔥 BRANCH 3: AUTO MODE - Use original smart crawl logic
    else {
      await processOriginalSmartMode(jobId, baseUrl, preAnalyzedUrls, settings);
    }
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
 * 🔥 NEW: Content Pages Mode - Visit content pages, extract ALL their links, then check status
 */
async function processContentPagesMode(jobId, baseUrl, contentPages, settings) {
  console.log(
    `🎯 CONTENT PAGES MODE: Processing ${contentPages.length} content pages for job ${jobId}`
  );

  try {
    // Phase 1: Visit each content page and extract ALL links
    console.log(`📄 Phase 1: Visiting content pages to extract links...`);

    const linkExtractor = new LinkExtractor({
      includeExternal: settings.includeExternal || false,
      maxLinksPerPage: 2000, // Allow more links per page
    });

    const allExtractedLinks = new Map(); // url -> link data
    let contentPagesProcessed = 0;
    let totalLinksExtracted = 0;

    // Process content pages in small batches
    const contentBatches = batchUtils.chunkArray(contentPages, 3); // Small batches to avoid timeouts

    for (const batch of contentBatches) {
      console.log(`📄 Processing content page batch: ${batch.length} pages`);

      await Promise.all(
        batch.map(async (pageData) => {
          const pageUrl = pageData.url;

          try {
            console.log(`🔍 Visiting content page: ${pageUrl}`);

            // Fetch page content
            const response = await fetch(pageUrl, {
              timeout: settings.timeout || 10000,
              headers: {
                'User-Agent': 'Broken Link Checker Bot/1.0',
                Accept: 'text/html,application/xhtml+xml',
              },
            });

            if (response.ok) {
              const pageContent = await response.text();

              // Extract all links from this content page
              const extractionResult = linkExtractor.extractLinks(pageContent, pageUrl, 1);

              console.log(`🔗 Extracted ${extractionResult.links.length} links from ${pageUrl}`);

              // Add extracted links to our master list
              extractionResult.links.forEach((link) => {
                if (!allExtractedLinks.has(link.url)) {
                  allExtractedLinks.set(link.url, {
                    url: link.url,
                    sourceUrl: pageUrl,
                    linkText: link.linkText || 'Extracted link',
                    isInternal: link.isInternal,
                    depth: 1,
                    category: link.isInternal ? 'pages' : 'external',
                  });
                  totalLinksExtracted++;
                }
              });
            } else {
              console.log(`⚠️ Could not fetch content page: ${pageUrl} (${response.status})`);
            }

            contentPagesProcessed++;
          } catch (error) {
            console.error(`❌ Error processing content page ${pageUrl}:`, error);
            contentPagesProcessed++;
          }
        })
      );

      // Update progress for content page processing
      await db.updateJobProgress(jobId, contentPagesProcessed, contentPages.length);

      // Small delay between batches
      await batchUtils.delay(500);
    }

    console.log(
      `✅ Phase 1 complete: Extracted ${totalLinksExtracted} unique links from ${contentPagesProcessed} content pages`
    );

    // Phase 2: Check status of all extracted links
    console.log(`🔗 Phase 2: Checking status of ${totalLinksExtracted} extracted links...`);

    const linksToCheck = Array.from(allExtractedLinks.values());

    // Add all discovered links to database first
    const discoveredLinks = linksToCheck.map((linkData) => ({
      url: linkData.url,
      sourceUrl: linkData.sourceUrl,
      isInternal: linkData.isInternal,
      depth: linkData.depth,
      status: 'pending',
      http_status_code: null,
      response_time: null,
      checked_at: null,
      is_working: null,
      error_message: null,
    }));

    if (discoveredLinks.length > 0) {
      // Add in chunks to avoid database limits
      const dbChunks = batchUtils.chunkArray(discoveredLinks, 100);
      for (const chunk of dbChunks) {
        await db.addDiscoveredLinks(jobId, chunk);
      }
      console.log(`💾 Saved ${discoveredLinks.length} discovered links to database`);
    }

    // Update progress tracking to reflect the extracted links count
    await db.updateJobProgress(jobId, 0, totalLinksExtracted);

    // Now check status of all extracted links
    await checkLinksStatus(jobId, linksToCheck, settings);
  } catch (error) {
    console.error('❌ CONTENT PAGES MODE: Error:', error);
    throw error;
  }
}

/**
 * 🔥 NEW: Discovered Links Mode - Check pre-discovered links directly for status
 */
async function processDiscoveredLinksMode(jobId, baseUrl, discoveredUrls, settings) {
  console.log(
    `🔄 DISCOVERED LINKS MODE: Processing ${discoveredUrls.length} pre-discovered links for job ${jobId}`
  );

  try {
    // Prepare link data
    const linksToCheck = discoveredUrls
      .map((urlData) => {
        let url, sourceUrl;

        if (typeof urlData === 'string') {
          url = urlData;
          sourceUrl = baseUrl;
        } else if (typeof urlData === 'object' && urlData.url) {
          url = urlData.url;
          sourceUrl = urlData.sourceUrl || urlData.source_url || baseUrl;
        } else {
          console.warn(`⚠️ Invalid URL data:`, urlData);
          return null;
        }

        return {
          url: url,
          sourceUrl: sourceUrl || baseUrl,
          linkText: urlData.linkText || 'Discovered link',
          isInternal: urlUtils.isInternalUrl(url, baseUrl),
          depth: 1,
          category: urlData.category || 'discovered',
        };
      })
      .filter(Boolean);

    console.log(`📦 Prepared ${linksToCheck.length} valid links for status checking`);

    // Add all discovered links to database first
    const discoveredLinks = linksToCheck.map((linkData) => ({
      url: linkData.url,
      sourceUrl: linkData.sourceUrl,
      isInternal: linkData.isInternal,
      depth: linkData.depth,
      status: 'pending',
      http_status_code: null,
      response_time: null,
      checked_at: null,
      is_working: null,
      error_message: null,
    }));

    if (discoveredLinks.length > 0) {
      await db.addDiscoveredLinks(jobId, discoveredLinks);
      console.log(`💾 Saved ${discoveredLinks.length} discovered links to database`);
    }

    // Update initial progress
    await db.updateJobProgress(jobId, 0, discoveredLinks.length);

    // Check status of all discovered links
    await checkLinksStatus(jobId, linksToCheck, settings);
  } catch (error) {
    console.error('❌ DISCOVERED LINKS MODE: Error:', error);
    throw error;
  }
}

/**
 * 🔄 EXISTING: Original Smart Mode - Check URLs directly (backward compatibility)
 */
async function processOriginalSmartMode(jobId, baseUrl, preAnalyzedUrls, settings) {
  console.log(`🔄 ORIGINAL SMART MODE: Processing ${preAnalyzedUrls.length} URLs for job ${jobId}`);

  // This is the existing logic from the original smart crawl
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

  // Check status of all links
  const linksToCheck = discoveredLinks.map((link) => ({
    url: link.url,
    sourceUrl: link.sourceUrl,
    linkText: 'Pre-analyzed link',
  }));

  await checkLinksStatus(jobId, linksToCheck, settings);
}

/**
 * 🔗 SHARED: Link Status Checking Logic (used by all modes)
 */
async function checkLinksStatus(jobId, linksToCheck, settings) {
  console.log(`🔗 LINK STATUS CHECK: Checking ${linksToCheck.length} links for job ${jobId}`);

  // NEW: Check if SEO analysis is enabled
  const enableSEO = settings.enableSEO || false;
  const seoForContentPages = settings.seoForContentPages !== false; // Default true
  const httpChecker = new HttpChecker({
    timeout: settings.timeout || 10000,
    maxConcurrent: enableSEO ? 3 : 4,
    retryAttempts: 1,
  });

  // Process URLs in smaller batches
  const batchSize = enableSEO ? 8 : 10; // Smaller batches for SEO
  const batches = batchUtils.chunkArray(linksToCheck, batchSize);

  let processedCount = 0;
  let brokenLinksFound = 0;
  let seoAnalyzedCount = 0;

  console.log(`📦 Processing ${batches.length} batches of up to ${batchSize} URLs each`);

  for (let i = 0; i < batches.length; i++) {
    // Check if job was stopped
    const currentJob = await db.getJob(jobId);
    if (currentJob.status === 'failed' && currentJob.error_message === 'Stopped by user') {
      console.log(`🛑 STOP DETECTED: Job ${jobId} was stopped by user, exiting link checking`);
      return; // Exit gracefully
    }
    const batch = batches[i];

    console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`);

    try {
      const urlsToCheck = batch.map((linkData) => ({
        url: linkData.url,
        sourceUrl: linkData.sourceUrl,
        linkText: linkData.linkText || 'Link',
      }));

      // NEW: Use enhanced HTTP checker with SEO
      const { results } = await httpChecker.checkUrlsWithSEO(urlsToCheck, {
        enableSEO: enableSEO && seoForContentPages,
        onProgress: (progress) => {
          console.log(
            `🔄 Batch progress: ${progress.completed}/${progress.total}, SEO: ${
              progress.seoAnalyzed || 0
            } // SEO enabled: ${enableSEO}`
          );
        },
      });

      console.log(`✅ Checked ${results.length} URLs in batch ${i + 1}`);

      for (const result of results) {
        processedCount++;

        try {
          // Update discovered_links table with HTTP status
          await db.supabase
            .from('discovered_links')
            .update({
              status: 'checked',
              http_status_code: result.http_status_code,
              response_time: result.response_time,
              checked_at: result.checked_at,
              is_working: result.is_working,
              error_message: result.error_message,
              has_seo_data: result.seo_data && !result.seo_data.error,
            })
            .eq('job_id', jobId)
            .eq('url', result.url);

          // Save SEO analysis data if available
          if (result.seo_data && !result.seo_data.error) {
            try {
              await db.addSEOAnalysis(jobId, result.seo_data);
              seoAnalyzedCount++; // Increment only when successfully saved
              console.log(`📊 SEO: Saved data for ${result.url} (${seoAnalyzedCount} total)`);
            } catch (seoSaveError) {
              console.error(`❌ Failed to save SEO data for ${result.url}:`, seoSaveError);
            }
          }

          console.log(
            `💾 Updated status for: ${result.url} (${result.http_status_code || 'ERROR'})`
          );
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
            linkText: result.linkText || 'Link',
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
      const totalLinks = linksToCheck.length;
      await db.updateJobProgress(jobId, processedCount, totalLinks);

      console.log(
        `📊 Progress: ${processedCount}/${totalLinks} links checked, ${brokenLinksFound} broken, ${seoAnalyzedCount} SEO analyzed`
      );

      // Longer delay for SEO requests to be respectful
      await batchUtils.delay(enableSEO ? 800 : 500);
    } catch (batchError) {
      console.error(`❌ Error processing batch ${i + 1}:`, batchError);
    }
  }

  // Complete the job
  await db.updateJobStatus(jobId, 'completed');

  console.log(
    `🎉 LINK CHECK COMPLETE: ${processedCount} links checked, ${brokenLinksFound} broken links found`
  );

  // NEW: Log SEO summary
  if (enableSEO && seoAnalyzedCount > 0) {
    try {
      const seoSummary = await db.getSEOSummary(jobId);
      console.log(
        `📊 SEO SUMMARY: Avg score ${seoSummary.avg_score}/100, ${seoSummary.total_issues} total issues`
      );
    } catch (summaryError) {
      console.error('❌ Error getting SEO summary:', summaryError);
    }
  }
}

/**
 * EXISTING TRADITIONAL CRAWL LOGIC (unchanged)
 * Process traditional crawl with discovery-based approach
 */
async function processTraditionalCrawlBackground(jobId, startUrl, settings) {
  try {
    console.log(`🕷️ TRADITIONAL CRAWL: Starting background processing for job ${jobId}`);
    console.log(`🎯 TRADITIONAL CRAWL: SEO enabled: ${!!settings.enableSEO}`);

    await db.updateJobStatus(jobId, 'running');

    // Initialize crawler components
    const linkExtractor = new LinkExtractor({
      includeExternal: settings.includeExternal || false,
      maxLinksPerPage: 1000,
    });

    // Traditional crawler state
    const visitedUrls = new Set();
    const pendingUrls = new Map(); // url -> {depth, sourceUrl}
    const discoveredUrlsBatch = []; // Batch URLs for efficient checking
    const maxDepth = settings.maxDepth || 3;
    const maxPages = 500; // Reasonable limit
    const batchSize = 20; // Process URLs in batches

    // Get base domain for internal link checking
    const baseDomain = new URL(startUrl).hostname;

    // Add starting URL to pending queue
    pendingUrls.set(startUrl, { depth: 0, sourceUrl: null });

    let totalDiscovered = 0;
    let totalProcessed = 0;
    let brokenLinksFound = 0;

    console.log(`🚀 TRADITIONAL CRAWL: Starting from ${startUrl} with max depth ${maxDepth}`);

    // Main crawling loop
    while (pendingUrls.size > 0 && totalProcessed < maxPages) {
      // Check if job was stopped
      const currentJob = await db.getJob(jobId);
      if (currentJob.status === 'failed' && currentJob.error_message === 'Stopped by user') {
        console.log(`🛑 STOP DETECTED: Traditional crawl job ${jobId} was stopped by user`);
        return; // Exit gracefully
      }

      // Get next batch of URLs to process
      const batchUrls = [];
      const batchSize = 10; // Smaller batches for traditional crawl

      const urlEntries = Array.from(pendingUrls.entries()).slice(0, batchSize);
      urlEntries.forEach(([url, metadata]) => {
        batchUrls.push({ url, ...metadata });
        pendingUrls.delete(url);
      });

      if (batchUrls.length === 0) break;

      console.log(`📦 TRADITIONAL: Processing batch of ${batchUrls.length} URLs`);

      // 🔥 NEW: Use checkLinksStatus() for both HTTP + SEO analysis
      const linksToCheck = batchUrls
        .filter((urlData) => !visitedUrls.has(urlData.url))
        .map((urlData) => ({
          url: urlData.url,
          sourceUrl: urlData.sourceUrl || startUrl,
          linkText: 'Traditional crawl link',
          isInternal: urlUtils.isInternalUrl(urlData.url, startUrl),
          depth: urlData.depth,
        }));

      if (linksToCheck.length > 0) {
        // Mark as visited before processing
        linksToCheck.forEach((linkData) => {
          visitedUrls.add(linkData.url);
          totalProcessed++;
        });

        console.log(
          `🔍 TRADITIONAL: [${totalProcessed}] Checking ${
            linksToCheck.length
          } URLs with SEO: ${!!settings.enableSEO}`
        );

        // 🔥 KEY CHANGE: Smart checking - lightweight for link status, full content only if SEO enabled
        try {
          if (settings.enableSEO) {
            // SEO enabled: Use full content checking (slower but comprehensive)
            await checkLinksStatusForTraditional(jobId, linksToCheck, settings);
          } else {
            // SEO disabled: Use lightweight quickCheck for fast status checking
            await checkLinksStatusLightweight(jobId, linksToCheck, settings);
          }
        } catch (checkError) {
          console.error('❌ Error in batch checking:', checkError);
          // Continue with remaining URLs
        }

        // 🔧 Extract links from working internal pages for further crawling
        for (const linkData of linksToCheck) {
          const { url, depth } = linkData;

          // Only extract links if we haven't reached max depth and it's an internal URL
          if (depth < maxDepth && urlUtils.isInternalUrl(url, startUrl)) {
            try {
              // Fetch page content for link extraction
              const pageResponse = await fetch(url, {
                timeout: settings.timeout || 10000,
                headers: {
                  'User-Agent': 'Broken Link Checker Bot/1.0',
                },
              });

              if (pageResponse.status < 500) {
                const pageContent = await pageResponse.text();
                const extractionResult = linkExtractor.extractLinks(pageContent, url, depth);

                // Add new discovered links to pending queue
                extractionResult.links.forEach((link) => {
                  if (!visitedUrls.has(link.url) && !pendingUrls.has(link.url)) {
                    pendingUrls.set(link.url, {
                      depth: link.depth,
                      sourceUrl: url,
                    });
                    totalDiscovered++;

                    console.log(
                      `🔗 TRADITIONAL: Discovered ${link.url} (${
                        link.isInternal ? 'internal' : 'external'
                      }, depth: ${link.depth})`
                    );
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
        }
      }

      // Update progress after batch
      await db.updateJobProgress(jobId, totalProcessed, Math.max(totalProcessed, totalDiscovered));

      console.log(
        `📊 TRADITIONAL: Progress: ${totalProcessed} processed, ${pendingUrls.size} pending`
      );

      // Small delay between batches
      await batchUtils.delay(200);
    }

    // Complete the job
    await db.updateJobStatus(jobId, 'completed');

    console.log(`🎉 TRADITIONAL CRAWL COMPLETE: ${totalProcessed} URLs processed`);

    // 🔥 NEW: Log SEO summary if enabled
    if (settings.enableSEO) {
      try {
        const seoSummary = await db.calculateSEOSummary(jobId);
        if (seoSummary && seoSummary.total_pages > 0) {
          console.log(
            `📊 SEO SUMMARY: ${seoSummary.total_pages} pages analyzed, avg score: ${seoSummary.avg_score}/100, ${seoSummary.total_issues} total issues`
          );
        }
      } catch (summaryError) {
        console.error('❌ Error getting SEO summary:', summaryError);
      }
    }
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

/**
 * 🔥 NEW: Wrapper function for traditional crawl to use checkLinksStatus
 * This reuses the same logic as smart crawl modes but for traditional discovery
 */
async function checkLinksStatusForTraditional(jobId, linksToCheck, settings) {
  console.log(
    `🔗 TRADITIONAL-CHECK: Processing ${linksToCheck.length} URLs with SEO: ${!!settings.enableSEO}`
  );

  // NEW: Check if SEO analysis is enabled
  const enableSEO = settings.enableSEO || false;

  const httpChecker = new HttpChecker({
    timeout: settings.timeout || 10000,
    maxConcurrent: enableSEO ? 2 : 3, // Reduce concurrency if SEO enabled
    retryAttempts: 1,
  });

  let processedCount = 0;
  let brokenLinksFound = 0;
  let seoAnalyzedCount = 0;

  // Process in small batches
  const batchSize = enableSEO ? 10 : 20;
  const batches = batchUtils.chunkArray(linksToCheck, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    console.log(
      `📦 TRADITIONAL-CHECK: Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`
    );

    try {
      // 🔥 KEY: Use the same enhanced HTTP checking as smart crawl modes
      const checkResults = await httpChecker.checkUrlsWithSEO(
        batch.map((link) => ({
          url: link.url,
          sourceUrl: link.sourceUrl,
        })),
        {
          enableSEO,
          onProgress: (progress) => {
            console.log(
              `🔍 Progress: ${progress.completed}/${progress.total}, SEO analyzed: ${
                progress.seoAnalyzed || 0
              }`
            );
          },
        }
      );

      // Process results
      for (let j = 0; j < checkResults.results.length; j++) {
        const result = checkResults.results[j];
        const originalLink = batch[j];

        processedCount++;

        // Save discovered link to database (all links, working or broken)
        const discoveredLink = {
          url: result.url,
          sourceUrl: originalLink.sourceUrl,
          isInternal: originalLink.isInternal,
          depth: originalLink.depth,
          status: 'checked',
          http_status_code: result.http_status_code,
          response_time: result.response_time,
          checked_at: result.checked_at,
          is_working: result.is_working,
          error_message: result.error_message,
        };

        try {
          await db.addDiscoveredLinks(jobId, [discoveredLink]);
        } catch (dbError) {
          console.error('❌ Error saving discovered link:', dbError);
        }

        // Handle broken links
        if (!result.is_working) {
          const brokenLink = {
            url: result.url,
            sourceUrl: originalLink.sourceUrl,
            statusCode: result.http_status_code,
            errorType: result.errorType || 'other',
            linkText: originalLink.linkText,
            responseTime: result.response_time,
          };

          try {
            await db.addBrokenLink(jobId, brokenLink);
            brokenLinksFound++;
          } catch (dbError) {
            console.error('❌ Error saving broken link:', dbError);
          }
        }

        // 🔥 NEW: Handle SEO data if enabled
        if (enableSEO && result.seo_data && !result.seo_data.error) {
          try {
            await db.addSEOAnalysis(jobId, result.seo_data);
            seoAnalyzedCount++;
          } catch (seoError) {
            console.error('❌ Error saving SEO data:', seoError);
          }
        }
      }

      // Small delay between batches
      await batchUtils.delay(enableSEO ? 800 : 500);
    } catch (batchError) {
      console.error(`❌ Error processing batch ${i + 1}:`, batchError);
    }
  }
}

/**
 * 🔗 LIGHTWEIGHT: Fast link checking without SEO (maintains current performance)
 */
async function checkLinksStatusLightweight(jobId, linksToCheck, settings) {
  console.log(`⚡ LIGHTWEIGHT-CHECK: Fast checking ${linksToCheck.length} URLs (no SEO)`);

  const httpChecker = new HttpChecker({
    timeout: settings.timeout || 10000,
    maxConcurrent: 5, // Higher concurrency since no SEO
    retryAttempts: 1,
  });

  let processedCount = 0;
  let brokenLinksFound = 0;

  // Process in larger batches since it's just status checking
  const batchSize = 25;
  const batches = batchUtils.chunkArray(linksToCheck, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    console.log(
      `📦 LIGHTWEIGHT: Processing batch ${i + 1}/${batches.length} (${batch.length} URLs)`
    );

    try {
      // Use quickCheck for fast HEAD requests
      const checkPromises = batch.map(async (linkData) => {
        const result = await httpChecker.quickCheck(linkData.url);

        // Save discovered link to database
        const discoveredLink = {
          url: result.url,
          sourceUrl: linkData.sourceUrl,
          isInternal: linkData.isInternal,
          depth: linkData.depth,
          status: 'checked',
          http_status_code: result.http_status_code,
          response_time: result.response_time,
          checked_at: result.checked_at,
          is_working: result.is_working,
          error_message: result.error_message,
        };

        try {
          await db.addDiscoveredLinks(jobId, [discoveredLink]);
        } catch (dbError) {
          console.error('❌ Error saving discovered link:', dbError);
        }

        // Handle broken links
        if (!result.is_working) {
          const brokenLink = {
            url: result.url,
            sourceUrl: linkData.sourceUrl,
            statusCode: result.http_status_code,
            errorType: result.errorType || 'other',
            linkText: linkData.linkText,
            responseTime: result.response_time,
          };

          try {
            await db.addBrokenLink(jobId, brokenLink);
            brokenLinksFound++;
          } catch (dbError) {
            console.error('❌ Error saving broken link:', dbError);
          }
        }

        processedCount++;
        return result;
      });

      await Promise.all(checkPromises);

      // Small delay between batches
      await batchUtils.delay(200);
    } catch (batchError) {
      console.error(`❌ Error processing lightweight batch ${i + 1}:`, batchError);
    }
  }

  console.log(
    `⚡ LIGHTWEIGHT-CHECK COMPLETE: ${processedCount} links checked, ${brokenLinksFound} broken links found`
  );
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
