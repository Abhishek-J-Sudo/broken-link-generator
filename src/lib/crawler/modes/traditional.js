import { LinkExtractor } from '@/lib/linkExtractor';
import { urlUtils, batchUtils } from '@/lib/utils';
import { safeFetch } from '@/lib/safeFetch';
import { db } from '@/lib/supabase';
import { checkLinks } from '../linkCheck';

export async function runTraditionalCrawl(jobId, startUrl, settings) {
  console.log(`🕷️ TRADITIONAL CRAWL: Starting background processing for job ${jobId}`);
  console.log(`🎯 TRADITIONAL CRAWL: SEO enabled: ${!!settings.enableSEO}`);

  await db.updateJobStatus(jobId, 'running');

  const linkExtractor = new LinkExtractor({
    includeExternal: settings.includeExternal || false,
    maxLinksPerPage: 1000,
  });

  const visitedUrls = new Set();
  const pendingUrls = new Map(); // url -> { depth, sourceUrl }
  const maxDepth = settings.maxDepth || 3;
  const maxPages = 500;
  const batchSize = 10;

  pendingUrls.set(startUrl, { depth: 0, sourceUrl: null });

  let totalDiscovered = 0;
  let totalProcessed = 0;

  while (pendingUrls.size > 0 && totalProcessed < maxPages) {
    // Stop check at outer loop level
    const currentJob = await db.getJob(jobId);
    if (currentJob.status === 'failed' && currentJob.error_message === 'Stopped by user') {
      console.log(`🛑 STOP DETECTED: Traditional crawl job ${jobId} was stopped by user`);
      return;
    }

    const urlEntries = Array.from(pendingUrls.entries()).slice(0, batchSize);
    const batchUrls = urlEntries.map(([url, metadata]) => {
      pendingUrls.delete(url);
      return { url, ...metadata };
    });

    if (batchUrls.length === 0) break;

    const linksToCheck = batchUrls
      .filter((urlData) => !visitedUrls.has(urlData.url))
      .map((urlData) => ({
        url: urlData.url,
        sourceUrl: urlData.sourceUrl || startUrl,
        linkText: 'Traditional crawl link',
        isInternal: urlUtils.isInternalUrl(urlData.url, startUrl),
        depth: urlData.depth,
      }));

    if (linksToCheck.length > 0) {
      linksToCheck.forEach((linkData) => {
        visitedUrls.add(linkData.url);
        totalProcessed++;
      });

      try {
        // enableStopCheck: true fixes the latent bug where stopping a traditional SEO crawl
        // was slow because the inner check function didn't poll job status between batches.
        await checkLinks(jobId, linksToCheck, settings, {
          preInserted: false,
          trackProgress: false,
          completeJob: false,
          enableStopCheck: true,
        });
      } catch (checkError) {
        console.error('Error in batch checking:', checkError);
      }

      // Extract links from working internal pages for further crawling
      for (const linkData of linksToCheck) {
        if (linkData.depth < maxDepth && urlUtils.isInternalUrl(linkData.url, startUrl)) {
          try {
            const pageResponse = await safeFetch(linkData.url, {
              timeout: settings.timeout || 10000,
              headers: { 'User-Agent': 'Broken Link Checker Bot/1.0' },
              readBody: true,
            });

            if (pageResponse.status < 500) {
              const pageContent = await pageResponse.text();
              const extractionResult = linkExtractor.extractLinks(pageContent, linkData.url, linkData.depth);

              extractionResult.links.forEach((link) => {
                if (!visitedUrls.has(link.url) && !pendingUrls.has(link.url)) {
                  pendingUrls.set(link.url, { depth: link.depth, sourceUrl: linkData.url });
                  totalDiscovered++;
                }
              });
            }
          } catch (extractError) {
            console.error(`Error extracting links from ${linkData.url}:`, extractError);
          }
        }
      }
    }

    await db.updateJobProgress(jobId, totalProcessed, Math.max(totalProcessed, totalDiscovered));
    await batchUtils.delay(200);
  }

  await db.updateJobStatus(jobId, 'completed');
  console.log(`🎉 TRADITIONAL CRAWL COMPLETE: ${totalProcessed} URLs processed`);

  if (settings.enableSEO) {
    try {
      const seoSummary = await db.calculateSEOSummary(jobId);
      if (seoSummary && seoSummary.total_pages > 0) {
        console.log(
          `📊 SEO SUMMARY: ${seoSummary.total_pages} pages, avg score ${seoSummary.avg_score}/100`
        );
      }
    } catch (summaryError) {
      console.error('Error getting SEO summary:', summaryError);
    }
  }
}
