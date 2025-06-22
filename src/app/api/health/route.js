/**
 * Health check endpoint
 * Tests database connection and system status
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  try {
    const startTime = Date.now();

    // Test database connection
    const { data, error } = await db.supabase.from('crawl_jobs').select('count(*)').limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
      },
      version: packageJson.version,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        database: {
          connected: false,
        },
        version: packageJson.version,
      },
      { status: 500 }
    );
  }
}
