/**
 * HTTP status checker for validating links
 * Handles various types of HTTP requests and error conditions
 */

import axios from 'axios';
import { errorUtils, batchUtils } from './utils.js';

export class HttpChecker {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      maxRedirects: 5,
      userAgent: 'Broken Link Checker Bot/1.0 (+https://your-domain.com/bot)',
      maxConcurrent: 5,
      retryAttempts: 2,
      retryDelay: 1000,
      respectRobots: true,
      ...options,
    };

    // Configure axios defaults
    this.axiosConfig = {
      timeout: this.options.timeout,
      maxRedirects: this.options.maxRedirects,
      headers: {
        'User-Agent': this.options.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      validateStatus: () => true, // Don't throw on any status code
    };
  }

  /**
   * Checks a single URL and returns detailed status information
   */
  async checkUrl(url, sourceUrl = null) {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= this.options.retryAttempts) {
      try {
        const response = await axios.get(url, this.axiosConfig);
        const responseTime = Date.now() - startTime;

        const result = {
          url,
          sourceUrl,
          statusCode: response.status,
          responseTime,
          isWorking: this._isStatusCodeOk(response.status),
          finalUrl: response.request.res?.responseUrl || url,
          redirectCount: response.request._redirectCount || 0,
          headers: this._extractRelevantHeaders(response.headers),
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
        };

        // If successful or non-retryable error, return result
        if (result.isWorking || !this._shouldRetry(response.status)) {
          if (!result.isWorking) {
            result.errorType = errorUtils.classifyError(response.status);
            result.errorMessage = errorUtils.getErrorMessage(result.errorType, response.status);
          }
          return result;
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;

        // If this is the last attempt, return the error
        if (attempt === this.options.retryAttempts) {
          return {
            url,
            sourceUrl,
            statusCode: null,
            responseTime,
            isWorking: false,
            errorType: errorUtils.classifyError(null, error),
            errorMessage: error.message,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
          };
        }
      }

      attempt++;

      // Wait before retry
      if (attempt <= this.options.retryAttempts) {
        await batchUtils.delay(this.options.retryDelay * attempt);
      }
    }
  }

  /**
   * Checks multiple URLs with concurrency control
   */
  async checkUrls(urls, onProgress = null) {
    const results = [];
    const failed = [];

    // Create check functions for each URL
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
            statusCode: null,
            isWorking: false,
            errorType: 'other',
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

    // Execute with rate limiting
    await batchUtils.rateLimit(
      checkFunctions,
      this.options.maxConcurrent,
      100 // 100ms delay between requests
    );

    return {
      results,
      summary: this._generateSummary(results),
    };
  }

  /**
   * Performs a lightweight HEAD request to check if URL exists
   */
  async quickCheck(url) {
    try {
      const response = await axios.head(url, {
        ...this.axiosConfig,
        timeout: 5000, // Shorter timeout for quick checks
      });

      return {
        url,
        statusCode: response.status,
        isWorking: this._isStatusCodeOk(response.status),
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

        return {
          url,
          statusCode: response.status,
          isWorking: this._isStatusCodeOk(response.status),
          method: 'GET (partial)',
        };
      } catch (getError) {
        return {
          url,
          statusCode: null,
          isWorking: false,
          errorType: errorUtils.classifyError(null, getError),
          errorMessage: getError.message,
          method: 'HEAD/GET failed',
        };
      }
    }
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
      errors: {},
      statusCodes: {},
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    let totalTime = 0;
    let timeCount = 0;

    results.forEach((result) => {
      if (result.isWorking) {
        summary.working++;
      } else {
        summary.broken++;

        // Count error types
        const errorType = result.errorType || 'unknown';
        summary.errors[errorType] = (summary.errors[errorType] || 0) + 1;
      }

      // Count status codes
      if (result.statusCode) {
        summary.statusCodes[result.statusCode] = (summary.statusCodes[result.statusCode] || 0) + 1;
      }

      // Calculate average response time
      if (result.responseTime) {
        totalTime += result.responseTime;
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
          valid.push(urlData);
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
