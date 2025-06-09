/**
 * Chunk processing endpoint
 * Processes batches of URLs for link checking (internal use)
 */

import { NextRequest, NextResponse } from 'next/server';
import { HttpChecker } from '@/lib/httpChecker';
import { db } from '@/lib/supabase';
import { batchUtils } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const { jobId, urls, batchSize = 50 } = body;

    // Validate required fields
    if (!jobId) {
      return NextResponse.json(
        {
          error: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        },
        { status: 400 }
      );
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          error: 'URLs array is required and must not be empty',
          code: 'MISSING_URLS',
        },
        { status: 400 }
      );
    }

    // Verify job exists and is in running state
    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (job.status !== 'running') {
      return NextResponse.json(
        {
          error: 'Job is not in running state',
          code: 'JOB_NOT_RUNNING',
        },
        { status: 400 }
      );
    }

    console.log(`Processing chunk of ${urls.length} URLs for job ${jobId}`);

    // Create HTTP checker instance
    const httpChecker = new HttpChecker({
      timeout: job.settings?.timeout || 10000,
      maxConcurrent: 3, // Lower concurrency for chunk processing
      retryAttempts: 1, // Fewer retries for chunks
    });

    // Process URLs in smaller sub-batches to avoid timeouts
    const subBatchSize = Math.min(batchSize, 25);
    const subBatches = batchUtils.chunkArray(urls, subBatchSize);

    const allResults = [];
    const processedUrls = [];
    const brokenLinks = [];

    for (const subBatch of subBatches) {
      try {
        // Check URLs in this sub-batch
        const { results } = await httpChecker.checkUrls(subBatch);
        allResults.push(...results);

        // Process results
        for (const result of results) {
          processedUrls.push(result.url);

          // If URL is broken, record it
          if (!result.isWorking) {
            const brokenLink = {
              url: result.url,
              sourceUrl: result.sourceUrl || null,
              statusCode: result.statusCode,
              errorType: result.errorType || 'other',
              linkText: result.linkText || 'No text',
            };

            brokenLinks.push(brokenLink);

            // Save to database immediately
            try {
              await db.addBrokenLink(jobId, brokenLink);
            } catch (dbError) {
              console.error('Error saving broken link:', dbError);
            }
          }
        }

        // Small delay between sub-batches
        if (subBatches.indexOf(subBatch) < subBatches.length - 1) {
          await batchUtils.delay(100);
        }
      } catch (error) {
        console.error('Error processing sub-batch:', error);
        // Continue with next sub-batch
      }
    }

    // Update job progress
    try {
      // Get current progress
      const currentJob = await db.getJob(jobId);
      const currentProgress = currentJob.progress || { current: 0, total: 0 };

      const newCurrent = currentProgress.current + processedUrls.length;
      await db.updateJobProgress(jobId, newCurrent, currentProgress.total);
    } catch (progressError) {
      console.error('Error updating progress:', progressError);
    }

    const response = {
      success: true,
      jobId,
      processed: {
        count: processedUrls.length,
        urls: processedUrls,
      },
      brokenLinks: {
        count: brokenLinks.length,
        links: brokenLinks,
      },
      summary: {
        totalProcessed: allResults.length,
        workingLinks: allResults.filter((r) => r.isWorking).length,
        brokenLinks: allResults.filter((r) => !r.isWorking).length,
        averageResponseTime:
          allResults.length > 0
            ? Math.round(
                allResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / allResults.length
              )
            : 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing chunk:', error);

    return NextResponse.json(
      {
        error: 'Failed to process URL chunk',
        message: error.message,
        code: 'CHUNK_PROCESSING_FAILED',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
