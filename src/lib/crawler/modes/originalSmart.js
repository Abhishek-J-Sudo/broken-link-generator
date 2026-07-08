import { urlUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';
import { checkLinks } from '../linkCheck';

export async function processOriginalSmartMode(jobId, baseUrl, preAnalyzedUrls, settings) {
  console.log(
    `🔄 ORIGINAL SMART MODE: Processing ${preAnalyzedUrls.length} URLs for job ${jobId}`
  );

  const discoveredLinks = preAnalyzedUrls
    .map((urlData, index) => {
      let url, sourceUrl;
      if (typeof urlData === 'string') {
        url = urlData;
        sourceUrl = baseUrl;
      } else if (typeof urlData === 'object' && urlData.url) {
        url = urlData.url;
        sourceUrl = urlData.sourceUrl || urlData.source_url || urlData.sourcePageUrl || baseUrl;
      } else {
        console.warn(`Invalid URL at index ${index}:`, urlData);
        return null;
      }

      if (!url) return null;

      return {
        url,
        sourceUrl: sourceUrl || baseUrl,
        isInternal: urlUtils.isInternalUrl(url, baseUrl),
        depth: 1,
        status: 'pending',
        http_status_code: null,
        response_time: null,
        checked_at: null,
        is_working: null,
        error_message: null,
      };
    })
    .filter(Boolean);

  if (discoveredLinks.length === 0) {
    throw new Error('No valid URLs to process');
  }

  await db.addDiscoveredLinks(jobId, discoveredLinks);
  await db.updateJobProgress(jobId, 0, discoveredLinks.length);

  const linksToCheck = discoveredLinks.map((link) => ({
    url: link.url,
    sourceUrl: link.sourceUrl,
    linkText: 'Pre-analyzed link',
  }));

  await checkLinks(jobId, linksToCheck, settings, {
    preInserted: true,
    trackProgress: true,
    completeJob: true,
    enableStopCheck: true,
  });
}
