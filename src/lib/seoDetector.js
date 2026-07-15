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
   */
  analyzePage(html, url, statusCode, responseTime) {
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
   * Find a <meta> tag by its name attribute (case-insensitive, attribute-order independent)
   */
  findMetaContent($, name) {
    const meta = $('meta')
      .filter((_, el) => (el.attribs.name || '').trim().toLowerCase() === name)
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
   * Analyze heading structure (lightweight)
   */
  analyzeHeadings($) {
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;

    return {
      h1Count,
      h2Count,
      h3Count,
      totalHeadings: h1Count + h2Count + h3Count,
      hasMultipleH1: h1Count > 1,
      hasNoH1: h1Count === 0,
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
