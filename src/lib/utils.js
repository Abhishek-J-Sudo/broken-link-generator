/**
 * Utility functions for the broken link checker
 * ENHANCED: Main branch code + Smart analyzer content page classification
 * Handles URL validation, normalization, and common helpers
 */

// URL validation and normalization - ORIGINAL MAIN BRANCH CODE (PRESERVED)
export const urlUtils = {
  /**
   * Validates if a URL is properly formatted
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Normalizes a URL by removing fragments, sorting query params, etc.
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);

      // Remove fragment (hash)
      urlObj.hash = '';

      // Remove trailing slash for non-root paths
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      // Sort query parameters for consistency
      urlObj.searchParams.sort();

      return urlObj.toString();
    } catch {
      return url; // Return original if parsing fails
    }
  },

  /**
   * Resolves a relative URL against a base URL
   */
  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return null;
    }
  },

  /**
   * Checks if a URL is internal to the given domain
   */
  isInternalUrl(url, baseDomain) {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(baseDomain);
      return urlObj.hostname === baseObj.hostname;
    } catch {
      return false;
    }
  },

  /**
   * Extracts domain from URL
   */
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  },

  /**
   * Checks if URL should be crawled based on common exclusions
   */
  shouldCrawlUrl(url) {
    const excludedExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.zip',
      '.rar',
      '.exe',
      '.dmg',
      '.pkg',
      '.deb',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.webp',
      '.mp3',
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.css',
      '.js',
      '.ico',
      '.xml',
      '.json',
    ];

    const excludedProtocols = ['mailto:', 'tel:', 'ftp:', 'ftps:'];

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (excludedProtocols.some((protocol) => url.toLowerCase().startsWith(protocol))) {
        return false;
      }

      // Check file extension
      const pathname = urlObj.pathname.toLowerCase();
      if (excludedExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      // Check for common admin/system paths
      const excludedPaths = ['/admin', '/wp-admin', '/api', '/private'];
      if (excludedPaths.some((path) => pathname.startsWith(path))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },
};

// NEW: Smart analyzer content page classification utilities - ADDED FEATURES
export const contentPageUtils = {
  /**
   * Determines if a page is a content page worth checking for links
   * @param {string} url - The page URL
   * @param {string} html - The page HTML content (optional)
   * @param {string} title - The page title (optional)
   * @param {string} contentType - The response content type (optional)
   * @returns {boolean} True if this is a content page
   */
  isContentPage(url, html = '', title = '', contentType = '') {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      // Quick URL-based filtering
      const pageType = this.classifyPageTypeByUrl(url);

      // Exclude obvious non-content types
      if (['admin', 'api', 'media'].includes(pageType)) {
        return false;
      }

      // If HTML is provided, do content analysis
      if (html && html.length > 100) {
        const contentScore = this.calculateContentScore(html, title, url);
        return contentScore >= 0.6; // Content threshold
      }

      // URL-only classification for potential content
      return pageType === 'pages' || pageType === 'content';
    } catch {
      return false;
    }
  },

  /**
   * Classifies page type based on URL patterns only (fast)
   * @param {string} url - The URL to classify
   * @returns {string} Page type category
   */
  classifyPageTypeByUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const params = urlObj.searchParams;

      // Admin/system pages
      if (
        pathname.includes('/admin') ||
        pathname.includes('/wp-admin') ||
        pathname.includes('/backend') ||
        pathname.includes('/dashboard')
      ) {
        return 'admin';
      }

      // API endpoints
      if (
        pathname.includes('/api/') ||
        pathname.includes('/rest/') ||
        pathname.includes('/graphql') ||
        pathname.endsWith('.json') ||
        pathname.endsWith('.xml')
      ) {
        return 'api';
      }

      // Media files
      const mediaExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.webp',
        '.mp3',
        '.mp4',
        '.avi',
        '.mov',
        '.pdf',
        '.zip',
      ];
      if (mediaExtensions.some((ext) => pathname.endsWith(ext))) {
        return 'media';
      }

      // Pagination patterns
      if (
        pathname.includes('/page/') ||
        params.has('page') ||
        params.has('p') ||
        pathname.match(/\/\d+\/?$/) ||
        params.has('offset')
      ) {
        return 'pagination';
      }

      // Date-based URLs
      if (pathname.match(/\/\d{4}\/\d{1,2}/) || pathname.match(/\/20\d{2}/)) {
        return 'dates';
      }

      // Parameter-heavy URLs (likely filters/searches)
      if (params.size > 2) {
        return 'withParams';
      }

      // Regular content pages (articles, posts, pages)
      if (
        pathname.includes('/post/') ||
        pathname.includes('/article/') ||
        pathname.includes('/blog/') ||
        pathname.includes('/news/') ||
        pathname.length > 10
      ) {
        // Substantial path likely content
        return 'pages';
      }

      return 'other';
    } catch {
      return 'other';
    }
  },

  /**
   * Calculates content quality score for HTML pages
   * @param {string} html - The HTML content
   * @param {string} title - Page title
   * @param {string} url - Page URL
   * @returns {number} Content score (0-1)
   */
  calculateContentScore(html, title = '', url = '') {
    try {
      let score = 0.3; // Base score

      // Text content analysis
      const textContent = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const wordCount = textContent.split(' ').length;

      if (wordCount > 300) score += 0.2;
      if (wordCount > 1000) score += 0.1;

      // Title quality
      if (title && title.length > 10 && title.length < 70) {
        score += 0.1;
      }

      // Content structure indicators
      if (
        html.includes('<article>') ||
        html.includes('<main>') ||
        html.includes('class="content"') ||
        html.includes('class="post"')
      ) {
        score += 0.15;
      }

      // Schema markup (indicates quality content)
      if (
        html.includes('schema.org') &&
        (html.includes('Article') || html.includes('BlogPosting') || html.includes('NewsArticle'))
      ) {
        score += 0.15;
      }

      // Meta description
      if (
        html.includes('meta name="description"') ||
        html.includes('meta property="og:description"')
      ) {
        score += 0.05;
      }

      // Clamp score between 0 and 1
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.3; // Default low score if analysis fails
    }
  },

  /**
   * Performs comprehensive page type classification including content analysis
   * @param {string} url - The page URL
   * @param {string} html - The page HTML content
   * @returns {Object} Classification result with type, score, and reasoning
   */
  classifyPageType(url, html = '') {
    const urlType = this.classifyPageTypeByUrl(url);

    // For non-content types, return immediately
    if (['admin', 'media', 'api'].includes(urlType)) {
      return {
        type: urlType,
        isContent: false,
        score: 0,
        confidence: 'high',
        reasoning: `URL pattern indicates ${urlType} page`,
      };
    }

    // For potential content pages, do deeper analysis if HTML is available
    if (html && html.length > 100) {
      const contentScore = this.calculateContentScore(html, '', url);
      const isContent = contentScore >= 0.6;

      return {
        type: isContent ? 'content' : urlType,
        isContent,
        score: contentScore,
        confidence: contentScore > 0.8 ? 'high' : contentScore > 0.4 ? 'medium' : 'low',
        reasoning: `Content analysis score: ${contentScore.toFixed(2)}`,
      };
    }

    // URL-only classification for potential content
    const isLikelyContent = urlType === 'pages';

    return {
      type: isLikelyContent ? 'content' : urlType,
      isContent: isLikelyContent,
      score: isLikelyContent ? 0.7 : 0.3,
      confidence: 'medium',
      reasoning: `URL-based classification: ${urlType}`,
    };
  },

  /**
   * Gets content page discovery heuristics for a URL
   * @param {string} url - The URL to analyze
   * @param {string} html - Optional HTML content
   * @returns {Object} Heuristics object with various metrics
   */
  getContentPageHeuristics(url, html = '') {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      return {
        // URL characteristics
        pathDepth: pathname.split('/').filter((p) => p.length > 0).length,
        hasParameters: urlObj.search.length > 0,
        parameterCount: urlObj.searchParams.size,
        fileExtension: pathname.includes('.') ? pathname.split('.').pop() : null,

        // Content characteristics (if HTML provided)
        ...(html && {
          htmlLength: html.length,
          wordCount: html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ').length,
          linkCount: (html.match(/<a[^>]*href/gi) || []).length,
          imageCount: (html.match(/<img[^>]*src/gi) || []).length,
          hasTitle: html.includes('<title>'),
          hasMetaDescription: html.includes('meta name="description"'),
          hasSchemaMarkup: html.includes('schema.org'),
        }),

        // Classification results
        urlClassification: this.classifyPageTypeByUrl(url),
        isLikelyContent: this.isContentPage(url, html),
      };
    } catch {
      return {
        pathDepth: 0,
        hasParameters: false,
        parameterCount: 0,
        fileExtension: null,
        urlClassification: 'other',
        isLikelyContent: false,
      };
    }
  },

  /**
   * Determines if we should extract links from this page type
   * @param {string} pageType - The classified page type
   * @param {Object} options - Additional options
   * @returns {boolean} Whether to extract links from this page
   */
  shouldExtractLinksFromPage(pageType, options = {}) {
    const { includeAll = false, includeNavigation = true } = options;

    // Always extract from content pages
    if (pageType === 'content' || pageType === 'pages') {
      return true;
    }

    // Include all if specified
    if (includeAll) {
      return !['admin', 'api'].includes(pageType); // Exclude only admin/API
    }

    // Include navigation pages if specified
    if (includeNavigation && ['other'].includes(pageType)) {
      return true;
    }

    // Default: only extract from content pages
    return false;
  },

  /**
   * Bulk classify an array of URLs (URL-only, fast)
   * @param {Array<string>} urls - Array of URLs to classify
   * @returns {Object} Classification results grouped by type
   */
  bulkClassifyUrls(urls) {
    const classifications = {
      content: [],
      withParams: [],
      pagination: [],
      dates: [],
      media: [],
      admin: [],
      api: [],
      other: [],
    };

    const stats = {
      total: urls.length,
      contentPages: 0,
      filtered: 0,
    };

    urls.forEach((url) => {
      try {
        const type = this.classifyPageTypeByUrl(url);
        const isContent = this.isContentPage(url); // URL-only analysis

        if (isContent) {
          classifications.content.push({ url, type: 'content', isContent: true });
          stats.contentPages++;
        } else {
          classifications[type] = classifications[type] || [];
          classifications[type].push({ url, type, isContent: false });
          stats.filtered++;
        }
      } catch (error) {
        classifications.other.push({ url, type: 'other', isContent: false });
        stats.filtered++;
      }
    });

    return {
      classifications,
      stats,
      summary: {
        totalUrls: stats.total,
        contentPages: stats.contentPages,
        filteredOut: stats.filtered,
        categories: {
          content: classifications.content.length,
          withParams: classifications.withParams.length,
          pagination: classifications.pagination.length,
          dates: classifications.dates.length,
          media: classifications.media.length,
          admin: classifications.admin.length,
          api: classifications.api.length,
          other: classifications.other.length,
        },
      },
    };
  },
};

// Text and content helpers - ORIGINAL MAIN BRANCH CODE (PRESERVED)
export const textUtils = {
  /**
   * Cleans and truncates text content
   */
  cleanText(text, maxLength = 200) {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, maxLength);
  },

  /**
   * Extracts meaningful text from HTML attributes
   */
  extractLinkText(element) {
    // Try different sources for link text
    const text =
      element.text?.trim() ||
      element.title?.trim() ||
      element.getAttribute?.('aria-label')?.trim() ||
      element.getAttribute?.('alt')?.trim() ||
      '';

    return this.cleanText(text, 100);
  },
};

// Error handling helpers - ORIGINAL MAIN BRANCH CODE (PRESERVED)
export const errorUtils = {
  /**
   * Creates standardized error objects
   */
  createError(message, code, details = {}) {
    return {
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Formats HTTP status codes with descriptions
   */
  formatHttpStatus(statusCode) {
    const statusMessages = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    const baseMessage = statusMessages[statusCode] || 'Unknown Status';
    return statusCode ? `${baseMessage} (${statusCode})` : baseMessage;
  },
};

// Performance and batching helpers - ORIGINAL MAIN BRANCH CODE (PRESERVED)
export const batchUtils = {
  /**
   * Splits an array into chunks of specified size
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  },

  /**
   * Delays execution for specified milliseconds
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Executes functions with rate limiting
   */
  async rateLimit(functions, maxConcurrent = 5, delayMs = 100) {
    const results = [];
    const executing = [];

    for (const fn of functions) {
      const promise = fn().then((result) => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }

      if (delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    return Promise.all(results);
  },
};

// Validation helpers - ORIGINAL MAIN BRANCH CODE (PRESERVED)
export const validateUtils = {
  /**
   * Validates crawl settings
   */
  validateCrawlSettings(settings) {
    const errors = [];

    if (!settings.maxDepth || settings.maxDepth < 1 || settings.maxDepth > 5) {
      errors.push('maxDepth must be between 1 and 5');
    }

    if (settings.timeout && (settings.timeout < 1000 || settings.timeout > 60000)) {
      errors.push('timeout must be between 1000ms and 60000ms');
    }

    if (typeof settings.includeExternal !== 'boolean') {
      errors.push('includeExternal must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validates pagination parameters
   */
  validatePagination(page, limit) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;

    return {
      page: Math.max(1, pageNum),
      limit: Math.min(Math.max(1, limitNum), 100), // Max 100 items per page
    };
  },
};

// Export everything - UPDATED to include contentPageUtils
export default {
  urlUtils,
  contentPageUtils, // NEW: Added smart analyzer utilities
  textUtils,
  errorUtils,
  batchUtils,
  validateUtils,
};
