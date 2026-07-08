import { urlUtils } from '@/lib/utils';
import { db } from '@/lib/supabase';
import { checkLinks } from '../linkCheck';

export async function processDiscoveredLinksMode(jobId, baseUrl, discoveredUrls, settings) {
  console.log(
    `🔄 DISCOVERED LINKS MODE: Processing ${discoveredUrls.length} pre-discovered links for job ${jobId}`
  );

  const linksToCheck = discoveredUrls
    .map((urlData) => {
      let url, sourceUrl;
      if (typeof urlData === 'string') {
        url = urlData;
        sourceUrl = baseUrl;
      } else if (typeof urlData === 'object' && urlData.url) {
        url = urlData.url;
        sourceUrl = urlData.sourceUrl || urlData.source_url || baseUrl;
      } else {
        console.warn('Invalid URL data:', urlData);
        return null;
      }
      return {
        url,
        sourceUrl: sourceUrl || baseUrl,
        linkText: urlData.linkText || 'Discovered link',
        isInternal: urlUtils.isInternalUrl(url, baseUrl),
        depth: 1,
        category: urlData.category || 'discovered',
      };
    })
    .filter(Boolean);

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
    await db.addDiscoveredLinks(jobId, discoveredLinks);
  }

  await db.updateJobProgress(jobId, 0, discoveredLinks.length);

  await checkLinks(jobId, linksToCheck, settings, {
    preInserted: true,
    trackProgress: true,
    completeJob: true,
    enableStopCheck: true,
  });
}
