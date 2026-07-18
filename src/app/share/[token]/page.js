'use client';

/**
 * /share/[token] — public, read-only CLIENT health report.
 *
 * Written for a non-technical reader (a client, manager, or director):
 *   two plainly-labelled scores → what they mean → what we found → what to fix
 *   first → the team tracker.
 * The two scores are shown side by side as equal brand hexagons so the
 * link-health grade and the SEO score never read as a contradiction. No URL
 * tables, no jargon left unexplained, no per-page detail — the working detail
 * lives in the team tracker at /share/[token]/fix-list. Prints to one clean page.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { buildReport, hostnameOf } from '@/lib/auditReport';
import BrandRule from '@/app/components/BrandRule';
import GradeHex from '@/app/components/GradeHex';
import {
  microLabel,
  reportDate,
  useSharedReport,
  ShareErrorScreen,
  ShareLoadingScreen,
} from '../useSharedReport';

const GRADE_WORD = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' };

// Plain-English word for the on-page SEO /100 score, mirroring the grade word.
function seoWord(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs work';
  return 'Poor';
}

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

  const issues = report.kpis.issues;
  const healthyShare = report.kpis.totalChecked
    ? Math.round((100 * report.kpis.healthy) / report.kpis.totalChecked)
    : 100;

  const hasSeo = !!seoSummary && (seoSummary.total_pages || 0) > 0;
  const seoScore = hasSeo ? Math.round(seoSummary.avg_score || 0) : null;
  const hidden = indexability?.hidden || 0;

  // The two equal scores — each a brand hexagon with a one-line plain meaning.
  const scores = [
    {
      label: 'Link health',
      value: report.score.grade,
      sub: GRADE_WORD[report.score.grade] || 'Fair',
      meaning:
        issues === 0
          ? 'Every link on your site works — no dead ends for your visitors.'
          : `${issues.toLocaleString()} link${issues === 1 ? '' : 's'} lead nowhere — some visitors will hit dead ends.`,
    },
  ];
  if (hasSeo) {
    scores.push({
      label: 'SEO health',
      value: String(seoScore),
      sub: `out of 100 · ${seoWord(seoScore)}`,
      meaning:
        seoScore >= 80
          ? 'Your pages are well set up to be found on Google and shared online.'
          : seoScore >= 60
            ? 'Your pages are missing some details that help them show up on Google.'
            : 'Your pages are missing details that search engines and social sites look for.',
    });
  }

  // Slim, plain headline numbers under the scores.
  const stats = [
    ['URLs checked', report.kpis.totalChecked.toLocaleString()],
    ['Broken links', issues.toLocaleString()],
    ['Links working', `${healthyShare}%`],
  ];
  if (hasSeo) stats.push(['Pages reviewed', seoSummary.total_pages.toLocaleString()]);

  // "What this means" — 2–3 plain sentences, composed from the data (no AI call).
  const meaningSentences = [
    issues === 0
      ? 'Your site is easy to move around — every link we checked works.'
      : `We found ${issues.toLocaleString()} broken link${issues === 1 ? '' : 's'} that send visitors to pages which no longer exist.`,
  ];
  if (hasSeo) {
    meaningSentences.push(
      `Your pages score ${seoScore} out of 100 for on-page SEO — they're missing details that help search engines understand and rank them` +
        (hidden > 0
          ? `, and ${hidden} ${hidden === 1 ? 'page is' : 'pages are'} currently hidden from search altogether.`
          : '.')
    );
  }
  meaningSentences.push(
    'None of this means your site is broken — most of it is missed opportunity that is quick to fix, and the priorities are listed below.'
  );

  // What we found: AI findings as prose, else the rule-generated takeaways.
  const found = narrative?.findings?.length > 0 ? narrative.findings : null;

  // What to fix first: the AI plan when it exists, else derived tasks. Top 3 only.
  const fixFirst = (
    narrative?.priorityActions?.length > 0
      ? narrative.priorityActions
      : report.tasks.map((t) => t.action)
  ).slice(0, 3);

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
            SEO fix tracker →
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
        <BrandRule className="mt-2" />
        <h1 className="mt-8 font-display text-4xl leading-tight text-text md:text-5xl">{host}</h1>
        <p className="mt-3 text-sm text-text-muted">
          {payload.job.settings?.enableSEO
            ? 'Full audit — link health and on-page SEO.'
            : 'Link-health audit.'}
          {isPartial ? ' Partial: the audit was stopped before completion.' : ''}
        </p>
      </header>

      {/* 01 · Your scores — two equal hexagons, the fix for the grade-vs-score clash */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-6 text-text-subtle`}>{serial()} · Your scores</p>
        <div className={`grid items-start gap-10 ${scores.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {scores.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-4 text-center">
              <p className={`${microLabel} text-text-subtle`}>{s.label}</p>
              <GradeHex grade={s.value} sub={s.sub} />
              <p className="max-w-[30ch] text-sm leading-relaxed text-text-muted">{s.meaning}</p>
            </div>
          ))}
        </div>
        <div
          className={`mt-10 grid border-y border-border ${
            stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {stats.map(([label, value], i) => (
            <div
              key={label}
              className={`py-5 text-center sm:text-left ${
                i > 0 ? 'sm:border-l sm:border-border sm:pl-6' : ''
              }`}
            >
              <p className="font-display text-3xl text-text">{value}</p>
              <p className={`${microLabel} mt-1.5 text-text-subtle`}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 02 · What this means */}
      <section className="mb-12 break-inside-avoid">
        <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · What this means</p>
        <div className="space-y-3 text-lg leading-relaxed text-text">
          {meaningSentences.map((sentence, i) => (
            <p key={i}>{sentence}</p>
          ))}
        </div>
      </section>

      {/* 03 · What we found */}
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

      {/* 04 · What to fix first */}
      {fixFirst.length > 0 && (
        <section className="mb-12 break-inside-avoid">
          <p className={`${microLabel} mb-5 text-text-subtle`}>{serial()} · What to fix first</p>
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
          <p className="mt-6 text-sm leading-relaxed text-text-muted">
            Every item — each broken link and page-level fix — is listed in the{' '}
            <Link
              href={`/share/${token}/fix-list`}
              className="text-action underline-offset-2 hover:underline"
            >
              SEO fix tracker
            </Link>
            , where the team can assign an owner and tick each one off.
          </p>
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
