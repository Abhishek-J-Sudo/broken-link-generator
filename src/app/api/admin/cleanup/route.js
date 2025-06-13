// FILE: src/app/api/admin/cleanup/route.js
// Create this new file in your project

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // Security: Verify the request is from our trusted GitHub Action
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CLEANUP_SECRET_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
      console.log('❌ Unauthorized cleanup attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Starting database cleanup...');

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`🔍 Looking for data older than: ${cutoffDate.toLocaleDateString()}`);

    // Step 1: Get jobs to be deleted (for counting and foreign key handling)
    const { data: jobsToDelete, error: jobsError } = await supabase
      .from('crawl_jobs')
      .select('id')
      .lt('created_at', cutoffISO);

    if (jobsError) {
      throw new Error(`Failed to query old jobs: ${jobsError.message}`);
    }

    const jobIds = jobsToDelete.map((job) => job.id);
    console.log(`📊 Found ${jobIds.length} old crawl jobs to cleanup`);

    if (jobIds.length === 0) {
      console.log('✨ No old data found - database is clean!');
      return NextResponse.json({
        success: true,
        message: 'No old data to cleanup - database is clean!',
        deleted: { jobs: 0, brokenLinks: 0, discoveredLinks: 0 },
        cutoffDate: cutoffDate.toLocaleDateString(),
      });
    }

    // Step 2: Delete discovered_links first (foreign key dependency)
    console.log('🗑️ Deleting discovered_links...');
    const { error: discoveredError, count: discoveredCount } = await supabase
      .from('discovered_links')
      .delete()
      .in('job_id', jobIds);

    if (discoveredError) {
      throw new Error(`Failed to delete discovered links: ${discoveredError.message}`);
    }

    // Step 3: Delete broken_links
    console.log('🗑️ Deleting broken_links...');
    const { error: brokenError, count: brokenCount } = await supabase
      .from('broken_links')
      .delete()
      .in('job_id', jobIds);

    if (brokenError) {
      throw new Error(`Failed to delete broken links: ${brokenError.message}`);
    }

    // Step 4: Delete crawl_jobs (parent table)
    console.log('🗑️ Deleting crawl_jobs...');
    const { error: jobsDeleteError, count: jobCount } = await supabase
      .from('crawl_jobs')
      .delete()
      .lt('created_at', cutoffISO);

    if (jobsDeleteError) {
      throw new Error(`Failed to delete crawl jobs: ${jobsDeleteError.message}`);
    }

    const result = {
      success: true,
      message: '✅ Database cleanup completed successfully!',
      deleted: {
        jobs: jobCount || jobIds.length,
        brokenLinks: brokenCount || 0,
        discoveredLinks: discoveredCount || 0,
      },
      cutoffDate: cutoffDate.toLocaleDateString(),
      timestamp: new Date().toISOString(),
    };

    console.log('🎉 Cleanup completed successfully:', result.deleted);

    return NextResponse.json(result);
  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint - you can visit this in browser
export async function GET() {
  const nextCleanup = new Date();
  nextCleanup.setHours(2, 0, 0, 0); // 2 AM tomorrow
  if (nextCleanup <= new Date()) {
    nextCleanup.setDate(nextCleanup.getDate() + 1);
  }

  return NextResponse.json({
    service: 'Database Cleanup API',
    status: 'Ready',
    method: 'POST with Authorization header',
    description: 'Automatically deletes crawl data older than 30 days',
    nextScheduledRun: nextCleanup.toISOString(),
    endpoint: '/api/admin/cleanup',
  });
}
