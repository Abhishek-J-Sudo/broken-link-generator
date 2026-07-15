import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { query } from '@/lib/pg';
import { getDeepSeekNarrative } from '@/lib/deepseekNarrative';
import { corsOrigin } from '@/lib/cors';

// Maps broken_links.error_type + status_code → the same cls buckets as auditReport.js
function classifyError(errorType, statusCode) {
  if (errorType === 'timeout') return 'timeout';
  if (errorType === 'ssl_error' || errorType === 'dns_error' || errorType === 'connection_error')
    return 'network';
  if (errorType === 'robots_blocked' || errorType === 'security_blocked') return 'blocked';
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (!statusCode) return 'network';
  return 'other';
}

const CLS_LABEL = {
  '4xx': 'missing pages (4xx)',
  '5xx': 'server errors (5xx)',
  timeout: 'timeouts',
  network: 'SSL/network failures',
  blocked: 'blocked by robots',
  other: 'other failures',
};

async function buildCondensed(jobId, job) {
  const [statsResult, errorResult, pagesResult, sharedResult, seoResult] = await Promise.all([
    // Link-level stats
    query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'checked') AS total_checked,
        COUNT(*) FILTER (WHERE is_working = false AND status = 'checked') AS broken_count,
        COUNT(*) FILTER (WHERE is_working = true  AND status = 'checked') AS healthy_count,
        COUNT(*) FILTER (WHERE response_time > 5000 AND status = 'checked') AS slow_links
       FROM discovered_links WHERE job_id = $1`,
      [jobId]
    ),
    // Error breakdown joined with is_internal from discovered_links
    query(
      `SELECT
        bl.error_type,
        bl.status_code,
        COALESCE(dl.is_internal, true) AS is_internal,
        COUNT(*) AS count
       FROM broken_links bl
       LEFT JOIN discovered_links dl ON dl.job_id = bl.job_id AND dl.url = bl.url
       WHERE bl.job_id = $1
       GROUP BY bl.error_type, bl.status_code, COALESCE(dl.is_internal, true)
       ORDER BY count DESC`,
      [jobId]
    ),
    // Top affected pages
    query(
      `SELECT source_url, COUNT(*) AS broken_count
       FROM broken_links
       WHERE job_id = $1 AND source_url IS NOT NULL
       GROUP BY source_url
       ORDER BY broken_count DESC
       LIMIT 5`,
      [jobId]
    ),
    // Shared-element targets (broken on 4+ distinct source pages)
    query(
      `SELECT url, COUNT(DISTINCT source_url) AS page_count
       FROM broken_links
       WHERE job_id = $1 AND source_url IS NOT NULL
       GROUP BY url
       HAVING COUNT(DISTINCT source_url) >= 4
       ORDER BY page_count DESC
       LIMIT 5`,
      [jobId]
    ),
    // Per-page SEO analysis incl. deeper signals (doc 04 §G)
    query(
      `SELECT url, seo_score, issues, signals
       FROM seo_analysis
       WHERE job_id = $1
       ORDER BY seo_score ASC`,
      [jobId]
    ),
  ]);

  const stats = statsResult.rows[0];
  const totalChecked = Number(stats.total_checked) || 0;
  const brokenCount = Number(stats.broken_count) || 0;
  const slowLinks = Number(stats.slow_links) || 0;

  // Aggregate error rows into cls buckets
  const clsMap = {};
  for (const row of errorResult.rows) {
    const cls = classifyError(row.error_type, Number(row.status_code) || 0);
    if (!clsMap[cls]) clsMap[cls] = { cls, label: CLS_LABEL[cls], count: 0, internal: 0, external: 0 };
    const n = Number(row.count);
    clsMap[cls].count += n;
    if (row.is_internal) clsMap[cls].internal += n;
    else clsMap[cls].external += n;
  }
  const categories = Object.values(clsMap).sort((a, b) => b.count - a.count);

  const internalBroken = categories.reduce((s, c) => s + c.internal, 0);
  const externalBroken = brokenCount - internalBroken;

  let hostname = job.url;
  try { hostname = new URL(job.url).hostname; } catch { /* keep raw */ }

  return {
    site: hostname,
    auditStatus: job.status,
    totalChecked,
    broken: brokenCount,
    healthy: Number(stats.healthy_count) || 0,
    internalBroken,
    externalBroken,
    slowLinks,
    categories: categories.slice(0, 6),
    topAffectedPages: pagesResult.rows.slice(0, 5).map((r) => ({
      path: (() => { try { return new URL(r.source_url).pathname; } catch { return r.source_url; } })(),
      brokenCount: Number(r.broken_count),
    })),
    sharedTargets: sharedResult.rows.slice(0, 5).map((r) => ({
      url: r.url,
      appearsOnPages: Number(r.page_count),
    })),
    seo: condenseSeo(seoResult.rows),
  };
}

// Compact per-page SEO rollup for the prompt — aggregate counts plus the
// worst 3 pages, kept small to protect the token budget.
function condenseSeo(rows) {
  if (!rows || rows.length === 0) return null;

  const toPath = (url) => { try { return new URL(url).pathname; } catch { return url; } };
  const scores = rows.map((r) => Number(r.seo_score) || 0);
  const withSignals = rows.filter((r) => r.signals);

  // Sitewide issue frequency (top 5 recurring issue messages)
  const issueCounts = {};
  for (const row of rows) {
    for (const issue of row.issues || []) {
      issueCounts[issue.message] = (issueCounts[issue.message] || 0) + 1;
    }
  }
  const topIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([message, count]) => ({ issue: message, pages: count }));

  return {
    pagesAnalyzed: rows.length,
    avgScore: Math.round(scores.reduce((s, n) => s + n, 0) / rows.length),
    scoreRange: [Math.min(...scores), Math.max(...scores)],
    noindexedPages: withSignals.filter((r) => r.signals.robots?.noindex).length,
    robotsBlockedPages: withSignals.filter((r) => r.signals.robotsTxt?.disallowed).length,
    pagesWithoutOpenGraph: withSignals.filter((r) => !r.signals.social?.hasOpenGraph).length,
    pagesWithoutStructuredData: withSignals.filter(
      (r) => !r.signals.structuredData?.hasStructuredData
    ).length,
    stalePages: withSignals.filter((r) => r.signals.freshness?.isStale).length,
    topIssues,
    worstPages: rows.slice(0, 3).map((r) => ({
      path: toPath(r.url),
      score: Number(r.seo_score) || 0,
    })),
  };
}

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const job = await db.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Return cached result immediately — no extra cost
    if (job.ai_narrative) {
      return NextResponse.json(job.ai_narrative);
    }

    // Only generate once the crawl has settled
    if (job.status !== 'completed' && job.status !== 'stopped') {
      return new NextResponse(null, { status: 204 });
    }

    const condensed = await buildCondensed(jobId, job);
    const narrative = await getDeepSeekNarrative(condensed);

    if (!narrative) {
      return new NextResponse(null, { status: 204 });
    }

    // Store (best-effort — don't fail the response if the update errors)
    try {
      await query(
        'UPDATE crawl_jobs SET ai_narrative = $1 WHERE id = $2',
        [JSON.stringify(narrative), jobId]
      );
    } catch (err) {
      console.warn('Failed to cache ai_narrative:', err.message);
    }

    return NextResponse.json(narrative);
  } catch (error) {
    console.error('Narrative route error:', error);
    return new NextResponse(null, { status: 204 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
