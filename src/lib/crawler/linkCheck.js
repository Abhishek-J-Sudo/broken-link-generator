import { HttpChecker } from '@/lib/httpChecker';
import { batchUtils, errorUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';

/**
 * Check link statuses and persist results.
 *
 * opts.preInserted    – links already exist in discovered_links (smart modes); function UPDATEs.
 *                       When false (traditional), function INSERTs each row as it checks.
 * opts.trackProgress  – call db.updateJobProgress after each batch (smart modes own this;
 *                       traditional manages progress in its outer loop).
 * opts.completeJob    – call db.updateJobStatus('completed') at the end.
 * opts.enableStopCheck – poll job status each batch and exit early if stopped by user.
 */
export async function checkLinks(
  jobId,
  linksToCheck,
  settings,
  { preInserted = false, trackProgress = false, completeJob = false, enableStopCheck = false } = {}
) {
  const enableSEO = settings.enableSEO || false;
  // quickMode: traditional crawl without SEO — uses HEAD-only quickCheck, larger batches
  const quickMode = !enableSEO && !preInserted;

  const httpChecker = new HttpChecker({
    timeout: settings.timeout || 10000,
    maxConcurrent: enableSEO ? 2 : quickMode ? 5 : 4,
    retryAttempts: 1,
  });

  const batchSize = enableSEO ? 8 : quickMode ? 25 : 10;
  const batchDelay = enableSEO ? 800 : quickMode ? 200 : 500;
  const batches = batchUtils.chunkArray(linksToCheck, batchSize);

  let processedCount = 0;
  let brokenLinksFound = 0;
  let seoAnalyzedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    if (enableStopCheck) {
      const currentJob = await db.getJob(jobId);
      if (currentJob.status === 'failed' && currentJob.error_message === 'Stopped by user') {
        return;
      }
    }

    const batch = batches[i];

    try {
      let results;

      if (quickMode) {
        const raw = await Promise.all(batch.map((link) => httpChecker.quickCheck(link.url)));
        results = raw.map((r, j) => ({
          ...r,
          sourceUrl: batch[j].sourceUrl,
          isInternal: batch[j].isInternal,
          depth: batch[j].depth,
          linkText: batch[j].linkText,
        }));
      } else {
        const { results: raw } = await httpChecker.checkUrlsWithSEO(
          batch.map((link) => ({ url: link.url, sourceUrl: link.sourceUrl })),
          { enableSEO }
        );
        results = raw.map((r, j) => ({
          ...r,
          isInternal: batch[j].isInternal,
          depth: batch[j].depth,
          linkText: batch[j].linkText,
        }));
      }

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const originalLink = batch[j];
        processedCount++;

        try {
          if (preInserted) {
            await db.supabase
              .from('discovered_links')
              .update({
                status: 'checked',
                http_status_code: result.http_status_code,
                response_time: result.response_time,
                checked_at: result.checked_at,
                is_working: result.is_working,
                error_message: result.error_message,
                has_seo_data: result.seo_data && !result.seo_data.error,
              })
              .eq('job_id', jobId)
              .eq('url', result.url);
          } else {
            await db.addDiscoveredLinks(jobId, [
              {
                url: result.url,
                sourceUrl: originalLink.sourceUrl,
                isInternal: originalLink.isInternal,
                depth: originalLink.depth,
                status: 'checked',
                http_status_code: result.http_status_code,
                response_time: result.response_time,
                checked_at: result.checked_at,
                is_working: result.is_working,
                error_message: result.error_message,
              },
            ]);
          }
        } catch (updateError) {
          console.error(`Failed to persist status for ${result.url}:`, updateError);
        }

        if (enableSEO && result.seo_data && !result.seo_data.error) {
          try {
            await db.addSEOAnalysis(jobId, result.seo_data);
            seoAnalyzedCount++;
          } catch (seoError) {
            console.error(`Failed to save SEO data for ${result.url}:`, seoError);
          }
        }

        if (!result.is_working) {
          const errorType =
            result.errorType || errorUtils.classifyError(result.http_status_code, result);
          try {
            await db.addBrokenLink(jobId, {
              url: result.url,
              sourceUrl: originalLink.sourceUrl,
              statusCode: result.http_status_code,
              errorType,
              linkText: result.linkText || originalLink.linkText || 'Link',
              responseTime: result.response_time,
            });
            brokenLinksFound++;
          } catch (dbError) {
            console.error('Failed to save broken link:', dbError);
          }
        }
      }

      if (trackProgress) {
        await db.updateJobProgress(jobId, processedCount, linksToCheck.length);
      }

      await batchUtils.delay(batchDelay);
    } catch (batchError) {
      console.error(`Error in link-check batch ${i + 1}:`, batchError);
    }
  }

  if (completeJob) {
    await db.updateJobStatus(jobId, 'completed');
    if (enableSEO && seoAnalyzedCount > 0) {
      try {
        const summary = await db.getSEOSummary(jobId);
        console.log(`SEO summary: avg ${summary.avg_score}/100, ${summary.total_issues} issues`);
      } catch (e) {
        console.error('Error fetching SEO summary:', e);
      }
    }
  }
}
