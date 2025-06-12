// src/lib/securityLogger.js - Security event logging system
import { supabaseAdmin } from './supabase.js';

// Security event types
export const SECURITY_EVENTS = {
  RATE_LIMIT_VIOLATION: 'rate_limit_violation',
  BLOCKED_URL: 'blocked_url',
  ROBOTS_BLOCKED: 'robots_blocked',
  INVALID_INPUT: 'invalid_input',
  SUSPICIOUS_PATTERN: 'suspicious_pattern',
  CRAWL_ABUSE: 'crawl_abuse',
  SECURITY_SCAN: 'security_scan',
  MALICIOUS_REQUEST: 'malicious_request',
};

// Severity levels
export const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

class SecurityLogger {
  constructor() {
    this.client = supabaseAdmin;
    this.enabled =
      process.env.NODE_ENV === 'production' || process.env.ENABLE_SECURITY_LOGGING === 'true';
  }

  /**
   * Log a security event
   */
  async logEvent({
    eventType,
    ipAddress,
    userAgent,
    endpoint,
    details = {},
    severity = SEVERITY.MEDIUM,
    blocked = false,
    request = null,
  }) {
    try {
      // Extract additional info from request if provided
      if (request) {
        ipAddress = ipAddress || this.extractIP(request);
        userAgent = userAgent || request.headers.get('user-agent');
        endpoint = endpoint || request.nextUrl?.pathname;
      }

      const eventData = {
        event_type: eventType,
        ip_address: ipAddress,
        user_agent: userAgent?.substring(0, 500), // Limit length
        endpoint: endpoint?.substring(0, 100),
        details: {
          ...details,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        },
        severity,
        blocked,
      };

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔒 SECURITY EVENT [${severity.toUpperCase()}]:`, eventData);
      }

      // Save to database if enabled
      if (this.enabled && this.client) {
        const { error } = await this.client.from('security_events').insert(eventData);

        if (error) {
          console.error('❌ Failed to log security event:', error);
        }
      }

      // Alert on critical events
      if (severity === SEVERITY.CRITICAL) {
        await this.alertCriticalEvent(eventData);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Security logging error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract IP address from request
   */
  extractIP(request) {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }

  /**
   * Log rate limit violations
   */
  async logRateLimitViolation(request, endpoint, details = {}) {
    return await this.logEvent({
      eventType: SECURITY_EVENTS.RATE_LIMIT_VIOLATION,
      request,
      endpoint,
      details: {
        ...details,
        action: 'rate_limit_exceeded',
      },
      severity: SEVERITY.MEDIUM,
      blocked: true,
    });
  }

  /**
   * Log blocked URLs (SSRF attempts)
   */
  async logBlockedUrl(request, url, reason) {
    return await this.logEvent({
      eventType: SECURITY_EVENTS.BLOCKED_URL,
      request,
      details: {
        blocked_url: url,
        reason,
        action: 'url_blocked',
      },
      severity: SEVERITY.HIGH,
      blocked: true,
    });
  }

  /**
   * Log robots.txt violations
   */
  async logRobotsBlocked(request, url, reason) {
    return await this.logEvent({
      eventType: SECURITY_EVENTS.ROBOTS_BLOCKED,
      request,
      details: {
        blocked_url: url,
        reason,
        action: 'robots_blocked',
      },
      severity: SEVERITY.MEDIUM,
      blocked: true,
    });
  }

  /**
   * Log invalid input attempts
   */
  async logInvalidInput(request, validationErrors, inputData = {}) {
    return await this.logEvent({
      eventType: SECURITY_EVENTS.INVALID_INPUT,
      request,
      details: {
        validation_errors: validationErrors,
        input_sample: this.sanitizeInput(inputData),
        action: 'invalid_input',
      },
      severity: SEVERITY.LOW,
      blocked: false,
    });
  }

  /**
   * Log suspicious crawling patterns
   */
  async logSuspiciousPattern(request, pattern, details = {}) {
    return await this.logEvent({
      eventType: SECURITY_EVENTS.SUSPICIOUS_PATTERN,
      request,
      details: {
        pattern,
        ...details,
        action: 'suspicious_detected',
      },
      severity: SEVERITY.MEDIUM,
      blocked: false,
    });
  }

  /**
   * Sanitize input data for logging (remove sensitive info)
   */
  sanitizeInput(data) {
    const sanitized = { ...data };

    // Remove potentially sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.key;

    // Truncate long strings
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '...';
      }
    });

    return sanitized;
  }

  /**
   * Alert on critical security events
   */
  async alertCriticalEvent(eventData) {
    console.error('🚨 CRITICAL SECURITY EVENT:', eventData);

    // In production, you might want to:
    // - Send email alerts
    // - Post to Slack/Discord
    // - Trigger monitoring systems
    // - Auto-block IPs

    // For now, just log prominently
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 CRITICAL SECURITY ALERT - Manual review required');
    }
  }

  /**
   * Get recent security events (for monitoring)
   */
  async getRecentEvents(limit = 100, hours = 24) {
    if (!this.client) return { events: [], error: 'No database client' };

    try {
      const { data, error } = await this.client
        .from('security_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      return { events: data || [], error };
    } catch (error) {
      return { events: [], error: error.message };
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(hours = 24) {
    if (!this.client) return { stats: {}, error: 'No database client' };

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.client
        .from('security_events')
        .select('event_type, severity, blocked, ip_address')
        .gte('created_at', since);

      if (error) return { stats: {}, error };

      const stats = {
        totalEvents: data.length,
        blockedRequests: data.filter((e) => e.blocked).length,
        uniqueIPs: new Set(data.map((e) => e.ip_address)).size,
        eventTypes: {},
        severityBreakdown: {},
        topIPs: {},
      };

      // Count by event type
      data.forEach((event) => {
        stats.eventTypes[event.event_type] = (stats.eventTypes[event.event_type] || 0) + 1;
        stats.severityBreakdown[event.severity] =
          (stats.severityBreakdown[event.severity] || 0) + 1;
        stats.topIPs[event.ip_address] = (stats.topIPs[event.ip_address] || 0) + 1;
      });

      // Sort top IPs
      stats.topIPs = Object.entries(stats.topIPs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});

      return { stats, error: null };
    } catch (error) {
      return { stats: {}, error: error.message };
    }
  }
}

// Create singleton instance
export const securityLogger = new SecurityLogger();

// Export utility functions
export const logSecurityEvent = securityLogger.logEvent.bind(securityLogger);
export const logRateLimitViolation = securityLogger.logRateLimitViolation.bind(securityLogger);
export const logBlockedUrl = securityLogger.logBlockedUrl.bind(securityLogger);
export const logRobotsBlocked = securityLogger.logRobotsBlocked.bind(securityLogger);
export const logInvalidInput = securityLogger.logInvalidInput.bind(securityLogger);
export const logSuspiciousPattern = securityLogger.logSuspiciousPattern.bind(securityLogger);

export default securityLogger;
