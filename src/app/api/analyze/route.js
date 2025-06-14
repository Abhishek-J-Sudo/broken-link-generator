/**
 * Enhanced URL analysis endpoint with content page discovery for smart analyzer
 * MERGED: Main branch pattern analysis + Smart analyzer content discovery
 */

import { NextResponse } from 'next/server';
import { urlUtils, validateUtils, batchUtils, contentPageUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { errorHandler } from '@/lib/errorHandler';
import { validateCrawlRequest } from '@/lib/validation';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

// MAIN BRANCH POST HANDLER - PRESERVED WITH SMART ANALYZER ENHANCEMENT
export async function POST(request) {
  try {
    console.log('🔍 ANALYZER: Starting URL analysis...');

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return await errorHandler.handleError(new Error('Invalid JSON in request body'), request, {
        step: 'json_parsing',
      });
    }

    const { url, maxDepth = 3, maxPages = 500 } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400, headers: securityHeaders }
      );
    }

    console.log(`🚀 ANALYZER: Analyzing ${url} with maxDepth=${maxDepth}, maxPages=${maxPages}`);

    // ENHANCED: Smart analyzer with content discovery + fallback to pattern analysis
    const analysis = await analyzeUrlsWithContentDiscovery(url, maxDepth, maxPages);

    console.log(
      `✅ ANALYZER: Analysis complete - found ${
        analysis.summary.totalUrls || analysis.summary.totalPagesFound || 0
      } URLs`
    );

    return NextResponse.json(analysis, { headers: securityHeaders });
  } catch (error) {
    console.error('❌ ANALYZER: Error analyzing URLs:', error);

    return await errorHandler.handleError(error, request, {
      step: 'url_analysis',
      url: body?.url,
      maxDepth: body?.maxDepth,
      maxPages: body?.maxPages,
    });
  }
}

// NEW: Enhanced analysis with content discovery + pattern analysis fallback
async function analyzeUrlsWithContentDiscovery(startUrl, maxDepth, maxPages) {
  console.log(`🎯 ANALYZER: Starting enhanced analysis for: ${startUrl}`);

  // Step 1: Analyze homepage to determine site type
  const homepageAnalysis = await analyzeHomepage(startUrl);

  if (!homepageAnalysis.hasValidContent) {
    console.log(`❌ ANALYZER: Homepage analysis failed or detected JavaScript-only site`);
    return createJavaScriptSiteResponse(startUrl, homepageAnalysis);
  }

  console.log(`✅ ANALYZER: Valid homepage found with ${homepageAnalysis.linkCount} links`);

  // Step 2: Try content discovery first (smart analyzer approach)
  try {
    console.log(`🧠 ANALYZER: Attempting smart content discovery...`);
    const contentDiscovery = await discoverContentPages(startUrl, maxPages);

    if (contentDiscovery.success && contentDiscovery.contentPages.length > 0) {
      console.log(
        `✅ ANALYZER: Content discovery successful - found ${contentDiscovery.contentPages.length} content pages`
      );
      return contentDiscovery;
    }
  } catch (error) {
    console.log(
      `⚠️ ANALYZER: Content discovery failed, falling back to pattern analysis:`,
      error.message
    );
  }

  // Step 3: Fallback to original pattern analysis (main branch approach)
  console.log(`🔄 ANALYZER: Using pattern analysis as fallback...`);
  return await performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis);
}

// NEW: Smart analyzer content page discovery
async function discoverContentPages(startUrl, maxPages = 1000) {
  console.log(`🔍 CONTENT DISCOVERY: Starting for ${startUrl} (max: ${maxPages} pages)`);

  const visitedUrls = new Set();
  const pendingUrls = new Map([[startUrl, { depth: 0, sourceUrl: null }]]);
  const contentPages = [];
  const allDiscoveredPages = [];
  const stats = {
    totalPagesFound: 0,
    contentPages: 0,
    filteredOut: 0,
  };

  const categories = {
    content: 0,
    withParams: 0,
    pagination: 0,
    dates: 0,
    media: 0,
    admin: 0,
    api: 0,
    other: 0,
  };

  let pagesProcessed = 0;

  // BFS crawl for content page discovery
  while (pendingUrls.size > 0 && pagesProcessed < maxPages) {
    const batch = [];
    const batchSize = 10; // Process in small batches

    // Get next batch of URLs
    const urlEntries = Array.from(pendingUrls.entries()).slice(0, batchSize);
    urlEntries.forEach(([url, metadata]) => {
      batch.push({ url, ...metadata });
      pendingUrls.delete(url);
    });

    if (batch.length === 0) break;

    // Process batch for content discovery
    for (const urlData of batch) {
      const { url, depth } = urlData;

      if (visitedUrls.has(url) || pagesProcessed >= maxPages) continue;

      try {
        visitedUrls.add(url);
        pagesProcessed++;
        stats.totalPagesFound++;

        console.log(
          `📄 CONTENT DISCOVERY: [${pagesProcessed}/${maxPages}] Analyzing: ${url.substring(
            0,
            80
          )}...`
        );

        // Quick classification without full content fetch
        const pageType = contentPageUtils.classifyPageTypeByUrl(url);
        const isContent = contentPageUtils.isContentPage(url);

        allDiscoveredPages.push({
          url,
          type: pageType,
          isContent,
          depth,
        });

        // Update category stats
        categories[pageType] = (categories[pageType] || 0) + 1;

        if (isContent) {
          contentPages.push({
            url,
            title: `Content Page ${contentPages.length + 1}`,
            type: 'content',
            depth,
            sourceUrl: urlData.sourceUrl,
          });
          stats.contentPages++;
        } else {
          stats.filteredOut++;
        }

        // Continue crawling for more pages (only if depth allows and is internal)
        if (depth < 2 && urlUtils.isInternalUrl(url, startUrl)) {
          try {
            const pageContent = await fetchPageWithTimeout(url, 8000);
            if (pageContent) {
              const newLinks = extractLinksForDiscovery(pageContent, url, depth);

              newLinks.forEach((link) => {
                if (!visitedUrls.has(link.url) && !pendingUrls.has(link.url)) {
                  pendingUrls.set(link.url, {
                    depth: link.depth,
                    sourceUrl: url,
                  });
                }
              });
            }
          } catch (extractError) {
            // Continue without this page's links
            console.log(`⚠️ Could not extract links from ${url}`);
          }
        }

        // Small delay to be respectful
        if (pagesProcessed % 10 === 0) {
          await batchUtils.delay(500);
        }
      } catch (error) {
        console.error(`❌ Error processing ${url}:`, error.message);
        stats.filteredOut++;
      }
    }

    // Progress logging
    if (pagesProcessed % 50 === 0) {
      console.log(
        `📊 CONTENT DISCOVERY: Progress - ${pagesProcessed} pages, ${contentPages.length} content pages found`
      );
    }
  }

  console.log(
    `🎉 CONTENT DISCOVERY: Complete! Found ${contentPages.length} content pages out of ${stats.totalPagesFound} total pages`
  );

  return {
    success: true,
    contentPages,
    summary: {
      totalPagesFound: stats.totalPagesFound,
      contentPages: stats.contentPages,
      filteredOut: stats.filteredOut,
      categories,
    },
    originalUrl: startUrl,
    analysisType: 'content_discovery',
    allDiscoveredPages: allDiscoveredPages.slice(0, 100), // Sample for debugging
  };
}

// MAIN BRANCH FUNCTIONS - PRESERVED EXACTLY
async function analyzeHomepage(url) {
  console.log(`🏠 ANALYZER: Analyzing homepage: ${url}`);

  const content = await fetchPageWithTimeout(url);

  if (!content) {
    return {
      hasValidContent: false,
      reason: 'fetch_failed',
      content: null,
      linkCount: 0,
    };
  }

  console.log(`📄 ANALYZER: Got ${content.length} chars of content`);

  // Analyze content structure
  const linkCount = (content.match(/<a[^>]*href/gi) || []).length;
  const hasContent = content.length > 1000 && linkCount > 5;

  return {
    hasValidContent: hasContent,
    reason: hasContent ? 'has_content' : 'insufficient_content',
    content,
    linkCount,
  };
}

// MAIN BRANCH: Original pattern analysis (preserved as fallback)
async function performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis) {
  console.log(`🕷️ ANALYZER: Performing pattern analysis starting from: ${startUrl}`);

  const visitedUrls = new Set();
  const pendingUrls = new Map([[startUrl, { depth: 0, sourceUrl: null }]]);
  const allUrls = [];
  const urlPatterns = new Map();
  const urlCategories = {
    pages: [],
    withParams: [],
    pagination: [],
    dates: [],
    media: [],
    admin: [],
    api: [],
    other: [],
  };

  let pagesProcessed = 0;
  let totalLinksFound = 0;

  // Process homepage links first
  console.log(`🔧 ANALYZER: Processing homepage links...`);

  try {
    const extractionResult = extractLinksManually(homepageAnalysis.content, startUrl);

    console.log(`🔗 ANALYZER: Homepage extraction result: ${extractionResult.length} links`);

    extractionResult.forEach((link) => {
      totalLinksFound++;

      const analysis = analyzeUrlPattern(link.url, startUrl);

      const urlData = {
        url: link.url,
        sourceUrl: startUrl,
        depth: link.depth,
        category: analysis.category,
        pattern: analysis.pattern,
        params: analysis.params,
        linkText: link.linkText || '',
        shouldCrawl: link.shouldCrawl,
      };

      allUrls.push(urlData);
      urlCategories[analysis.category].push({
        url: link.url,
        pattern: analysis.pattern,
        params: analysis.params,
        sourceUrl: startUrl,
      });

      // Track patterns
      const patternKey = analysis.pattern;
      if (!urlPatterns.has(patternKey)) {
        urlPatterns.set(patternKey, {
          pattern: patternKey,
          count: 0,
          examples: [],
        });
      }
      const patternData = urlPatterns.get(patternKey);
      patternData.count++;
      if (patternData.examples.length < 5) {
        patternData.examples.push(link.url);
      }

      if (
        link.depth <= maxDepth &&
        link.shouldCrawl &&
        !visitedUrls.has(link.url) &&
        !pendingUrls.has(link.url)
      ) {
        pendingUrls.set(link.url, {
          depth: link.depth,
          sourceUrl: startUrl,
        });
      }
    });

    visitedUrls.add(startUrl);
    pagesProcessed++;
  } catch (error) {
    console.error(`❌ Error processing homepage:`, error);
  }

  // Continue with BFS crawling for pattern analysis
  while (pendingUrls.size > 0 && pagesProcessed < maxPages) {
    const currentUrl = pendingUrls.keys().next().value;
    const urlData = pendingUrls.get(currentUrl);
    pendingUrls.delete(currentUrl);

    if (visitedUrls.has(currentUrl)) continue;

    try {
      visitedUrls.add(currentUrl);
      pagesProcessed++;

      console.log(`🔍 ANALYZER: [${pagesProcessed}] Processing: ${currentUrl}`);

      const content = await fetchPageWithTimeout(currentUrl, 10000);
      if (!content) continue;

      const extractionResult = extractLinksManually(content, currentUrl);
      let newLinksAdded = 0;
      let addedToPendingQueue = 0;

      extractionResult.forEach((link) => {
        if (!allUrls.some((existing) => existing.url === link.url)) {
          totalLinksFound++;
          const analysis = analyzeUrlPattern(link.url, startUrl);

          const urlData = {
            url: link.url,
            sourceUrl: currentUrl,
            depth: link.depth,
            category: analysis.category,
            pattern: analysis.pattern,
            params: analysis.params,
            linkText: link.linkText || '',
            shouldCrawl: link.shouldCrawl,
          };

          allUrls.push(urlData);
          urlCategories[analysis.category].push({
            url: link.url,
            pattern: analysis.pattern,
            params: analysis.params,
            sourceUrl: currentUrl,
          });

          // Track patterns
          const patternKey = analysis.pattern;
          if (!urlPatterns.has(patternKey)) {
            urlPatterns.set(patternKey, {
              pattern: patternKey,
              count: 0,
              examples: [],
            });
          }
          const patternData = urlPatterns.get(patternKey);
          patternData.count++;
          if (patternData.examples.length < 5) {
            patternData.examples.push(link.url);
          }

          newLinksAdded++;
        }

        if (
          link.depth <= maxDepth &&
          link.shouldCrawl &&
          !visitedUrls.has(link.url) &&
          !pendingUrls.has(link.url)
        ) {
          pendingUrls.set(link.url, {
            depth: link.depth,
            sourceUrl: currentUrl,
          });
          addedToPendingQueue++;
        }
      });

      console.log(`➕ ANALYZER: Added ${newLinksAdded} new URLs, ${addedToPendingQueue} to queue`);

      await batchUtils.delay(1000); // Be respectful
    } catch (error) {
      console.error(`❌ ANALYZER: Error crawling ${currentUrl}:`, error.message);
    }
  }

  console.log(
    `🏁 ANALYZER: Pattern analysis complete! Found ${allUrls.length} URLs, ${pagesProcessed} pages analyzed`
  );

  const patterns = Array.from(urlPatterns.values()).sort((a, b) => b.count - a.count);
  const summary = {
    totalUrls: allUrls.length,
    pagesAnalyzed: pagesProcessed,
    totalLinksFound,
    categories: Object.fromEntries(
      Object.entries(urlCategories).map(([key, urls]) => [key, urls.length])
    ),
    topPatterns: patterns.slice(0, 10),
    recommendations: generateRecommendations(urlCategories, patterns),
    isJavaScriptSite: false,
  };

  return {
    summary,
    categories: urlCategories,
    allPatterns: patterns,
    sampleUrls: {
      pages: urlCategories.pages.slice(0, 20),
      withParams: urlCategories.withParams.slice(0, 20),
      pagination: urlCategories.pagination.slice(0, 20),
      dates: urlCategories.dates.slice(0, 20),
    },
    originalUrl: startUrl,
    analysisType: 'pattern_analysis',
  };
}

// NEW: Helper function for content discovery link extraction (lightweight)
function extractLinksForDiscovery(html, baseUrl, currentDepth) {
  const links = [];
  const baseHostname = new URL(baseUrl).hostname;

  try {
    // Simple regex-based link extraction for speed
    const linkRegex = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
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

// MAIN BRANCH FUNCTIONS - PRESERVED EXACTLY
function extractLinksManually(html, baseUrl) {
  const links = [];
  const baseHostname = new URL(baseUrl).hostname;

  // Find all anchor tags with href attributes
  const anchorRegex = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].trim();

    try {
      // Skip obviously invalid links
      if (
        !href ||
        href.trim() === '' ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) {
        continue;
      }

      // Resolve relative URLs
      let fullUrl;
      if (href.startsWith('http')) {
        fullUrl = href;
      } else {
        fullUrl = new URL(href, baseUrl).toString();
      }

      // Check if internal
      const linkHostname = new URL(fullUrl).hostname;
      const isInternal = linkHostname === baseHostname;
      const shouldCrawl = isInternal && !fullUrl.includes('#');

      links.push({
        url: fullUrl,
        linkText: linkText || 'No text',
        isInternal,
        shouldCrawl,
        depth: 1,
        sourceUrl: baseUrl,
      });
    } catch (error) {
      // Skip invalid URLs
      continue;
    }
  }

  return links;
}

function analyzeUrlPattern(url, baseUrl) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;

  let category = 'other';
  let pattern = pathname;
  let paramInfo = {};

  // Categorize URL
  if (pathname.includes('/admin') || pathname.includes('/wp-admin')) {
    category = 'admin';
  } else if (
    pathname.includes('/api/') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.xml')
  ) {
    category = 'api';
  } else if (pathname.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|mp3|mp4)$/i)) {
    category = 'media';
  } else if (pathname.includes('/page/') || params.has('page') || params.has('p')) {
    category = 'pagination';
    pattern = pathname.replace(/\/page\/\d+/, '/page/[N]').replace(/\d+$/, '[N]');
  } else if (pathname.match(/\/\d{4}\/\d{1,2}/)) {
    category = 'dates';
    pattern = pathname.replace(/\/\d{4}\/\d{1,2}(\/\d{1,2})?/, '/YYYY/MM(/DD)');
  } else if (params.size > 0) {
    category = 'withParams';
    paramInfo = Object.fromEntries(params.entries());
  } else if (pathname.length > 1) {
    category = 'pages';
  }

  // Normalize pattern
  pattern = pattern.replace(/\/\d+/g, '/[ID]');

  return {
    category,
    pattern,
    params: paramInfo,
  };
}

function generateRecommendations(urlCategories, patterns) {
  const recommendations = [];

  if (urlCategories.pagination.length > 50) {
    recommendations.push({
      type: 'warning',
      message: `Found ${urlCategories.pagination.length} pagination URLs. Consider limiting pagination depth.`,
      action: 'Set pagination limit to reduce crawl time',
    });
  }

  if (urlCategories.withParams.length > 100) {
    recommendations.push({
      type: 'warning',
      message: `Found ${urlCategories.withParams.length} URLs with parameters. Many might be duplicates.`,
      action: 'Enable parameter normalization to reduce duplicates',
    });
  }

  if (urlCategories.dates.length > 50) {
    recommendations.push({
      type: 'info',
      message: `Found ${urlCategories.dates.length} date archive URLs. These might not need checking.`,
      action: 'Consider excluding date archives from crawl',
    });
  }

  const realPages = urlCategories.pages.length;
  const totalUrls = Object.values(urlCategories).reduce((sum, cat) => sum + cat.length, 0);

  if (realPages > 0 && realPages < totalUrls * 0.3) {
    recommendations.push({
      type: 'suggestion',
      message: `Only ${realPages} real pages out of ${totalUrls} URLs (${Math.round(
        (realPages / totalUrls) * 100
      )}%).`,
      action: 'Use filtered crawling to focus on actual content pages',
    });
  }

  if (totalUrls > 500) {
    recommendations.push({
      type: 'suggestion',
      message: `Large site detected with ${totalUrls} URLs. Consider using chunked processing.`,
      action: 'Enable large site mode for better performance',
    });
  }

  return recommendations;
}

async function createJavaScriptSiteResponse(startUrl, homepageAnalysis) {
  console.log(`🎭 ANALYZER: Creating JavaScript site response`);

  const recommendations = [];

  recommendations.push({
    type: 'warning',
    message:
      'This site uses JavaScript to load content dynamically. Our analyzer can only see the initial HTML.',
    action:
      'Try enabling JavaScript in a headless browser or check the sitemap for a complete URL list',
  });

  recommendations.push({
    type: 'suggestion',
    message: 'Consider using a different approach for JavaScript-heavy sites.',
    action: 'Look for XML sitemaps or use the direct URL input method instead',
  });

  return {
    summary: {
      totalUrls: 1,
      pagesAnalyzed: 1,
      totalLinksFound: homepageAnalysis.linkCount || 0,
      isJavaScriptSite: true,
      categories: { pages: 1, other: 0 },
      recommendations,
    },
    categories: {
      pages: [{ url: startUrl, pattern: 'homepage', sourceUrl: null }],
      other: [],
    },
    allPatterns: [],
    sampleUrls: { pages: [{ url: startUrl }] },
    originalUrl: startUrl,
    analysisType: 'javascript_site',
  };
}

async function fetchPageWithTimeout(url, timeout = 15000) {
  try {
    // Security validation before fetching
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED fetch in analyzer: ${url} - ${validation.reason}`);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
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
    console.error(`❌ ANALYZER: Error fetching ${url}:`, error.message);
    return null;
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
