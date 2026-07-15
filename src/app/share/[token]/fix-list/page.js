'use client';

/**
 * /share/[token]/fix-list — public, read-only SEO TEAM work order.
 *
 * The working document: every broken link as a real table row (URL / status /
 * found-on / link text) grouped by failure type, and every on-page SEO check
 * grouped by check type with the failing pages and measured values — the way
 * audit tooling exports read, so the team can divide the work and tick it off.
 * The client-friendly summary lives one level up at /share/[token].
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  buildReport,
  classifyFinding,
  deriveSeverity,
  actionForClass,
  hostnameOf,
  pathOf,
  CLASS_LABELS,
  CLASS_SHORT,
} from '@/lib/auditReport';
import { buildSeoFixList } from '@/lib/seoChecks';
import BrandRule from '@/app/components/BrandRule';
import {
  microLabel,
  reportDate,
  csvDownload,
  useSharedReport,
  ShareErrorScreen,
  ShareLoadingScreen,
} from '../../useSharedReport';

// Keep printed tables sane on very broken sites; the CSV always has all rows.
const MAX_ROWS_PER_CLASS = 200;

const SEVERITY_RANK = { critical: 0, major: 1, minor: 2 };

const SEO_TONE = {
  critical: 'text-danger',
  major: 'text-danger',
  warning: 'text-warning',
  minor: 'text-text-muted',
  notice: 'text-text-subtle',
};

const thCell = `${microLabel} py-2 pr-4 text-left font-normal text-text-subtle`;

function StatusCell({ row }) {
  return row.statusCode != null ? String(row.statusCode) : CLASS_SHORT[row.cls];
}

export default function SharedFixListPage() {
  const { token } = useParams();
  const { payload, error } = useSharedReport(token);

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

  // Broken findings as table rows, grouped by failure class (count desc).
  const classGroups = useMemo(() => {
    if (!payload || !report) return [];
    const sharedSet = new Set(report.sharedTargets);
    const byClass = new Map();
    for (const f of payload.findings || []) {
      const cls = classifyFinding(f);
      const isInternal = !!f.is_internal;
      const row = {
        url: f.url,
        sourceUrl: f.source_url || null,
        linkText: f.link_text && f.link_text !== 'Unknown' ? f.link_text : null,
        statusCode: f.http_status_code,
        isInternal,
        isShared: sharedSet.has(f.url),
        cls,
        severity: deriveSeverity(cls, isInternal, sharedSet.has(f.url)),
      };
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(row);
    }
    return [...byClass.entries()]
      .map(([cls, rows]) => {
        rows.sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            Number(b.isInternal) - Number(a.isInternal) ||
            a.url.localeCompare(b.url)
        );
        const internal = rows.filter((r) => r.isInternal).length;
        return {
          cls,
          label: CLASS_LABELS[cls],
          rows,
          internal,
          external: rows.length - internal,
          action: actionForClass(cls, internal >= rows.length - internal),
        };
      })
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [payload, report]);

  const seoFixList = useMemo(
    () => (payload?.seoPages?.length ? buildSeoFixList(payload.seoPages) : null),
    [payload]
  );

  if (error) return <ShareErrorScreen error={error} />;
  if (!payload || !report) return <ShareLoadingScreen />;

  const seoPages = payload.seoPages || [];
  const host = hostnameOf(payload.job.url);
  const isPartial = payload.job.status === 'stopped';
  const exposures = report.environmentExposures;

  const severityCounts = { critical: 0, major: 0, minor: 0 };
  for (const g of classGroups) for (const r of g.rows) severityCounts[r.severity]++;
  const totalFindings = report.kpis.issues;

  const exportLinksCsv = () => {
    const sharedSet = new Set(report.sharedTargets);
    // Broken rows carry error detail the checked-links payload doesn't have.
    const findingByUrl = new Map((payload.findings || []).map((f) => [f.url, f]));
    // Full inventory, broken rows first — a healthy site still exports every
    // checked URL as proof-of-work instead of an empty file.
    const links = (payload.checkedLinks || []).slice().sort((a, b) => {
      const aBroken = a.is_working !== true;
      const bBroken = b.is_working !== true;
      if (aBroken !== bBroken) return aBroken ? -1 : 1;
      return a.url.localeCompare(b.url);
    });
    csvDownload(
      `seoscrub-links-${host}.csv`,
      [
        'Result',
        'Severity',
        'Type',
        'HTTP Code',
        'URL',
        'Scope',
        'Source Page',
        'Link Text',
        'Response Time (ms)',
        'Error',
      ],
      links.map((l) => {
        const broken = l.is_working !== true;
        const f = broken ? findingByUrl.get(l.url) : null;
        const cls = broken ? classifyFinding(f || l) : null;
        return [
          broken ? 'BROKEN' : 'OK',
          broken ? deriveSeverity(cls, !!l.is_internal, sharedSet.has(l.url)) : '',
          broken ? CLASS_SHORT[cls] : '',
          l.http_status_code ?? '',
          l.url,
          l.is_internal ? 'Internal' : 'External',
          l.source_url || '',
          f?.link_text && f.link_text !== 'Unknown' ? f.link_text : '',
          l.response_time ?? '',
          f?.error_message || '',
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

  let sectionNo = 0;
  const serial = () => String(++sectionNo).padStart(2, '0');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 lg:px-8 print:max-w-none print:px-0 print:py-0">
      {/* Toolbar — screen only */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 print:hidden">
        <Link
          href={`/share/${token}`}
          className={`${microLabel} text-text-subtle transition-colors hover:text-text`}
        >
          ← Client summary
        </Link>
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
            onClick={exportLinksCsv}
            title="Every checked link with its status — broken rows include severity, error type, and link text"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
          >
            Links CSV
          </button>
          {seoPages.length > 0 && (
            <button
              type="button"
              onClick={exportSeoCsv}
              title="Per-page SEO scores, issues, and signals for every analyzed page"
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
            >
              SEO pages CSV
            </button>
          )}
        </div>
      </div>

      {/* Masthead */}
      <header className="mb-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className={`${microLabel} text-text-subtle`}>SeoScrub · SEO Team Fix List</p>
          <p className="font-mono text-xs text-text-subtle">
            {reportDate(payload.job.timestamps?.completedAt)}
          </p>
        </div>
        <BrandRule className="mt-2" />
        <h1 className="mt-8 font-display text-4xl leading-tight text-text md:text-5xl">{host}</h1>
        <p className="mt-3 font-mono text-xs text-text-muted">
          {payload.job.url} · depth {payload.job.settings?.maxDepth ?? '—'} ·{' '}
          {report.kpis.totalChecked.toLocaleString()} URLs checked
          {isPartial ? ' · PARTIAL — audit stopped before completion' : ''}
        </p>
      </header>

      {/* 01 · Work summary */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · Work summary</p>
        <div className="space-y-1.5 font-mono text-xs text-text-muted">
          {[
            [
              'Broken links',
              totalFindings
                ? `${totalFindings} — ${severityCounts.critical} critical · ${severityCounts.major} major · ${severityCounts.minor} minor`
                : 'none found',
              '#broken-links',
            ],
            seoFixList && [
              'On-page SEO issues',
              `${seoFixList.totals.issues} across ${seoFixList.totals.pagesWithIssues} of ${seoFixList.totals.pagesMeasured} pages`,
              '#on-page-seo',
            ],
            exposures.length > 0 && [
              'Environment exposures',
              String(exposures.length),
              '#exposures',
            ],
          ]
            .filter(Boolean)
            .map(([label, value, href]) => (
              <p key={label} className="flex items-baseline gap-2">
                <a href={href} className="shrink-0 text-text hover:text-action">
                  {label}
                </a>
                <span className="flex-1 border-b border-dotted border-border" />
                <span>{value}</span>
              </p>
            ))}
        </div>
      </section>

      {/* 02 · Broken links, by failure type */}
      <section id="broken-links" className="mb-12">
        <p className={`${microLabel} mb-5 text-text-subtle`}>
          {serial()} · Broken links — by failure type
        </p>
        {classGroups.length === 0 ? (
          <p className="text-sm text-text-muted">
            No broken links — all {report.kpis.totalChecked.toLocaleString()} checked URLs resolve.
          </p>
        ) : (
          <div className="space-y-8">
            {classGroups.map((group) => (
              <div key={group.cls}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-text">
                    {group.label}
                    <span className="ml-3 font-mono text-xs text-text-muted">
                      {group.rows.length} · {group.internal} internal · {group.external} external
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-subtle">{group.action}</p>
                <table className="mt-3 w-full table-fixed border-collapse border-t border-border">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={`${thCell} w-[36%]`}>Broken URL</th>
                      <th className={`${thCell} w-[8%]`}>Status</th>
                      <th className={`${thCell} w-[30%]`}>Found on</th>
                      <th className={`${thCell} w-[26%]`}>Link text</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {group.rows.slice(0, MAX_ROWS_PER_CLASS).map((row, i) => (
                      <tr key={`${row.url}-${i}`} className="break-inside-avoid border-b border-border">
                        <td className="py-2 pr-4">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all font-mono text-xs text-text hover:text-action"
                          >
                            {row.url}
                          </a>
                          <p className="mt-0.5 font-mono text-[10px] text-text-subtle">
                            {row.isInternal ? 'internal' : 'external'}
                            {row.severity === 'critical' && (
                              <span className="text-danger"> · critical</span>
                            )}
                            {row.isShared && ' · shared element — one edit fixes all instances'}
                          </p>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-text">
                          <StatusCell row={row} />
                        </td>
                        <td className="py-2 pr-4">
                          {row.sourceUrl ? (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all font-mono text-xs text-text-muted hover:text-action"
                            >
                              {pathOf(row.sourceUrl)}
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-text-subtle">discovery</span>
                          )}
                        </td>
                        <td className="py-2 text-xs leading-relaxed text-text-muted">
                          {row.linkText || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {group.rows.length > MAX_ROWS_PER_CLASS && (
                  <p className="mt-2 text-xs text-text-subtle">
                    Showing {MAX_ROWS_PER_CLASS} of {group.rows.length} — the Links CSV has the
                    complete list.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 03 · On-page SEO, by check type */}
      <section id="on-page-seo" className="mb-12">
        <p className={`${microLabel} mb-5 text-text-subtle`}>
          {serial()} · On-page SEO — by check type
        </p>
        {!seoFixList ? (
          <p className="text-sm text-text-muted">
            {payload.job.settings?.enableSEO
              ? 'No pages were analyzed for SEO in this audit.'
              : 'On-page SEO was not part of this audit.'}
          </p>
        ) : (
          <>
            {/* Pages measured — score reference */}
            <table className="w-full table-fixed border-collapse border-t border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thCell} w-[64%]`}>Page ({seoPages.length} measured)</th>
                  <th className={`${thCell} w-[12%]`}>Score</th>
                  <th className={`${thCell} w-[12%]`}>Grade</th>
                  <th className={`${thCell} w-[12%]`}>Issues</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {seoPages.map((p) => (
                  <tr key={p.url} className="break-inside-avoid border-b border-border">
                    <td className="break-all py-2 pr-4 font-mono text-xs text-text">
                      {pathOf(p.url)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-text">{p.seo_score}/100</td>
                    <td
                      className={`py-2 pr-4 font-mono text-xs ${
                        ['D', 'F'].includes(p.seo_grade) ? 'text-danger' : 'text-text'
                      }`}
                    >
                      {p.seo_grade}
                    </td>
                    <td className="py-2 font-mono text-xs text-text-muted">
                      {seoFixList.pageIssueCounts.get(p.url) || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Check groups */}
            <div className="mt-8 space-y-8">
              {seoFixList.categories.map((cat) => (
                <div key={cat.key}>
                  <p className={`${microLabel} mb-3 text-text`}>{cat.label}</p>
                  <div className="space-y-4">
                    {cat.checks.map((check) => {
                      if (check.status === 'fail') {
                        return (
                          <div key={check.id} className="break-inside-avoid border-l-2 border-border pl-4">
                            <p className="text-sm text-text">
                              <span className={`mr-2 font-mono ${SEO_TONE[check.severity]}`}>✕</span>
                              {check.label}
                              <span className={`ml-3 font-mono text-[11px] uppercase ${SEO_TONE[check.severity]}`}>
                                {check.severity}
                              </span>
                              <span className="ml-3 font-mono text-xs text-text-muted">
                                {check.affected.length} of{' '}
                                {check.affected.length + check.passCount} page
                                {check.affected.length + check.passCount === 1 ? '' : 's'}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-text-subtle">
                              Fix: {check.hint}
                            </p>
                            <div className="mt-2 space-y-1">
                              {check.affected.map((a) => (
                                <p key={a.url} className="flex items-baseline gap-2 font-mono text-xs">
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 break-all text-text-muted hover:text-action"
                                  >
                                    {pathOf(a.url)}
                                  </a>
                                  <span className="flex-1 border-b border-dotted border-border" />
                                  <span className="shrink-0 text-text">{a.value}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p key={check.id} className="pl-4 text-xs text-text-muted">
                          {check.status === 'pass' ? (
                            <>
                              <span className="mr-2 font-mono text-success">✓</span>
                              {check.label} — {check.passCount} page
                              {check.passCount === 1 ? '' : 's'} pass
                              {check.naCount > 0 ? ` (${check.naCount} not applicable)` : ''}
                            </>
                          ) : (
                            <>
                              <span className="mr-2 font-mono text-text-subtle">·</span>
                              <span className="text-text-subtle">
                                {check.label} — not measured in this audit
                              </span>
                            </>
                          )}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-text-subtle">
              SEO is scored per analyzed HTML page and never feeds the link-health grade. Content
              metrics are measured on the first 50KB of each page. The SEO fix list CSV mirrors
              this section in spreadsheet form.
            </p>
          </>
        )}
      </section>

      {/* 04 · Exposure review */}
      {exposures.length > 0 && (
        <section id="exposures" className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-danger`}>{serial()} · Exposure review</p>
          <table className="w-full table-fixed border-collapse border-t border-border">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thCell} w-[60%]`}>URL</th>
                <th className={`${thCell} w-[28%]`}>Flagged as</th>
                <th className={`${thCell} w-[12%]`}>HTTP</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {exposures.map((e, i) => (
                <tr key={i} className="break-inside-avoid border-b border-border">
                  <td className="break-all py-2 pr-4 font-mono text-xs text-text">{e.url}</td>
                  <td className="py-2 pr-4 text-xs text-text-muted">{e.reasons.join(', ')}</td>
                  <td className="py-2 font-mono text-xs text-text-muted">
                    {e.statusCode ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          DNS/TLS layer. Severity escalates for site-owned (internal) links and for targets broken
          in shared elements. Audit ran {reportDate(payload.job.timestamps?.createdAt)}
          {payload.job.timestamps?.completedAt
            ? ` and finished ${reportDate(payload.job.timestamps.completedAt)}`
            : ''}
          . Generated by SeoScrub — automated link-health &amp; SEO auditing.
        </p>
      </footer>
    </main>
  );
}
