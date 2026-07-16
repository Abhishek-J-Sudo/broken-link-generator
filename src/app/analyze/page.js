// src/app/analyze/page.js — Audit setup (doc 06 §7) in the "Typeset Audit" language.
// Setup only: starting an audit navigates to /results/[jobId], where progress
// and the report live. The old three-step wizard (analyze → crawl → results)
// is gone; the URL pre-scan survives as an optional "Estimate scope" step.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';
import Button from '@/app/components/Button';
import { getCsrfToken } from '@/lib/csrf-client';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function ledgerDate(value) {
  const d = new Date(value);
  if (!value || isNaN(d)) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

function depthBand(maxDepth) {
  const depth = Number(maxDepth);
  if (depth <= 2) return { size: 'Small', pages: '< 100 pages', tone: 'text-success' };
  if (depth <= 3) return { size: 'Medium', pages: '100–500 pages', tone: 'text-info' };
  if (depth <= 4) return { size: 'Large', pages: '500–1500 pages', tone: 'text-warning' };
  return { size: 'Very Large', pages: '1500+ pages', tone: 'text-danger' };
}

function runtimeEstimate(scope, maxDepth, enableSEO) {
  const links = scope?.summary?.totalLinksFound || 0;
  if (links > 0) {
    // ~2 checks/sec sustained; the SEO pass roughly doubles per-page work
    let low = Math.max(1, Math.round(links / 2 / 60));
    if (enableSEO) low = Math.ceil(low * 2.5);
    return `${low}–${Math.max(low * 2, low + 3)} min`;
  }
  const table = enableSEO
    ? { 1: '3–8 min', 2: '8–25 min', 3: '25–70 min', 4: '70–180 min', 5: '90–240 min' }
    : { 1: '2–10 min', 2: '2–10 min', 3: '10–30 min', 4: '30–90 min', 5: '60–120 min' };
  return table[Number(maxDepth)] || table[3];
}

/* ── Sidebar: dotted-leader readout row ─────────────────────────────── */
function LeaderRow({ k, v, tone = 'text-text' }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <span className="text-text-muted">{k}</span>
      <span className="flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
      <span className={tone}>{v}</span>
    </div>
  );
}

function SidebarHeading({ children }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <p className={`${microLabel} shrink-0 text-text-subtle`}>{children}</p>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

/* ── Previous audits ledger ─────────────────────────────────────────── */
const STATUS_TONE = {
  completed: 'text-success',
  running: 'text-info',
  queued: 'text-info',
  failed: 'text-danger',
  stopped: 'text-warning',
};

function brokenReadout(job) {
  if (job.status === 'completed' || job.status === 'stopped') return `${job.brokenCount} broken`;
  if (job.status === 'running') return `${job.brokenCount} so far`;
  return '—';
}

function PreviousAudits() {
  const [state, setState] = useState({ status: 'loading', jobs: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/jobs/recent');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load');
        if (!cancelled) setState({ status: 'done', jobs: data.jobs || [] });
      } catch {
        if (!cancelled) setState({ status: 'error', jobs: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-16 lg:mt-20">
      <div className="mb-6 flex items-center gap-4">
        <p className={`${microLabel} shrink-0 text-text-subtle`}>Previous Audits</p>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      {state.status === 'loading' && (
        <p className="font-mono text-xs text-text-subtle">Loading the ledger&hellip;</p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-text-muted">Couldn&rsquo;t load recent audits.</p>
      )}
      {state.status === 'done' && state.jobs.length === 0 && (
        <p className="text-sm text-text-muted">
          No audits yet &mdash; your first report will appear here.
        </p>
      )}

      {state.jobs.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {state.jobs.map((job) => (
            <Link
              key={job.id}
              href={`/results/${job.id}`}
              className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 py-3.5 transition-colors hover:bg-surface-subtle sm:flex-nowrap sm:gap-x-6"
            >
              <span className="min-w-0 truncate font-mono text-sm text-text">
                {hostnameOf(job.url)}
              </span>
              <span
                className="hidden flex-1 border-b border-dotted border-border-strong sm:block"
                aria-hidden="true"
              />
              <span className="shrink-0 font-mono text-xs text-text-subtle">
                {ledgerDate(job.createdAt)}
              </span>
              <span
                className={`shrink-0 font-mono text-xs ${
                  STATUS_TONE[job.status] || 'text-text-muted'
                }`}
              >
                {job.status}
              </span>
              <span className="shrink-0 font-mono text-xs text-text-muted sm:w-20 sm:text-right">
                {brokenReadout(job)}
              </span>
              <span className="shrink-0 font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors group-hover:text-action group-hover:decoration-action">
                View report <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AuditSetupPage() {
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [auditType, setAuditType] = useState('full');
  const [maxDepth, setMaxDepth] = useState(3);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [enableSEO, setEnableSEO] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scope estimate = the old URL Structure Analyzer, demoted to an optional
  // pre-flight step. Its page list rides along on a Full Audit start.
  const [scope, setScope] = useState(null);
  const [scopeUrl, setScopeUrl] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');

  // An estimate only counts while the URL it was run for is still in the field
  const scopeCurrent = scope && scopeUrl === url ? scope : null;
  const scopeStale = Boolean(scope) && scopeUrl !== url;

  const selectAuditType = (type) => {
    setAuditType(type);
    setEnableSEO(type === 'full');
    setMaxDepth(type === 'full' ? 3 : 2);
  };

  const runEstimate = async () => {
    setEstimateError('');
    try {
      new URL(url);
    } catch {
      setEstimateError('Enter a complete URL, including http:// or https://');
      return;
    }

    setIsEstimating(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify({ url, maxDepth: 3, maxPages: 100 }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Scope estimate failed');
      if (!result?.summary) throw new Error('Invalid response from the analyzer');

      setScope(result);
      setScopeUrl(url);
    } catch (err) {
      setEstimateError(err.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const startAudit = async (e) => {
    e.preventDefault();
    setStartError('');
    try {
      new URL(url);
    } catch {
      setStartError('Enter a complete URL, including http:// or https://');
      return;
    }

    setIsStarting(true);
    try {
      const settings = {
        maxDepth: Number(maxDepth),
        includeExternal,
        enableSEO,
        timeout: 10000,
      };

      let body = { url, settings };
      if (auditType === 'full' && scopeCurrent?.categories?.pages?.length) {
        body = {
          url,
          settings: { ...settings, usePreAnalyzedUrls: true, crawlMode: 'content_pages' },
          preAnalyzedUrls: scopeCurrent.categories.pages.map((page) => ({
            url: page.url,
            sourceUrl: page.sourceUrl || page.source_url || url,
            category: 'pages',
          })),
        };
      }

      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to start the audit');

      router.push(`/results/${result.jobId}`);
    } catch (err) {
      setStartError(err.message);
      setIsStarting(false);
    }
  };

  const summary = scopeCurrent?.summary;
  const contentPages = summary?.categories?.pages || 0;
  const scopeRecommendations = summary?.recommendations || [];
  const recommendedMode =
    summary && (contentPages > 25 || summary.totalUrls > 100) ? 'Full Audit' : 'Quick Check';

  const scopeRows = summary
    ? [
        { k: 'Pages sampled', v: String(summary.pagesAnalyzed ?? '—') },
        { k: 'URLs found', v: String(summary.totalUrls ?? '—') },
        { k: 'Content pages', v: String(contentPages) },
        { k: 'Links discovered', v: String(summary.totalLinksFound ?? '—') },
        { k: 'Est. runtime', v: runtimeEstimate(scopeCurrent, maxDepth, enableSEO) },
      ]
    : [
        { k: 'Pages sampled', v: '—' },
        { k: 'URLs found', v: '—' },
        { k: 'Content pages', v: '—' },
        { k: 'Links discovered', v: '—' },
        { k: 'Est. runtime', v: runtimeEstimate(null, maxDepth, enableSEO) },
      ];

  const band = depthBand(maxDepth);

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <p className={`${microLabel} shrink-0 text-action`}>Audit Setup</p>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">Set up your audit.</h1>
          <p className="max-w-2xl leading-relaxed text-text-muted">
            Point SeoScrub at a site, choose how deep to go, and start. Estimate the scope first if
            you want to know what you&rsquo;re committing to.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Main column: the form ─────────────────────────────────── */}
          <form onSubmit={startAudit} className="lg:col-span-7">
            {/* 01 — Website URL */}
            <div className="mb-10">
              <label htmlFor="url" className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-sm text-action">01</span>
                <span className="text-sm font-medium text-text">Website URL</span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  id="url"
                  name="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="w-full flex-1 rounded-md border border-border bg-surface px-4 py-3.5 font-mono text-sm text-text transition-colors placeholder:text-text-subtle focus:border-action"
                />
                <Button
                  variant="secondary"
                  size="lg"
                  type="button"
                  onClick={runEstimate}
                  disabled={isEstimating || !url}
                  className="shrink-0"
                >
                  {isEstimating ? 'Sampling…' : 'Estimate scope'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Include http:// or https://. Estimate scope samples up to 100 pages &mdash;
                optional, but it sizes the crawl before you commit.
              </p>

              {isEstimating && (
                <div className="mt-3 flex items-center gap-3 border border-info/40 bg-info-subtle p-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-info border-t-transparent" />
                  <span className="text-sm text-text">
                    Sampling up to 100 pages of {hostnameOf(url)}&hellip;
                  </span>
                </div>
              )}
              {estimateError && !isEstimating && (
                <div className="mt-3 border border-danger/40 bg-danger-subtle p-3">
                  <p className="text-sm text-danger">{estimateError}</p>
                </div>
              )}
            </div>

            {/* 02 — Audit type */}
            <fieldset className="mb-10">
              <legend className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-sm text-action">02</span>
                <span className="text-sm font-medium text-text">Audit type</span>
              </legend>
              <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
                {[
                  {
                    id: 'full',
                    title: 'Full Audit',
                    recommended: true,
                    body: 'Rides on the scope estimate when you’ve run one, then crawls in full — severity-graded findings plus the SEO review.',
                    meta: 'Depth 3 · SEO on',
                  },
                  {
                    id: 'quick',
                    title: 'Quick Check',
                    recommended: false,
                    body: 'A straight crawl with live progress — the fastest route to a broken-link list on smaller sites.',
                    meta: 'Depth 2 · links only',
                  },
                ].map((mode) => {
                  const selected = auditType === mode.id;
                  return (
                    <label
                      key={mode.id}
                      className={`flex cursor-pointer items-start gap-4 bg-surface p-5 transition-shadow ${
                        selected ? 'ring-1 ring-inset ring-action' : 'hover:bg-surface-subtle'
                      }`}
                    >
                      <input
                        type="radio"
                        name="auditType"
                        value={mode.id}
                        checked={selected}
                        onChange={() => selectAuditType(mode.id)}
                        className="sr-only"
                      />
                      <span
                        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-action' : 'border-border-strong'
                        }`}
                        aria-hidden="true"
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-action" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-xl text-text">{mode.title}</span>
                          {mode.recommended && (
                            <span
                              className={`${microLabel} rounded-sm bg-action-subtle px-2 py-1 text-action`}
                            >
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block text-sm leading-relaxed text-text-muted">
                          {mode.body}
                        </span>
                        <span className="mt-3 block font-mono text-xs text-text-subtle">
                          {mode.meta}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* 03 — Advanced options */}
            <div className="mb-10">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-sm text-action">03</span>
                <span className="text-sm font-medium text-text">Advanced options</span>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="ml-auto font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors hover:text-action hover:decoration-action"
                >
                  {showAdvanced ? 'Hide' : 'Show'}
                </button>
              </div>

              {!showAdvanced && (
                <p className="border-t border-border pt-3 font-mono text-xs text-text-subtle">
                  Depth {maxDepth} &middot; external links {includeExternal ? 'on' : 'off'} &middot;
                  SEO {enableSEO ? 'on' : 'off'}
                </p>
              )}

              {showAdvanced && (
                <div className="border-t border-border pt-5">
                  <div className="mb-6">
                    <label htmlFor="maxDepth" className="mb-2 block text-sm font-medium text-text">
                      Crawl depth
                    </label>
                    <select
                      id="maxDepth"
                      name="maxDepth"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(Number(e.target.value))}
                      className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-text focus:border-action"
                    >
                      <option value={1}>1 &mdash; Homepage only</option>
                      <option value={2}>2 &mdash; One level deep</option>
                      <option value={3}>3 &mdash; Two levels deep (recommended)</option>
                      <option value={4}>4 &mdash; Three levels deep (large sites)</option>
                      <option value={5}>5 &mdash; Four levels deep (very large)</option>
                    </select>

                    {/* Estimate readout: label ……… value */}
                    <div className="mt-3 flex items-baseline gap-2 font-mono text-xs">
                      <span className="shrink-0">
                        <span className={`font-medium ${band.tone}`}>{band.size} crawl</span>
                        <span className="text-text-muted"> &middot; {band.pages}</span>
                      </span>
                      <span
                        className="flex-1 border-b border-dotted border-border-strong"
                        aria-hidden="true"
                      />
                      <span className="shrink-0 text-text-muted">
                        est. {runtimeEstimate(scopeCurrent, maxDepth, enableSEO)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label
                      htmlFor="includeExternal"
                      className="flex cursor-pointer items-start gap-3 border border-border p-4 transition-colors hover:border-border-strong"
                    >
                      <input
                        id="includeExternal"
                        name="includeExternal"
                        type="checkbox"
                        checked={includeExternal}
                        onChange={(e) => setIncludeExternal(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-action"
                      />
                      <span>
                        <span className="block text-sm font-medium text-text">
                          Check external links
                        </span>
                        <span className="mt-1 block text-xs text-text-muted">
                          Also verify links pointing to other websites (increases scan time)
                        </span>
                      </span>
                    </label>

                    <label
                      htmlFor="enableSEO"
                      className="flex cursor-pointer items-start gap-3 border border-border p-4 transition-colors hover:border-border-strong"
                    >
                      <input
                        id="enableSEO"
                        name="enableSEO"
                        type="checkbox"
                        checked={enableSEO}
                        onChange={(e) => setEnableSEO(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-action"
                      />
                      <span>
                        <span className="block text-sm font-medium text-text">
                          Enable SEO analysis
                        </span>
                        <span className="mt-1 block text-xs text-text-muted">
                          Analyze page titles, meta descriptions, and more
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            {startError && (
              <div className="mb-6 border border-danger/40 bg-danger-subtle p-4">
                <p className="text-sm font-medium text-danger">Couldn&rsquo;t start the audit</p>
                <p className="mt-1 text-sm text-text-muted">{startError}</p>
              </div>
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              type="submit"
              disabled={isStarting || !url}
            >
              {isStarting ? 'Starting audit…' : 'Start Audit'}
            </Button>
            <p className="mt-3 text-xs text-text-muted">
              You&rsquo;ll land on the live report page &mdash; progress streams in as the crawl
              runs, and you can stop it at any point.
            </p>
          </form>

          {/* ── Supporting column ─────────────────────────────────────── */}
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="space-y-10 lg:sticky lg:top-24">
              <div>
                <SidebarHeading>Scope Estimate</SidebarHeading>
                <div className="space-y-1.5">
                  {scopeRows.map((row) => (
                    <LeaderRow key={row.k} k={row.k} v={row.v} />
                  ))}
                </div>

                {summary && (
                  <div className="mt-4 border-t border-border pt-3">
                    <LeaderRow k="Recommended" v={recommendedMode} tone="text-action" />
                  </div>
                )}

                {scopeRecommendations.length > 0 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <SidebarHeading>
                      {summary.recommendationsSource === 'ai' ? 'AI Scope Notes' : 'Scope Notes'}
                    </SidebarHeading>
                    <ul className="space-y-3">
                      {scopeRecommendations.map((recommendation, index) => {
                        const tone =
                          recommendation.type === 'warning'
                            ? 'border-warning/40 bg-warning-subtle'
                            : recommendation.type === 'info'
                              ? 'border-info/40 bg-info-subtle'
                              : 'border-border bg-surface-subtle';
                        return (
                          <li key={`${recommendation.message}-${index}`} className={`border p-3 ${tone}`}>
                            <p className="text-xs leading-relaxed text-text">{recommendation.message}</p>
                            <p className="mt-2 font-mono text-[11px] leading-relaxed text-text-muted">
                              {recommendation.action}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {!summary && !scopeStale && (
                  <p className="mt-4 text-xs leading-relaxed text-text-muted">
                    Run <span className="font-medium text-text">Estimate scope</span> to sample the
                    site &mdash; pages, links, and runtime &mdash; before you commit to a full
                    crawl.
                  </p>
                )}
                {scopeStale && (
                  <div className="mt-4 border border-warning/40 bg-warning-subtle p-3">
                    <p className="text-xs leading-relaxed text-text">
                      The URL changed since the last estimate &mdash; re-run it to refresh these
                      numbers.
                    </p>
                  </div>
                )}
                {summary?.isJavaScriptSite && (
                  <div className="mt-4 border border-warning/40 bg-warning-subtle p-3">
                    <p className="text-xs leading-relaxed text-text">
                      <span className="font-medium">JavaScript-heavy site.</span> The sampler only
                      sees server-rendered HTML, so these counts may run low. The full crawl still
                      checks every link it can reach.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <SidebarHeading>Your Report Includes</SidebarHeading>
                <ul className="space-y-2 text-sm leading-relaxed text-text-muted">
                  {[
                    'Executive summary with site health',
                    'Findings graded by severity',
                    'Affected pages, ranked by impact',
                    'Full URL-by-URL evidence table',
                    'CSV / JSON export',
                    ...(enableSEO ? ['SEO review: titles, meta, headings, alt text'] : []),
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="font-mono text-action" aria-hidden="true">
                        &mdash;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>

        <PreviousAudits />

        <SecurityNotice />
      </main>

      <Footer />
    </div>
  );
}
