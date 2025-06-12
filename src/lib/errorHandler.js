// src/lib/errorHandler.js - Centralized secure error handling
import { NextResponse } from 'next/server';
import { logSecurityEvent, SECURITY_EVENTS, SEVERITY } from './securityLogger.js';

// Error types for classification
export const ERROR_TYPES = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  RATE_LIMIT: 'rate_limit_error',
  SECURITY: 'security_error',
  DATABASE: 'database_error',
  EXTERNAL_API: 'external_api_error',
  NETWORK: 'network_error',
  PARSING: 'parsing_error',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  INTERNAL: 'internal_error',
};

// Error codes for consistent API responses
export const ERROR_CODES = {
  // Client errors (4xx)
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_URL: 'INVALID_URL',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  ROBOTS_BLOCKED: 'ROBOTS_BLOCKED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

// Sanitized error messages (safe for production)
const SAFE_ERROR_MESSAGES = {
  [ERROR_CODES.INVALID_REQUEST]: 'The request contains invalid data',
  [ERROR_CODES.MISSING_PARAMETER]: 'Required parameters are missing',
  [ERROR_CODES.INVALID_URL]: 'The provided URL is not valid',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.FORBIDDEN]: 'Access denied',
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found',
  [ERROR_CODES.SECURITY_BLOCKED]: 'Request blocked for security reasons',
  [ERROR_CODES.ROBOTS_BLOCKED]: 'Request blocked by robots.txt policy',
  [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred',
  [ERROR_CODES.DATABASE_ERROR]: 'Database temporarily unavailable',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service temporarily unavailable',
  [ERROR_CODES.TIMEOUT]: 'Request timeout occurred',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

// Security headers for error responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

class SecureErrorHandler {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.enableDetailedErrors = process.env.ENABLE_DETAILED_ERRORS === 'true';
  }

  /**
   * Main error handling method
   */
  async handleError(error, request = null, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    // Classify the error
    const classification = this.classifyError(error);

    // Determine if this is a security-related error
    const isSecurityError = this.isSecurityError(error, classification);

    // Log the error securely
    await this.logError(error, request, classification, errorId, context);

    // Log security events if needed
    if (isSecurityError && request) {
      await this.logSecurityEvent(error, request, classification);
    }

    // Generate safe response
    const response = this.createSafeResponse(error, classification, errorId, timestamp);

    return response;
  }

  /**
   * Classify error type and severity
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';
    const stack = error.stack || '';

    // Database errors
    if (
      message.includes('database') ||
      message.includes('supabase') ||
      message.includes('postgresql')
    ) {
      return {
        type: ERROR_TYPES.DATABASE,
        code: ERROR_CODES.DATABASE_ERROR,
        severity: SEVERITY.HIGH,
        httpStatus: 503,
      };
    }

    // Validation errors (Zod)
    if (name === 'zoderror' || message.includes('validation')) {
      return {
        type: ERROR_TYPES.VALIDATION,
        code: ERROR_CODES.INVALID_REQUEST,
        severity: SEVERITY.LOW,
        httpStatus: 400,
      };
    }

    // Network/timeout errors
    if (message.includes('timeout') || message.includes('network') || name.includes('timeout')) {
      return {
        type: ERROR_TYPES.NETWORK,
        code: ERROR_CODES.TIMEOUT,
        severity: SEVERITY.MEDIUM,
        httpStatus: 504,
      };
    }

    // Parsing errors
    if (message.includes('json') || message.includes('parse') || name.includes('syntax')) {
      return {
        type: ERROR_TYPES.PARSING,
        code: ERROR_CODES.INVALID_REQUEST,
        severity: SEVERITY.LOW,
        httpStatus: 400,
      };
    }

    // Security-related errors
    if (
      message.includes('blocked') ||
      message.includes('forbidden') ||
      message.includes('security')
    ) {
      return {
        type: ERROR_TYPES.SECURITY,
        code: ERROR_CODES.SECURITY_BLOCKED,
        severity: SEVERITY.HIGH,
        httpStatus: 403,
      };
    }

    // Rate limiting errors
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        type: ERROR_TYPES.RATE_LIMIT,
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        severity: SEVERITY.MEDIUM,
        httpStatus: 429,
      };
    }

    // External API errors
    if (message.includes('fetch') || message.includes('api') || stack.includes('fetch')) {
      return {
        type: ERROR_TYPES.EXTERNAL_API,
        code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        severity: SEVERITY.MEDIUM,
        httpStatus: 502,
      };
    }

    // Default to internal error
    return {
      type: ERROR_TYPES.INTERNAL,
      code: ERROR_CODES.INTERNAL_ERROR,
      severity: SEVERITY.HIGH,
      httpStatus: 500,
    };
  }

  /**
   * Determine if error should trigger security logging
   */
  isSecurityError(error, classification) {
    const securityTypes = [
      ERROR_TYPES.SECURITY,
      ERROR_TYPES.AUTHENTICATION,
      ERROR_TYPES.AUTHORIZATION,
    ];

    const suspiciousMessages = [
      'blocked',
      'forbidden',
      'unauthorized',
      'invalid token',
      'malicious',
      'attack',
      'injection',
      'xss',
      'csrf',
    ];

    return (
      securityTypes.includes(classification.type) ||
      suspiciousMessages.some((keyword) => error.message?.toLowerCase().includes(keyword))
    );
  }

  /**
   * Log error securely (without exposing sensitive data)
   */
  async logError(error, request, classification, errorId, context) {
    const logData = {
      errorId,
      timestamp: new Date().toISOString(),
      type: classification.type,
      code: classification.code,
      severity: classification.severity,
      httpStatus: classification.httpStatus,
      endpoint: request?.nextUrl?.pathname,
      method: request?.method,
      userAgent: request?.headers.get('user-agent')?.substring(0, 200),
      ip: this.extractIP(request),
      context: this.sanitizeContext(context),
    };

    // Add safe error details
    if (this.isDevelopment || this.enableDetailedErrors) {
      logData.errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 10), // Limit stack trace
      };
    }

    // Log to console
    if (
      classification.severity === SEVERITY.HIGH ||
      classification.severity === SEVERITY.CRITICAL
    ) {
      console.error(`🚨 [${errorId}] HIGH SEVERITY ERROR:`, logData);
    } else {
      console.log(`⚠️ [${errorId}] ERROR:`, logData);
    }

    // In production, you might want to send to external logging service
    if (!this.isDevelopment) {
      // await this.sendToExternalLogger(logData);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(error, request, classification) {
    try {
      await logSecurityEvent({
        eventType: SECURITY_EVENTS.MALICIOUS_REQUEST,
        request,
        details: {
          errorType: classification.type,
          errorCode: classification.code,
          errorMessage: this.sanitizeErrorMessage(error.message),
          classification: classification.type,
        },
        severity: classification.severity,
        blocked: true,
      });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
  }

  /**
   * Create safe response for client
   */
  createSafeResponse(error, classification, errorId, timestamp) {
    const safeMessage =
      SAFE_ERROR_MESSAGES[classification.code] || SAFE_ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];

    const responseBody = {
      success: false,
      error: {
        code: classification.code,
        message: safeMessage,
        type: classification.type,
        timestamp,
        errorId: this.isDevelopment ? errorId : undefined,
      },
    };

    // Add detailed error info in development
    if (this.isDevelopment || this.enableDetailedErrors) {
      responseBody.error.details = {
        originalMessage: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 5), // Limited stack trace
      };
    }

    // Add retry information for temporary errors
    if (
      classification.httpStatus >= 500 ||
      classification.code === ERROR_CODES.RATE_LIMIT_EXCEEDED
    ) {
      responseBody.error.retryable = true;
      responseBody.error.retryAfter = this.getRetryAfter(classification);
    }

    return NextResponse.json(responseBody, {
      status: classification.httpStatus,
      headers: {
        ...SECURITY_HEADERS,
        'X-Error-ID': errorId,
        'X-Error-Type': classification.type,
      },
    });
  }

  /**
   * Generate unique error ID for tracking
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract IP safely
   */
  extractIP(request) {
    if (!request) return 'unknown';

    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    );
  }

  /**
   * Sanitize context data (remove sensitive info)
   */
  sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize error messages (remove file paths, etc.)
   */
  sanitizeErrorMessage(message) {
    if (!message) return 'Unknown error';

    return message
      .replace(/\/[a-zA-Z0-9_\-\/\.]+/g, '[PATH]') // Remove file paths
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // Remove IP addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Remove emails
      .substring(0, 200); // Limit length
  }

  /**
   * Get retry-after value for temporary errors
   */
  getRetryAfter(classification) {
    switch (classification.code) {
      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return 60; // 1 minute
      case ERROR_CODES.DATABASE_ERROR:
        return 30; // 30 seconds
      case ERROR_CODES.EXTERNAL_SERVICE_ERROR:
        return 15; // 15 seconds
      default:
        return 5; // 5 seconds
    }
  }
}

// Create singleton instance
export const errorHandler = new SecureErrorHandler();

// Convenience functions for common error types
export const handleValidationError = (error, request = null) =>
  errorHandler.handleError(error, request, { type: 'validation' });

export const handleDatabaseError = (error, request = null) =>
  errorHandler.handleError(error, request, { type: 'database' });

export const handleSecurityError = (error, request = null) =>
  errorHandler.handleError(error, request, { type: 'security' });

export const handleNetworkError = (error, request = null) =>
  errorHandler.handleError(error, request, { type: 'network' });

// Default export
export default errorHandler;
