/**
 * Health check endpoint
 * Tests database connection and system status
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { APP_VERSION } from '@/lib/version';

export async function GET() {
  try {
    const startTime = Date.now();

    // Test database connection
    await db.ping();

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
      },
      version: APP_VERSION,
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
        },
        version: APP_VERSION,
      },
      { status: 500 }
    );
  }
}
