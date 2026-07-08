// src/lib/rateLimit.js - Rate-limiting middleware wrappers
import { NextResponse } from 'next/server';
import { validateAdvancedRateLimit, getRateLimitStats } from './validation.js';
import { getClientIp } from './clientIp.js';

/**
 * Higher-order function: wraps an API route handler with rate limiting.
 * Usage: export const POST = withRateLimit('crawl')(async (request) => { ... });
 */
export function withRateLimit(endpoint) {
  return function rateLimitMiddleware(handler) {
    return async function wrappedHandler(request, context) {
      try {
        const clientIP = getClientIp(request);
        const rateLimit = await validateAdvancedRateLimit(clientIP, endpoint);

        if (!rateLimit.allowed) {
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: rateLimit.reason,
              retryAfter: rateLimit.retryAfter,
              blockedUntil: rateLimit.blockedUntil,
              endpoint,
            },
            {
              status: 429,
              headers: {
                'Retry-After': rateLimit.retryAfter.toString(),
                'X-RateLimit-Exceeded': 'true',
                'X-RateLimit-Endpoint': endpoint,
                ...(rateLimit.headers || {}),
              },
            }
          );
        }

        const response = await handler(request, context);

        if (response instanceof NextResponse && rateLimit.headers) {
          Object.entries(rateLimit.headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          response.headers.set('X-RateLimit-Endpoint', endpoint);
        }

        return response;
      } catch (error) {
        console.error(`Rate limiting middleware error for ${endpoint}:`, error);
        return await handler(request, context);
      }
    };
  };
}

/** Pre-configured rate-limiting middlewares for each endpoint type. */
export const rateLimiters = {
  analyze: withRateLimit('analyze'),
  crawl:   withRateLimit('crawl'),
  status:  withRateLimit('status'),
  results: withRateLimit('results'),
  health:  withRateLimit('health'),
  general: withRateLimit('general'),
};

/** Convenience wrapper: rateLimiters.analyze(handler). */
export function createRateLimitedHandler(endpoint, handler) {
  return withRateLimit(endpoint)(handler);
}

/** Check multiple rate-limit buckets in sequence; returns first denied or all-allowed. */
export async function checkMultipleRateLimits(clientIP, endpoints) {
  const results = {};
  let anyBlocked = false;
  let highestRetryAfter = 0;

  for (const endpoint of endpoints) {
    const result = await validateAdvancedRateLimit(clientIP, endpoint);
    results[endpoint] = result;

    if (!result.allowed) {
      anyBlocked = true;
      highestRetryAfter = Math.max(highestRetryAfter, result.retryAfter || 0);
    }
  }

  return {
    allowed: !anyBlocked,
    retryAfter: highestRetryAfter,
    results,
    blockedEndpoints: Object.entries(results)
      .filter(([, result]) => !result.allowed)
      .map(([endpoint]) => endpoint),
  };
}

/** Rate-limit status for monitoring dashboards. */
export async function getRateLimitStatus() {
  const stats = await getRateLimitStats();
  return {
    timestamp: new Date().toISOString(),
    stats,
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV,
    rateLimitConfig: {
      analyze: '10 requests / 15 minutes',
      crawl:   '20 requests / 1 hour',
      status:  '5000 requests / 1 hour (dynamic)',
      results: '500 requests / 15 minutes',
      health:  '2000 requests / 5 minutes',
    },
  };
}

export default {
  withRateLimit,
  rateLimiters,
  createRateLimitedHandler,
  checkMultipleRateLimits,
  getRateLimitStatus,
};
