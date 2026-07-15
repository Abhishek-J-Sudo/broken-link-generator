'use client';

/**
 * /share/[token] — public, read-only client audit report.
 *
 * No Basic Auth (allow-listed in middleware); the unguessable token is the
 * only handle. Fetches ONE composite payload from /api/share/view/[token],
 * derives the report with the same buildReport() the internal page uses,
 * and renders a print-first document (browser print → clean PDF).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  buildReport,
  classifyFinding,
  deriveSeverity,
  hostnameOf,
  CLASS_SHORT,
} from '@/lib/auditReport';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const SEVERITY_TONE = {
  critical: 'text-danger',
  major: 'text-text',
  minor: 'text-text-muted',
};

function reportDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function csvDownload(filename, headers, rows) {
  const bom = String.fromCharCode(0xfeff);
  const csv =
    bom +
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SharedReportPage() {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  // Client reports are a light-theme, print-first document regardless of the
  // visitor's OS preference.
  useEffect(() => {
    const previous = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      if (previous) document.documentElement.setAttribute('data-theme', previous);
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share/view/${token}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.status === 404
              ? 'This report link is invalid or has been revoked by the sender.'
              : data.error || 'This report could not be loaded.'
          );
          return;
        }
        setPayload(data);
      } catch {
        if (!cancelled) setError('This report could not be loaded — try again in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const report = useMemo(
    () =>
      payload
        ? buildReport({
            job: payload.job,
            summary: payload.summary,
            findings: payload.findings,
            checkedLinks: payload.checkedLinks,
          })
        : null,
    [payload]
  );

  const narrative = payload?.narrative || null;
  const seoSummary = payload?.seoSummary || null;
  const seoPages = payload?.seoPages || [];
  const host = payload ? hostnameOf(payload.job.url) : '';
  const isPartial = payload?.job.status === 'stopped';

  const exportFindingsCsv = () => {
    const sharedSet = new Set(report?.sharedTargets || []);
    csvDownload(
      `seoscrub-findings-${host}.csv`,
      ['Severity', 'Type', 'HTTP Code', 'URL', 'Scope', 'Source Page', 'Link Text', 'Error'],
      (payload.findings || []).map((f) => {
        const cls = classifyFinding(f);
        return [
          deriveSeverity(cls, !!f.is_internal, sharedSet.has(f.url)),
          CLASS_SHORT[cls],
          f.http_status_code ?? '',
          f.url,
          f.is_internal ? 'Internal' : 'External',
          f.source_url || '',
          f.link_text && f.link_text !== 'Unknown' ? f.link_text : '',
          f.error_message || '',
        ];
      })
    );
  };

  const exportSeoCsv = () => {
    csvDownload(
      `seoscrub-seo-fixlist-${host}.csv`,
      [
        'Page URL',
        'Score',
        'Grade',
        'Title',
        'Title Length',
        'Meta Description Length',
        'Issues',
        'Noindex',
        'Blocked by robots.txt',
        'Open Graph',
        'Structured Data',
        'Lang',
        'Viewport',
        'Stale Content',
      ],
      seoPages.map((p) => {
        const s = p.signals || {};
        return [
          p.url,
          p.seo_score,
          p.seo_grade,
          p.title_text || '',
          p.title_length || 0,
          p.description_length || 0,
          (p.issues || []).map((i) => i.message).join(' | '),
          s.robots?.noindex ? 'YES' : 'no',
          s.robotsTxt?.disallowed ? 'YES' : 'no',
          s.social?.hasOpenGraph ? 'present' : 'MISSING',
          s.structuredData?.hasStructuredData ? s.structuredData.types.join('; ') : 'MISSING',
          s.fundamentals?.htmlLang || 'MISSING',
          s.fundamentals?.hasViewport ? 'present' : 'MISSING',
          s.freshness?.isStale ? 'YES' : 'no',
        ];
      })
    );
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className={`${microLabel} text-text-subtle`}>SeoScrub · Shared Report</p>
        <p className="mt-4 font-display text-2xl text-text">{error}</p>
        <p className="mt-3 text-sm text-text-muted">
          Ask the person who sent you this link for a fresh one.
        </p>
      </main>
    );
  }

  if (!payload || !report) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
        <p className={`${microLabel} animate-pulse text-text-subtle`}>Loading report…</p>
      </main>
    );
  }

  let sectionNo = 0;
  const serial = () => String(++sectionNo).padStart(2, '0');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 lg:px-8 print:max-w-none print:px-0 print:py-0">
      {/* Toolbar — screen only */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 print:hidden">
        <p className={`${microLabel} text-text-subtle`}>
          Read-only report · shared by the site owner
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={exportFindingsCsv}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
          >
            Findings CSV
          </button>
          {seoPages.length > 0 && (
            <button
              type="button"
              onClick={exportSeoCsv}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
            >
              SEO fix list CSV
            </button>
          )}
        </div>
      </div>

      {/* Masthead */}
      <header className="mb-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className={`${microLabel} text-text-subtle`}>SeoScrub · Site Audit Report</p>
          <p className="font-mono text-xs text-text-subtle">{reportDate(payload.job.timestamps?.completedAt)}</p>
        </div>
        <div className="mt-2 h-px bg-border" />
        <h1 className="mt-8 font-display text-4xl leading-tight text-text md:text-5xl">{host}</h1>
        <p className="mt-3 font-mono text-xs text-text-muted">
          {payload.job.url} · depth {payload.job.settings?.maxDepth ?? '—'} ·{' '}
          {payload.job.settings?.enableSEO ? 'link health + SEO' : 'link health'}
          {isPartial ? ' · PARTIAL — audit stopped before completion' : ''}
        </p>
      </header>

      {/* 01 · Verdict */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-5 text-text-subtle`}>
          {serial()} · Link health verdict
        </p>
        <div className="grid gap-8 sm:grid-cols-[auto_1fr]">
          <div className="border border-border p-6 text-center">
            <p className="font-display text-6xl leading-none text-text">{report.score.grade}</p>
            <p className="mt-2 font-mono text-xs text-text-muted">{report.score.overall}/100</p>
          </div>
          <div>
            <blockquote className="border-l-2 border-action pl-5 font-display text-xl leading-snug text-text">
              {narrative?.headline ?? report.verdict}
            </blockquote>
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 font-mono text-xs text-text-muted sm:grid-cols-3">
              {[
                ['Checked URLs', report.kpis.totalChecked.toLocaleString()],
                ['Healthy', report.kpis.healthy.toLocaleString()],
                ['Link issues', report.kpis.issues.toLocaleString()],
                ['Slow links', report.kpis.slowLinks.toLocaleString()],
                ['Pages affected', report.kpis.affectedPages.toLocaleString()],
                ['SEO pages', report.kpis.pagesAnalyzed.toLocaleString()],
              ].map(([k, v]) => (
                <p key={k} className="flex justify-between gap-2 border-b border-dotted border-border pb-0.5">
                  <span>{k}</span>
                  <span className="text-text">{v}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 02 · AI expert summary */}
      {narrative && (
        <section className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · AI SEO expert summary</p>
          <div className="space-y-5">
            {narrative.findings.map((f, i) => (
              <div key={i} className="border-l-2 border-border pl-5">
                <p className="text-base text-text">{f.finding}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{f.why}</p>
                <p className={`${microLabel} mt-1.5 text-action`}>→ {f.action}</p>
              </div>
            ))}
          </div>
          {narrative.priorityActions?.length > 0 && (
            <ol className="mt-6 space-y-1.5 border-t border-border pt-4">
              {narrative.priorityActions.map((action, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-muted">
                  <span className="shrink-0 font-mono text-action">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {action}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* 03 · Remediation plan */}
      {report.tasks.length > 0 && (
        <section className="mb-12">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · Remediation plan</p>
          <div className="space-y-4">
            {report.tasks.map((t) => (
              <div key={t.rank} className="break-inside-avoid border border-border p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium text-text">
                    <span className="mr-3 font-mono text-xs text-action">
                      {String(t.rank).padStart(2, '0')}
                    </span>
                    {t.action}
                  </p>
                  <p className="shrink-0 font-mono text-[11px] text-text-subtle">
                    {t.owner} · effort {t.effort} · {t.instances} instance{t.instances === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="mt-1.5 pl-8 text-sm leading-relaxed text-text-muted">{t.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 04 · Findings by severity */}
      {report.kpis.issues > 0 && (
        <section className="mb-12">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · Link findings by priority</p>
          <div className="space-y-6">
            {report.bySeverity
              .filter((block) => block.count > 0)
              .map((block) => (
                <div key={block.severity} className="break-inside-avoid">
                  <p className={`${microLabel} mb-2 ${SEVERITY_TONE[block.severity]}`}>
                    {block.severity} · {block.count}
                  </p>
                  <div className="divide-y divide-border border border-border">
                    {block.groups.map((g) => (
                      <div key={g.cls} className="grid gap-1 p-3 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <p className="text-sm text-text">{g.label}</p>
                          <p className="truncate font-mono text-xs text-text-muted">
                            e.g. {g.example}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-text-subtle">{g.action}</p>
                        </div>
                        <p className="shrink-0 font-mono text-xs text-text-muted">
                          {g.count} total · {g.internal} internal · {g.external} external
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            The complete URL-by-URL list is in the Findings CSV export.
          </p>
        </section>
      )}

      {/* 05 · SEO snapshot */}
      {seoSummary && seoPages.length > 0 && (
        <section className="mb-12">
          <p className={`${microLabel} mb-5 text-text-subtle`}>
            {serial()} · SEO snapshot — measured separately
          </p>
          <div className="mb-6 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
            <div className="bg-surface p-5">
              <p className={`${microLabel} text-text-subtle`}>On-Page</p>
              <p className="mt-3 font-mono text-2xl text-text">
                {Math.round(seoSummary.avg_score || 0)}/100
              </p>
              <p className="mt-1 font-mono text-xs text-text-muted">
                page average · range {seoSummary.min_score ?? '—'}–{seoSummary.max_score ?? '—'} ·{' '}
                {seoSummary.total_pages || 0} pages · {seoSummary.total_issues || 0} issues
              </p>
            </div>
            <div className="bg-surface p-5">
              <p className={`${microLabel} text-text-subtle`}>Indexability</p>
              {seoSummary.indexability ? (
                <>
                  <p
                    className={`mt-3 font-mono text-2xl ${
                      seoSummary.indexability.hidden > 0 ? 'text-danger' : 'text-text'
                    }`}
                  >
                    {seoSummary.indexability.indexable}/{seoSummary.indexability.measured_pages}
                  </p>
                  <p className="mt-1 font-mono text-xs text-text-muted">
                    pages visible to search
                    {seoSummary.indexability.hidden > 0
                      ? ` · ${seoSummary.indexability.noindexed} noindexed · ${seoSummary.indexability.robots_blocked} robots-blocked`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-text-subtle">Not measured in this audit.</p>
              )}
            </div>
          </div>

          <div className="divide-y divide-border border border-border">
            {seoPages.map((p) => {
              const s = p.signals || {};
              const flags = [];
              if (s.robots?.noindex) flags.push('noindexed');
              if (s.robotsTxt?.disallowed) flags.push('blocked by robots.txt');
              return (
                <div key={p.url} className="break-inside-avoid p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="min-w-0 truncate font-mono text-xs text-text">{p.url}</p>
                    <p className="shrink-0 font-mono text-xs text-text-muted">
                      {p.seo_score}/100 ({p.seo_grade})
                      {flags.length > 0 && <span className="text-danger"> · {flags.join(' · ')}</span>}
                    </p>
                  </div>
                  {(p.issues || []).length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {p.issues.map((issue, i) => (
                        <li key={i} className="flex gap-2 text-xs leading-relaxed text-text-muted">
                          <span className="font-mono text-action">-</span>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            SEO is scored per analyzed HTML page and never feeds the link-health grade. Content
            metrics are measured on the first 50KB of each page. The SEO fix list CSV has this
            table in spreadsheet form.
          </p>
        </section>
      )}

      {/* 06 · Environment exposures */}
      {report.environmentExposures.length > 0 && (
        <section className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-danger`}>{serial()} · Exposure review</p>
          <div className="divide-y divide-border border border-border">
            {report.environmentExposures.map((e, i) => (
              <p key={i} className="truncate p-3 font-mono text-xs text-text-muted">
                {e.url || e}
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            URLs referencing internal or non-production environments. They may load fine, but they
            should not be linked from a public site.
          </p>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border pt-5 pb-10">
        <p className="text-xs leading-relaxed text-text-subtle">
          A link counts as broken when it answers with a 4xx/5xx status, times out, or fails at the
          DNS/TLS layer. Audit ran {reportDate(payload.job.timestamps?.createdAt)}
          {payload.job.timestamps?.completedAt
            ? ` and finished ${reportDate(payload.job.timestamps.completedAt)}`
            : ''}
          . Generated by SeoScrub — automated link-health &amp; SEO auditing.
        </p>
      </footer>
    </main>
  );
}
