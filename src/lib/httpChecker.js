/**
 * HTTP status checker for validating links.
 * Uses safeFetch for all outbound requests (SSRF protection + redirect validation).
 */

import { errorUtils, batchUtils } from './utils.js';
import { securityUtils } from './security.js';
import { seoDetector } from './seoDetector.js';
import { evaluateRobots } from './robotsAudit.js';
import { safeFetch } from './safeFetch.js';

// ── Adaptive per-host rate-limit handling ────────────────────────────────
// A 429 (or a 503 carrying Retry-After) means "you're going too fast", not
// "this page is broken". We honour Retry-After, pause the whole host, and —
// if it keeps throttling — open a circuit breaker so the rest of that host's
// URLs are skipped fast instead of hammered and mislabelled as broken.
//
// State is module-level on purpose: the crawl builds a fresh HttpChecker per
// batch, so instance state would reset every ~10 URLs. Keying by host here
// makes a throttling site slow us down for the rest of the run (and across
// concurrent worker jobs hitting the same host). Entries are timestamp-based
// and self-expire, so a cooldown can never get permanently stuck.
const hostThrottle = new Map(); // host -> { cooldownUntil, consecutive, openUntil }

const RL = {
  MAX_WAIT_MS: 30_000, // cap a single Retry-After wait so one URL can't stall a job for minutes
  BASE_COOLDOWN_MS: 4_000, // per-host pause after a rate-limit hit (escalates with consecutive hits)
  MAX_COOLDOWN_MS: 60_000, // ceiling on the escalating per-host pause
  OPEN_THRESHOLD: 5, // consecutive hits on a host before the breaker opens
  OPEN_MS: 120_000, // how long the breaker stays open (URLs skipped) for a host
};

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Retry-After is either delta-seconds or an HTTP-date. Returns ms, or null.
function parseRetryAfter(value) {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(value);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

function isRateLimitStatus(status, headers) {
  if (status === 429) return true;
  // A bare 503 is a genuine outage (stays a broken-link result); a 503 *with*
  // Retry-After is a throttle signal (Cloudflare and friends use it that way).
  if (status === 503 && headers && headers.get('retry-after')) return true;
  return false;
}

function isHostCircuitOpen(host) {
  if (!host) return false;
  const s = hostThrottle.get(host);
  return !!(s && s.openUntil > Date.now());
}

function hostCooldownMs(host) {
  if (!host) return 0;
  const s = hostThrottle.get(host);
  if (!s || !s.cooldownUntil) return 0;
  return Math.max(0, Math.min(s.cooldownUntil - Date.now(), RL.MAX_WAIT_MS));
}

// Record a rate-limit hit; escalate the host cooldown, maybe open the breaker,
// and return how long to wait before retrying THIS url (bounded).
function noteRateLimit(host, retryAfterMs) {
  const bounded = (ms) => Math.min(ms, RL.MAX_WAIT_MS);
  if (!host) return bounded(retryAfterMs ?? RL.BASE_COOLDOWN_MS);

  const now = Date.now();
  const s = hostThrottle.get(host) || { cooldownUntil: 0, consecutive: 0, openUntil: 0 };
  s.consecutive += 1;
  const escalated = Math.min(RL.BASE_COOLDOWN_MS * s.consecutive, RL.MAX_COOLDOWN_MS);
  s.cooldownUntil = now + escalated;
  if (s.consecutive >= RL.OPEN_THRESHOLD) s.openUntil = now + RL.OPEN_MS;
  hostThrottle.set(host, s);

  return bounded(retryAfterMs ?? escalated);
}

// A clean response clears the host's throttle state.
function noteSuccess(host) {
  if (!host) return;
  if (hostThrottle.has(host)) hostThrottle.delete(host);
}

// Exposed for tests / crawl handoff between jobs.
export function _resetHostThrottle() {
  hostThrottle.clear();
}

// Internals surfaced for unit tests only (underscore = not public API).
export const _rateLimitInternals = {
  RL,
  hostThrottle,
  hostOf,
  parseRetryAfter,
  isRateLimitStatus,
  isHostCircuitOpen,
  hostCooldownMs,
  noteRateLimit,
  noteSuccess,
};

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

    const host = hostOf(url);
    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      if (isHostCircuitOpen(host)) {
        return this._rateLimitedResult(url, sourceUrl, null, Date.now() - startTime, attempt + 1, true);
      }
      const gate = hostCooldownMs(host);
      if (gate > 0) await batchUtils.delay(gate);

      try {
        const response = await safeFetch(url, { ...this.fetchOpts, readBody: false });
        const responseTime = Date.now() - startTime;

        if (isRateLimitStatus(response.status, response.headers)) {
          const wait = noteRateLimit(host, parseRetryAfter(response.headers.get('retry-after')));
          if (attempt < this.options.retryAttempts) {
            await batchUtils.delay(wait);
            attempt++;
            continue;
          }
          return this._rateLimitedResult(url, sourceUrl, response.status, responseTime, attempt + 1);
        }

        noteSuccess(host);
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

    const host = hostOf(url);
    if (isHostCircuitOpen(host)) {
      return this._rateLimitedResult(url, null, null, Date.now() - startTime, 1, true);
    }
    const gate = hostCooldownMs(host);
    if (gate > 0) await batchUtils.delay(gate);

    try {
      const response = await safeFetch(url, { ...this.fetchOpts, method: 'HEAD', timeout: 5000, readBody: false });
      const responseTime = Date.now() - startTime;

      if (isRateLimitStatus(response.status, response.headers)) {
        const wait = noteRateLimit(host, parseRetryAfter(response.headers.get('retry-after')));
        await batchUtils.delay(wait);
        const retry = await safeFetch(url, { ...this.fetchOpts, method: 'HEAD', timeout: 5000, readBody: false });
        if (isRateLimitStatus(retry.status, retry.headers)) {
          noteRateLimit(host, parseRetryAfter(retry.headers.get('retry-after')));
          return this._rateLimitedResult(url, null, retry.status, Date.now() - startTime, 2);
        }
        noteSuccess(host);
        return {
          url,
          http_status_code: retry.status,
          response_time: Date.now() - startTime,
          checked_at: new Date().toISOString(),
          is_working: this._isStatusCodeOk(retry.status),
          error_message: null,
          statusCode: retry.status,
          isWorking: this._isStatusCodeOk(retry.status),
          method: 'HEAD',
        };
      }

      noteSuccess(host);
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

    const host = hostOf(url);
    let attempt = 0;
    while (attempt <= this.options.retryAttempts) {
      if (isHostCircuitOpen(host)) {
        return this._rateLimitedResult(url, sourceUrl, null, Date.now() - startTime, attempt + 1, true);
      }
      const gate = hostCooldownMs(host);
      if (gate > 0) await batchUtils.delay(gate);

      try {
        const method = enableSEO ? 'GET' : 'HEAD';
        const response = await safeFetch(url, {
          ...this.fetchOpts,
          method,
          readBody: enableSEO,
        });

        const responseTime = Date.now() - startTime;

        if (isRateLimitStatus(response.status, response.headers)) {
          const wait = noteRateLimit(host, parseRetryAfter(response.headers.get('retry-after')));
          if (attempt < this.options.retryAttempts) {
            await batchUtils.delay(wait);
            attempt++;
            continue;
          }
          return this._rateLimitedResult(url, sourceUrl, response.status, responseTime, attempt + 1);
        }

        noteSuccess(host);
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
                  // Security headers (G16) — presence rolled up into the Security cell
                  'strict-transport-security':
                    response.headers.get('strict-transport-security') || null,
                  'content-security-policy':
                    response.headers.get('content-security-policy') || null,
                  'x-frame-options': response.headers.get('x-frame-options') || null,
                  'x-content-type-options': response.headers.get('x-content-type-options') || null,
                  'referrer-policy': response.headers.get('referrer-policy') || null,
                  'permissions-policy': response.headers.get('permissions-policy') || null,
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

  // A rate-limited URL is "undetermined", not "broken" — the host throttled us
  // before it could answer. Carries a distinct errorType + rateLimited flag so
  // callers can keep it out of the broken-link findings.
  _rateLimitedResult(url, sourceUrl, status, responseTime, attempt, skipped = false) {
    return {
      url, sourceUrl,
      http_status_code: status ?? null,
      response_time: responseTime ?? null,
      checked_at: new Date().toISOString(),
      is_working: false,
      rateLimited: true,
      error_message: skipped
        ? 'Not checked — host is rate-limiting our crawler'
        : `Rate limited by host (HTTP ${status})`,
      statusCode: status ?? null,
      responseTime: responseTime ?? null,
      isWorking: false,
      errorType: 'rate_limited',
      attempt,
      timestamp: new Date().toISOString(),
      seo_data: null,
    };
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
    const summary = { total: results.length, working: 0, broken: 0, blocked: 0, rateLimited: 0, errors: {}, statusCodes: {}, averageResponseTime: 0, totalResponseTime: 0 };
    let totalTime = 0;
    let timeCount = 0;

    results.forEach((result) => {
      if (result.blocked) {
        summary.blocked++;
      } else if (result.rateLimited) {
        // Undetermined, not broken — the host throttled us before answering.
        summary.rateLimited++;
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
