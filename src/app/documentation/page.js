// src/app/documentation/page.js — User guide in the "Typeset Audit" language.
// Replaces the legacy Documentation.js sidebar app (rejected template, stale
// Supabase/Vercel copy). A single typeset document: anchored sections with a
// sticky contents rail; every number and check name here mirrors the real
// implementation (auditReport.js, seoChecks.js, the analyze/results pages).
import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Button from '@/app/components/Button';
import BrandRule from '@/app/components/BrandRule';

export const metadata = {
  title: 'User Guide — SeoScrub',
  description: 'How to run, read and share a SeoScrub site audit.',
};

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const CONTENTS = [
  { id: 'first-audit', serial: '§ 01', label: 'Your first audit' },
  { id: 'modes', serial: '§ 02', label: 'Modes & settings' },
  { id: 'report', serial: '§ 03', label: 'Reading the report' },
  { id: 'seo-review', serial: '§ 04', label: 'The SEO review' },
  { id: 'export-share', serial: '§ 05', label: 'Exports & sharing' },
  { id: 'troubleshooting', serial: '§ 06', label: 'Troubleshooting' },
];

/* The full SEO check manifest — names mirror seoChecks.js exactly. */
const SEO_CHECKS = [
  {
    group: 'Meta & canonical',
    checks: [
      'Missing page title',
      'Title too long (>60 chars)',
      'Title too short (<50 chars)',
      'Missing meta description',
      'Meta description too long (>160 chars)',
      'Meta description too short (<150 chars)',
      'Missing canonical URL',
    ],
  },
  {
    group: 'Content',
    checks: [
      'Low content word count (<200 words)',
      'Images missing alt text (<80% coverage)',
      'Slow page response (>3s)',
    ],
  },
  {
    group: 'Structure & fundamentals',
    checks: [
      'Missing H1 tag',
      'Skipped heading level in outline',
      'Headings appear before the first H1',
      'JSON-LD block fails to parse',
      'No structured data (JSON-LD)',
      'Missing lang attribute on <html>',
      'Missing viewport meta tag',
      'URL quality (length / underscores)',
      'Not served over HTTPS',
    ],
  },
  {
    group: 'Indexability',
    checks: ['Page is noindexed', 'Blocked by robots.txt'],
  },
  {
    group: 'Social preview',
    checks: ['No Open Graph tags', 'Incomplete Open Graph tags', 'No Twitter/X card (not scored)'],
  },
  {
    group: 'Freshness',
    checks: ['Content not updated in over 12 months', 'No date signals found (not scored)'],
  },
];

function LeaderRow({ k, v, tone = 'text-text' }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <span className="text-text-muted">{k}</span>
      <span className="flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
      <span className={tone}>{v}</span>
    </div>
  );
}

function GuideSection({ id, serial, label, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-4">
        <p className={`${microLabel} shrink-0 text-action`}>{serial}</p>
        <p className={`${microLabel} shrink-0 text-text-subtle`}>{label}</p>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <h2 className="mb-6 font-display text-3xl text-text md:text-4xl">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 pt-0.5 font-mono text-sm text-action">{n}</span>
      <div>
        <h3 className="mb-1.5 font-medium text-text">{title}</h3>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">{children}</p>
      </div>
    </li>
  );
}

function DashItem({ children }) {
  return (
    <li className="flex gap-3">
      <span className="text-action" aria-hidden="true">
        &mdash;
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <div className="mb-14">
          <div className="mb-4 flex items-center gap-4">
            <p className={`${microLabel} shrink-0 text-action`}>User Guide</p>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">
            How to run a clean audit.
          </h1>
          <p className="max-w-2xl leading-relaxed text-text-muted">
            Everything in this guide describes what the tool actually does &mdash; how an audit
            runs, how the report is scored, what every SEO check looks for, and how to hand the
            results to a client.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Contents rail ──────────────────────────────────────────── */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4 flex items-center gap-4">
                <p className={`${microLabel} shrink-0 text-text-subtle`}>Contents</p>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              <nav className="space-y-2.5">
                {CONTENTS.map((item) => (
                  <Link
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-baseline gap-2 font-mono text-xs"
                  >
                    <span className="text-action">{item.serial}</span>
                    <span
                      className="flex-1 border-b border-dotted border-border-strong"
                      aria-hidden="true"
                    />
                    <span className="text-text-muted transition-colors duration-200 group-hover:text-action">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Document ───────────────────────────────────────────────── */}
          <div className="space-y-20 lg:col-span-9">
            {/* § 01 — Your first audit */}
            <GuideSection
              id="first-audit"
              serial="&sect; 01"
              label="Getting Started"
              title="Your first audit"
            >
              <ol className="space-y-8">
                <Step n="01" title="Point it at a site">
                  Enter a complete URL, including https://. The Quick Check form on the{' '}
                  <Link href="/#quick-check" className="text-action hover:underline">
                    homepage
                  </Link>{' '}
                  starts a crawl immediately; the{' '}
                  <Link href="/analyze" className="text-action hover:underline">
                    Full Audit setup
                  </Link>{' '}
                  gives you the full set of controls.
                </Step>
                <Step n="02" title="Choose depth and checks">
                  Crawl depth (1&ndash;5) decides how far from the start page the crawler follows
                  links. On a Full Audit you can also run a scope estimate first and switch the
                  per-page SEO review on or off.
                </Step>
                <Step n="03" title="Watch it run">
                  Starting an audit opens the report page with live progress &mdash; pages
                  crawled, links checked, failures so far. You can stop a running audit at any
                  point; everything found up to then is kept.
                </Step>
                <Step n="04" title="Read, export, share">
                  The finished report opens with an executive summary and health score, then
                  prioritized fixes and the full evidence table. Export the data as CSV or JSON,
                  or create a read-only share link for a client.
                </Step>
              </ol>
            </GuideSection>

            {/* § 02 — Modes & settings */}
            <GuideSection
              id="modes"
              serial="&sect; 02"
              label="Modes &amp; Settings"
              title="Two ways in, and what the knobs do"
            >
              <div className="mb-8 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
                <div className="bg-surface p-6 sm:p-8">
                  <h3 className="mb-3 font-display text-2xl text-text">Full Audit</h3>
                  <p className="mb-5 text-sm leading-relaxed text-text-muted">
                    The complete workflow at{' '}
                    <Link href="/analyze" className="text-action hover:underline">
                      /analyze
                    </Link>
                    : estimate the scope before committing, tune every setting, and review
                    previous audits in the ledger below the form.
                  </p>
                  <ul className="space-y-2 text-sm text-text-muted">
                    <DashItem>
                      Scope estimate samples the site first and predicts pages, links and runtime
                    </DashItem>
                    <DashItem>Optional SEO review, on by default</DashItem>
                    <DashItem>Built for medium to large sites and client-ready reporting</DashItem>
                  </ul>
                </div>
                <div className="bg-surface p-6 sm:p-8">
                  <h3 className="mb-3 font-display text-2xl text-text">Quick Check</h3>
                  <p className="mb-5 text-sm leading-relaxed text-text-muted">
                    The form on the{' '}
                    <Link href="/#quick-check" className="text-action hover:underline">
                      homepage
                    </Link>
                    : a straight crawl with the two settings that matter most, for fast validation
                    on smaller sites.
                  </p>
                  <ul className="space-y-2 text-sm text-text-muted">
                    <DashItem>Crawl depth, defaulting to 3</DashItem>
                    <DashItem>External-link checking, off by default</DashItem>
                    <DashItem>Same live progress and same report at the end</DashItem>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
                <div className="bg-surface p-6 sm:p-8">
                  <p className={`${microLabel} mb-4 text-text-subtle`}>Depth &rarr; typical scope</p>
                  <div className="space-y-2">
                    <LeaderRow k="Depth 1–2" v="Small · under 100 pages" tone="text-success" />
                    <LeaderRow k="Depth 3" v="Medium · 100–500 pages" tone="text-info" />
                    <LeaderRow k="Depth 4" v="Large · 500–1,500 pages" tone="text-warning" />
                    <LeaderRow k="Depth 5" v="Very large · 1,500+ pages" tone="text-danger" />
                  </div>
                </div>
                <div className="bg-surface p-6 sm:p-8">
                  <p className={`${microLabel} mb-4 text-text-subtle`}>What settings cost</p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    Depth is the biggest lever on runtime &mdash; each level multiplies the pages
                    visited. The SEO review roughly doubles the work done per page. The setup page
                    shows a live runtime estimate as you change either one.
                  </p>
                </div>
              </div>
            </GuideSection>

            {/* § 03 — Reading the report */}
            <GuideSection
              id="report"
              serial="&sect; 03"
              label="The Report"
              title="How the report is scored"
            >
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-text-muted">
                Every audit produces the same written document: a one-line verdict, the health
                score, prioritized fixes, findings by category, the most affected pages, and a
                URL-by-URL evidence appendix.
              </p>

              <div className="mb-8 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
                <div className="bg-surface p-6 sm:p-8">
                  <p className={`${microLabel} mb-4 text-text-subtle`}>Health score / 100</p>
                  <div className="mb-4 space-y-2">
                    <LeaderRow k="Link integrity" v="70%" tone="text-action" />
                    <LeaderRow k="Response health" v="20%" tone="text-action" />
                    <LeaderRow k="Crawl coverage" v="10%" tone="text-action" />
                  </div>
                  <p className="text-sm leading-relaxed text-text-muted">
                    Link integrity weighs failures by class &mdash; an internal server error
                    counts far more than a flaky external link. Response health tracks links
                    slower than 5 seconds. Coverage is how much of the discovered site was
                    actually checked, so a stopped audit is scored as the partial read it is.
                  </p>
                </div>
                <div className="bg-surface p-6 sm:p-8">
                  <p className={`${microLabel} mb-4 text-text-subtle`}>Severity grades</p>
                  <div className="space-y-4 text-sm leading-relaxed text-text-muted">
                    <p>
                      <span className="font-mono text-xs text-danger">CRITICAL</span> &mdash;
                      internal server errors, and internal failures shared across several pages
                      (a broken link in a template or navigation).
                    </p>
                    <p>
                      <span className="font-mono text-xs text-warning">MAJOR</span> &mdash; other
                      internal failures, and external failures that repeat across pages.
                    </p>
                    <p>
                      <span className="font-mono text-xs text-info">MINOR</span> &mdash; isolated
                      external failures and links that block automated checking.
                    </p>
                  </div>
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
                Failures are classified as missing pages (4xx), server errors (5xx), timeouts,
                network failures, or blocked checks &mdash; and the report calls out targets that
                fail from many source pages, because fixing one template link often clears dozens
                of findings at once.
              </p>
            </GuideSection>

            {/* § 04 — The SEO review */}
            <GuideSection
              id="seo-review"
              serial="&sect; 04"
              label="SEO Review"
              title="Every check, by name"
            >
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-text-muted">
                With the SEO review enabled, every crawled page is checked against this manifest.
                Each failing check comes with a concrete fix hint in the report; checks marked
                &ldquo;not scored&rdquo; are reported for awareness without affecting the score.
              </p>
              <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
                {SEO_CHECKS.map((section) => (
                  <div key={section.group} className="bg-surface p-6">
                    <p className={`${microLabel} mb-4 text-text-subtle`}>{section.group}</p>
                    <ul className="space-y-2 font-mono text-xs text-text-muted">
                      {section.checks.map((check) => (
                        <li key={check} className="flex gap-3">
                          <span className="text-action" aria-hidden="true">
                            &mdash;
                          </span>
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </GuideSection>

            {/* § 05 — Exports & sharing */}
            <GuideSection
              id="export-share"
              serial="&sect; 05"
              label="Handoff"
              title="Exports &amp; sharing"
            >
              <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
                <div className="bg-surface p-6">
                  <p className={`${microLabel} mb-3 text-text-subtle`}>Link inventory</p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    CSV or JSON of every URL checked &mdash; status, class, severity and source
                    page, broken rows first. A healthy site still exports its full inventory.
                  </p>
                </div>
                <div className="bg-surface p-6">
                  <p className={`${microLabel} mb-3 text-text-subtle`}>SEO fix list</p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    CSV of every failing SEO check with its page and fix hint &mdash; ready to
                    work through as a task list.
                  </p>
                </div>
                <div className="bg-surface p-6">
                  <p className={`${microLabel} mb-3 text-text-subtle`}>Share link</p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    A read-only, print-friendly copy of the report at a private URL &mdash; made
                    for sending to clients. Create and revoke it from the report toolbar.
                  </p>
                </div>
              </div>
            </GuideSection>

            {/* § 06 — Troubleshooting */}
            <GuideSection
              id="troubleshooting"
              serial="&sect; 06"
              label="Troubleshooting"
              title="When something looks off"
            >
              <div className="divide-y divide-border border-t border-border">
                {[
                  {
                    q: 'The audit won’t start',
                    a: 'Check the URL is complete, including http:// or https://, and that the site is publicly reachable — a site behind a login can’t be crawled. Rapid repeat requests can also hit rate limiting; wait a moment and retry.',
                  },
                  {
                    q: 'It’s taking a long time',
                    a: 'Runtime scales with depth and the target server’s response times, and the SEO review multiplies per-page work. Progress is live the whole way, and stopping early keeps everything found so far.',
                  },
                  {
                    q: 'I stopped an audit early',
                    a: 'The report still renders from what was collected, and the coverage sub-score marks it as a partial read — treat those findings as a floor, not a ceiling.',
                  },
                  {
                    q: 'The link counts differ from another tool',
                    a: 'URL discovery deduplicates parameter variations and near-duplicate patterns so the audit focuses on real pages, and external links are only checked when you enable them.',
                  },
                ].map((item) => (
                  <div key={item.q} className="py-6">
                    <h3 className="mb-2 font-display text-xl text-text">{item.q}</h3>
                    <p className="max-w-2xl text-sm leading-relaxed text-text-muted">{item.a}</p>
                  </div>
                ))}
              </div>
            </GuideSection>

            {/* ── Document close ─────────────────────────────────────────── */}
            <div>
              <BrandRule className="mb-10" />
              <div className="flex flex-wrap items-center gap-5">
                <Button href="/analyze" size="md">
                  Start Full Audit
                  <span aria-hidden="true">&rarr;</span>
                </Button>
                <Link
                  href="/#quick-check"
                  className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 transition-colors duration-200 hover:text-action"
                >
                  or run a Quick Check
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
