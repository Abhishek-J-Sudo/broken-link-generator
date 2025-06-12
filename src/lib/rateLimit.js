// src/lib/rateLimit.js - Centralized Rate Limiting Middleware
import { NextResponse } from 'next/server';
import { validateAdvancedRateLimit, getRateLimitStats } from './validation.js';

/**
 * Rate limiting middleware that can be used across all API routes
 */
export function withRateLimit(endpoint) {
  return function rateLimitMiddleware(handler) {
    return async function wrappedHandler(request, context) {
      try {
        // Extract client IP
        const clientIP =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          request.headers.get('cf-connecting-ip') || // Cloudflare
          'unknown';

        console.log(`🔒 Rate limit check for ${clientIP} on ${endpoint}`);

        // Perform rate limit check
        const rateLimit = validateAdvancedRateLimit(clientIP, endpoint);

        if (!rateLimit.allowed) {
          console.log(`🚫 Rate limit exceeded for ${clientIP} on ${endpoint}: ${rateLimit.reason}`);

          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: rateLimit.reason,
              retryAfter: rateLimit.retryAfter,
              blockedUntil: rateLimit.blockedUntil,
              endpoint: endpoint,
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

        console.log(
          `✅ Rate limit passed for ${clientIP} on ${endpoint}: ${rateLimit.remaining} requests remaining`
        );

        // Call the original handler
        const response = await handler(request, context);

        // Add rate limit headers to successful responses
        if (response instanceof NextResponse && rateLimit.headers) {
          Object.entries(rateLimit.headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });

          // Add additional security headers
          response.headers.set('X-RateLimit-Endpoint', endpoint);
          response.headers.set('X-RateLimit-IP', clientIP.substring(0, 10) + '***'); // Partially mask IP for privacy
        }

        return response;
      } catch (error) {
        console.error(`❌ Rate limiting middleware error for ${endpoint}:`, error);

        // If rate limiting fails, allow the request but log the error
        console.log(`⚠️ Rate limiting failed, allowing request for ${endpoint}`);
        return await handler(request, context);
      }
    };
  };
}

/**
 * Pre-configured rate limiting middlewares for different endpoint types
 */
export const rateLimiters = {
  // Analysis endpoints - most restrictive
  analyze: withRateLimit('analyze'),

  // Crawl endpoints - moderately restrictive
  crawl: withRateLimit('crawl'),

  // Status endpoints - light restrictions
  status: withRateLimit('status'),

  // Results endpoints - generous limits
  results: withRateLimit('results'),

  // Health endpoints - very generous
  health: withRateLimit('health'),

  // General endpoints - default restrictions
  general: withRateLimit('general'),
};

/**
 * Easy-to-use decorator for API route handlers
 * Usage: export const POST = rateLimiters.analyze(async (request) => { ... });
 */
export function createRateLimitedHandler(endpoint, handler) {
  return withRateLimit(endpoint)(handler);
}

/**
 * Batch rate limiting for multiple endpoints
 * Useful when one route might count against multiple limits
 */
export async function checkMultipleRateLimits(clientIP, endpoints) {
  const results = {};
  let anyBlocked = false;
  let highestRetryAfter = 0;

  for (const endpoint of endpoints) {
    const result = validateAdvancedRateLimit(clientIP, endpoint);
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

/**
 * Rate limit status checker for monitoring dashboards
 */
export function getRateLimitStatus() {
  const stats = getRateLimitStats();

  return {
    timestamp: new Date().toISOString(),
    stats,
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV,
    rateLimitConfig: {
      analyze: '3 requests / 15 minutes',
      crawl: '10 requests / 1 hour',
      status: '100 requests / 15 minutes',
      results: '200 requests / 15 minutes',
      health: '1000 requests / 5 minutes',
    },
  };
}

/**
 * Emergency rate limit bypass (for admin use)
 * Usage: bypassRateLimit('192.168.1.100', ['crawl', 'analyze'])
 */
export function bypassRateLimit(clientIP, endpoints = ['all']) {
  console.log(
    `🔓 Emergency rate limit bypass activated for ${clientIP} on endpoints: ${endpoints.join(', ')}`
  );

  // This would need to be implemented based on your specific needs
  // For now, it's just a placeholder for emergency situations

  return {
    success: true,
    message: `Rate limits bypassed for IP ${clientIP}`,
    endpoints: endpoints,
    bypassedAt: new Date().toISOString(),
  };
}

/**
 * Rate limit configuration updater (for dynamic adjustments)
 */
export function updateRateLimitConfig(endpoint, newConfig) {
  console.log(`🔧 Updating rate limit config for ${endpoint}:`, newConfig);

  // This would update the RATE_LIMITS configuration in validation.js
  // Implementation depends on whether you want dynamic config changes

  return {
    success: true,
    endpoint,
    newConfig,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * IP-based rate limit analytics
 */
export function getIPAnalytics(clientIP) {
  // This would provide detailed analytics for a specific IP
  // Useful for investigating suspicious activity

  return {
    ip: clientIP,
    totalRequests: 0, // Would be calculated from the rate limit store
    violations: 0,
    lastActivity: null,
    endpoints: [],
    riskScore: 'low', // low, medium, high
    recommendations: [],
  };
}

/**
 * Utility to extract client IP from various sources
 */
export function getClientIP(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    request.headers.get('x-client-ip') ||
    request.headers.get('x-forwarded') ||
    request.headers.get('forwarded-for') ||
    request.headers.get('forwarded') ||
    'unknown'
  );
}

/**
 * Response helper for rate limit errors
 */
export function createRateLimitResponse(rateLimit, endpoint) {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: rateLimit.reason,
      retryAfter: rateLimit.retryAfter,
      blockedUntil: rateLimit.blockedUntil,
      endpoint: endpoint,
      documentation: 'https://your-domain.com/docs/rate-limits',
    },
    {
      status: 429,
      headers: {
        'Retry-After': rateLimit.retryAfter.toString(),
        'X-RateLimit-Exceeded': 'true',
        'X-RateLimit-Endpoint': endpoint,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        ...(rateLimit.headers || {}),
      },
    }
  );
}

// Export default object for easier importing
export default {
  withRateLimit,
  rateLimiters,
  createRateLimitedHandler,
  checkMultipleRateLimits,
  getRateLimitStatus,
  bypassRateLimit,
  updateRateLimitConfig,
  getIPAnalytics,
  getClientIP,
  createRateLimitResponse,
};
