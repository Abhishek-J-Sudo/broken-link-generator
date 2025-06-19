/**
 * HTTP status checker for validating links
 * UPDATED: Now returns detailed status info for database storage
 */

import axios from 'axios';
import { errorUtils, batchUtils } from './utils.js';
import { securityUtils } from './security.js';
import { seoDetector } from './seoDetector.js';

export class HttpChecker {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      maxRedirects: 3,
      userAgent: 'Broken Link Checker Bot/1.0 (+https://your-domain.com/bot)',
      maxConcurrent: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      respectRobots: true,
      ...options,
    };

    // Configure axios defaults
    this.axiosConfig = {
      timeout: this.options.timeout,
      maxRedirects: this.options.maxRedirects,
      headers: securityUtils.getCrawlHeaders(),
      validateStatus: () => true,
    };
  }

  /**
   * Checks a single URL and returns detailed status information
   * UPDATED: Returns database-ready format
   */
  async checkUrl(url, sourceUrl = null) {
    const startTime = Date.now();

    // SECURITY: Validate URL before making request
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED URL: ${url} - ${validation.reason}`);
      return {
        url,
        sourceUrl,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        statusCode: null,
        isWorking: false,
        errorType: 'security_blocked',
        blocked: true,
      };
    }

    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      try {
        // SECURITY: Use secure headers and limited redirects
        const response = await axios.get(url, this.axiosConfig);
        const responseTime = Date.now() - startTime;
        const isWorking = this._isStatusCodeOk(response.status);

        return {
          url,
          sourceUrl,
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: isWorking,
          error_message: null,

          // Legacy compatibility
          statusCode: response.status,
          responseTime,
          isWorking,
          finalUrl: response.request.res?.responseUrl || url,
          redirectCount: response.request._redirectCount || 0,
          headers: this._extractRelevantHeaders(response.headers),
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        if (attempt === this.options.retryAttempts) {
          console.log('🔍 HTTPCHECKER DEBUG: About to call classifyError with:', {
            statusCode: error.response?.status,
            errorMessage: error.message,
            errorType: typeof error.response?.status,
          });
          const errorType = errorUtils.classifyError(error.response?.status, error);
          console.log('🔍 HTTPCHECKER DEBUG: classifyError returned:', errorType);
          return {
            url,
            sourceUrl,
            http_status_code: error.response?.status || null,
            response_time: responseTime,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,

            // Legacy compatibility
            statusCode: error.response?.status || null,
            responseTime,
            isWorking: false,
            errorType,
            errorMessage: error.message,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
          };
        }
      }

      attempt++;
      if (attempt <= this.options.retryAttempts) {
        await batchUtils.delay(this.options.retryDelay * attempt);
      }
    }
  }
  /**
   * Checks multiple URLs with concurrency control
   * UPDATED: Returns database-ready results
   */
  async checkUrls(urls, onProgress = null) {
    const results = [];
    const failed = [];

    const checkFunctions = urls.map((urlData) => {
      const url = typeof urlData === 'string' ? urlData : urlData.url;
      const sourceUrl = typeof urlData === 'object' ? urlData.sourceUrl : null;

      return async () => {
        try {
          const result = await this.checkUrl(url, sourceUrl);
          results.push(result);

          if (onProgress) {
            onProgress({
              completed: results.length + failed.length,
              total: urls.length,
              current: result,
            });
          }

          return result;
        } catch (error) {
          const failedResult = {
            url,
            sourceUrl,
            http_status_code: error.response?.status || null,
            response_time: null,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            statusCode: error.response?.status || null,
            isWorking: false,
            errorType: errorUtils.classifyError(error.response?.status, error),
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          };

          failed.push(failedResult);
          results.push(failedResult);

          if (onProgress) {
            onProgress({
              completed: results.length + failed.length,
              total: urls.length,
              current: failedResult,
            });
          }

          return failedResult;
        }
      };
    });

    await batchUtils.rateLimit(
      checkFunctions,
      this.options.maxConcurrent,
      200 // Increased delay for security
    );

    return {
      results,
      summary: this._generateSummary(results),
    };
  }

  /**
   * Performs a lightweight HEAD request to check if URL exists
   * UPDATED: Returns database-ready format
   */
  async quickCheck(url) {
    const startTime = Date.now();

    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED URL in quickCheck: ${url} - ${validation.reason}`);
      return {
        url,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        statusCode: null,
        isWorking: false,
        method: 'BLOCKED',
        errorType: 'security_blocked',
        blocked: true,
      };
    }

    try {
      const response = await axios.head(url, {
        ...this.axiosConfig,
        timeout: 5000, // Shorter timeout for quick checks
      });

      const responseTime = Date.now() - startTime;
      const isWorking = this._isStatusCodeOk(response.status);

      return {
        url,
        // NEW: Database fields
        http_status_code: response.status,
        response_time: responseTime,
        checked_at: new Date().toISOString(),
        is_working: isWorking,
        error_message: null,

        // Legacy fields
        statusCode: response.status,
        isWorking,
        method: 'HEAD',
      };
    } catch (error) {
      // If HEAD fails, try GET with limited data
      try {
        const response = await axios.get(url, {
          ...this.axiosConfig,
          timeout: 5000,
          headers: {
            ...this.axiosConfig.headers,
            Range: 'bytes=0-1023', // Only get first 1KB
          },
        });

        const responseTime = Date.now() - startTime;
        const isWorking = this._isStatusCodeOk(response.status);

        return {
          url,
          // NEW: Database fields
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: isWorking,
          error_message: null,

          // Legacy fields
          statusCode: response.status,
          isWorking,
          method: 'GET (partial)',
        };
      } catch (getError) {
        const responseTime = Date.now() - startTime;
        const errorType = errorUtils.classifyError(getError.response?.status, getError);

        return {
          url,
          // NEW: Database fields
          http_status_code: getError.response?.status || null,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: false,
          error_message: getError.message,

          // Legacy fields
          statusCode: getError.response?.status || null,
          isWorking: false,
          errorType,
          errorMessage: getError.message,
          method: 'HEAD/GET failed',
        };
      }
    }
  }

  /**
   * ENHANCED: Check URL with optional SEO analysis for content pages
   * Reuses existing HTTP response - minimal resource impact
   */
  async checkUrlWithSEO(url, sourceUrl = null, options = {}) {
    const enableSEO = options.enableSEO || false;
    const startTime = Date.now();

    // SECURITY: Existing validation
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      console.log(`🚫 BLOCKED URL: ${url} - ${validation.reason}`);
      return {
        url,
        sourceUrl,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        blocked: true,
        seo_data: null, // No SEO for blocked URLs
      };
    }

    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      try {
        // Use GET instead of HEAD to get content for SEO analysis
        const method = enableSEO ? 'GET' : 'HEAD';
        const response = await axios({
          method,
          url,
          ...this.axiosConfig,
        });

        const responseTime = Date.now() - startTime;
        const isWorking = this._isStatusCodeOk(response.status);

        const result = {
          url,
          sourceUrl,
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: isWorking,
          error_message: null,

          // Legacy compatibility
          statusCode: response.status,
          responseTime,
          isWorking,
          finalUrl: response.request.res?.responseUrl || url,
          redirectCount: response.request._redirectCount || 0,
          headers: this._extractRelevantHeaders(response.headers),
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
          seo_data: null, // Will be populated if SEO enabled
        };

        // ADDITION: SEO Analysis for content pages (Railway optimized)
        if (enableSEO && isWorking && response.data) {
          const contentType = response.headers['content-type'] || '';

          // Only analyze HTML content pages to save resources
          if (contentType.includes('text/html')) {
            try {
              console.log(`🔍 SEO: Analyzing ${url}`);

              result.seo_data = seoDetector.analyzePage(
                response.data,
                url,
                response.status,
                responseTime
              );

              if (result.seo_data) {
                console.log(
                  `✅ SEO: Score ${result.seo_data.score}/100 (${result.seo_data.grade}) for ${url}`
                );
              }
            } catch (seoError) {
              console.error(`❌ SEO analysis failed for ${url}:`, seoError.message);
              result.seo_data = {
                url,
                error: seoError.message,
                analyzedAt: new Date().toISOString(),
              };
            }
          } else {
            console.log(`⏭️ SEO: Skipping non-HTML content: ${url} (${contentType})`);
          }
        }

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;

        if (attempt === this.options.retryAttempts) {
          const errorType = errorUtils.classifyError(error.response?.status, error);

          return {
            url,
            sourceUrl,
            http_status_code: error.response?.status || null,
            response_time: responseTime,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,

            // Legacy compatibility
            statusCode: error.response?.status || null,
            responseTime,
            isWorking: false,
            errorType,
            errorMessage: error.message,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
            seo_data: null, // No SEO for failed requests
          };
        }
      }

      attempt++;
      if (attempt <= this.options.retryAttempts) {
        await batchUtils.delay(this.options.retryDelay * attempt);
      }
    }
  }

  /**
   * ENHANCED: Batch check URLs with optional SEO
   * Railway optimized - only analyze content pages
   */
  async checkUrlsWithSEO(urls, options = {}) {
    const enableSEO = options.enableSEO || false;
    const seoPages = options.seoPages || []; // Specific pages to SEO analyze
    const onProgress = options.onProgress;

    const results = [];
    const failed = [];

    console.log(
      `🔍 HTTP+SEO: Checking ${urls.length} URLs${enableSEO ? ' with SEO analysis' : ''}`
    );

    const checkFunctions = urls.map((urlData) => {
      const url = typeof urlData === 'string' ? urlData : urlData.url;
      const sourceUrl = typeof urlData === 'object' ? urlData.sourceUrl : null;

      // Determine if this URL should get SEO analysis
      const shouldAnalyzeSEO =
        enableSEO &&
        (seoPages.length === 0 || // Analyze all if no specific pages
          seoPages.some((page) => page.url === url) || // In specific pages list
          seoDetector.isContentPage(url)); // Is a content page

      return async () => {
        try {
          const result = await this.checkUrlWithSEO(url, sourceUrl, {
            enableSEO: shouldAnalyzeSEO,
          });

          results.push(result);

          if (onProgress) {
            onProgress({
              completed: results.length + failed.length,
              total: urls.length,
              current: result,
              seoAnalyzed: result.seo_data ? 1 : 0,
            });
          }

          return result;
        } catch (error) {
          const failedResult = {
            url,
            sourceUrl,
            http_status_code: error.response?.status || null,
            response_time: null,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            seo_data: null,
            // Legacy compatibility
            statusCode: error.response?.status || null,
            isWorking: false,
            errorType: errorUtils.classifyError(error.response?.status, error),
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          };

          failed.push(failedResult);
          results.push(failedResult);

          if (onProgress) {
            onProgress({
              completed: results.length + failed.length,
              total: urls.length,
              current: failedResult,
              seoAnalyzed: 0,
            });
          }

          return failedResult;
        }
      };
    });

    await batchUtils.rateLimit(
      checkFunctions,
      this.options.maxConcurrent,
      enableSEO ? 300 : 200 // Slightly longer delay for SEO requests
    );

    // Enhanced summary with SEO stats
    const summary = this._generateSummary(results);

    if (enableSEO) {
      const seoResults = results.filter((r) => r.seo_data && !r.seo_data.error);

      if (seoResults.length > 0) {
        summary.seo = seoDetector.getSummary(seoResults.map((r) => r.seo_data));
        console.log(
          `📊 SEO Summary: ${seoResults.length} pages analyzed, avg score: ${summary.seo.averageScore}/100`
        );
      }
    }

    return {
      results,
      summary,
    };
  }

  /**
   * Checks if a status code indicates a working link
   */
  _isStatusCodeOk(statusCode) {
    // 2xx and 3xx are generally OK
    // Some 4xx might be OK depending on context (e.g., 401 for protected resources)
    return statusCode >= 200 && statusCode < 400;
  }

  /**
   * Determines if a request should be retried based on status code
   */
  _shouldRetry(statusCode) {
    // Retry on 5xx server errors and some 4xx errors
    const retryableCodes = [408, 429, 500, 502, 503, 504];
    return retryableCodes.includes(statusCode);
  }

  /**
   * Extracts relevant headers from response
   */
  _extractRelevantHeaders(headers) {
    const relevantHeaders = {};

    const headerKeys = [
      'content-type',
      'content-length',
      'last-modified',
      'cache-control',
      'expires',
      'server',
      'x-powered-by',
      'location',
    ];

    headerKeys.forEach((key) => {
      if (headers[key]) {
        relevantHeaders[key] = headers[key];
      }
    });

    return relevantHeaders;
  }

  /**
   * Generates summary statistics from check results
   */
  _generateSummary(results) {
    const summary = {
      total: results.length,
      working: 0,
      broken: 0,
      blocked: 0, // New: track blocked URLs
      errors: {},
      statusCodes: {},
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    let totalTime = 0;
    let timeCount = 0;

    results.forEach((result) => {
      if (result.blocked) {
        summary.blocked++;
      } else if (result.is_working) {
        summary.working++;
      } else {
        summary.broken++;

        // Count error types
        const errorType = result.errorType || 'unknown';
        summary.errors[errorType] = (summary.errors[errorType] || 0) + 1;
      }

      // Count status codes
      if (result.http_status_code) {
        summary.statusCodes[result.http_status_code] =
          (summary.statusCodes[result.http_status_code] || 0) + 1;
      }

      // Calculate average response time
      if (result.response_time) {
        totalTime += result.response_time;
        timeCount++;
      }
    });

    if (timeCount > 0) {
      summary.averageResponseTime = Math.round(totalTime / timeCount);
    }
    summary.totalResponseTime = totalTime;

    return summary;
  }

  /**
   * Validates URLs before checking (filters out invalid ones)
   */
  validateUrls(urls) {
    const valid = [];
    const invalid = [];

    urls.forEach((urlData) => {
      const url = typeof urlData === 'string' ? urlData : urlData.url;

      try {
        new URL(url);

        // Additional validation
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // ADD THIS: Security validation
          const validation = securityUtils.isSafeUrl(url);
          if (!validation.safe) {
            invalid.push({ url, reason: `Security: ${validation.reason}` });
          } else {
            valid.push(urlData);
          }
        } else {
          invalid.push({ url, reason: 'Invalid protocol' });
        }
      } catch (error) {
        invalid.push({ url, reason: 'Invalid URL format' });
      }
    });

    return { valid, invalid };
  }
}

// Export a default instance
export const httpChecker = new HttpChecker();

// Export the class for custom configurations
export default HttpChecker;
