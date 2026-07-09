// src/app/page.js — Landing page, doc 06 §6 wireframe in the "Typeset Audit" language.
import Link from 'next/link';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import LegalTerms from './components/LegalTerms';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

function SectionHeading({ label, title }) {
  return (
    <div className="mb-10">
      <p className={`${microLabel} text-action mb-3`}>{label}</p>
      <h2 className="font-display text-3xl md:text-4xl text-text">{title}</h2>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          <div className="lg:col-span-7">
            <p className={`${microLabel} text-text-subtle mb-6`}>
              Site Audit &middot; Link Integrity &middot; SEO
            </p>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.08] text-text mb-6">
              Your website,{' '}
              <span className="underline decoration-action decoration-4 underline-offset-8">
                audited
              </span>{' '}
              like it actually matters.
            </h1>
            <p className="text-lg text-text-muted leading-relaxed max-w-xl mb-9">
              SeoScrub crawls every page, link and asset on your site &mdash; then writes broken
              links, redirect chains and SEO defects into one prioritized, client-ready report.
            </p>
            <div className="flex flex-wrap items-center gap-5 mb-10">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 rounded-md bg-action px-6 py-3 font-medium text-text-on-action hover:bg-action-hover transition-colors duration-200"
              >
                Start Full Audit
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link
                href="#quick-check"
                className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 hover:text-action transition-colors duration-200"
              >
                or run a Quick Check below
              </Link>
            </div>
            <p className={`${microLabel} text-text-subtle`}>
              1,000+ pages per crawl &mdash; HTTP &middot; Redirects &middot; SEO &mdash; CSV / JSON
              export
            </p>
          </div>

          {/* Report excerpt — the output is the pitch (doc 06 §6.3) */}
          <div className="lg:col-span-5">
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="flex items-baseline justify-between mb-1">
                <p className={`${microLabel} text-text-subtle`}>Audit Report</p>
                <p className="font-mono text-xs text-text-subtle">09 JUL 2026</p>
              </div>
              <p className="font-mono text-sm text-text mb-5">
                example.com &mdash; 1,204 pages crawled
              </p>

              <div className="border-t border-border pt-5 mb-5">
                <p className={`${microLabel} text-text-subtle mb-2`}>Executive Summary</p>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-display text-5xl text-text">84</span>
                  <span className="font-mono text-sm text-text-muted">/ 100 site health</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                  <span className="text-danger">&#9679; 3 critical</span>
                  <span className="text-warning">&#9679; 12 warnings</span>
                  <span className="text-success">&#9679; 41 passed</span>
                </div>
              </div>

              <div className="border-t border-border divide-y divide-border">
                <div className="py-3 flex items-start gap-3">
                  <span className="font-mono text-xs text-danger pt-0.5 shrink-0">404</span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-text truncate">/pricing/old-plan</p>
                    <p className="text-xs text-text-muted">linked from 12 pages</p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-3">
                  <span className="font-mono text-xs text-warning pt-0.5 shrink-0">301</span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-text truncate">
                      /blog/feed &rarr; /rss
                    </p>
                    <p className="text-xs text-text-muted">redirect chain, depth 3</p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-3">
                  <span className="font-mono text-xs text-info pt-0.5 shrink-0">SEO</span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-text truncate">/about</p>
                    <p className="text-xs text-text-muted">missing meta description</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading label="How It Works" title="Scan. Prioritize. Share." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                n: '01',
                title: 'Scan',
                body: 'SeoScrub crawls every internal page, follows each link and asset, and records how every URL responds — status codes, redirect hops, failures.',
              },
              {
                n: '02',
                title: 'Prioritize',
                body: 'Findings are graded by severity and impact: what breaks user journeys first, what erodes SEO second. A triaged plan, not a raw dump.',
              },
              {
                n: '03',
                title: 'Share',
                body: 'The output is a written report — executive summary, prioritized fixes, full evidence table. Export the data or send the link.',
              },
            ].map((step) => (
              <div key={step.n} className="border-t-2 border-action pt-5">
                <p className="font-mono text-sm text-action mb-3">{step.n}</p>
                <h3 className="font-display text-2xl text-text mb-3">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Choose your mode ─────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading label="Choose Your Mode" title="Two ways in. One report out." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-lg overflow-hidden">
            <div className="bg-surface p-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-display text-2xl text-text">Full Audit</h3>
                <span
                  className={`${microLabel} rounded-sm bg-action-subtle px-2 py-1 text-action`}
                >
                  Recommended
                </span>
              </div>
              <p className="text-sm text-text-muted leading-relaxed mb-6">
                URL structure is analyzed first, then crawled in full &mdash; built for medium to
                large sites, stakeholder-ready reporting, and the optional SEO review.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-text-muted">
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  Complete site understanding, 1,000+ pages
                </li>
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  Severity-graded findings and health score
                </li>
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  Optional SEO checks: titles, meta, headings, alt text
                </li>
              </ul>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 rounded-md bg-action px-5 py-2.5 text-sm font-medium text-text-on-action hover:bg-action-hover transition-colors duration-200"
              >
                Start Full Audit
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <div className="bg-surface p-8">
              <h3 className="font-display text-2xl text-text mb-4">Quick Check</h3>
              <p className="text-sm text-text-muted leading-relaxed mb-6">
                A straight crawl, right from this page &mdash; best for smaller sites, fast
                validation, and technical users who already know what they&rsquo;re looking for.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-text-muted">
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  Runs in minutes on small and medium sites
                </li>
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  You control crawl depth and external-link checks
                </li>
                <li className="flex gap-3">
                  <span className="text-action" aria-hidden="true">&mdash;</span>
                  Same live progress and results table
                </li>
              </ul>
              <Link
                href="#quick-check"
                className="inline-flex items-center gap-2 rounded-md border border-border-strong px-5 py-2.5 text-sm font-medium text-text hover:border-action hover:text-action transition-colors duration-200"
              >
                Run a Quick Check
                <span aria-hidden="true">&darr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Check (working form) ───────────────────────────────────── */}
      <section id="quick-check" className="border-t border-border scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading label="Quick Check" title="Run it right here." />
          <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
            <LargeCrawlForm />
          </div>
        </div>
      </section>

      {/* ── Who it's for + FAQ / methodology ─────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <SectionHeading label="Methodology" title="Common questions" />
              <p className="text-sm text-text-muted leading-relaxed">
                Built for developers shipping fixes, SEO consultants writing recommendations, and
                agencies sending client-ready reports.
              </p>
            </div>
            <div className="lg:col-span-8 divide-y divide-border border-t border-border">
              {[
                {
                  q: 'What exactly gets checked?',
                  a: 'Every internal link, image and asset — plus external links if you enable them. Each URL is recorded with its HTTP status, redirect chain and failures. The optional SEO review adds titles, meta descriptions, headings and alt text.',
                },
                {
                  q: 'How long does an audit take?',
                  a: 'A Quick Check on a small site finishes in minutes. Full audits scale with crawl depth — a 1,000+ page site can take an hour or more, with live progress the whole way.',
                },
                {
                  q: 'Will it hammer my site?',
                  a: 'Requests run with conservative timeouts and a hard page cap. You control crawl depth, and a running audit can be stopped at any point.',
                },
                {
                  q: 'What do I get at the end?',
                  a: 'A prioritized report: executive summary, severity-graded findings, affected pages, and the full URL-by-URL evidence table — exportable as CSV or JSON.',
                },
              ].map((item) => (
                <div key={item.q} className="py-6">
                  <h3 className="font-display text-xl text-text mb-2">{item.q}</h3>
                  <p className="text-sm text-text-muted leading-relaxed max-w-2xl">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <p className={`${microLabel} text-action mb-3`}>Start Now</p>
          <h2 className="font-display text-4xl md:text-5xl text-text mb-8 max-w-2xl">
            Ready to see what&rsquo;s broken?
          </h2>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-md bg-action px-6 py-3 font-medium text-text-on-action hover:bg-action-hover transition-colors duration-200"
            >
              Start Full Audit
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="#quick-check"
              className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 hover:text-action transition-colors duration-200"
            >
              Quick Check
            </Link>
          </div>
        </div>
      </section>

      <LegalTerms variant="banner" />
      <Footer />
    </div>
  );
}
