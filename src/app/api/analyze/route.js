/**
 * REWRITTEN ANALYZER - Single-Pass Content Page Discovery
 * Replace /src/app/api/analyze/route.js with this version
 *
 * NEW APPROACH:
 * 1. Lightweight BFS crawl to discover ALL pages
 * 2. Classify each page as content/non-content during discovery
 * 3. Return clean list of content pages ready for link checking
 * 4. No pattern analysis - just efficient content discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { urlUtils, batchUtils, contentPageUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { validateAnalysisRequest, validateAdvancedRateLimit } from '@/lib/validation';
import { errorHandler, handleValidationError, handleSecurityError } from '@/lib/errorHandler';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function POST(request) {
  try {
    // Rate limiting for analysis (more restrictive)
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = validateAdvancedRateLimit(clientIP, 'analyze');

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded for analysis',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
            ...securityHeaders,
          },
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return await errorHandler.handleError(new Error('Invalid JSON in request body'), request, {
        step: 'json_parsing',
      });
    }

    const requestValidation = validateAnalysisRequest(body);

    if (!requestValidation.success) {
      return await handleValidationError(new Error('Analysis request validation failed'), request);
    }

    const { url, maxDepth = 3, maxPages = 1000 } = requestValidation.data;

    console.log(
      `🔍 CONTENT DISCOVERY: Starting for ${url}, depth: ${maxDepth}, maxPages: ${maxPages}`
    );

    if (!urlUtils.isValidUrl(url)) {
      return await handleValidationError(new Error('Invalid URL format'), request);
    }

    // Security validation
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED analysis attempt: ${url} - ${validation.reason}`);
      return NextResponse.json(
        {
          error: 'URL blocked for security reasons',
          reason: validation.reason,
          code: 'SECURITY_BLOCKED',
        },
        { status: 403 }
      );
    }

    // Check robots.txt
    try {
      const robotsCheck = await securityUtils.checkRobotsTxt(url);
      if (!robotsCheck.allowed) {
        console.log(`🚫 BLOCKED analysis by robots.txt: ${url}`);
        return NextResponse.json(
          {
            error: 'Analysis not allowed by robots.txt',
            reason: robotsCheck.reason,
            code: 'ROBOTS_BLOCKED',
          },
          { status: 403 }
        );
      }
    } catch (robotsError) {
      console.log('Could not check robots.txt for analysis, proceeding');
    }

    // Start content page discovery
    const discovery = await discoverContentPages(url, maxDepth, maxPages);

    console.log(
      `✅ CONTENT DISCOVERY: Complete - ${discovery.summary.contentPages} content pages found`
    );

    return NextResponse.json(discovery, { headers: securityHeaders });
  } catch (error) {
    console.error('❌ CONTENT DISCOVERY: Error:', error);

    return await errorHandler.handleError(error, request, {
      step: 'content_discovery',
      url: body?.url,
      maxDepth: body?.maxDepth,
      maxPages: body?.maxPages,
    });
  }
}

/**
 * NEW: Lightweight Content Page Discovery
 * Uses BFS to find ALL pages, classifies during discovery, returns clean content list
 */
async function discoverContentPages(startUrl, maxDepth, maxPages) {
  console.log(`🚀 CONTENT DISCOVERY: Starting discovery for: ${startUrl}`);

  const normalizedStartUrl = urlUtils.normalizeUrl(startUrl);
  const baseHostname = new URL(normalizedStartUrl).hostname;

  // Discovery state
  const visitedUrls = new Set();
  const pendingQueue = new Map(); // url -> {depth, sourceUrl, priority}
  const contentPages = [];
  const allPages = [];
  const statistics = {
    content: 0,
    withParams: 0,
    pagination: 0,
    dates: 0,
    media: 0,
    admin: 0,
    api: 0,
    other: 0,
  };

  // Add starting URL to queue with high priority
  pendingQueue.set(normalizedStartUrl, {
    depth: 0,
    sourceUrl: null,
    priority: 10,
  });

  let pagesAnalyzed = 0;
  let totalLinksDiscovered = 0;

  console.log(`📊 CONTENT DISCOVERY: Target - max ${maxPages} pages, depth ${maxDepth}`);

  // Main discovery loop - BFS with content classification
  while (pendingQueue.size > 0 && pagesAnalyzed < maxPages) {
    // Get next URL to process (prioritize by depth and priority)
    const nextEntry = getNextHighestPriorityUrl(pendingQueue);
    if (!nextEntry) break;

    const [currentUrl, metadata] = nextEntry;
    pendingQueue.delete(currentUrl);

    // Skip if already visited
    if (visitedUrls.has(currentUrl)) continue;

    try {
      visitedUrls.add(currentUrl);
      pagesAnalyzed++;

      console.log(
        `🔍 DISCOVERY: [${pagesAnalyzed}/${maxPages}] Analyzing: ${currentUrl} (depth: ${metadata.depth})`
      );

      // Fetch page content for analysis and link extraction
      const pageData = await fetchPageForDiscovery(currentUrl);

      if (!pageData.success) {
        console.log(`❌ DISCOVERY: Failed to fetch ${currentUrl}: ${pageData.error}`);

        // Still record as "other" for statistics
        allPages.push({
          url: currentUrl,
          type: 'other',
          isContent: false,
          sourceUrl: metadata.sourceUrl,
          depth: metadata.depth,
          error: pageData.error,
        });
        statistics.other++;
        continue;
      }

      // Classify the page using new content classification
      const classification = contentPageUtils.classifyPageType(currentUrl, pageData.html);

      // Extract page title for better classification
      const title = extractPageTitle(pageData.html);

      // Store page information
      const pageInfo = {
        url: currentUrl,
        title: title,
        type: classification.type,
        isContent: classification.isContent,
        score: classification.score,
        confidence: classification.confidence,
        sourceUrl: metadata.sourceUrl,
        depth: metadata.depth,
        wordCount: pageData.wordCount,
        linkCount: pageData.linkCount,
      };

      allPages.push(pageInfo);

      // Update statistics
      const statKey = classification.isContent ? 'content' : classification.type;
      statistics[statKey] = (statistics[statKey] || 0) + 1;

      // Add to content pages if it's classified as content
      if (classification.isContent) {
        contentPages.push(pageInfo);
        console.log(`✅ CONTENT PAGE: ${currentUrl} (score: ${classification.score.toFixed(2)})`);
      } else {
        console.log(
          `🗑️ FILTERED: ${currentUrl} (${
            classification.type
          }, score: ${classification.score.toFixed(2)})`
        );
      }

      // Extract links for further discovery (if we haven't reached max depth)
      if (metadata.depth < maxDepth && pageData.html) {
        const discoveredLinks = extractLinksForDiscovery(pageData.html, currentUrl, metadata.depth);

        // Add new links to pending queue
        let newLinksAdded = 0;
        discoveredLinks.forEach((link) => {
          if (!visitedUrls.has(link.url) && !pendingQueue.has(link.url)) {
            // Prioritize internal links and shorter paths
            const priority = calculateLinkPriority(link, baseHostname, metadata.depth);

            pendingQueue.set(link.url, {
              depth: link.depth,
              sourceUrl: currentUrl,
              priority: priority,
            });
            newLinksAdded++;
            totalLinksDiscovered++;
          }
        });

        console.log(
          `🔗 DISCOVERY: Found ${discoveredLinks.length} links, ${newLinksAdded} new (queue: ${pendingQueue.size})`
        );
      }

      // Small delay to be respectful
      await batchUtils.delay(100);
    } catch (error) {
      console.error(`❌ DISCOVERY: Error processing ${currentUrl}:`, error);

      // Record as error for statistics
      allPages.push({
        url: currentUrl,
        type: 'other',
        isContent: false,
        sourceUrl: metadata.sourceUrl,
        depth: metadata.depth,
        error: error.message,
      });
      statistics.other++;
    }
  }

  // Generate final discovery results
  const totalPagesFound = allPages.length;
  const contentPagesFound = contentPages.length;
  const filteredOut = totalPagesFound - contentPagesFound;

  console.log(
    `🎉 DISCOVERY COMPLETE: ${totalPagesFound} total pages, ${contentPagesFound} content pages, ${filteredOut} filtered`
  );

  return {
    // NEW FORMAT: Content pages ready for single-pass crawl
    contentPages: contentPages.map((page) => ({
      url: page.url,
      title: page.title,
      sourceUrl: page.sourceUrl,
      depth: page.depth,
      score: page.score,
      wordCount: page.wordCount,
    })),

    // Summary for UI display
    summary: {
      totalPagesFound,
      contentPages: contentPagesFound,
      filteredOut,
      pagesAnalyzed,
      totalLinksDiscovered,
      isJavaScriptSite: false, // We successfully analyzed content
      recommendations: generateSmartRecommendations(statistics, contentPagesFound, totalPagesFound),
    },

    // Categories for compatibility (but focused on content)
    categories: {
      content: contentPages.length,
      withParams: statistics.withParams || 0,
      pagination: statistics.pagination || 0,
      dates: statistics.dates || 0,
      media: statistics.media || 0,
      admin: statistics.admin || 0,
      api: statistics.api || 0,
      other: statistics.other || 0,
    },

    // Sample pages for UI (top content pages by score)
    samplePages: {
      content: contentPages
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((page) => ({
          url: page.url,
          title: page.title,
          score: page.score,
          confidence: page.confidence,
        })),
      filtered: allPages
        .filter((page) => !page.isContent)
        .slice(0, 10)
        .map((page) => ({
          url: page.url,
          type: page.type,
          reason: `Filtered as ${page.type}`,
        })),
    },

    // Discovery statistics
    discoveryStats: {
      averageContentScore:
        contentPages.length > 0
          ? (contentPages.reduce((sum, page) => sum + page.score, 0) / contentPages.length).toFixed(
              2
            )
          : 0,
      highConfidencePages: contentPages.filter((page) => page.confidence === 'high').length,
      mediumConfidencePages: contentPages.filter((page) => page.confidence === 'medium').length,
      lowConfidencePages: contentPages.filter((page) => page.confidence === 'low').length,
    },
  };
}

/**
 * Fetches page content for classification and link discovery
 */
async function fetchPageForDiscovery(url, timeout = 10000) {
  try {
    // Security validation
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return { success: false, error: `Security: ${validation.reason}` };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentDiscoveryBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { success: false, error: 'Not HTML content' };
    }

    const html = await response.text();

    // Quick content metrics for classification
    const textContent = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textContent.split(' ').length;
    const linkCount = (html.match(/<a[^>]*href/gi) || []).length;

    return {
      success: true,
      html,
      wordCount,
      linkCount,
      contentType,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Extracts links from page for continued discovery
 */
function extractLinksForDiscovery(html, baseUrl, currentDepth) {
  const links = [];
  const baseHostname = new URL(baseUrl).hostname;

  try {
    // Simple regex-based link extraction for speed
    const linkRegex = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null && links.length < 200) {
      const href = match[1];

      // Skip invalid links
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }

      try {
        // Resolve to absolute URL
        const absoluteUrl = new URL(href, baseUrl).toString();
        const normalizedUrl = urlUtils.normalizeUrl(absoluteUrl);

        // Only follow internal links for discovery
        const linkHostname = new URL(normalizedUrl).hostname;
        if (linkHostname !== baseHostname) {
          continue;
        }

        // Quick filter obviously non-content URLs
        const quickType = contentPageUtils.classifyPageTypeByUrl(normalizedUrl);
        if (['admin', 'api', 'media'].includes(quickType)) {
          continue;
        }

        links.push({
          url: normalizedUrl,
          depth: currentDepth + 1,
          sourceUrl: baseUrl,
          type: quickType,
        });
      } catch (urlError) {
        // Skip invalid URLs
        continue;
      }
    }
  } catch (error) {
    console.error('Error extracting links:', error);
  }

  return links;
}

/**
 * Calculates priority for link discovery queue
 */
function calculateLinkPriority(link, baseHostname, currentDepth) {
  let priority = 5; // Base priority

  // Prioritize by depth (shallower = higher priority)
  priority += 3 - currentDepth;

  // Prioritize likely content URLs
  if (link.type === 'pages') priority += 3;
  if (link.type === 'withParams') priority += 1;

  // Deprioritize certain types
  if (link.type === 'pagination') priority -= 2;
  if (link.type === 'dates') priority -= 2;
  if (link.type === 'other') priority -= 1;

  // Prioritize shorter paths
  const pathDepth = new URL(link.url).pathname.split('/').filter((p) => p.length > 0).length;
  if (pathDepth <= 2) priority += 2;
  if (pathDepth <= 1) priority += 1;

  return Math.max(1, priority);
}

/**
 * Gets next highest priority URL from queue
 */
function getNextHighestPriorityUrl(pendingQueue) {
  if (pendingQueue.size === 0) return null;

  let bestEntry = null;
  let bestPriority = -1;

  for (const [url, metadata] of pendingQueue.entries()) {
    const priority = metadata.priority + (3 - metadata.depth); // Boost shallow pages
    if (priority > bestPriority) {
      bestPriority = priority;
      bestEntry = [url, metadata];
    }
  }

  return bestEntry;
}

/**
 * Extracts page title from HTML
 */
function extractPageTitle(html) {
  try {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim().substring(0, 100);
    }

    // Fallback to h1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      return h1Match[1]
        .replace(/<[^>]*>/g, '')
        .trim()
        .substring(0, 100);
    }

    return 'Untitled Page';
  } catch {
    return 'Untitled Page';
  }
}

/**
 * Generates smart recommendations based on discovery results
 */
function generateSmartRecommendations(statistics, contentPages, totalPages) {
  const recommendations = [];

  // Content ratio analysis
  const contentRatio = totalPages > 0 ? contentPages / totalPages : 0;

  if (contentRatio > 0.7) {
    recommendations.push({
      type: 'success',
      message: `Excellent! ${Math.round(
        contentRatio * 100
      )}% of discovered pages are content pages.`,
      action:
        'Your site has a clean structure. Focus crawling on content pages is highly recommended.',
    });
  } else if (contentRatio > 0.3) {
    recommendations.push({
      type: 'info',
      message: `${Math.round(
        contentRatio * 100
      )}% of pages are content pages. Good content-to-noise ratio.`,
      action: 'Smart crawling will be efficient by focusing on content pages only.',
    });
  } else {
    recommendations.push({
      type: 'warning',
      message: `Only ${Math.round(
        contentRatio * 100
      )}% of pages are content pages. High noise ratio detected.`,
      action: 'Strongly recommend using content-only crawling to avoid checking low-value pages.',
    });
  }

  // Size recommendations
  if (totalPages > 500) {
    recommendations.push({
      type: 'suggestion',
      message: `Large site detected (${totalPages} pages). Smart crawling will be much more efficient.`,
      action: 'Use content-only crawling to focus on meaningful pages and reduce scan time.',
    });
  }

  // Filtering efficiency
  const filteredPages = totalPages - contentPages;
  if (filteredPages > contentPages) {
    recommendations.push({
      type: 'info',
      message: `Smart filtering removed ${filteredPages} non-content pages, keeping ${contentPages} content pages.`,
      action: 'This filtering will significantly improve crawl efficiency and result quality.',
    });
  }

  return recommendations;
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
