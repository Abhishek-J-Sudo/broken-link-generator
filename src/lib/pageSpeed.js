/**
 * pageSpeed.js — Core Web Vitals via the free Google PageSpeed Insights API (G7).
 *
 * One bounded call per audit, run on the site's homepage only (PSI is slow,
 * ~15-30s, and the anonymous quota is unusable — see the 429s). Requires a free
 * PAGESPEED_API_KEY (no billing). Everything degrades to null / a reason string
 * so a missing key or a transient PSI failure never breaks the report.
 *
 * Note: PSI fetches the target URL from Google's own servers, so the audited URL
 * is sent to Google. That's fine for the public sites this tool audits.
 */

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Fetch + parse PSI for one URL. Returns a compact result, or a { reason }
 * marker the UI can explain ('no_key' | 'unavailable'). Never throws.
 */
export async function fetchPageSpeed(url, { strategy = 'mobile', timeoutMs = 30000 } = {}) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { reason: 'no_key' };

  const params = new URLSearchParams({ url, strategy, category: 'performance' });
  params.append('key', key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) return { reason: 'unavailable' };
    const data = await res.json();
    const parsed = parsePageSpeed(data, strategy);
    return parsed || { reason: 'unavailable' };
  } catch {
    return { reason: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reduce a PSI response to the fields the report needs: the Lighthouse
 * performance score, the key lab metrics as display strings, and the CrUX
 * real-user field data when Google has enough traffic for it.
 */
export function parsePageSpeed(data, strategy = 'mobile') {
  const lr = data?.lighthouseResult;
  if (!lr) return null;

  const audits = lr.audits || {};
  const rawScore = lr.categories?.performance?.score;
  const score = typeof rawScore === 'number' ? Math.round(rawScore * 100) : null;

  const lab = {
    lcp: audits['largest-contentful-paint']?.displayValue || null,
    cls: audits['cumulative-layout-shift']?.displayValue || null,
    tbt: audits['total-blocking-time']?.displayValue || null,
    fcp: audits['first-contentful-paint']?.displayValue || null,
    speedIndex: audits['speed-index']?.displayValue || null,
  };

  // CrUX field data — only present for URLs/origins with enough real traffic.
  const metrics = data.loadingExperience?.metrics;
  const pickField = (m) => (m ? { value: m.percentile, category: m.category } : null);
  const field = metrics
    ? {
        overall: data.loadingExperience.overall_category || null,
        lcp: pickField(metrics.LARGEST_CONTENTFUL_PAINT_MS),
        inp: pickField(metrics.INTERACTION_TO_NEXT_PAINT),
        cls: pickField(metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE),
      }
    : null;

  return {
    strategy,
    score,
    lab,
    field,
    testedUrl: lr.finalUrl || lr.requestedUrl || null,
    fetchedAt: new Date().toISOString(),
  };
}
