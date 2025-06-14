/**
 * PRODUCTION URL ANALYZER - Fixed version with manual link extraction
 * Replace /src/app/api/analyze/route.js with this version
 */

import { NextRequest, NextResponse } from 'next/server';
import { urlUtils, batchUtils } from '@/lib/utils';
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

    const { url, maxDepth = 3, maxPages = 100 } = requestValidation.data;

    console.log(
      `🔍 PRODUCTION: Starting analysis for ${url}, depth: ${maxDepth}, maxPages: ${maxPages}`
    );

    if (!urlUtils.isValidUrl(url)) {
      return await handleValidationError(new Error('Invalid URL format'), request);
    }

    //Security validation for Smart Analyzer
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

    //Check robots.txt for analyzer
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

    const analysis = await analyzeUrlsSmart(url, maxDepth, maxPages);

    console.log(`✅ PRODUCTION: Analysis complete: ${analysis.summary.totalUrls} URLs found`);

    return NextResponse.json(analysis, { headers: securityHeaders });
  } catch (error) {
    console.error('❌ PRODUCTION: Error analyzing URLs:', error);

    return await errorHandler.handleError(error, request, {
      step: 'url_analysis',
      url: body?.url,
      maxDepth: body?.maxDepth,
      maxPages: body?.maxPages,
    });
  }
}

async function analyzeUrlsSmart(startUrl, maxDepth, maxPages) {
  console.log(`🚀 PRODUCTION: Starting smart URL analysis for: ${startUrl}`);

  // Step 1: Fetch and analyze the homepage
  const homepageAnalysis = await analyzeHomepage(startUrl);

  if (!homepageAnalysis.hasValidContent) {
    console.log(`❌ PRODUCTION: Homepage analysis failed or detected JavaScript-only site`);
    return createJavaScriptSiteResponse(startUrl, homepageAnalysis);
  }

  // Step 2: If homepage has links, proceed with crawling
  console.log(
    `✅ PRODUCTION: Found ${homepageAnalysis.linkCount} links on homepage, proceeding with crawl`
  );

  return await performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis);
}

async function analyzeHomepage(url) {
  console.log(`🏠 PRODUCTION: Analyzing homepage: ${url}`);

  const content = await fetchPageWithTimeout(url);

  if (!content) {
    return {
      hasValidContent: false,
      reason: 'fetch_failed',
      content: null,
      linkCount: 0,
    };
  }

  console.log(`📄 PRODUCTION: Got ${content.length} chars of content`);

  // Analyze content quality
  const analysis = {
    hasHtml: content.includes('<html') || content.includes('<!DOCTYPE'),
    hasBody: content.includes('<body'),
    hasLinks: content.includes('href='),
    hasScripts: content.includes('<script'),
    linkCount: (content.match(/href\s*=\s*["']([^"']+)["']/gi) || []).length,
    isJavaScriptHeavy: false,
    frameworkDetection: {},
  };

  // Detect JavaScript frameworks
  analysis.frameworkDetection = {
    react: content.includes('react') || content.includes('React') || content.includes('_react'),
    vue: content.includes('vue') || content.includes('Vue'),
    angular: content.includes('angular') || content.includes('Angular'),
    next: content.includes('next') || content.includes('Next') || content.includes('_next'),
    nuxt: content.includes('nuxt') || content.includes('Nuxt'),
    svelte: content.includes('svelte') || content.includes('Svelte'),
  };

  // Check for signs of JavaScript-heavy site
  const jsIndicators = [
    content.includes('Loading...'),
    content.includes('loading...'),
    content.includes('id="app"'),
    content.includes('id="root"'),
    content.includes('class="app"'),
    analysis.linkCount < 3 && analysis.hasScripts,
    Object.values(analysis.frameworkDetection).some((v) => v),
  ];

  analysis.isJavaScriptHeavy = jsIndicators.filter(Boolean).length >= 2;

  console.log(`🔍 PRODUCTION: Homepage analysis:`, analysis);

  return {
    hasValidContent: analysis.hasLinks && analysis.linkCount > 0,
    reason: analysis.isJavaScriptHeavy ? 'javascript_heavy' : 'static_content',
    content,
    linkCount: analysis.linkCount,
    analysis,
  };
}

async function performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis) {
  console.log(`🕷️ PRODUCTION: Performing full crawl starting from: ${startUrl}`);

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
  const contentPages = [];
  const allPages = [];
  let pagesProcessed = 0;
  let totalLinksFound = 0;

  // Process homepage links first
  console.log(`🔧 PRODUCTION: Processing homepage links...`);

  try {
    const extractionResult = extractLinksManually(homepageAnalysis.content, startUrl);
    // NEW: Classify if this is a content page
    const isContent = isContentPage(startUrl, homepageAnalysis.content, extractionResult);
    if (isContent) {
      contentPages.push({
        url: startUrl,
        title: extractPageTitle(homepageAnalysis.content),
        linkCount: extractionResult.length,
      });
    }

    allPages.push({
      url: startUrl,
      type: isContent ? 'content' : 'other',
      title: extractPageTitle(homepageAnalysis.content),
    });
    console.log(`🔗 PRODUCTION: Homepage extraction result: ${extractionResult.length} links`);

    extractionResult.forEach((link, index) => {
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

      // Add to pending if should crawl and within depth
      if (link.depth < maxDepth && link.shouldCrawl && !pendingUrls.has(link.url)) {
        pendingUrls.set(link.url, {
          depth: link.depth + 1,
          sourceUrl: startUrl,
        });
      }
    });

    console.log(`✅ PRODUCTION: Processed ${extractionResult.length} homepage links`);
    console.log(
      `📊 PRODUCTION: Categories: ${Object.entries(urlCategories)
        .map(([k, v]) => `${k}:${v.length}`)
        .join(', ')}`
    );
  } catch (error) {
    console.error(`❌ PRODUCTION: Error processing homepage links:`, error);
  }

  // Mark homepage as visited
  visitedUrls.add(startUrl);
  pagesProcessed = 1;
  pendingUrls.delete(startUrl);

  console.log(
    `🚀 PRODUCTION: Starting additional page crawling with ${pendingUrls.size} URLs in queue`
  );

  // Continue crawling other pages (limited for performance)
  let crawlCount = 0;
  const maxAdditionalPages = Math.min(maxPages - 1, 499); // Limit additional crawling

  while (pendingUrls.size > 0 && crawlCount < maxAdditionalPages) {
    console.log(
      `📈 PRODUCTION: Progress: ${pendingUrls.size} pending, ${pagesProcessed} processed, ${totalLinksFound} total links`
    );

    const iterator = pendingUrls.entries();
    const next = iterator.next();

    if (next.done) break;

    const [currentUrl, metadata] = next.value;
    pendingUrls.delete(currentUrl);
    crawlCount++;

    if (visitedUrls.has(currentUrl)) continue;

    try {
      visitedUrls.add(currentUrl);
      pagesProcessed++;

      console.log(`🔍 PRODUCTION: [${pagesProcessed}/${maxPages}] Crawling: ${currentUrl}`);

      const pageContent = await fetchPageWithTimeout(currentUrl, 10000); // Shorter timeout
      if (!pageContent) {
        console.log(`❌ PRODUCTION: No content for: ${currentUrl}`);
        continue;
      }

      const extractionResult = extractLinksManually(pageContent, currentUrl);

      const isContent = isContentPage(currentUrl, pageContent, extractionResult);
      if (isContent) {
        contentPages.push({
          url: currentUrl,
          title: extractPageTitle(pageContent),
          linkCount: extractionResult.length,
        });
      }

      allPages.push({
        url: currentUrl,
        type: isContent ? 'content' : 'other',
        title: extractPageTitle(pageContent),
      });

      console.log(`🔗 PRODUCTION: Found ${extractionResult.length} links on ${currentUrl}`);

      let newLinksAdded = 0;
      let addedToPendingQueue = 0;

      extractionResult.forEach((link) => {
        totalLinksFound++;

        if (!allUrls.find((u) => u.url === link.url)) {
          const analysis = analyzeUrlPattern(link.url, startUrl);

          allUrls.push({
            url: link.url,
            sourceUrl: currentUrl,
            depth: link.depth,
            category: analysis.category,
            pattern: analysis.pattern,
            params: analysis.params,
            linkText: link.linkText || '',
            shouldCrawl: link.shouldCrawl,
          });

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

      console.log(
        `➕ PRODUCTION: Added ${newLinksAdded} new URLs, ${addedToPendingQueue} to queue`
      );

      await batchUtils.delay(1000); // Be respectful
    } catch (error) {
      console.error(`❌ PRODUCTION: Error crawling ${currentUrl}:`, error.message);
    }
  }

  console.log(
    `🏁 PRODUCTION: Crawl complete! ${allUrls.length} URLs, ${pagesProcessed} pages analyzed`
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
    summary: {
      ...summary, // Keep all existing summary fields
      contentPages: contentPages.length, // ADD: Count of content pages
      filteredOut: allPages.length - contentPages.length, // ADD: Count of filtered pages
    },
    contentPages: contentPages, // ADD: Array of content pages
    allPages: allPages, // ADD: Array of all pages discovered
    categories: urlCategories, // KEEP: Existing categories for UI
    allPatterns: patterns, // KEEP: Existing patterns for UI
    sampleUrls: {
      // KEEP: Existing sample URLs for UI
      pages: urlCategories.pages.slice(0, 20),
      withParams: urlCategories.withParams.slice(0, 20),
      pagination: urlCategories.pagination.slice(0, 20),
      dates: urlCategories.dates.slice(0, 20),
    },
  };
}

function isContentPage(url, html, extractionResult) {
  // Rule 1: URL-based filters (reject obvious junk)
  if (
    url.includes('/page/') ||
    url.includes('/admin') ||
    url.includes('wp-admin') ||
    /\/\d{4}\/\d{2}\//.test(url) || // date archives like /2023/01/
    url.includes('?page=') ||
    url.includes('&page=')
  ) {
    return false;
  }

  // Rule 2: Content-based filters
  const title = extractPageTitle(html);
  if (!title || title.length < 10) return false;

  // Rule 3: Must have reasonable content
  if (!html || html.length < 2000) return false;

  // Rule 4: Should have some links (but not too many like pagination)
  const linkCount = extractionResult?.length || 0;
  if (linkCount < 3 || linkCount > 200) return false;

  return true;
}

function extractPageTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : '';
}

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

async function createJavaScriptSiteResponse(startUrl, homepageAnalysis) {
  console.log(`🎭 PRODUCTION: Creating JavaScript site response`);

  const recommendations = [];
  const alternatives = [];

  // Try to find alternative sources of URLs
  const sitemapUrls = await tryFindSitemap(startUrl);

  recommendations.push({
    type: 'warning',
    message:
      'This site uses JavaScript to load content dynamically. Our analyzer can only see the initial HTML.',
    action: 'Try the full broken link checker instead - it may work better with JavaScript sites',
  });

  if (sitemapUrls.length > 0) {
    recommendations.push({
      type: 'info',
      message: `Found ${sitemapUrls.length} URLs in sitemap.xml`,
      action: 'Use sitemap URLs for a more complete analysis',
    });
    alternatives.push({
      type: 'sitemap',
      urls: sitemapUrls.slice(0, 20),
      total: sitemapUrls.length,
    });
  }

  return {
    summary: {
      totalUrls: sitemapUrls.length,
      pagesAnalyzed: 1,
      totalLinksFound: 0,
      categories: {
        pages: sitemapUrls.length,
        withParams: 0,
        pagination: 0,
        dates: 0,
        media: 0,
        admin: 0,
        api: 0,
        other: 0,
      },
      topPatterns: [],
      recommendations,
      isJavaScriptSite: true,
      frameworks: homepageAnalysis.analysis?.frameworkDetection || {},
    },
    categories: {
      pages: sitemapUrls.map((url) => ({
        url,
        pattern: 'sitemap-discovered',
        params: false,
        sourceUrl: 'sitemap.xml',
      })),
      withParams: [],
      pagination: [],
      dates: [],
      media: [],
      admin: [],
      api: [],
      other: [],
    },
    allPatterns: [],
    sampleUrls: {
      pages: sitemapUrls
        .slice(0, 20)
        .map((url) => ({ url, pattern: 'sitemap', sourceUrl: 'sitemap.xml' })),
      withParams: [],
      pagination: [],
      dates: [],
    },
    alternatives,
  };
}

async function tryFindSitemap(baseUrl) {
  console.log(`🗺️ PRODUCTION: Looking for sitemap at: ${baseUrl}`);

  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).toString(),
    new URL('/sitemap_index.xml', baseUrl).toString(),
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 Broken Link Checker Bot' },
        timeout: 10000,
      });

      if (response.ok) {
        const content = await response.text();
        const urlMatches = content.match(/<loc>([^<]+)<\/loc>/g) || [];
        const urls = urlMatches.map((match) => match.replace(/<\/?loc>/g, ''));

        if (urls.length > 0) {
          console.log(`✅ PRODUCTION: Found sitemap with ${urls.length} URLs`);
          return urls;
        }
      }
    } catch (error) {
      // Continue to next sitemap
    }
  }

  return [];
}

function analyzeUrlPattern(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    if (urlObj.hostname !== baseUrlObj.hostname) {
      return { category: 'other', pattern: 'external-domain', params: false };
    }

    const pathname = urlObj.pathname.toLowerCase();
    const search = urlObj.search;
    const hasParams = search.length > 0;

    // Check for admin/system URLs
    if (
      pathname.includes('/wp-admin') ||
      pathname.includes('/admin') ||
      pathname.includes('/wp-content') ||
      pathname.includes('/api/')
    ) {
      return { category: 'admin', pattern: 'admin-system', params: hasParams };
    }

    // Check for media files
    const mediaExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.pdf',
      '.css',
      '.js',
      '.ico',
    ];
    if (mediaExtensions.some((ext) => pathname.endsWith(ext))) {
      return { category: 'media', pattern: 'media-files', params: hasParams };
    }

    // Check for date patterns (blog archives)
    if (/\/\d{4}\/\d{1,2}\//.test(pathname)) {
      return { category: 'dates', pattern: 'date-archive', params: hasParams };
    }

    // Check for pagination
    if (pathname.includes('/page/') || search.includes('page=') || pathname.match(/\/\d+\/?$/)) {
      return { category: 'pagination', pattern: 'pagination', params: hasParams };
    }

    // Check for URLs with parameters
    if (hasParams) {
      const paramCount = urlObj.searchParams.size;
      return {
        category: 'withParams',
        pattern: paramCount > 3 ? `complex-params-${paramCount}` : 'simple-params',
        params: true,
      };
    }

    // Regular content pages
    let pattern = pathname.replace(/\/\d+/g, '/[ID]').replace(/\/[a-f0-9-]{32,}/g, '/[HASH]');
    const pathParts = pattern.split('/').filter((p) => p.length > 0);
    if (pathParts.length > 4) {
      pattern = '/' + pathParts.slice(0, 3).join('/') + '/[...]';
    }

    return {
      category: 'pages',
      pattern: pattern || '/',
      params: hasParams,
    };
  } catch (error) {
    return { category: 'other', pattern: 'invalid-url', params: false };
  }
}

function generateRecommendations(categories, patterns) {
  const recommendations = [];

  if (categories.pagination.length > 50) {
    recommendations.push({
      type: 'warning',
      message: `Found ${categories.pagination.length} pagination URLs. Consider limiting pagination depth.`,
      action: 'Set pagination limit to reduce crawl time',
    });
  }

  if (categories.withParams.length > 100) {
    recommendations.push({
      type: 'warning',
      message: `Found ${categories.withParams.length} URLs with parameters. Many might be duplicates.`,
      action: 'Enable parameter normalization to reduce duplicates',
    });
  }

  if (categories.dates.length > 50) {
    recommendations.push({
      type: 'info',
      message: `Found ${categories.dates.length} date archive URLs. These might not need checking.`,
      action: 'Consider excluding date archives from crawl',
    });
  }

  const realPages = categories.pages.length;
  const totalUrls = Object.values(categories).reduce((sum, cat) => sum + cat.length, 0);

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

async function fetchPageWithTimeout(url, timeout = 15000) {
  try {
    //Security validation before fetching
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED fetch in analyzer: ${url} - ${validation.reason}`);
      return null; // Return null instead of throwing to maintain existing flow
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
    console.error(`❌ PRODUCTION: Error fetching ${url}:`, error.message);
    return null;
  }
}
