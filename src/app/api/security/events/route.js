// src/app/api/security/events/route.js - Security monitoring dashboard endpoint
import { NextResponse } from 'next/server';
import { securityLogger, SECURITY_EVENTS, SEVERITY } from '@/lib/securityLogger';
import { validateAdvancedRateLimit } from '@/lib/validation';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

export async function GET(request) {
  try {
    // Rate limiting for security endpoint
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = validateAdvancedRateLimit(clientIP, 'results'); // Use results limit

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
            ...securityHeaders,
          },
        }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const hours = Math.min(parseInt(searchParams.get('hours')) || 24, 168); // Max 7 days
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 200); // Max 200 events
    const eventType = searchParams.get('eventType');
    const severity = searchParams.get('severity');

    // Get security events and stats
    const [eventsResult, statsResult] = await Promise.all([
      securityLogger.getRecentEvents(limit, hours),
      securityLogger.getSecurityStats(hours),
    ]);

    let events = eventsResult.events || [];

    // Apply filters
    if (eventType && eventType !== 'all') {
      events = events.filter((event) => event.event_type === eventType);
    }

    if (severity && severity !== 'all') {
      events = events.filter((event) => event.severity === severity);
    }

    // Create response
    const response = {
      success: true,
      timeRange: {
        hours,
        since: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        until: new Date().toISOString(),
      },
      stats: statsResult.stats || {},
      events: events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        ipAddress: event.ip_address,
        userAgent: event.user_agent?.substring(0, 100) + '...',
        endpoint: event.endpoint,
        severity: event.severity,
        blocked: event.blocked,
        createdAt: event.created_at,
        details: event.details,
      })),
      pagination: {
        total: events.length,
        limit,
        showing: events.length,
      },
      filters: {
        available: {
          eventTypes: Object.values(SECURITY_EVENTS),
          severities: Object.values(SEVERITY),
        },
        applied: {
          eventType: eventType || 'all',
          severity: severity || 'all',
          hours,
        },
      },
    };

    return NextResponse.json(response, { headers: securityHeaders });
  } catch (error) {
    console.error('❌ Error fetching security events:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch security events',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      },
      { status: 500, headers: securityHeaders }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...securityHeaders,
    },
  });
}
