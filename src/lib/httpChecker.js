/**
 * HTTP status checker for validating links.
 * Uses safeFetch for all outbound requests (SSRF protection + redirect validation).
 */

import { errorUtils, batchUtils } from './utils.js';
import { securityUtils } from './security.js';
import { seoDetector } from './seoDetector.js';
import { evaluateRobots } from './robotsAudit.js';
import { safeFetch } from './safeFetch.js';

export class HttpChecker {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      maxRedirects: 3,
      userAgent: 'SeoScrub Bot/1.0 (+https://seoscrub.in/bot)',
      maxConcurrent: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      respectRobots: true,
      ...options,
    };

    this.fetchOpts = {
      headers: securityUtils.getCrawlHeaders(),
      timeout: this.options.timeout,
      maxRedirects: this.options.maxRedirects,
    };
  }

  /**
   * Checks a single URL and returns detailed status information.
   */
  async checkUrl(url, sourceUrl = null) {
    const startTime = Date.now();

    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return {
        url, sourceUrl,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        statusCode: null, isWorking: false, errorType: 'security_blocked', blocked: true,
      };
    }

    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      try {
        const response = await safeFetch(url, { ...this.fetchOpts, readBody: false });
        const responseTime = Date.now() - startTime;
        const isWorking = this._isStatusCodeOk(response.status);

        return {
          url, sourceUrl,
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: isWorking,
          error_message: null,
          statusCode: response.status, responseTime, isWorking,
          finalUrl: response.url,
          redirectCount: response.redirectCount,
          headers: this._extractRelevantHeaders(response.headers),
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        if (attempt === this.options.retryAttempts) {
          const errorType = error.code === 'SSRF_BLOCKED'
            ? 'security_blocked'
            : errorUtils.classifyError(null, error);
          return {
            url, sourceUrl,
            http_status_code: null,
            response_time: responseTime,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            statusCode: null, responseTime, isWorking: false,
            errorType, errorMessage: error.message,
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
   * Checks multiple URLs with concurrency control.
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
          if (onProgress) onProgress({ completed: results.length + failed.length, total: urls.length, current: result });
          return result;
        } catch (error) {
          const failedResult = {
            url, sourceUrl,
            http_status_code: null,
            response_time: null,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            statusCode: null, isWorking: false,
            errorType: errorUtils.classifyError(null, error),
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          };
          failed.push(failedResult);
          results.push(failedResult);
          if (onProgress) onProgress({ completed: results.length + failed.length, total: urls.length, current: failedResult });
          return failedResult;
        }
      };
    });

    await batchUtils.rateLimit(checkFunctions, this.options.maxConcurrent, 200);
    return { results, summary: this._generateSummary(results) };
  }

  /**
   * Lightweight HEAD check; falls back to GET on failure.
   */
  async quickCheck(url) {
    const startTime = Date.now();

    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return {
        url,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        statusCode: null, isWorking: false, method: 'BLOCKED', errorType: 'security_blocked', blocked: true,
      };
    }

    try {
      const response = await safeFetch(url, { ...this.fetchOpts, method: 'HEAD', timeout: 5000, readBody: false });
      const responseTime = Date.now() - startTime;
      return {
        url,
        http_status_code: response.status,
        response_time: responseTime,
        checked_at: new Date().toISOString(),
        is_working: this._isStatusCodeOk(response.status),
        error_message: null,
        statusCode: response.status,
        isWorking: this._isStatusCodeOk(response.status),
        method: 'HEAD',
      };
    } catch {
      // HEAD failed — try a partial GET
      try {
        const response = await safeFetch(url, {
          ...this.fetchOpts,
          method: 'GET',
          timeout: 5000,
          readBody: false,
          headers: { ...this.fetchOpts.headers, Range: 'bytes=0-1023' },
        });
        const responseTime = Date.now() - startTime;
        return {
          url,
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: this._isStatusCodeOk(response.status),
          error_message: null,
          statusCode: response.status,
          isWorking: this._isStatusCodeOk(response.status),
          method: 'GET (partial)',
        };
      } catch (getError) {
        const responseTime = Date.now() - startTime;
        return {
          url,
          http_status_code: null,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: false,
          error_message: getError.message,
          statusCode: null, isWorking: false,
          errorType: getError.code === 'SSRF_BLOCKED' ? 'security_blocked' : errorUtils.classifyError(null, getError),
          errorMessage: getError.message,
          method: 'HEAD/GET failed',
        };
      }
    }
  }

  /**
   * Check URL with optional SEO analysis for content pages.
   */
  async checkUrlWithSEO(url, sourceUrl = null, options = {}) {
    const enableSEO = options.enableSEO || false;
    const startTime = Date.now();

    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return {
        url, sourceUrl,
        http_status_code: null,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        is_working: false,
        error_message: `Security: ${validation.reason}`,
        blocked: true, seo_data: null,
      };
    }

    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      try {
        const method = enableSEO ? 'GET' : 'HEAD';
        const response = await safeFetch(url, {
          ...this.fetchOpts,
          method,
          readBody: enableSEO,
        });

        const responseTime = Date.now() - startTime;
        const isWorking = this._isStatusCodeOk(response.status);

        const result = {
          url, sourceUrl,
          http_status_code: response.status,
          response_time: responseTime,
          checked_at: new Date().toISOString(),
          is_working: isWorking,
          error_message: null,
          statusCode: response.status, responseTime, isWorking,
          finalUrl: response.url,
          redirectCount: response.redirectCount,
          headers: this._extractRelevantHeaders(response.headers),
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
          seo_data: null,
        };

        if (enableSEO && isWorking) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            try {
              const html = await response.text();
              const seoContext = {
                headers: {
                  'x-robots-tag': response.headers.get('x-robots-tag') || null,
                  'last-modified': response.headers.get('last-modified') || null,
                },
                robotsTxt: options.robotsRules ? evaluateRobots(options.robotsRules, url) : null,
              };
              result.seo_data = seoDetector.analyzePage(html, url, response.status, responseTime, seoContext);
            } catch (seoError) {
              result.seo_data = { url, error: seoError.message, analyzedAt: new Date().toISOString() };
            }
          }
        }

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        if (attempt === this.options.retryAttempts) {
          const errorType = error.code === 'SSRF_BLOCKED'
            ? 'security_blocked'
            : errorUtils.classifyError(null, error);
          return {
            url, sourceUrl,
            http_status_code: null,
            response_time: responseTime,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            statusCode: null, responseTime, isWorking: false,
            errorType, errorMessage: error.message,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
            seo_data: null,
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
   * Batch check URLs with optional SEO.
   */
  async checkUrlsWithSEO(urls, options = {}) {
    const enableSEO = options.enableSEO || false;
    const seoPages = options.seoPages || [];
    const onProgress = options.onProgress;

    const results = new Array(urls.length);
    const failed = [];
    let completedCount = 0;

    const checkFunctions = urls.map((urlData, index) => {
      const url = typeof urlData === 'string' ? urlData : urlData.url;
      const sourceUrl = typeof urlData === 'object' ? urlData.sourceUrl : null;

      const shouldAnalyzeSEO =
        enableSEO &&
        (seoPages.length === 0 ||
          seoPages.some((page) => page.url === url) ||
          seoDetector.isContentPage(url));

      return async () => {
        try {
          const result = await this.checkUrlWithSEO(url, sourceUrl, {
            enableSEO: shouldAnalyzeSEO,
            robotsRules: options.robotsRules || null,
          });
          results[index] = result;
          completedCount++;
          if (onProgress) onProgress({ completed: completedCount, total: urls.length, current: result, seoAnalyzed: result.seo_data ? 1 : 0 });
          return result;
        } catch (error) {
          const failedResult = {
            url, sourceUrl,
            http_status_code: null,
            response_time: null,
            checked_at: new Date().toISOString(),
            is_working: false,
            error_message: error.message,
            seo_data: null,
            statusCode: null, isWorking: false,
            errorType: errorUtils.classifyError(null, error),
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          };
          failed.push(failedResult);
          results[index] = failedResult;
          completedCount++;
          if (onProgress) onProgress({ completed: completedCount, total: urls.length, current: failedResult, seoAnalyzed: 0 });
          return failedResult;
        }
      };
    });

    await batchUtils.rateLimit(checkFunctions, this.options.maxConcurrent, enableSEO ? 300 : 200);

    const summary = this._generateSummary(results);
    if (enableSEO) {
      const seoResults = results.filter((r) => r.seo_data && !r.seo_data.error);
      if (seoResults.length > 0) {
        summary.seo = seoDetector.getSummary(seoResults.map((r) => r.seo_data));
      }
    }

    return { results, summary };
  }

  _isStatusCodeOk(statusCode) {
    return statusCode >= 200 && statusCode < 400;
  }

  _extractRelevantHeaders(headers) {
    const keys = ['content-type', 'content-length', 'last-modified', 'cache-control', 'expires', 'server', 'x-powered-by', 'location', 'x-robots-tag'];
    const result = {};
    for (const key of keys) {
      const val = headers.get(key);
      if (val) result[key] = val;
    }
    return result;
  }

  _generateSummary(results) {
    const summary = { total: results.length, working: 0, broken: 0, blocked: 0, errors: {}, statusCodes: {}, averageResponseTime: 0, totalResponseTime: 0 };
    let totalTime = 0;
    let timeCount = 0;

    results.forEach((result) => {
      if (result.blocked) {
        summary.blocked++;
      } else if (result.is_working) {
        summary.working++;
      } else {
        summary.broken++;
        const errorType = result.errorType || 'unknown';
        summary.errors[errorType] = (summary.errors[errorType] || 0) + 1;
      }
      if (result.http_status_code) {
        summary.statusCodes[result.http_status_code] = (summary.statusCodes[result.http_status_code] || 0) + 1;
      }
      if (result.response_time) {
        totalTime += result.response_time;
        timeCount++;
      }
    });

    if (timeCount > 0) summary.averageResponseTime = Math.round(totalTime / timeCount);
    summary.totalResponseTime = totalTime;
    return summary;
  }

  validateUrls(urls) {
    const valid = [];
    const invalid = [];

    urls.forEach((urlData) => {
      const url = typeof urlData === 'string' ? urlData : urlData.url;
      try {
        new URL(url);
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const validation = securityUtils.isSafeUrl(url);
          if (!validation.safe) {
            invalid.push({ url, reason: `Security: ${validation.reason}` });
          } else {
            valid.push(urlData);
          }
        } else {
          invalid.push({ url, reason: 'Invalid protocol' });
        }
      } catch {
        invalid.push({ url, reason: 'Invalid URL format' });
      }
    });

    return { valid, invalid };
  }
}

export const httpChecker = new HttpChecker();
export default HttpChecker;
