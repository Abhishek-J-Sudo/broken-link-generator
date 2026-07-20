/**
 * PRODUCTION URL ANALYZER - Updated version with increased crawl limit
 * Replace /src/app/api/analyze/route.js with this version
 */

import { NextRequest, NextResponse } from 'next/server';
import { urlUtils, batchUtils } from '@/lib/utils';
import { securityUtils } from '@/lib/security';
import { safeFetch } from '@/lib/safeFetch';
import { validateAnalysisRequest, validateAdvancedRateLimit } from '@/lib/validation';
import { errorHandler, handleValidationError, handleSecurityError } from '@/lib/errorHandler';
import { getClientIp } from '@/lib/clientIp';
import { csrfProtect, CsrfError } from '@/lib/csrf';
import { getDeepSeekRecommendations } from '@/lib/deepseekRecommendations';
import { detectJsRendering } from '@/lib/jsSiteDetector';
import { findSitemapUrls } from '@/lib/sitemap';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function POST(request) {
  try {
    await csrfProtect(request, new NextResponse());
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403, headers: securityHeaders });
    }
    throw e;
  }

  try {
    // Rate limiting for analysis (more restrictive)
    const clientIP = getClientIp(request);
    const rateLimit = await validateAdvancedRateLimit(clientIP, 'analyze');

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

    console.log(
      `✅ PRODUCTION: Analysis complete: ${analysis.summary.totalUrls} URLs found, ${
        analysis.summary.totalLinksFound || 'N/A'
      } total links discovered`
    );

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

  const result = await performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis);

  // JS-heavy but still crawlable (e.g. a rendered shell with a few nav links):
  // crawl what the HTML shows, then top up the page list from the sitemap so
  // client-rendered routes aren't invisible to the audit.
  if (homepageAnalysis.analysis?.isJavaScriptHeavy) {
    await supplementWithSitemap(result, startUrl, homepageAnalysis);
  }

  return result;
}

async function supplementWithSitemap(result, startUrl, homepageAnalysis) {
  console.log(`🎭 PRODUCTION: JS-heavy site — supplementing scope from sitemap`);

  result.summary.isJavaScriptSite = true;
  result.summary.frameworks = homepageAnalysis.analysis?.frameworkDetection || {};

  const sitemapUrls = await findSitemapUrls(startUrl);
  const known = new Set(
    [...result.categories.pages, ...(result.discoveredLinks || [])].map((entry) =>
      entry.url.replace(/\/$/, '')
    )
  );
  const fresh = sitemapUrls.filter((url) => !known.has(url.replace(/\/$/, '')));

  for (const url of fresh) {
    result.categories.pages.push({
      url,
      pattern: 'sitemap-discovered',
      params: false,
      sourceUrl: 'sitemap.xml',
    });
    result.discoveredLinks.push({
      url,
      sourceUrl: 'sitemap.xml',
      category: 'pages',
      linkText: 'Sitemap link',
    });
  }

  result.summary.totalUrls += fresh.length;
  result.summary.categories.pages += fresh.length;
  result.summary.sitemapSupplemented = fresh.length;

  result.summary.recommendations.push({
    type: 'warning',
    message:
      'This site renders part of its content with JavaScript, so the sampler may miss links.' +
      (fresh.length > 0 ? ` Added ${fresh.length} pages from the sitemap to fill the gaps.` : ''),
    action:
      fresh.length > 0
        ? 'Run a Full Audit — the sitemap pages are included in its scope'
        : 'No sitemap found — page counts for this site may run low',
  });
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

  // Analyze content quality. Anchor-only counting matters here: the old bare
  // `href=` regex also matched stylesheet/favicon links, so CSR shells always
  // passed as "has links" and the JavaScript-site path never fired.
  const detection = detectJsRendering(content);
  const analysis = {
    hasHtml: content.includes('<html') || content.includes('<!DOCTYPE'),
    hasBody: content.includes('<body'),
    hasLinks: detection.anchorCount > 0,
    hasScripts: detection.hasScripts,
    linkCount: detection.anchorCount,
    isJavaScriptHeavy: detection.isJavaScriptHeavy,
    frameworkDetection: detection.frameworks,
    hasEmptyAppShell: detection.hasEmptyAppShell,
  };

  console.log(`🔍 PRODUCTION: Homepage analysis:`, analysis);

  return {
    hasValidContent: analysis.linkCount > 0,
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

  let pagesProcessed = 0;
  let totalLinksFound = 0;
  let totalLinkOccurrences = 0;

  // Process homepage links first
  console.log(`🔧 PRODUCTION: Processing homepage links...`);

  try {
    const extractionResult = extractLinksManually(homepageAnalysis.content, startUrl);

    console.log(`🔗 PRODUCTION: Homepage extraction result: ${extractionResult.length} links`);

    extractionResult.forEach((link, index) => {
      totalLinksFound++;
      totalLinkOccurrences++;

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

  // 🔥 MAIN CHANGE: Increase additional crawling limit to ~99 pages (total 100)
  let crawlCount = 0;
  const maxAdditionalPages = Math.min(maxPages - 1, 99); // INCREASED from 20 to 80

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

      console.log(`🔗 PRODUCTION: Found ${extractionResult.length} links on ${currentUrl}`);

      let newLinksAdded = 0;
      let addedToPendingQueue = 0;

      extractionResult.forEach((link) => {
        totalLinkOccurrences++;
        if (!allUrls.find((u) => u.url === link.url)) {
          const analysis = analyzeUrlPattern(link.url, startUrl);
          totalLinksFound++;

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
    `🏁 PRODUCTION: Crawl complete! ${allUrls.length} URLs, ${pagesProcessed} pages analyzed, ${totalLinksFound} total links discovered`
  );

  const patterns = Array.from(urlPatterns.values()).sort((a, b) => b.count - a.count);
  const categoryCounts = Object.fromEntries(
    Object.entries(urlCategories).map(([key, urls]) => [key, urls.length])
  );
  const fallbackRecommendations = generateRecommendations(urlCategories, patterns);
  const aiAnalysis = await getDeepSeekRecommendations({
    categoryCounts,
    topPatterns: patterns,
  });

  const summary = {
    totalUrls: allUrls.length,
    pagesAnalyzed: pagesProcessed,
    totalLinksFound,
    categories: categoryCounts,
    topPatterns: patterns.slice(0, 10),
    recommendations: aiAnalysis?.recommendations || fallbackRecommendations,
    recommendationsSource: aiAnalysis ? 'ai' : 'rules',
    recommendationModel: aiAnalysis?.model || null,
    recommendationUsage: aiAnalysis?.usage || null,
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
    totalLinkOccurrences, // including duplicates
    linkRedundancy: Math.round((totalLinkOccurrences / Math.max(totalLinksFound, 1)) * 10) / 10,
    // 🔥 NEW: Include discovered links for "Check All Links" option
    discoveredLinks: allUrls.map((url) => ({
      url: url.url,
      sourceUrl: url.sourceUrl,
      category: url.category,
      linkText: url.linkText,
    })),
  };
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
  const sitemapUrls = await findSitemapUrls(startUrl);

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
      totalLinksFound: 0, // 🔥 NEW: Add for consistency
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
    // 🔥 NEW: Include discovered links for consistency
    discoveredLinks: sitemapUrls.map((url) => ({
      url,
      sourceUrl: 'sitemap.xml',
      category: 'pages',
      linkText: 'Sitemap link',
    })),
  };
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

// TODO: Replace this with DeepSeek V4 Flash API call (OpenAI-compatible, ~$0.0004/call).
// Send categories + patterns, get real AI analysis instead of these hardcoded thresholds.
// Needs DEEPSEEK_API_KEY env var and base URL https://api.deepseek.com
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
    const response = await safeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
      },
      timeout,
      readBody: true,
    });

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
