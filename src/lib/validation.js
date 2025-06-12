// src/lib/validation.js - Enhanced input validation with Zod
import { z } from 'zod';
import { securityUtils } from './security.js';

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

// Rate limiting validation
export function validateRateLimit(ip, windowMs = 15 * 60 * 1000, maxRequests = 20) {
  // This would need a Redis store in production
  // For now, using a simple in-memory store (not suitable for production)
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean old entries
  for (const [key, timestamps] of global.rateLimitStore.entries()) {
    const filtered = timestamps.filter((time) => time > windowStart);
    if (filtered.length === 0) {
      global.rateLimitStore.delete(key);
    } else {
      global.rateLimitStore.set(key, filtered);
    }
  }

  // Check current IP
  const requests = global.rateLimitStore.get(ip) || [];
  const recentRequests = requests.filter((time) => time > windowStart);

  if (recentRequests.length >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000),
    };
  }

  // Add current request
  recentRequests.push(now);
  global.rateLimitStore.set(ip, recentRequests);

  return {
    allowed: true,
    remaining: maxRequests - recentRequests.length,
  };
}
