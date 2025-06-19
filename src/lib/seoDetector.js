// src/lib/seoDetector.js - Lightweight SEO analysis for content pages
// Designed for minimal resource impact on Railway $5 tier

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

    // Truncate HTML to save memory (Railway constraint)
    const analyzableHtml = html.substring(0, this.options.maxContentLength);

    try {
      const seoData = {
        url,
        analyzedAt: new Date().toISOString(),

        // Basic Meta Tags (lightweight extraction)
        title: this.extractTitle(analyzableHtml),
        metaDescription: this.extractMetaDescription(analyzableHtml),
        metaKeywords: this.extractMetaKeywords(analyzableHtml),
        canonicalUrl: this.extractCanonical(analyzableHtml),

        // Content Structure (regex-based, fast)
        headings: this.analyzeHeadings(analyzableHtml),
        contentLength: analyzableHtml.length,
        wordCount: this.estimateWordCount(analyzableHtml),

        // Images (lightweight check)
        images: this.analyzeImages(analyzableHtml),

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
   * Extract page title (fast regex)
   */
  extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    return {
      text: title.substring(0, 200), // Limit to save space
      length: title.length,
      isEmpty: !title,
      isTooLong: title.length > 60,
      isTooShort: title.length < 30,
    };
  }

  /**
   * Extract meta description
   */
  extractMetaDescription(html) {
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
    const description = descMatch ? descMatch[1].trim() : '';

    return {
      text: description.substring(0, 300),
      length: description.length,
      isEmpty: !description,
      isTooLong: description.length > 160,
      isTooShort: description.length < 120,
    };
  }

  /**
   * Extract meta keywords (if present)
   */
  extractMetaKeywords(html) {
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)/i);
    return keywordsMatch ? keywordsMatch[1].trim().substring(0, 200) : null;
  }

  /**
   * Extract canonical URL
   */
  extractCanonical(html) {
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)/i);
    return canonicalMatch ? canonicalMatch[1].trim() : null;
  }

  /**
   * Analyze heading structure (lightweight)
   */
  analyzeHeadings(html) {
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
    const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;

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
   * Estimate word count (fast approximation)
   */
  estimateWordCount(html) {
    // Remove HTML tags and count words (approximation)
    const textContent = html.replace(/<[^>]*>/g, ' ');
    const words = textContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    return words.length;
  }

  /**
   * Analyze images (lightweight check)
   */
  analyzeImages(html) {
    const imgMatches = html.match(/<img[^>]*>/gi) || [];

    let totalImages = imgMatches.length;
    let missingAlt = 0;
    let missingTitle = 0;

    // Quick check for alt attributes
    imgMatches.forEach((img) => {
      if (!img.includes('alt=')) missingAlt++;
      if (!img.includes('title=')) missingTitle++;
    });

    return {
      totalImages,
      missingAlt,
      missingTitle,
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
      issues.push({ type: 'warning', message: 'Title too short (<30 chars)' });
    }

    // Meta description checks (15 points)
    if (seoData.metaDescription.isEmpty) {
      score -= 15;
      issues.push({ type: 'major', message: 'Missing meta description' });
    } else if (seoData.metaDescription.isTooLong) {
      score -= 8;
      issues.push({ type: 'warning', message: 'Meta description too long (>160 chars)' });
    }

    // Heading checks (15 points)
    if (seoData.headings.hasNoH1) {
      score -= 15;
      issues.push({ type: 'major', message: 'Missing H1 tag' });
    } else if (seoData.headings.hasMultipleH1) {
      score -= 10;
      issues.push({ type: 'warning', message: 'Multiple H1 tags found' });
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
      issues.push({ type: 'warning', message: 'Low content word count (<200 words)' });
    }

    // Performance checks (10 points)
    if (seoData.technical.responseTime > 3000) {
      score -= 10;
      issues.push({ type: 'warning', message: 'Slow page load time (>3s)' });
    }

    // Canonical checks (10 points)
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
  maxContentLength: 50000, // Railway memory optimization
  enableImageChecks: true,
  enableStructureChecks: true,
  enableMetaChecks: true,
});

export default LightweightSEODetector;
