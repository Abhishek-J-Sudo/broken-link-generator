// src/lib/validation.js - Input validation + Redis-backed rate limiting
import { z } from 'zod';
import { securityUtils } from './security.js';
import { logRateLimitViolation } from './securityLogger.js';
import { checkAndRecord } from './redisRateLimit.js';

// URL validation schema
const urlSchema = z
  .string()
  .url('Invalid URL format')
  .refine((url) => {
    // Security validation
    const validation = securityUtils.isSafeUrl(url);
    return validation.safe;
  }, 'URL is not allowed for security reasons')
  .refine((url) => {
    // Additional URL restrictions
    try {
      const urlObj = new URL(url);

      // Block suspicious TLDs
      const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf'];
      if (suspiciousTlds.some((tld) => urlObj.hostname.endsWith(tld))) {
        return false;
      }

      // Block URLs with auth info
      if (urlObj.username || urlObj.password) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, 'URL contains suspicious elements');

// Crawl settings schema
const crawlSettingsSchema = z.object({
  maxDepth: z.number().int().min(1).max(5),
  includeExternal: z.boolean(),
  timeout: z.number().int().min(1000).max(30000),
  usePreAnalyzedUrls: z.boolean().optional(),
  crawlMode: z.enum(['auto', 'content_pages', 'discovered_links']).optional(),
  enableSEO: z.boolean().optional(),
});

// Start crawl request schema
export const startCrawlSchema = z.object({
  url: urlSchema,
  settings: crawlSettingsSchema,
  preAnalyzedUrls: z
    .array(
      z.object({
        url: urlSchema,
        sourceUrl: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .optional(),
});

// Analysis request schema
export const analyzeUrlSchema = z.object({
  url: urlSchema,
  maxDepth: z.number().int().min(1).max(5).default(3),
  maxPages: z.number().int().min(1).max(200).default(100),
});

// Job ID schema
export const jobIdSchema = z.string().uuid('Invalid job ID format');

// Results query schema
export const resultsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  statusFilter: z.enum(['all', 'working', 'broken', 'pages']).optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  errorType: z.string().optional(),
  search: z.string().max(200).optional(),
});

// ========================================
// RATE LIMITING (Redis-backed, shared across replicas)
// ========================================
const isDevelopment = process.env.NODE_ENV === 'development';

const BASE_RATE_LIMITS = {
  analyze: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: isDevelopment ? 1 * 60 * 1000 : 5 * 60 * 1000,
  },
  crawl: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 2 * 60 * 60 * 1000,
  },
  status: {
    maxRequests: 5000,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  results: {
    maxRequests: 500,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
  },
  health: {
    maxRequests: 2000,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 2 * 60 * 1000,
  },
  general: {
    maxRequests: 200,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
  },
};

function getDynamicRateLimit(endpoint, jobContext = null) {
  const base = BASE_RATE_LIMITS[endpoint] || BASE_RATE_LIMITS.general;
  if (endpoint !== 'status' || !jobContext) return base;

  const { estimatedLinks, crawlLevel } = jobContext;
  let multiplier = 1;
  if (crawlLevel >= 5 || estimatedLinks > 1000)     multiplier = 6;
  else if (crawlLevel >= 4 || estimatedLinks > 500) multiplier = 4;
  else if (crawlLevel >= 3 || estimatedLinks > 200) multiplier = 2;

  return {
    ...base,
    maxRequests:    base.maxRequests * multiplier,
    blockDurationMs: Math.max(base.blockDurationMs / multiplier, 60000),
  };
}

function buildDeniedResponse(result, limit, endpoint, jobContext = null) {
  const reason = result.violationCount > 0
    ? `Rate limit exceeded${jobContext ? ` (Level ${jobContext.crawlLevel || '?'} job)` : ''}`
    : 'IP temporarily blocked due to rate limit violations';
  return {
    allowed: false,
    retryAfter:   result.retryAfter,
    reason,
    blockedUntil: result.blockedUntil,
  };
}

/** Redis-backed sliding-window rate limit check. Returns a Promise. */
export async function validateAdvancedRateLimit(ip, endpoint = 'general') {
  const ep = endpoint.toLowerCase();
  const limit = BASE_RATE_LIMITS[ep];
  if (!limit) return validateAdvancedRateLimit(ip, 'general');

  const result = await checkAndRecord(ip, ep, limit);

  if (!result.allowed) {
    logRateLimitViolation(null, ep, {
      violationCount: result.violationCount,
      penaltyMultiplier: Math.min(result.violationCount, 5),
      blockedUntil: result.blockedUntil,
      limit: limit.maxRequests,
      windowMinutes: Math.round(limit.windowMs / 60000),
    }).catch((e) => console.error('Failed to log rate limit violation:', e));
    return buildDeniedResponse(result, limit, ep);
  }

  return result;
}

/** Redis-backed rate limit check with dynamic scaling for status endpoint. */
export async function validateStatusRateLimit(ip, jobContext = null) {
  const ep = 'status';
  const limit = getDynamicRateLimit(ep, jobContext);

  const result = await checkAndRecord(ip, ep, limit);

  if (!result.allowed) {
    logRateLimitViolation(null, ep, {
      violationCount: result.violationCount,
      penaltyMultiplier: Math.min(result.violationCount, 5),
      blockedUntil: result.blockedUntil,
      limit: limit.maxRequests,
      windowMinutes: Math.round(limit.windowMs / 60000),
    }).catch((e) => console.error('Failed to log rate limit violation:', e));
    return buildDeniedResponse(result, limit, ep, jobContext);
  }

  return {
    ...result,
    dynamicLimit: limit.maxRequests,
    headers: {
      ...result.headers,
      'X-RateLimit-Level': `dynamic-${jobContext?.crawlLevel || 'unknown'}`,
    },
  };
}

// ========================================
// EXISTING VALIDATION HELPER FUNCTIONS
// ========================================

// Validation helper functions
export function validateCrawlRequest(data) {
  try {
    return {
      success: true,
      data: startCrawlSchema.parse(data),
    };
  } catch (error) {
    return {
      success: false,
      errors: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
}

export function validateAnalysisRequest(data) {
  try {
    return {
      success: true,
      data: analyzeUrlSchema.parse(data),
    };
  } catch (error) {
    return {
      success: false,
      errors: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
}

export function validateJobId(jobId) {
  try {
    return {
      success: true,
      data: jobIdSchema.parse(jobId),
    };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid job ID format',
    };
  }
}

export function validateResultsQuery(query) {
  try {
    return {
      success: true,
      data: resultsQuerySchema.parse(query),
    };
  } catch (error) {
    return {
      success: false,
      errors: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
}

