import { db } from '@/lib/supabase';
import { processContentPagesMode } from './modes/contentPages';
import { processDiscoveredLinksMode } from './modes/discoveredLinks';
import { processOriginalSmartMode } from './modes/originalSmart';
import { runTraditionalCrawl } from './modes/traditional';

export async function runSmartCrawl(jobId, baseUrl, preAnalyzedUrls, settings) {
  try {
    console.log(
      `🎯 SMART CRAWL: Starting job ${jobId} with mode: ${settings.crawlMode}`
    );
    await db.updateJobStatus(jobId, 'running');

    const crawlMode = settings.crawlMode || 'auto';
    if (crawlMode === 'content_pages') {
      await processContentPagesMode(jobId, baseUrl, preAnalyzedUrls, settings);
    } else if (crawlMode === 'discovered_links') {
      await processDiscoveredLinksMode(jobId, baseUrl, preAnalyzedUrls, settings);
    } else {
      await processOriginalSmartMode(jobId, baseUrl, preAnalyzedUrls, settings);
    }
  } catch (error) {
    console.error(`❌ SMART CRAWL: Job ${jobId} failed:`, error.message);
    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('Failed to update job status after error:', dbError);
    }
  }
}

export async function runTraditionalCrawlWithErrorHandling(jobId, startUrl, settings) {
  try {
    await runTraditionalCrawl(jobId, startUrl, settings);
  } catch (error) {
    console.error(`❌ TRADITIONAL CRAWL: Job ${jobId} failed:`, error.message);
    try {
      await db.updateJobStatus(jobId, 'failed', error.message);
    } catch (dbError) {
      console.error('Failed to update job status after error:', dbError);
    }
  }
}
