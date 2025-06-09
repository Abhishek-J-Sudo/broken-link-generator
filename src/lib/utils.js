/**
 * Utility functions for the broken link checker
 * Handles URL validation, normalization, and common helpers
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
    if (statusCode) {
      if (statusCode === 404) return '404';
      if (statusCode === 403) return '403';
      if (statusCode === 401) return '401';
      if (statusCode >= 500) return '500';
    }

    if (error) {
      const errorMessage = error.message?.toLowerCase() || '';

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

    if (!settings.maxDepth || settings.maxDepth < 1 || settings.maxDepth > 10) {
      errors.push('maxDepth must be between 1 and 10');
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
  textUtils,
  errorUtils,
  batchUtils,
  validateUtils,
};
