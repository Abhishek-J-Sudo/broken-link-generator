'use client';

/**
 * /share/[token] — public, read-only CLIENT health report.
 *
 * The brief for the site owner: grade, plain-English verdict, a few headline
 * numbers, what was found, and what gets fixed first. Deliberately free of
 * URL tables, jargon, and per-page detail — all of that lives in the team
 * document at /share/[token]/fix-list. Prints to 1–2 clean pages.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { buildReport, hostnameOf } from '@/lib/auditReport';
import {
  microLabel,
  reportDate,
  useSharedReport,
  ShareErrorScreen,
  ShareLoadingScreen,
} from '../useSharedReport';

const GRADE_WORD = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' };

export default function SharedReportPage() {
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

  if (error) return <ShareErrorScreen error={error} />;
  if (!payload || !report) return <ShareLoadingScreen />;

  const narrative = payload.narrative || null;
  const seoSummary = payload.seoSummary || null;
  const host = hostnameOf(payload.job.url);
  const isPartial = payload.job.status === 'stopped';
  const indexability = seoSummary?.indexability || null;

  const healthyShare = report.kpis.totalChecked
    ? Math.round((100 * report.kpis.healthy) / report.kpis.totalChecked)
    : 100;

  // 3–4 headline numbers, no more — this is the whole point of the summary.
  const stats = [
    ['URLs checked', report.kpis.totalChecked.toLocaleString()],
    ['Broken links', report.kpis.issues.toLocaleString()],
    ['Links working', `${healthyShare}%`],
  ];
  if (indexability) {
    stats.push(['Pages hidden from search', String(indexability.hidden)]);
  } else if (report.kpis.pagesAnalyzed > 0) {
    stats.push(['Pages reviewed for SEO', report.kpis.pagesAnalyzed.toLocaleString()]);
  }

  // What gets fixed first: the AI plan when it exists, else the derived tasks.
  const fixFirst =
    narrative?.priorityActions?.length > 0
      ? narrative.priorityActions
      : report.tasks.slice(0, 5).map((t) => t.action);

  // What we found: AI findings as prose, else the rule-generated takeaways.
  const found = narrative?.findings?.length > 0 ? narrative.findings : null;

  let sectionNo = 0;
  const serial = () => String(++sectionNo).padStart(2, '0');

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 lg:px-8 print:max-w-none print:px-0 print:py-0">
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
          <Link
            href={`/share/${token}/fix-list`}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
          >
            SEO team fix list →
          </Link>
        </div>
      </div>

      {/* Masthead */}
      <header className="mb-12">
        <div className="flex items-baseline justify-between gap-4">
          <p className={`${microLabel} text-text-subtle`}>SeoScrub · Site Health Report</p>
          <p className="font-mono text-xs text-text-subtle">
            {reportDate(payload.job.timestamps?.completedAt)}
          </p>
        </div>
        <div className="mt-2 h-px bg-border" />
        <h1 className="mt-8 font-display text-4xl leading-tight text-text md:text-5xl">{host}</h1>
        <p className="mt-3 text-sm text-text-muted">
          {payload.job.settings?.enableSEO
            ? 'Full audit — link health and on-page SEO.'
            : 'Link-health audit.'}
          {isPartial ? ' Partial: the audit was stopped before completion.' : ''}
        </p>
      </header>

      {/* 01 · Verdict */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · The verdict</p>
        <div className="grid gap-8 sm:grid-cols-[auto_1fr]">
          <div className="border border-border p-6 text-center">
            <p className="font-display text-6xl leading-none text-text">{report.score.grade}</p>
            <p className="mt-2 font-mono text-xs text-text-muted">
              {GRADE_WORD[report.score.grade] || 'Fair'}
            </p>
          </div>
          <blockquote className="self-center border-l-2 border-action pl-5 font-display text-xl leading-snug text-text">
            {narrative?.headline ?? report.verdict}
          </blockquote>
        </div>
        <div
          className={`mt-8 grid border-y border-border ${
            stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {stats.map(([label, value], i) => (
            <div key={label} className={`py-5 ${i > 0 ? 'sm:border-l sm:border-border sm:pl-6' : ''}`}>
              <p className="font-display text-3xl text-text">{value}</p>
              <p className={`${microLabel} mt-1.5 text-text-subtle`}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 02 · What we found */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · What we found</p>
        {found ? (
          <div className="space-y-5">
            {found.map((f, i) => (
              <div key={i} className="border-l-2 border-border pl-5">
                <p className="text-base text-text">{f.finding}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{f.why}</p>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {report.takeaways.map((t, i) => (
              <li key={i} className="border-l-2 border-border pl-5 text-base leading-relaxed text-text">
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 03 · What gets fixed first */}
      {fixFirst.length > 0 && (
        <section className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · What gets fixed first</p>
          <ol className="space-y-3">
            {fixFirst.map((action, i) => (
              <li key={i} className="flex gap-4 text-base leading-relaxed text-text">
                <span className="shrink-0 font-mono text-sm text-action">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {action}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-text-muted">
            The complete work order — every broken link and every page-level SEO item — is in the
            accompanying SEO team fix list.
          </p>
        </section>
      )}

      {/* 04 · Search visibility */}
      {seoSummary && (
        <section className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · Search visibility</p>
          <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
            <div className="bg-surface p-5">
              <p className={`${microLabel} text-text-subtle`}>On-page SEO</p>
              <p className="mt-3 font-display text-3xl text-text">
                {Math.round(seoSummary.avg_score || 0)}
                <span className="text-lg text-text-muted">/100</span>
              </p>
              <p className="mt-1 text-sm text-text-muted">
                average across {seoSummary.total_pages || 0} pages reviewed
              </p>
            </div>
            <div className="bg-surface p-5">
              <p className={`${microLabel} text-text-subtle`}>Visible to search engines</p>
              {indexability ? (
                <>
                  <p
                    className={`mt-3 font-display text-3xl ${
                      indexability.hidden > 0 ? 'text-danger' : 'text-text'
                    }`}
                  >
                    {indexability.indexable}
                    <span className="text-lg text-text-muted">
                      /{indexability.measured_pages}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {indexability.hidden > 0
                      ? `${indexability.hidden} page${indexability.hidden === 1 ? ' is' : 's are'} currently invisible to Google`
                      : 'every reviewed page can appear in results'}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-text-muted">Not measured in this audit.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border pt-5 pb-10">
        <p className="text-xs leading-relaxed text-text-subtle">
          A link counts as broken when the page it points to is missing, erroring, or unreachable.
          Audit ran {reportDate(payload.job.timestamps?.createdAt)}
          {payload.job.timestamps?.completedAt
            ? ` and finished ${reportDate(payload.job.timestamps.completedAt)}`
            : ''}
          . Generated by SeoScrub — automated link-health &amp; SEO auditing.
        </p>
      </footer>
    </main>
  );
}
