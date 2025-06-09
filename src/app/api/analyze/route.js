/**
 * Smart URL Analyzer - Detects JavaScript-heavy sites and provides alternatives
 * Replace the existing /api/analyze/route.js with this file
 */

import { NextRequest, NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { urlUtils, batchUtils } from '@/lib/utils';

export async function POST(request) {
  console.log('🎯 NEW SMART ANALYZER IS RUNNING!');
  console.log('🔧 This should appear in your server logs');
  try {
    const { url, maxDepth = 3, maxPages = 100 } = await request.json();

    console.log(`🔍 Analysis request: ${url}, depth: ${maxDepth}, maxPages: ${maxPages}`);

    if (!urlUtils.isValidUrl(url)) {
      return NextResponse.json(
        {
          error: 'Invalid URL format',
        },
        { status: 400 }
      );
    }

    const analysis = await analyzeUrlsSmart(url, maxDepth, maxPages);

    console.log(`✅ Analysis complete: ${analysis.summary.totalUrls} URLs found`);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('❌ Error analyzing URLs:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze URLs',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

async function analyzeUrlsSmart(startUrl, maxDepth, maxPages) {
  console.log(`🚀 Starting smart URL analysis for: ${startUrl}`);

  // Step 1: Fetch and analyze the homepage
  const homepageAnalysis = await analyzeHomepage(startUrl);

  if (!homepageAnalysis.hasValidContent) {
    console.log(`❌ Homepage analysis failed or detected JavaScript-only site`);
    return createJavaScriptSiteResponse(startUrl, homepageAnalysis);
  }

  // Step 2: If homepage has links, proceed with crawling
  console.log(`✅ Found ${homepageAnalysis.linkCount} links on homepage, proceeding with crawl`);

  return await performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis);
}

async function analyzeHomepage(url) {
  console.log(`🏠 Analyzing homepage: ${url}`);

  const content = await fetchPageWithTimeout(url);

  if (!content) {
    return {
      hasValidContent: false,
      reason: 'fetch_failed',
      content: null,
      linkCount: 0,
    };
  }

  console.log(`📄 Got ${content.length} chars of content`);

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

  console.log(`🔍 Homepage analysis:`, analysis);

  return {
    hasValidContent: analysis.hasLinks && analysis.linkCount > 0,
    reason: analysis.isJavaScriptHeavy ? 'javascript_heavy' : 'static_content',
    content,
    linkCount: analysis.linkCount,
    analysis,
  };
}

async function createJavaScriptSiteResponse(startUrl, homepageAnalysis) {
  console.log(`🎭 Creating JavaScript site response`);

  const recommendations = [];
  const alternatives = [];

  // Try to find alternative sources of URLs
  const sitemapUrls = await tryFindSitemap(startUrl);
  const robotsUrls = await tryFindRobots(startUrl);

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
      urls: sitemapUrls.slice(0, 20), // Show first 20
      total: sitemapUrls.length,
    });
  }

  if (robotsUrls.length > 0) {
    recommendations.push({
      type: 'info',
      message: `Found ${robotsUrls.length} URLs in robots.txt`,
      action: 'Check robots.txt for additional site structure',
    });
  }

  // Suggest common URL patterns to try
  const commonPatterns = generateCommonUrlPatterns(startUrl);
  recommendations.push({
    type: 'suggestion',
    message: 'Try testing common URL patterns manually',
    action: 'Use the broken link checker on specific pages',
  });

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
    commonPatterns,
  };
}

async function performFullCrawl(startUrl, maxDepth, maxPages, homepageAnalysis) {
  console.log(`🕷️ SMART Performing full crawl starting from: ${startUrl}`);

  const linkExtractor = new LinkExtractor({
    includeExternal: false,
    maxLinksPerPage: 1000,
  });

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

  // CRITICAL FIX: Process homepage links we already analyzed
  console.log(`🔧 SMART Processing homepage links from analysis...`);

  try {
    const extractionResult = linkExtractor.extractLinks(homepageAnalysis.content, startUrl, 0);

    console.log(`🔗 SMART Homepage extraction result: ${extractionResult.links.length} links`);

    extractionResult.links.forEach((link, index) => {
      totalLinksFound++;

      console.log(
        `🔗 SMART Processing link ${index + 1}: ${link.url} (internal: ${
          link.isInternal
        }, shouldCrawl: ${link.shouldCrawl})`
      );

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
          depth: link.depth + 1, // IMPORTANT: Increment depth
          sourceUrl: startUrl,
        });
        console.log(`➕ SMART Added to crawl queue: ${link.url} at depth ${link.depth + 1}`);
      }
    });

    console.log(`✅ SMART Processed ${extractionResult.links.length} homepage links`);
    console.log(
      `📊 SMART Categories: ${Object.entries(urlCategories)
        .map(([k, v]) => `${k}:${v.length}`)
        .join(', ')}`
    );
    console.log(`🎯 SMART Queue size: ${pendingUrls.size}, Total URLs: ${allUrls.length}`);
  } catch (error) {
    console.error(`❌ SMART Error processing homepage links:`, error);
  }

  // Mark homepage as visited and remove from pending
  visitedUrls.add(startUrl);
  pagesProcessed = 1;
  pendingUrls.delete(startUrl);

  console.log(`🚀 SMART Starting additional page crawling with ${pendingUrls.size} URLs in queue`);

  // Continue crawling other pages (if any and if depth allows)
  let crawlCount = 0;
  while (pendingUrls.size > 0 && pagesProcessed < maxPages && crawlCount < 10) {
    // Safety limit for now
    console.log(
      `📈 SMART Progress: ${pendingUrls.size} pending, ${pagesProcessed} processed, ${totalLinksFound} total links`
    );

    const iterator = pendingUrls.entries();
    const next = iterator.next();

    if (next.done) break;

    const [currentUrl, metadata] = next.value;
    pendingUrls.delete(currentUrl);
    crawlCount++;

    if (visitedUrls.has(currentUrl)) {
      console.log(`⏭️ SMART Already visited: ${currentUrl}`);
      continue;
    }

    try {
      visitedUrls.add(currentUrl);
      pagesProcessed++;

      console.log(`🔍 SMART [${pagesProcessed}/${maxPages}] Crawling: ${currentUrl}`);

      const pageContent = await fetchPageWithTimeout(currentUrl);
      if (!pageContent) {
        console.log(`❌ SMART No content for: ${currentUrl}`);
        continue;
      }

      const extractionResult = linkExtractor.extractLinks(pageContent, currentUrl, metadata.depth);

      console.log(`🔗 SMART Found ${extractionResult.links.length} links on ${currentUrl}`);

      let newLinksAdded = 0;
      let addedToPendingQueue = 0;

      extractionResult.links.forEach((link) => {
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

      console.log(`➕ SMART Added ${newLinksAdded} new URLs, ${addedToPendingQueue} to queue`);

      await batchUtils.delay(1000); // Be respectful
    } catch (error) {
      console.error(`❌ SMART Error crawling ${currentUrl}:`, error.message);
    }
  }

  console.log(`🏁 SMART Crawl complete! ${allUrls.length} URLs, ${pagesProcessed} pages analyzed`);
  console.log(
    `📊 SMART Final categories:`,
    Object.entries(urlCategories)
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ')
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

  console.log(`🎯 SMART Final summary:`, summary);

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
  };
}

async function tryFindSitemap(baseUrl) {
  console.log(`🗺️ Looking for sitemap at: ${baseUrl}`);

  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).toString(),
    new URL('/sitemap_index.xml', baseUrl).toString(),
    new URL('/sitemaps.xml', baseUrl).toString(),
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`🔍 Trying sitemap: ${sitemapUrl}`);

      const response = await fetch(sitemapUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 Broken Link Checker Bot' },
        timeout: 10000,
      });

      if (response.ok) {
        const content = await response.text();
        console.log(`✅ Found sitemap: ${sitemapUrl} (${content.length} chars)`);

        // Extract URLs from sitemap XML
        const urlMatches = content.match(/<loc>([^<]+)<\/loc>/g) || [];
        const urls = urlMatches.map((match) => match.replace(/<\/?loc>/g, ''));

        console.log(`🔗 Extracted ${urls.length} URLs from sitemap`);
        return urls;
      }
    } catch (error) {
      console.log(`❌ Sitemap not found: ${sitemapUrl}`);
    }
  }

  return [];
}

async function tryFindRobots(baseUrl) {
  console.log(`🤖 Looking for robots.txt at: ${baseUrl}`);

  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const response = await fetch(robotsUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 Broken Link Checker Bot' },
      timeout: 10000,
    });

    if (response.ok) {
      const content = await response.text();
      console.log(`✅ Found robots.txt: ${robotsUrl}`);

      // Extract sitemap URLs from robots.txt
      const sitemapMatches = content.match(/Sitemap:\s*(.+)/gi) || [];
      const sitemapUrls = sitemapMatches.map((match) => match.replace(/Sitemap:\s*/i, '').trim());

      if (sitemapUrls.length > 0) {
        console.log(`🗺️ Found sitemaps in robots.txt:`, sitemapUrls);

        // Try to fetch URLs from these sitemaps
        const allUrls = [];
        for (const sitemapUrl of sitemapUrls) {
          try {
            const sitemapResponse = await fetch(sitemapUrl, { timeout: 10000 });
            if (sitemapResponse.ok) {
              const sitemapContent = await sitemapResponse.text();
              const urlMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) || [];
              const urls = urlMatches.map((match) => match.replace(/<\/?loc>/g, ''));
              allUrls.push(...urls);
            }
          } catch (error) {
            console.log(`❌ Could not fetch sitemap: ${sitemapUrl}`);
          }
        }

        return allUrls;
      }
    }
  } catch (error) {
    console.log(`❌ robots.txt not found or accessible`);
  }

  return [];
}

function generateCommonUrlPatterns(baseUrl) {
  const domain = new URL(baseUrl).origin;

  return [
    `${domain}/about`,
    `${domain}/contact`,
    `${domain}/blog`,
    `${domain}/news`,
    `${domain}/articles`,
    `${domain}/guides`,
    `${domain}/help`,
    `${domain}/support`,
    `${domain}/api`,
    `${domain}/docs`,
  ];
}

async function fetchPageWithTimeout(url, timeout = 15000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    console.error(`❌ Error fetching ${url}:`, error.message);
    return null;
  }
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
      pathname.includes('/admin') ||
      pathname.includes('/wp-admin') ||
      pathname.includes('/wp-content') ||
      pathname.includes('/api/') ||
      pathname.includes('/wp-json/')
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
      '.woff',
      '.ico',
    ];
    if (mediaExtensions.some((ext) => pathname.endsWith(ext))) {
      return { category: 'media', pattern: 'media-files', params: hasParams };
    }

    // Check for date patterns
    const datePattern = /\/(\d{4})\/(\d{1,2})\//;
    if (datePattern.test(pathname)) {
      return { category: 'dates', pattern: 'date-archive', params: hasParams };
    }

    // Check for pagination
    if (
      pathname.includes('/page/') ||
      search.includes('page=') ||
      search.includes('paged=') ||
      pathname.match(/\/\d+\/?$/)
    ) {
      return { category: 'pagination', pattern: 'pagination', params: hasParams };
    }

    // Check for URLs with parameters
    if (hasParams) {
      const paramCount = urlObj.searchParams.size;
      if (paramCount > 3) {
        return { category: 'withParams', pattern: `complex-params-${paramCount}`, params: true };
      }
      return { category: 'withParams', pattern: 'simple-params', params: true };
    }

    // Generate pattern for regular pages
    let pattern = pathname
      .replace(/\/\d+/g, '/[ID]')
      .replace(/\/[a-f0-9-]{32,}/g, '/[HASH]')
      .replace(/\/\d{4}-\d{2}-\d{2}/g, '/[DATE]');

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
