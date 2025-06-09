/**
 * URL Analyzer - Discovers and categorizes all URLs without checking them
 * Shows what types of URLs exist before running a full crawl
 */

import { NextRequest, NextResponse } from 'next/server';
import { LinkExtractor } from '@/lib/linkExtractor';
import { urlUtils, batchUtils } from '@/lib/utils';

export async function POST(request) {
  try {
    const { url, maxDepth = 3, maxPages = 100 } = await request.json(); // Reduced maxPages for testing

    console.log(`Analysis request: ${url}, depth: ${maxDepth}, maxPages: ${maxPages}`);

    if (!urlUtils.isValidUrl(url)) {
      return NextResponse.json(
        {
          error: 'Invalid URL format',
        },
        { status: 400 }
      );
    }

    const analysis = await analyzeUrls(url, maxDepth, maxPages);

    console.log(`Analysis complete: ${analysis.summary.totalUrls} URLs found`);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing URLs:', error);
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

async function analyzeUrls(startUrl, maxDepth, maxPages) {
  const linkExtractor = new LinkExtractor({
    includeExternal: false,
    maxLinksPerPage: 2000,
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

  console.log(
    `Starting URL analysis for: ${startUrl} (max depth: ${maxDepth}, max pages: ${maxPages})`
  );

  while (pendingUrls.size > 0 && pagesProcessed < maxPages) {
    console.log(`Queue status: ${pendingUrls.size} pending, ${pagesProcessed} processed`);

    const batch = [];
    const iterator = pendingUrls.entries();

    // Get batch of URLs to process (smaller batches for analysis)
    for (let i = 0; i < 3 && batch.length < 3; i++) {
      // Even smaller batches
      const next = iterator.next();
      if (next.done) break;

      const [url, metadata] = next.value;
      batch.push({ url, ...metadata });
      pendingUrls.delete(url);
    }

    if (batch.length === 0) {
      console.log('No more URLs in batch, breaking');
      break;
    }

    console.log(`Processing batch: ${batch.map((b) => b.url).join(', ')}`);

    // Process batch for link discovery
    for (const urlData of batch) {
      try {
        if (visitedUrls.has(urlData.url)) {
          console.log(`Already visited: ${urlData.url}`);
          continue;
        }
        visitedUrls.add(urlData.url);
        pagesProcessed++;

        console.log(`Analyzing page ${pagesProcessed}: ${urlData.url}`);

        // Quick fetch to get page content
        const pageContent = await fetchPageQuickly(urlData.url);
        if (!pageContent) {
          console.log(`No content received for: ${urlData.url}`);
          continue;
        }

        console.log(`Got content for ${urlData.url}, extracting links...`);

        // Extract all links from this page
        const extractionResult = linkExtractor.extractLinks(
          pageContent,
          urlData.url,
          urlData.depth
        );

        console.log(`Found ${extractionResult.links.length} links on ${urlData.url}`);

        // Analyze and categorize each discovered URL
        let newLinksAdded = 0;
        extractionResult.links.forEach((link) => {
          if (!allUrls.find((u) => u.url === link.url)) {
            const analysis = analyzeUrlPattern(link.url, startUrl);

            allUrls.push({
              url: link.url,
              sourceUrl: urlData.url,
              depth: link.depth,
              category: analysis.category,
              pattern: analysis.pattern,
              params: analysis.params,
              linkText: link.linkText,
            });

            // Categorize URL
            urlCategories[analysis.category].push({
              url: link.url,
              pattern: analysis.pattern,
              params: analysis.params,
              sourceUrl: urlData.url,
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

          // Add to pending queue if within depth and should crawl
          if (
            link.depth <= maxDepth &&
            link.shouldCrawl &&
            !visitedUrls.has(link.url) &&
            !pendingUrls.has(link.url)
          ) {
            pendingUrls.set(link.url, {
              depth: link.depth,
              sourceUrl: urlData.url,
            });
          }
        });

        console.log(`Added ${newLinksAdded} new URLs to analysis, ${pendingUrls.size} now pending`);

        // Small delay to be respectful
        await batchUtils.delay(500); // Longer delay
      } catch (error) {
        console.error(`Error analyzing ${urlData.url}:`, error);
      }
    }

    // Delay between batches
    await batchUtils.delay(1000); // Longer delay between batches
  }

  // Generate summary statistics
  const patterns = Array.from(urlPatterns.values()).sort((a, b) => b.count - a.count);

  const summary = {
    totalUrls: allUrls.length,
    pagesAnalyzed: pagesProcessed,
    categories: Object.fromEntries(
      Object.entries(urlCategories).map(([key, urls]) => [key, urls.length])
    ),
    topPatterns: patterns.slice(0, 10),
    recommendations: generateRecommendations(urlCategories, patterns),
  };

  return {
    summary,
    categories: urlCategories,
    allPatterns: patterns,
    sampleUrls: {
      pages: urlCategories.pages.slice(0, 10),
      withParams: urlCategories.withParams.slice(0, 10),
      pagination: urlCategories.pagination.slice(0, 10),
      dates: urlCategories.dates.slice(0, 10),
    },
  };
}

function analyzeUrlPattern(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseDomain = new URL(baseUrl).hostname;

    // Basic categorization
    const pathname = urlObj.pathname.toLowerCase();
    const search = urlObj.search;
    const hasParams = search.length > 0;

    // Check for admin/system URLs
    if (
      pathname.includes('/admin') ||
      pathname.includes('/wp-admin') ||
      pathname.includes('/wp-content') ||
      pathname.includes('/api/')
    ) {
      return { category: 'admin', pattern: 'admin-system', params: hasParams };
    }

    // Check for media files
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.pdf', '.css', '.js'];
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

    // Check for URLs with many parameters
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

    // Simplify long patterns
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

  // Check for excessive pagination
  if (categories.pagination.length > 50) {
    recommendations.push({
      type: 'warning',
      message: `Found ${categories.pagination.length} pagination URLs. Consider limiting pagination depth.`,
      action: 'Set pagination limit to reduce crawl time',
    });
  }

  // Check for parameter explosion
  if (categories.withParams.length > 100) {
    recommendations.push({
      type: 'warning',
      message: `Found ${categories.withParams.length} URLs with parameters. Many might be duplicates.`,
      action: 'Enable parameter normalization to reduce duplicates',
    });
  }

  // Check for date archives
  if (categories.dates.length > 50) {
    recommendations.push({
      type: 'info',
      message: `Found ${categories.dates.length} date archive URLs. These might not need checking.`,
      action: 'Consider excluding date archives from crawl',
    });
  }

  // Check for media files
  if (categories.media.length > 200) {
    recommendations.push({
      type: 'info',
      message: `Found ${categories.media.length} media file URLs.`,
      action: 'Media files are automatically excluded from crawling',
    });
  }

  // Overall assessment
  const realPages = categories.pages.length;
  const totalUrls = Object.values(categories).reduce((sum, cat) => sum + cat.length, 0);

  if (realPages < totalUrls * 0.3) {
    recommendations.push({
      type: 'suggestion',
      message: `Only ${realPages} real pages out of ${totalUrls} URLs (${Math.round(
        (realPages / totalUrls) * 100
      )}%).`,
      action: 'Use filtered crawling to focus on actual content pages',
    });
  }

  return recommendations;
}

async function fetchPageQuickly(url) {
  try {
    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Link Analyzer Bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
      // Don't use AbortController in serverless - can cause issues
      timeout: 10000,
    });

    console.log(`Response for ${url}: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const content = await response.text();
        console.log(`Content length for ${url}: ${content.length} chars`);
        return content;
      } else {
        console.log(`Skipping ${url} - not HTML (${contentType})`);
      }
    } else {
      console.log(`Failed to fetch ${url}: ${response.status}`);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}
