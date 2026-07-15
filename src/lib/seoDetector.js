// src/lib/seoDetector.js - Lightweight SEO analysis for content pages
// Parses only the first 50KB of each page to bound memory per crawl worker

import * as cheerio from 'cheerio';

export class LightweightSEODetector {
  constructor(options = {}) {
    this.options = {
      enableImageChecks: true,
      enableStructureChecks: true,
      enableMetaChecks: true,
      maxContentLength: 50000, // Only analyze first 50KB to save memory
      ...options,
    };
  }

  /**
   * Analyze SEO basics from existing HTTP response
   * Reuses the HTML content already fetched for link checking
   *
   * context (all optional):
   *   headers   — { 'x-robots-tag', 'last-modified' } from the page response
   *   robotsTxt — result of robotsAudit.evaluateRobots() for this URL
   */
  analyzePage(html, url, statusCode, responseTime, context = {}) {
    // Skip SEO analysis for non-content pages or errors
    if (!html || statusCode >= 400 || !this.isContentPage(url)) {
      return null;
    }

    // Truncate HTML to bound memory; the parser tolerates a mid-tag cut
    const analyzableHtml = html.substring(0, this.options.maxContentLength);

    try {
      const $ = cheerio.load(analyzableHtml);

      // Word count mutates the DOM (strips script/style), so run it last
      const title = this.extractTitle($);
      const metaDescription = this.extractMetaDescription($);
      const metaKeywords = this.extractMetaKeywords($);
      const canonicalUrl = this.extractCanonical($);
      const headings = this.analyzeHeadings($);
      const images = this.analyzeImages($);
      const robots = this.extractRobotsDirectives($, context.headers?.['x-robots-tag']);
      const social = this.extractSocialTags($);
      const structuredData = this.extractStructuredData($);
      const fundamentals = this.extractFundamentals($, url);
      const freshness = this.extractFreshness($, structuredData, context.headers?.['last-modified']);
      const wordCount = this.estimateWordCount($);

      const seoData = {
        url,
        analyzedAt: new Date().toISOString(),

        // Basic Meta Tags
        title,
        metaDescription,
        metaKeywords,
        canonicalUrl,

        // Content Structure (measured on the first 50KB only)
        headings,
        contentLength: analyzableHtml.length,
        wordCount,

        // Images (measured on the first 50KB only)
        images,

        // Technical SEO (from existing data)
        technical: {
          statusCode,
          responseTime,
          isHttps: url.startsWith('https://'),
          hasTrailingSlash: url.endsWith('/'),
        },

        // Deeper per-page signals (doc 04 §G batch: G2/G3/G8/G9/G10/G14/G15).
        // Persisted as one JSONB column; scored below like everything else.
        signals: {
          robots,
          social,
          structuredData,
          fundamentals,
          freshness,
          robotsTxt: context.robotsTxt || null,
          // outline lives here because seo_analysis only has h1–h3 count columns
          headings: {
            outline: headings.outline.slice(0, 40),
            firstHeading: headings.firstHeading,
            skippedLevels: headings.skippedLevels,
            headingsBeforeH1: headings.headingsBeforeH1,
            totalHeadings: headings.totalHeadings,
          },
        },

        // SEO Score (simple calculation)
        score: 0, // Will be calculated
        issues: [], // Will be populated
      };

      // Calculate simple SEO score and issues
      this.calculateSEOScore(seoData);

      return seoData;
    } catch (error) {
      console.error('SEO analysis error:', error.message);
      return {
        url,
        error: error.message,
        analyzedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if URL is worth SEO analysis (content pages only)
   */
  isContentPage(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      // Skip non-content URLs to save resources
      const skipPatterns = [
        '/api/',
        '/admin/',
        '/wp-admin/',
        '/wp-content/',
        '.css',
        '.js',
        '.xml',
        '.json',
        '.pdf',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '/feed',
        '/rss',
        '/sitemap',
      ];

      return !skipPatterns.some((pattern) => pathname.includes(pattern));
    } catch {
      return false;
    }
  }

  /**
   * Extract page title — first <title> that is not inside an inline <svg>
   */
  extractTitle($) {
    const titleEl = $('title')
      .filter((_, el) => $(el).closest('svg').length === 0)
      .first();
    const title = titleEl.length ? titleEl.text().replace(/\s+/g, ' ').trim() : '';

    return {
      text: title.substring(0, 200), // Limit to save space
      length: title.length,
      isEmpty: !title,
      isTooLong: title.length > 60,
      isTooShort: title.length < 50,
    };
  }

  /**
   * Find a <meta> tag by name/property attribute (case-insensitive, attribute-order independent)
   */
  findMetaContent($, key, attr = 'name') {
    const meta = $('meta')
      .filter((_, el) => (el.attribs[attr] || '').trim().toLowerCase() === key)
      .first();
    return meta.length ? (meta.attr('content') || '').trim() : '';
  }

  /**
   * Extract meta description
   */
  extractMetaDescription($) {
    const description = this.findMetaContent($, 'description');

    return {
      text: description.substring(0, 300),
      length: description.length,
      isEmpty: !description,
      isTooLong: description.length > 160,
      isTooShort: description.length < 150,
    };
  }

  /**
   * Extract meta keywords (if present)
   */
  extractMetaKeywords($) {
    const keywords = this.findMetaContent($, 'keywords');
    return keywords ? keywords.substring(0, 200) : null;
  }

  /**
   * Extract canonical URL
   */
  extractCanonical($) {
    const canonical = $('link')
      .filter((_, el) => (el.attribs.rel || '').trim().toLowerCase() === 'canonical')
      .first();
    const href = canonical.length ? (canonical.attr('href') || '').trim() : '';
    return href || null;
  }

  /**
   * Analyze heading structure as an ordered outline (G9).
   * Flags skipped levels (H2 → H4) and headings appearing before the first H1.
   */
  analyzeHeadings($) {
    const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    const outline = [];
    const levels = [];

    $('h1, h2, h3, h4, h5, h6')
      .filter((_, el) => $(el).closest('svg').length === 0)
      .each((_, el) => {
        const tag = el.name.toLowerCase();
        counts[tag]++;
        levels.push(Number(tag[1]));
        if (outline.length < 100) outline.push(tag.toUpperCase());
      });

    let skippedLevels = null;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        skippedLevels = `H${levels[i - 1]} → H${levels[i]}`;
        break;
      }
    }

    const firstH1Index = levels.indexOf(1);

    return {
      h1Count: counts.h1,
      h2Count: counts.h2,
      h3Count: counts.h3,
      h4Count: counts.h4,
      h5Count: counts.h5,
      h6Count: counts.h6,
      totalHeadings: levels.length,
      hasMultipleH1: counts.h1 > 1,
      hasNoH1: counts.h1 === 0,
      outline,
      firstHeading: outline.length ? outline[0] : null,
      skippedLevels,
      headingsBeforeH1: firstH1Index > 0,
      noHeadings: levels.length === 0,
    };
  }

  /**
   * Meta robots + X-Robots-Tag indexability directives (G2)
   */
  extractRobotsDirectives($, xRobotsTag) {
    const metaRobots = this.findMetaContent($, 'robots') || null;
    const metaVal = (metaRobots || '').toLowerCase();
    const headerVal = (xRobotsTag || '').toLowerCase();

    const noindex = metaVal.includes('noindex') || headerVal.includes('noindex');

    return {
      metaRobots,
      xRobotsTag: xRobotsTag || null,
      noindex,
      nofollow: metaVal.includes('nofollow') || headerVal.includes('nofollow'),
      noindexSource: metaVal.includes('noindex')
        ? 'meta robots'
        : headerVal.includes('noindex')
          ? 'X-Robots-Tag header'
          : null,
    };
  }

  /**
   * Open Graph / Twitter card tags (G3)
   */
  extractSocialTags($) {
    // OG is spec'd as property=, Twitter as name=, but both appear in the wild either way
    const tag = (key) =>
      this.findMetaContent($, key, 'property') || this.findMetaContent($, key, 'name');

    const og = {
      title: tag('og:title').substring(0, 200) || null,
      description: tag('og:description').substring(0, 300) || null,
      image: tag('og:image').substring(0, 500) || null,
      type: tag('og:type').substring(0, 50) || null,
    };
    const twitter = {
      card: tag('twitter:card').substring(0, 50) || null,
      title: tag('twitter:title').substring(0, 200) || null,
      description: tag('twitter:description').substring(0, 300) || null,
      image: tag('twitter:image').substring(0, 500) || null,
    };

    const missingOpenGraph = [];
    if (!og.title) missingOpenGraph.push('og:title');
    if (!og.description) missingOpenGraph.push('og:description');
    if (!og.image) missingOpenGraph.push('og:image');

    return {
      og,
      twitter,
      hasOpenGraph: missingOpenGraph.length < 3,
      hasTwitterCard: !!twitter.card,
      missingOpenGraph,
    };
  }

  /**
   * JSON-LD structured data detection (G8)
   */
  extractStructuredData($) {
    const blocks = $('script').filter(
      (_, el) => (el.attribs.type || '').trim().toLowerCase() === 'application/ld+json'
    );

    const types = new Set();
    let invalidBlocks = 0;
    let datePublished = null;
    let dateModified = null;

    const collectNode = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(collectNode);
        return;
      }
      const t = node['@type'];
      if (typeof t === 'string') types.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.add(x));
      if (!datePublished && typeof node.datePublished === 'string') datePublished = node.datePublished;
      if (!dateModified && typeof node.dateModified === 'string') dateModified = node.dateModified;
      if (Array.isArray(node['@graph'])) node['@graph'].forEach(collectNode);
    };

    blocks.each((_, el) => {
      const raw = $(el).text().trim();
      if (!raw) return;
      try {
        collectNode(JSON.parse(raw));
      } catch {
        invalidBlocks++;
      }
    });

    return {
      blockCount: blocks.length,
      invalidBlocks,
      types: [...types].slice(0, 20),
      hasStructuredData: types.size > 0,
      datePublished,
      dateModified,
    };
  }

  /**
   * Page fundamentals: html lang, viewport meta, URL quality (G10)
   */
  extractFundamentals($, url) {
    const htmlEl = $('html').first();
    const lang = htmlEl.length ? (htmlEl.attr('lang') || '').trim() : '';
    const hasViewport = $('meta').filter(
      (_, el) => (el.attribs.name || '').trim().toLowerCase() === 'viewport'
    ).length > 0;

    let urlHasUnderscores = false;
    try {
      urlHasUnderscores = new URL(url).pathname.includes('_');
    } catch {
      /* keep default */
    }

    return {
      htmlLang: lang || null,
      hasViewport,
      urlLength: url.length,
      urlTooLong: url.length > 100,
      urlHasUnderscores,
    };
  }

  /**
   * Content freshness signals: OG article dates, JSON-LD dates, Last-Modified header (G14)
   */
  extractFreshness($, structuredData, lastModifiedHeader) {
    const publishedTime =
      this.findMetaContent($, 'article:published_time', 'property') ||
      structuredData.datePublished ||
      null;
    const modifiedTime =
      this.findMetaContent($, 'article:modified_time', 'property') ||
      structuredData.dateModified ||
      null;

    // Staleness prefers content-level signals; Last-Modified header is the
    // weakest (often just deploy time) and only used when nothing else exists.
    const basis = modifiedTime || publishedTime || lastModifiedHeader || null;
    let ageMonths = null;
    let isStale = false;
    if (basis) {
      const parsed = new Date(basis);
      if (!Number.isNaN(parsed.getTime())) {
        const months = (Date.now() - parsed.getTime()) / (30.44 * 24 * 3600 * 1000);
        if (months >= 0) {
          ageMonths = Math.round(months);
          isStale = months > 12;
        }
      }
    }

    return {
      publishedTime,
      modifiedTime,
      lastModifiedHeader: lastModifiedHeader || null,
      ageMonths,
      isStale,
    };
  }

  /**
   * Estimate word count from visible text only.
   * Removes script/style/noscript/template so code never counts as words.
   * NOTE: mutates the parsed document — call after all other extractions.
   */
  estimateWordCount($) {
    $('script, style, noscript, template').remove();
    const body = $('body');
    const textContent = body.length ? body.text() : $.root().text();
    const words = textContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    return words.length;
  }

  /**
   * Analyze images (lightweight check)
   */
  analyzeImages($) {
    const imgs = $('img');

    const totalImages = imgs.length;
    let missingAlt = 0;

    imgs.each((_, el) => {
      // Attribute present (even empty, for decorative images) counts as having alt
      if (!Object.prototype.hasOwnProperty.call(el.attribs, 'alt')) missingAlt++;
    });

    return {
      totalImages,
      missingAlt,
      hasImages: totalImages > 0,
      altCoverage:
        totalImages > 0 ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 100,
    };
  }

  /**
   * Calculate simple SEO score (0-100)
   */
  calculateSEOScore(seoData) {
    let score = 100;
    const issues = [];

    // Title checks (20 points)
    if (seoData.title.isEmpty) {
      score -= 20;
      issues.push({ type: 'critical', message: 'Missing page title' });
    } else if (seoData.title.isTooLong) {
      score -= 10;
      issues.push({ type: 'warning', message: 'Title too long (>60 chars)' });
    } else if (seoData.title.isTooShort) {
      score -= 5;
      issues.push({ type: 'warning', message: 'Title too short (<50 chars)' });
    }

    // Meta description checks (15 points)
    if (seoData.metaDescription.isEmpty) {
      score -= 15;
      issues.push({ type: 'major', message: 'Missing meta description' });
    } else if (seoData.metaDescription.isTooLong) {
      score -= 8;
      issues.push({ type: 'warning', message: 'Meta description too long (>160 chars)' });
    } else if (seoData.metaDescription.isTooShort) {
      score -= 5;
      issues.push({ type: 'minor', message: 'Meta description too short (<150 chars)' });
    }

    // Heading checks (15 points) — multiple H1s are fine in HTML5, only absence is penalized
    if (seoData.headings.hasNoH1) {
      score -= 15;
      issues.push({ type: 'major', message: 'Missing H1 tag' });
    }

    // Image checks (10 points)
    if (seoData.images.hasImages && seoData.images.altCoverage < 80) {
      score -= 10;
      issues.push({
        type: 'warning',
        message: `${seoData.images.missingAlt} images missing alt text`,
      });
    }

    // Technical checks (10 points)
    if (!seoData.technical.isHttps) {
      score -= 10;
      issues.push({ type: 'major', message: 'Not using HTTPS' });
    }

    // Content checks (10 points)
    if (seoData.wordCount < 200) {
      score -= 10;
      issues.push({ type: 'warning', message: 'Low content word count (<200 words in first 50KB)' });
    }

    // Performance checks (10 points)
    if (seoData.technical.responseTime > 3000) {
      score -= 10;
      issues.push({ type: 'warning', message: 'Slow page load time (>3s)' });
    }

    // Canonical checks (5 points)
    if (!seoData.canonicalUrl) {
      score -= 5;
      issues.push({ type: 'minor', message: 'Missing canonical URL' });
    }

    // --- Deeper signals (doc 04 §G batch) ---
    const signals = seoData.signals || {};

    // G2: indexability directives — a perfect page that is noindexed is invisible
    if (signals.robots?.noindex) {
      score -= 15;
      issues.push({
        type: 'critical',
        message: `Page is noindexed (${signals.robots.noindexSource}) — excluded from search results`,
      });
    }

    // G15: robots.txt — blocked pages can't even be crawled, whatever their score
    if (signals.robotsTxt?.disallowed) {
      score -= 15;
      issues.push({
        type: 'critical',
        message: `Blocked by robots.txt rule "${signals.robotsTxt.matchedRule}" — invisible to Google`,
      });
    }

    // G9: heading outline structure (replaces the old multiple-H1 penalty)
    if (seoData.headings.skippedLevels) {
      score -= 4;
      issues.push({
        type: 'warning',
        message: `Heading level skipped in outline (${seoData.headings.skippedLevels})`,
      });
    }
    if (!seoData.headings.hasNoH1 && seoData.headings.headingsBeforeH1) {
      score -= 3;
      issues.push({
        type: 'minor',
        message: `Content headings appear before the first H1 (outline starts at ${seoData.headings.firstHeading})`,
      });
    }

    // G3: social preview tags
    if (signals.social) {
      if (!signals.social.hasOpenGraph) {
        score -= 3;
        issues.push({
          type: 'minor',
          message: 'No Open Graph tags — shared links render generic previews',
        });
      } else if (signals.social.missingOpenGraph.length > 0) {
        score -= 2;
        issues.push({
          type: 'minor',
          message: `Incomplete social preview tags (missing ${signals.social.missingOpenGraph.join(', ')})`,
        });
      }
    }

    // G8: structured data
    if (signals.structuredData) {
      if (signals.structuredData.invalidBlocks > 0) {
        score -= 3;
        issues.push({
          type: 'warning',
          message: `${signals.structuredData.invalidBlocks} JSON-LD block(s) failed to parse`,
        });
      } else if (!signals.structuredData.hasStructuredData) {
        score -= 2;
        issues.push({
          type: 'minor',
          message: 'No structured data (JSON-LD) — not eligible for rich results',
        });
      }
    }

    // G10: page fundamentals
    if (signals.fundamentals) {
      if (!signals.fundamentals.htmlLang) {
        score -= 2;
        issues.push({ type: 'minor', message: 'Missing lang attribute on <html>' });
      }
      if (!signals.fundamentals.hasViewport) {
        score -= 5;
        issues.push({
          type: 'warning',
          message: 'Missing viewport meta tag — page may not be mobile-friendly',
        });
      }
      const urlProblems = [];
      if (signals.fundamentals.urlTooLong) urlProblems.push('over 100 chars');
      if (signals.fundamentals.urlHasUnderscores) urlProblems.push('contains underscores');
      if (urlProblems.length > 0) {
        score -= 2;
        issues.push({ type: 'minor', message: `URL quality: ${urlProblems.join(', ')}` });
      }
    }

    // G14: content freshness
    if (signals.freshness?.isStale) {
      score -= 2;
      issues.push({
        type: 'minor',
        message: `Content not updated in over 12 months (last signal ~${signals.freshness.ageMonths} months old)`,
      });
    }

    seoData.score = Math.max(0, score);
    seoData.issues = issues;
    seoData.grade = this.getGrade(seoData.score);
  }

  /**
   * Convert score to letter grade
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get summary for multiple pages
   */
  getSummary(seoResults) {
    const validResults = seoResults.filter((r) => r && !r.error);

    if (validResults.length === 0) {
      return { error: 'No valid SEO data to summarize' };
    }

    const avgScore = Math.round(
      validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length
    );

    const gradeDistribution = {};
    validResults.forEach((r) => {
      gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    });

    const commonIssues = {};
    validResults.forEach((r) => {
      r.issues.forEach((issue) => {
        commonIssues[issue.message] = (commonIssues[issue.message] || 0) + 1;
      });
    });

    const topIssues = Object.entries(commonIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return {
      totalPages: validResults.length,
      averageScore: avgScore,
      averageGrade: this.getGrade(avgScore),
      gradeDistribution,
      topIssues,
      pagesWithNoIssues: validResults.filter((r) => r.issues.length === 0).length,
      httpsPages: validResults.filter((r) => r.technical.isHttps).length,
      avgResponseTime: Math.round(
        validResults.reduce((sum, r) => sum + r.technical.responseTime, 0) / validResults.length
      ),
    };
  }
}

// Export lightweight instance
export const seoDetector = new LightweightSEODetector({
  maxContentLength: 50000,
  enableImageChecks: true,
  enableStructureChecks: true,
  enableMetaChecks: true,
});

export default LightweightSEODetector;
