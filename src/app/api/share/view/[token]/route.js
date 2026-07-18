// src/app/api/share/view/[token]/route.js
// PUBLIC (no Basic Auth — allow-listed in src/middleware.ts by prefix).
// Resolves a share token to one composite, read-only report payload.
// Serves only what the share page needs; never triggers AI generation.

import { NextResponse } from 'next/server';
import { query } from '@/lib/pg';
import { db } from '@/lib/supabase';
import { validateAdvancedRateLimit } from '@/lib/validation';
import { getClientIp } from '@/lib/clientIp';

const MAX_CHECKED_LINKS = 5000;

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    // Tokens are 32-char base64url; reject junk before touching the DB
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const ip = getClientIp(request);
    const rateLimit = await validateAdvancedRateLimit(ip, 'results');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const jobResult = await query(
      `SELECT id, url, status, settings, created_at, completed_at, ai_narrative, seo_tracker
       FROM crawl_jobs WHERE share_token = $1`,
      [token]
    );
    const job = jobResult.rows[0];
    if (!job) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const [discoveredResult, checkedResult, findingsResult, seoPagesResult] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM discovered_links WHERE job_id = $1`, [job.id]),
      query(
        `SELECT url, source_url, is_internal, is_working, http_status_code, response_time
         FROM discovered_links
         WHERE job_id = $1 AND status = 'checked'
         LIMIT $2`,
        [job.id, MAX_CHECKED_LINKS]
      ),
      query(
        `SELECT dl.url, dl.source_url, dl.is_internal, dl.http_status_code,
                dl.response_time, dl.checked_at, dl.error_message,
                bl.error_type, bl.link_text
         FROM discovered_links dl
         LEFT JOIN broken_links bl ON bl.job_id = dl.job_id AND bl.url = dl.url
         WHERE dl.job_id = $1 AND dl.status = 'checked' AND dl.is_working IS NOT TRUE`,
        [job.id]
      ),
      query(
        `SELECT url, seo_score, seo_grade, title_text, title_length,
                meta_description, description_length, canonical_url,
                h1_count, h2_count, word_count, total_images, missing_alt,
                response_time, issues, signals
         FROM seo_analysis WHERE job_id = $1 ORDER BY seo_score ASC`,
        [job.id]
      ),
    ]);

    const checkedLinks = checkedResult.rows;
    const workingCount = checkedLinks.filter((l) => l.is_working === true).length;
    let totalResponseTime = 0;
    let validResponseTimes = 0;
    let slowLinks = 0;
    for (const link of checkedLinks) {
      if (link.response_time > 0) {
        totalResponseTime += link.response_time;
        validResponseTimes++;
        if (link.response_time > 5000) slowLinks++;
      }
    }

    // Mirrors the summary shape buildReport() consumes on the results page
    const summary = {
      totalLinksChecked: checkedLinks.length,
      workingLinks: workingCount,
      brokenLinks: checkedLinks.length - workingCount,
      pagesAnalyzed: seoPagesResult.rows.length,
      sourcePagesCount: new Set(
        checkedLinks.filter((l) => l.is_internal && l.source_url).map((l) => l.source_url)
      ).size,
      performance: {
        averageResponseTime:
          validResponseTimes > 0 ? Math.round(totalResponseTime / validResponseTimes) : 0,
        slowLinks,
      },
    };

    let seoSummary = null;
    if (seoPagesResult.rows.length > 0) {
      try {
        seoSummary = await db.calculateSEOSummary(job.id);
      } catch {
        /* SEO snapshot degrades gracefully on the share page */
      }
    }

    return NextResponse.json(
      {
        job: {
          // No job id in the public payload — the token is the only handle
          url: job.url,
          status: job.status,
          settings: job.settings,
          stats: {
            totalLinksDiscovered: Number(discoveredResult.rows[0]?.total) || 0,
            brokenLinksFound: findingsResult.rows.length,
          },
          timestamps: {
            createdAt: job.created_at,
            completedAt: job.completed_at,
          },
        },
        summary,
        findings: findingsResult.rows,
        checkedLinks,
        seoSummary,
        seoPages: seoPagesResult.rows,
        narrative: job.ai_narrative || null,
        seoTracker: job.seo_tracker || {},
      },
      {
        headers: {
          // Public but unlisted: keep crawlers out of client reports
          'X-Robots-Tag': 'noindex, nofollow',
          // Always fresh so the team's saved tracker edits show on reload
          // (a stale cache would look like their change vanished).
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Share view error:', error);
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
}
