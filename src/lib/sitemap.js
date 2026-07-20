/**
 * Sitemap discovery: robots.txt `Sitemap:` directives first, then the
 * conventional /sitemap.xml and /sitemap_index.xml locations. Sitemap
 * indexes list child sitemap files rather than pages, so they are recursed
 * one level. All fetches go through safeFetch (SSRF guard + body cap).
 */

import { safeFetch } from './safeFetch.js';

const MAX_URLS = 2000;
const MAX_CHILD_SITEMAPS = 10;

const BOT_UA = 'Mozilla/5.0 SeoScrub Bot/1.0';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const FETCH_OPTS = {
  timeout: 10000,
  readBody: true,
  maxBodyBytes: 5 * 1024 * 1024,
};

// Identify honestly first; some WAFs (Cloudflare et al.) 403 any UA with
// "Bot" in it even on public sitemap files — retry once as a plain browser.
async function fetchSitemapDoc(url, timeout = FETCH_OPTS.timeout) {
  let response = await safeFetch(url, {
    ...FETCH_OPTS,
    timeout,
    headers: { 'User-Agent': BOT_UA },
  });
  if (response.status === 403) {
    response = await safeFetch(url, {
      ...FETCH_OPTS,
      timeout,
      headers: { 'User-Agent': BROWSER_UA },
    });
  }
  return response;
}

/**
 * Returns page URLs (same site as baseUrl) from the first sitemap that
 * yields any, or [] when none is found.
 */
export async function findSitemapUrls(baseUrl) {
  const tried = new Set();
  for (const candidate of await sitemapCandidates(baseUrl)) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    // Hosts the sitemap documents were actually served from count as "this
    // site" too — canonical-domain migrations (old.tld → new.tld) redirect
    // the sitemap and list pages only on the new host.
    const allowedHosts = new Set([hostKey(baseUrl)]);
    const urls = await readSitemap(candidate, 0, allowedHosts);
    const pages = urls.filter((url) => allowedHosts.has(hostKey(url)));
    if (pages.length > 0) {
      console.log(`🗺️ SITEMAP: ${pages.length} page URLs via ${candidate}`);
      return [...new Set(pages)];
    }
  }
  return [];
}

async function sitemapCandidates(baseUrl) {
  const candidates = [];
  try {
    const res = await fetchSitemapDoc(new URL('/robots.txt', baseUrl).toString(), 5000);
    if (res.ok) {
      const text = await res.text();
      for (const match of text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) {
        try {
          candidates.push(new URL(match[1], baseUrl).toString());
        } catch {
          // malformed directive — skip
        }
      }
    }
  } catch {
    // no robots.txt — fall back to conventional locations
  }
  candidates.push(new URL('/sitemap.xml', baseUrl).toString());
  candidates.push(new URL('/sitemap_index.xml', baseUrl).toString());
  return candidates;
}

async function readSitemap(sitemapUrl, depth, allowedHosts) {
  let xml;
  try {
    const response = await fetchSitemapDoc(sitemapUrl);
    if (!response.ok) return [];
    allowedHosts.add(hostKey(response.url));
    xml = await response.text();
  } catch {
    return [];
  }

  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) =>
    decodeXmlEntities(m[1])
  );
  if (locs.length === 0) return [];

  if (/<sitemapindex[\s>]/i.test(xml)) {
    if (depth >= 1) return []; // don't follow indexes nested inside indexes
    const pages = [];
    for (const child of locs.slice(0, MAX_CHILD_SITEMAPS)) {
      pages.push(...(await readSitemap(child, depth + 1, allowedHosts)));
      if (pages.length >= MAX_URLS) break;
    }
    return pages.slice(0, MAX_URLS);
  }

  return locs.slice(0, MAX_URLS);
}

function hostKey(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function decodeXmlEntities(text) {
  return text
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
