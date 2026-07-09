import { LinkExtractor } from '@/lib/linkExtractor';
import { batchUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';
import { checkLinks } from '../linkCheck';
import { safeFetch } from '@/lib/safeFetch';

export async function processContentPagesMode(jobId, baseUrl, contentPages, settings) {
  console.log(
    `🎯 CONTENT PAGES MODE: Processing ${contentPages.length} content pages for job ${jobId}`
  );

  const linkExtractor = new LinkExtractor({
    includeExternal: settings.includeExternal || false,
    maxLinksPerPage: 2000,
  });

  const allExtractedLinks = new Map();
  let contentPagesProcessed = 0;
  let totalLinksExtracted = 0;

  const contentBatches = batchUtils.chunkArray(contentPages, 3);

  for (const batch of contentBatches) {
    await Promise.all(
      batch.map(async (pageData) => {
        const pageUrl = pageData.url;
        try {
          const response = await safeFetch(pageUrl, {
            timeout: settings.timeout || 10000,
            headers: {
              'User-Agent': 'SeoScrub Bot/1.0',
              Accept: 'text/html,application/xhtml+xml',
            },
            readBody: true,
          });

          if (response.ok) {
            const pageContent = await response.text();
            const extractionResult = linkExtractor.extractLinks(pageContent, pageUrl, 1);

            extractionResult.links.forEach((link) => {
              if (!allExtractedLinks.has(link.url)) {
                allExtractedLinks.set(link.url, {
                  url: link.url,
                  sourceUrl: pageUrl,
                  linkText: link.linkText || 'Extracted link',
                  isInternal: link.isInternal,
                  depth: 1,
                  category: link.isInternal ? 'pages' : 'external',
                });
                totalLinksExtracted++;
              }
            });
          }
          contentPagesProcessed++;
        } catch (error) {
          console.error(`Error processing content page ${pageUrl}:`, error);
          contentPagesProcessed++;
        }
      })
    );

    await db.updateJobProgress(jobId, contentPagesProcessed, contentPages.length);
    await batchUtils.delay(500);
  }

  const linksToCheck = Array.from(allExtractedLinks.values());

  const discoveredLinks = linksToCheck.map((linkData) => ({
    url: linkData.url,
    sourceUrl: linkData.sourceUrl,
    isInternal: linkData.isInternal,
    depth: linkData.depth,
    status: 'pending',
    http_status_code: null,
    response_time: null,
    checked_at: null,
    is_working: null,
    error_message: null,
  }));

  if (discoveredLinks.length > 0) {
    const dbChunks = batchUtils.chunkArray(discoveredLinks, 100);
    for (const chunk of dbChunks) {
      await db.addDiscoveredLinks(jobId, chunk);
    }
  }

  if (totalLinksExtracted > 0) {
    await db.updateJobProgress(jobId, 0, totalLinksExtracted);
  }

  await checkLinks(jobId, linksToCheck, settings, {
    preInserted: true,
    trackProgress: true,
    completeJob: true,
    enableStopCheck: true,
  });
}
