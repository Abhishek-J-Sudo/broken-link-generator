// src/lib/validation.js - CORRECTED: Enhanced input validation with advanced rate limiting
import { z } from 'zod';
import { securityUtils } from './security.js';
import { logRateLimitViolation } from './securityLogger.js';

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
// 🚀 ENHANCED RATE LIMITING SYSTEM
// ========================================
const isDevelopment = process.env.NODE_ENV === 'development';

// 🔧 FIXED: Base rate limiting configuration (used by dynamic system)
const BASE_RATE_LIMITS = {
  // Analysis endpoint - most CPU intensive
  analyze: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: isDevelopment ? 1 * 60 * 1000 : 5 * 60 * 1000,
  },
  // Crawl start endpoint - resource intensive
  crawl: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 2 * 60 * 60 * 1000,
  },
  // Status checking - base limit (will be scaled dynamically)
  status: {
    maxRequests: 5000,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  // Results viewing - generous limits
  results: {
    maxRequests: 500,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
  },
  // Health checks - very generous
  health: {
    maxRequests: 2000,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 2 * 60 * 1000,
  },
  // General endpoint rate limit (fallback)
  general: {
    maxRequests: 200,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 10 * 60 * 1000,
  },
};

// Legacy RATE_LIMITS for backwards compatibility
const RATE_LIMITS = BASE_RATE_LIMITS;

// 🚀 DYNAMIC RATE LIMITS: Scale based on job requirements
function getDynamicRateLimit(endpoint, jobContext = null) {
  const baseLimit = BASE_RATE_LIMITS[endpoint] || BASE_RATE_LIMITS.general;

  // For status checks, scale based on estimated job size
  if (endpoint === 'status' && jobContext) {
    const { jobId, estimatedLinks, crawlLevel } = jobContext;

    let multiplier = 1;

    // Scale rate limits based on crawl level
    if (crawlLevel >= 5 || estimatedLinks > 1000) {
      multiplier = 6; // 6x more status checks allowed for Level 5
    } else if (crawlLevel >= 4 || estimatedLinks > 500) {
      multiplier = 4; // 4x more status checks allowed for Level 4
    } else if (crawlLevel >= 3 || estimatedLinks > 200) {
      multiplier = 2; // 2x more status checks allowed for Level 3
    }

    return {
      ...baseLimit,
      maxRequests: baseLimit.maxRequests * multiplier,
      // Reduce ban time for large jobs
      blockDurationMs: Math.max(baseLimit.blockDurationMs / multiplier, 60000), // Min 1 minute
    };
  }

  return baseLimit;
}

// Enhanced in-memory store for rate limiting
class EnhancedRateLimitStore {
  constructor() {
    this.requests = new Map(); // IP -> { [endpoint]: [timestamps] }
    this.violations = new Map(); // IP -> { [endpoint]: { count, lastViolation, blockedUntil } }
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  // Clean up old entries
  cleanup() {
    const now = Date.now();

    // Clean request history
    for (const [ip, endpoints] of this.requests.entries()) {
      for (const [endpoint, timestamps] of Object.entries(endpoints)) {
        const limit = RATE_LIMITS[endpoint];
        if (!limit) continue;

        const windowStart = now - limit.windowMs;
        const validTimestamps = timestamps.filter((time) => time > windowStart);

        if (validTimestamps.length === 0) {
          delete endpoints[endpoint];
        } else {
          endpoints[endpoint] = validTimestamps;
        }
      }

      if (Object.keys(endpoints).length === 0) {
        this.requests.delete(ip);
      }
    }

    // Clean violation records
    for (const [ip, endpoints] of this.violations.entries()) {
      for (const [endpoint, violation] of Object.entries(endpoints)) {
        if (now > violation.blockedUntil) {
          delete endpoints[endpoint];
        }
      }

      if (Object.keys(endpoints).length === 0) {
        this.violations.delete(ip);
      }
    }

    console.log(
      `🧹 Rate limit cleanup: ${this.requests.size} IPs tracked, ${this.violations.size} IPs with violations`
    );
  }

  // Check if IP is currently blocked for an endpoint
  isBlocked(ip, endpoint) {
    const violations = this.violations.get(ip);
    if (!violations || !violations[endpoint]) return false;

    const now = Date.now();
    return now < violations[endpoint].blockedUntil;
  }

  // Record a violation and potentially block the IP
  async recordViolation(ip, endpoint, request = null) {
    if (!this.violations.has(ip)) {
      this.violations.set(ip, {});
    }

    const ipViolations = this.violations.get(ip);
    const now = Date.now();
    const limit = RATE_LIMITS[endpoint];

    if (!ipViolations[endpoint]) {
      ipViolations[endpoint] = { count: 0, lastViolation: 0, blockedUntil: 0 };
    }

    const violation = ipViolations[endpoint];
    violation.count++;
    violation.lastViolation = now;

    // Progressive penalty: longer blocks for repeat offenders
    const penaltyMultiplier = Math.min(violation.count, 5); // Cap at 5x penalty
    violation.blockedUntil = now + limit.blockDurationMs * penaltyMultiplier;

    console.log(
      `🚫 Rate limit violation from ${ip} on ${endpoint}: violation #${
        violation.count
      }, blocked until ${new Date(violation.blockedUntil).toISOString()}`
    );

    // 🔒 NEW: Log security event
    try {
      await logRateLimitViolation(request, endpoint, {
        violationCount: violation.count,
        penaltyMultiplier,
        blockedUntil: new Date(violation.blockedUntil).toISOString(),
        limit: limit.maxRequests,
        windowMinutes: Math.round(limit.windowMs / 60000),
      });
    } catch (logError) {
      console.error('Failed to log rate limit violation:', logError);
    }
  }

  // Add a request timestamp
  addRequest(ip, endpoint) {
    if (!this.requests.has(ip)) {
      this.requests.set(ip, {});
    }

    const ipRequests = this.requests.get(ip);
    if (!ipRequests[endpoint]) {
      ipRequests[endpoint] = [];
    }

    ipRequests[endpoint].push(Date.now());
  }

  // Get request count for an IP/endpoint within the time window
  getRequestCount(ip, endpoint) {
    const ipRequests = this.requests.get(ip);
    if (!ipRequests || !ipRequests[endpoint]) return 0;

    const limit = RATE_LIMITS[endpoint];
    if (!limit) return 0;

    const now = Date.now();
    const windowStart = now - limit.windowMs;

    return ipRequests[endpoint].filter((time) => time > windowStart).length;
  }

  // Get time until block expires
  getBlockTimeRemaining(ip, endpoint) {
    const violations = this.violations.get(ip);
    if (!violations || !violations[endpoint]) return 0;

    const now = Date.now();
    return Math.max(0, violations[endpoint].blockedUntil - now);
  }

  // Get statistics for monitoring
  getStats() {
    return {
      totalIPs: this.requests.size,
      blockedIPs: this.violations.size,
      totalRequests: Array.from(this.requests.values()).reduce((total, endpoints) => {
        return (
          total + Object.values(endpoints).reduce((sum, timestamps) => sum + timestamps.length, 0)
        );
      }, 0),
    };
  }
}

// Global rate limit store
const rateLimitStore = new EnhancedRateLimitStore();

// Enhanced rate limiting function (standard)
export function validateAdvancedRateLimit(ip, endpoint = 'general') {
  // Normalize endpoint name
  const normalizedEndpoint = endpoint.toLowerCase();

  // Get rate limit configuration
  const limit = RATE_LIMITS[normalizedEndpoint];
  if (!limit) {
    // If no specific limit, use general crawl limits
    return validateAdvancedRateLimit(ip, 'general');
  }

  const now = Date.now();

  // Check if IP is currently blocked
  if (rateLimitStore.isBlocked(ip, normalizedEndpoint)) {
    const remainingMs = rateLimitStore.getBlockTimeRemaining(ip, normalizedEndpoint);
    return {
      allowed: false,
      retryAfter: Math.ceil(remainingMs / 1000),
      reason: 'IP temporarily blocked due to rate limit violations',
      blockedUntil: new Date(now + remainingMs).toISOString(),
    };
  }

  // Get current request count
  const requestCount = rateLimitStore.getRequestCount(ip, normalizedEndpoint);

  // Check if limit exceeded
  if (requestCount >= limit.maxRequests) {
    // Record violation and block IP
    rateLimitStore.recordViolation(ip, normalizedEndpoint);

    const blockDuration = rateLimitStore.getBlockTimeRemaining(ip, normalizedEndpoint);

    return {
      allowed: false,
      retryAfter: Math.ceil(blockDuration / 1000),
      reason: `Rate limit exceeded: ${requestCount}/${limit.maxRequests} requests in ${Math.round(
        limit.windowMs / 60000
      )} minutes`,
      blockedUntil: new Date(now + blockDuration).toISOString(),
    };
  }

  // Add this request to the history
  rateLimitStore.addRequest(ip, normalizedEndpoint);

  // Return success with headers
  return {
    allowed: true,
    remaining: limit.maxRequests - requestCount - 1,
    resetTime: now + limit.windowMs,
    headers: {
      'X-RateLimit-Limit': limit.maxRequests.toString(),
      'X-RateLimit-Remaining': (limit.maxRequests - requestCount - 1).toString(),
      'X-RateLimit-Reset': Math.ceil((now + limit.windowMs) / 1000).toString(),
      'X-RateLimit-Window': Math.ceil(limit.windowMs / 1000).toString(),
    },
  };
}

// 🚀 NEW: Smart status rate limiting with dynamic scaling
export function validateStatusRateLimit(ip, jobContext = null) {
  const endpoint = 'status';

  // Get dynamic rate limit based on job context
  const limit = getDynamicRateLimit(endpoint, jobContext);

  const normalizedEndpoint = endpoint.toLowerCase();
  const now = Date.now();

  // Check if IP is currently blocked
  if (rateLimitStore.isBlocked(ip, normalizedEndpoint)) {
    const remainingMs = rateLimitStore.getBlockTimeRemaining(ip, normalizedEndpoint);
    return {
      allowed: false,
      retryAfter: Math.ceil(remainingMs / 1000),
      reason: 'IP temporarily blocked due to rate limit violations',
      blockedUntil: new Date(now + remainingMs).toISOString(),
    };
  }

  // Get current request count
  const requestCount = rateLimitStore.getRequestCount(ip, normalizedEndpoint);

  // Check if limit exceeded
  if (requestCount >= limit.maxRequests) {
    // Record violation and block IP
    rateLimitStore.recordViolation(ip, normalizedEndpoint);
    const blockDuration = rateLimitStore.getBlockTimeRemaining(ip, normalizedEndpoint);

    return {
      allowed: false,
      retryAfter: Math.ceil(blockDuration / 1000),
      reason: `Rate limit exceeded: ${requestCount}/${limit.maxRequests} requests in ${Math.round(
        limit.windowMs / 60000
      )} minutes (Level ${jobContext?.crawlLevel || '?'} job)`,
      blockedUntil: new Date(now + blockDuration).toISOString(),
    };
  }

  // Add this request to the history
  rateLimitStore.addRequest(ip, normalizedEndpoint);

  // Return success with headers
  return {
    allowed: true,
    remaining: limit.maxRequests - requestCount - 1,
    resetTime: now + limit.windowMs,
    dynamicLimit: limit.maxRequests, // Include the dynamic limit used
    headers: {
      'X-RateLimit-Limit': limit.maxRequests.toString(),
      'X-RateLimit-Remaining': (limit.maxRequests - requestCount - 1).toString(),
      'X-RateLimit-Reset': Math.ceil((now + limit.windowMs) / 1000).toString(),
      'X-RateLimit-Window': Math.ceil(limit.windowMs / 1000).toString(),
      'X-RateLimit-Level': `dynamic-${jobContext?.crawlLevel || 'unknown'}`,
    },
  };
}

// Get rate limiting stats (for monitoring)
export function getRateLimitStats() {
  return rateLimitStore.getStats();
}

// Reset rate limits for an IP (admin function)
export function resetRateLimitForIP(ip) {
  rateLimitStore.requests.delete(ip);
  rateLimitStore.violations.delete(ip);
  console.log(`🔄 Rate limits reset for IP: ${ip}`);
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

// Legacy rate limiting function (deprecated but kept for compatibility)
export function validateRateLimit(ip, windowMs = 15 * 60 * 1000, maxRequests = 20) {
  console.warn('⚠️ validateRateLimit is deprecated. Use validateAdvancedRateLimit instead.');
  return validateAdvancedRateLimit(ip, 'general');
}
