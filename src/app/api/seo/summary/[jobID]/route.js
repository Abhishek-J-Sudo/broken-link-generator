// src/app/api/seo/summary/[jobId]/route.js
import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase'; // CHANGED: Use named import with braces

export async function GET(request, { params }) {
  try {
    // FIX: Await params for Next.js 15
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`📊 Getting SEO summary for job: ${jobId}`);

    // FIX: Use the correct method name
    const seoSummary = await db.calculateSEOSummary(jobId);

    if (!seoSummary) {
      return NextResponse.json({ error: 'No SEO data found for this job' }, { status: 404 });
    }

    console.log(`✅ SEO summary retrieved for job ${jobId}:`, seoSummary);

    return NextResponse.json(seoSummary);
  } catch (error) {
    console.error('❌ Error getting SEO summary:', error);
    return NextResponse.json(
      {
        error: 'Failed to get SEO summary',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
