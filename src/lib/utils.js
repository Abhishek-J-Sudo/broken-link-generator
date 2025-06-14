/**
 * Utility functions for the broken link checker
 * Handles URL validation, normalization, and common helpers
 * ENHANCED: Added content page classification for smart analyzer
 */

// URL validation and normalization
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

// NEW: Content page classification utilities for smart analyzer
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

      // Definitely not content pages
      if (['admin', 'media', 'api'].includes(pageType)) {
        return false;
      }

      // Pagination and date archives are usually not primary content
      if (['pagination', 'dates'].includes(pageType)) {
        return false;
      }

      // Parameter-heavy URLs are often not primary content
      if (pageType === 'withParams') {
        // Allow some parameters but be selective
        const paramCount = urlObj.searchParams.size;
        if (paramCount > 3) return false;

        // Common non-content parameters
        const nonContentParams = ['page', 'sort', 'filter', 'view', 'limit', 'offset'];
        const hasNonContentParams = Array.from(urlObj.searchParams.keys()).some((key) =>
          nonContentParams.includes(key.toLowerCase())
        );

        if (hasNonContentParams) return false;
      }

      // If we have HTML content, do deeper analysis
      if (html && html.length > 100) {
        const contentScore = this.calculateContentScore(html, title, url);
        return contentScore >= 0.6; // Threshold for content pages
      }

      // Default: if it's a clean URL without obvious red flags, consider it content
      return pageType === 'pages';
    } catch {
      return false;
    }
  },

  /**
   * Classifies page type based on URL patterns only (fast)
   * @param {string} url - The URL to classify
   * @returns {string} Page type: 'pages', 'withParams', 'pagination', 'dates', 'media', 'admin', 'api', 'other'
   */
  classifyPageTypeByUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const search = urlObj.search;
      const hasParams = search.length > 0;

      // Check for admin/system URLs
      if (
        pathname.includes('/wp-admin') ||
        pathname.includes('/admin') ||
        pathname.includes('/wp-content') ||
        pathname.includes('/wp-includes') ||
        pathname.includes('/dashboard') ||
        pathname.includes('/login') ||
        pathname.includes('/register') ||
        pathname.includes('/auth')
      ) {
        return 'admin';
      }

      // Check for API endpoints
      if (
        pathname.includes('/api/') ||
        pathname.includes('/rest/') ||
        pathname.includes('/graphql') ||
        pathname.includes('/webhook')
      ) {
        return 'api';
      }

      // Check for media files
      const mediaExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.webp',
        '.ico',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.zip',
        '.rar',
        '.tar',
        '.gz',
        '.mp3',
        '.mp4',
        '.avi',
        '.mov',
        '.wmv',
        '.flv',
        '.css',
        '.js',
        '.json',
        '.xml',
        '.txt',
      ];

      if (mediaExtensions.some((ext) => pathname.endsWith(ext))) {
        return 'media';
      }

      // Check for date patterns (blog archives)
      if (/\/\d{4}(\/\d{1,2})?(\/\d{1,2})?\//.test(pathname)) {
        return 'dates';
      }

      // Check for pagination patterns
      if (
        pathname.includes('/page/') ||
        pathname.includes('/page-') ||
        search.includes('page=') ||
        search.includes('p=') ||
        pathname.match(/\/\d+\/?$/) || // URLs ending with just numbers
        pathname.includes('/feed') ||
        pathname.includes('/rss')
      ) {
        return 'pagination';
      }

      // Check for URLs with parameters
      if (hasParams) {
        const paramCount = urlObj.searchParams.size;
        return paramCount > 3 ? 'withParams' : 'pages'; // Light params might still be content
      }

      // Check for other non-content patterns
      if (
        pathname.includes('/search') ||
        pathname.includes('/category/') ||
        pathname.includes('/tag/') ||
        pathname.includes('/archive') ||
        pathname.includes('/sitemap') ||
        pathname.includes('/robots.txt') ||
        pathname.includes('/.well-known/')
      ) {
        return 'other';
      }

      // Default to content pages
      return 'pages';
    } catch {
      return 'other';
    }
  },

  /**
   * Analyzes page content to determine if it's worth crawling
   * @param {string} html - The HTML content
   * @param {string} title - Page title
   * @param {string} url - Page URL
   * @returns {number} Content score from 0-1 (higher = more likely to be content)
   */
  calculateContentScore(html, title = '', url = '') {
    let score = 0.5; // Start neutral

    try {
      // Title analysis
      if (title && title.length > 10 && title.length < 200) {
        score += 0.1;

        // Good title indicators
        if (!/^(page \d+|archive|category|tag)/i.test(title)) {
          score += 0.1;
        }

        // Bad title indicators
        if (/(404|not found|error|login|register)/i.test(title)) {
          score -= 0.3;
        }
      }

      // Content length analysis
      const textContent = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const wordCount = textContent.split(' ').length;

      if (wordCount > 100) score += 0.1;
      if (wordCount > 300) score += 0.1;
      if (wordCount > 1000) score += 0.1;

      // Too little content is probably not valuable
      if (wordCount < 50) score -= 0.2;

      // Content structure analysis
      const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length;
      const headingCount = (html.match(/<h[1-6][^>]*>/gi) || []).length;
      const linkCount = (html.match(/<a[^>]*href/gi) || []).length;

      if (paragraphCount > 2) score += 0.1;
      if (headingCount > 0) score += 0.1;
      if (linkCount > 3 && linkCount < 100) score += 0.1; // Some links but not excessive

      // Navigation/chrome detection (indicates it's probably not just content)
      const navCount = (html.match(/<nav[^>]*>/gi) || []).length;
      const menuCount = (html.match(/class="[^"]*menu[^"]*"/gi) || []).length;

      if (navCount > 0) score += 0.05; // Navigation suggests it's a real page
      if (menuCount > 0) score += 0.05;

      // Schema.org markup for articles
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

// Text and content helpers
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
      element.text?.() ||
      element.attr('title') ||
      element.attr('alt') ||
      element.attr('aria-label') ||
      'No text';

    return this.cleanText(text, 100);
  },
};

// Error handling and classification
export const errorUtils = {
  /**
   * Classifies HTTP errors into meaningful categories
   */
  classifyError(statusCode, error) {
    const code = parseInt(statusCode);

    if (code && !isNaN(code)) {
      if (code === 404) return '404';
      if (code === 403) return '403';
      if (code === 401) return '401';
      if (code >= 500) return '500';
      if (code >= 400) return code.toString(); // Any 4xx error
    }

    if (error) {
      const errorMessage = error.message?.toLowerCase() || '';

      // 🔧 NEW: Handle SSL/Certificate errors specifically
      if (
        errorMessage.includes('unable to verify the first certificate') ||
        errorMessage.includes('self signed certificate') ||
        errorMessage.includes('certificate has expired') ||
        errorMessage.includes('hostname/ip does not match certificate')
      ) {
        return 'ssl_error';
      }

      if (errorMessage.includes('timeout')) return 'timeout';
      if (errorMessage.includes('dns') || errorMessage.includes('notfound')) return 'dns_error';
      if (errorMessage.includes('connect') || errorMessage.includes('refused'))
        return 'connection_error';
      if (errorMessage.includes('invalid') || errorMessage.includes('malformed'))
        return 'invalid_url';
    }

    return 'other';
  },

  /**
   * Creates a user-friendly error message
   */
  getErrorMessage(errorType, statusCode) {
    const messages = {
      404: 'Page not found',
      403: 'Access forbidden',
      401: 'Unauthorized access',
      500: 'Server error',
      timeout: 'Request timed out',
      dns_error: 'Domain not found',
      connection_error: 'Connection failed',
      invalid_url: 'Invalid URL format',
      ssl_error: 'SSL Certificate Error',
      other: 'Unknown error',
    };

    const baseMessage = messages[errorType] || messages.other;
    return statusCode ? `${baseMessage} (${statusCode})` : baseMessage;
  },
};

// Performance and batching helpers
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

// Validation helpers
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

// Export everything as default object for easier importing
export default {
  urlUtils,
  contentPageUtils,
  textUtils,
  errorUtils,
  batchUtils,
  validateUtils,
};
