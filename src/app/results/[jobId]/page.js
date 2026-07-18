// src/app/results/[jobId]/page.js — the Audit Report (doc 06 §9 + doc 09),
// in the "Typeset Audit" language. Report-first: verdict → takeaways → quick
// wins → findings → remediation plan, with the raw table demoted to an
// evidence appendix. While the crawl runs, this page is the live progress
// view; the report assembles itself in place on completion.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';
import EvidenceTable from '@/app/components/EvidenceTable';
import GradeHex from '@/app/components/GradeHex';
import Button from '@/app/components/Button';
import { getCsrfToken } from '@/lib/csrf-client';
import {
  buildReport,
  classifyFinding,
  deriveSeverity,
  hostnameOf,
  pathOf,
  CLASS_SHORT,
  SLOW_MS,
  SHARED_SOURCE_THRESHOLD,
} from '@/lib/auditReport';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const RUNNING_STATUSES = ['running', 'queued', 'pending'];

const STATUS_TONE = {
  completed: 'text-success',
  running: 'text-info',
  queued: 'text-info',
  pending: 'text-info',
  failed: 'text-danger',
  stopped: 'text-warning',
};

const SEVERITY_META = {
  critical: {
    dot: 'bg-danger',
    text: 'text-danger',
    why: 'Breaks pages or core journeys on your own site — fix these first.',
  },
  major: {
    dot: 'bg-warning',
    text: 'text-warning',
    why: 'Widespread or site-owned — schedule these into the next sprint.',
  },
  minor: {
    dot: 'bg-border-strong',
    text: 'text-text-muted',
    why: 'Isolated or third-party — batch these when convenient.',
  },
};

function reportDate(value) {
  const d = new Date(value);
  if (!value || isNaN(d)) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

function formatDuration(ms) {
  if (ms == null) return '—';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchAllCheckedLinks(jobId) {
  const links = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await fetch(`/api/results/${jobId}?statusFilter=all&page=${page}&limit=100`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load checked URLs');
    links.push(...(data.links || []));
    hasNextPage = !!data.pagination?.hasNextPage;
    page += 1;
  }

  return links;
}

/* ── Typeset primitives ─────────────────────────────────────────────── */

function LeaderRow({ k, v, tone = 'text-text' }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <span className="text-text-muted">{k}</span>
      <span className="flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
      <span className={tone}>{v}</span>
    </div>
  );
}

function SectionHeading({ serial, label, title }) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-4">
        <p className={`${microLabel} shrink-0 text-action`}>{serial}</p>
        <p className={`${microLabel} shrink-0 text-text-subtle`}>{label}</p>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <h2 className="font-display text-3xl text-text md:text-4xl">{title}</h2>
    </div>
  );
}

function ColumnHeading({ children }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <p className={`${microLabel} shrink-0 text-text-subtle`}>{children}</p>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

/* ── Appendix accordion — a deep section, collapsed by default ───────── */
// No `open` prop → uncontrolled + closed (React resets a controlled
// `open={false}` on re-render, which would trap it shut). The evidence
// section needs to open programmatically, so it renders its own controlled
// <details> instead of using this.
function AccordionSection({ label, count, children }) {
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-5 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-2xl text-text">{label}</span>
        {count != null && <span className="font-mono text-sm text-text-muted">{count}</span>}
        <span className="ml-auto font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:hidden">
          show
        </span>
        <span className="ml-auto hidden font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:inline">
          hide
        </span>
      </summary>
      <div className="pb-8">{children}</div>
    </details>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function AuditReportPage() {
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
  const [fatalError, setFatalError] = useState('');
  const [pollNonce, setPollNonce] = useState(0);

  const [findingsPayload, setFindingsPayload] = useState(null);
  const [findingsError, setFindingsError] = useState('');
  const [findingsNonce, setFindingsNonce] = useState(0);
  const [seoSummary, setSeoSummary] = useState(null);

  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [exporting, setExporting] = useState(null); // 'csv' | 'json' | 'seo' | null
  const [sharePath, setSharePath] = useState(null); // '/share/<token>' once created
  const [shareBusy, setShareBusy] = useState(false);
  const [copiedWhich, setCopiedWhich] = useState(null); // 'client' | 'fixlist' | null

  const [aiNarrative, setAiNarrative] = useState(null);
  const [performance, setPerformance] = useState(null);

  const [appendixFocus, setAppendixFocus] = useState(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const appendixRef = useRef(null);

  const isRunning = job && RUNNING_STATUSES.includes(job.status);
  const reportReady = job && (job.status === 'completed' || job.status === 'stopped');

  /* ── Status polling — the worker's pollInterval sets the cadence ───── */
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer;

    const tick = async () => {
      try {
        const response = await fetch(`/api/crawl/status/${jobId}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 429) {
            timer = setTimeout(tick, (data.retryAfter || 5) * 1000);
            return;
          }
          setFatalError(data.error || 'This audit could not be loaded.');
          return;
        }
        setJob(data);
        if (RUNNING_STATUSES.includes(data.status)) {
          timer = setTimeout(tick, data.pollInterval || 2500);
        }
      } catch {
        // transient network hiccup — keep the live view alive
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, pollNonce]);

  /* ── Findings + SEO summary, fetched once the crawl settles ────────── */
  useEffect(() => {
    if (!reportReady) return undefined;
    let cancelled = false;
    (async () => {
      setFindingsError('');
      try {
        const response = await fetch(
          `/api/results/${jobId}?statusFilter=broken&page=1&limit=10000`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load the findings');
        const checkedLinks = await fetchAllCheckedLinks(jobId);
        if (!cancelled) {
          setFindingsPayload({
            findings: data.links || [],
            checkedLinks,
            summary: data.summary,
          });
        }
      } catch (err) {
        if (!cancelled) setFindingsError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, reportReady, findingsNonce]);

  useEffect(() => {
    if (!reportReady || !job?.settings?.enableSEO) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/seo/summary/${jobId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setSeoSummary(data);
      } catch {
        // the reserved SEO tile simply stays unmeasured
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, reportReady, job?.settings?.enableSEO]);

  const report = useMemo(
    () =>
      findingsPayload && job
        ? buildReport({
            job,
            summary: findingsPayload.summary,
            findings: findingsPayload.findings,
            checkedLinks: findingsPayload.checkedLinks,
          })
        : null,
    [findingsPayload, job]
  );

  /* ── AI narrative, fetched once report data is ready ───────────────── */
  useEffect(() => {
    if (!report || !jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ai/narrative/${jobId}`);
        if (!res.ok || res.status === 204) return;
        const data = await res.json();
        if (!cancelled && data?.headline) setAiNarrative(data);
      } catch {
        // fall back to static verdict / takeaways silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, report]);

  /* ── Core Web Vitals (PageSpeed Insights), lazy once the report is ready ── */
  useEffect(() => {
    if (!reportReady || !jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/performance/${jobId}`);
        if (!res.ok || res.status === 204) return;
        const data = await res.json();
        if (!cancelled && data) setPerformance(data);
      } catch {
        // the Performance cell simply stays unmeasured
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, reportReady]);

  /* ── Actions ────────────────────────────────────────────────────────── */

  const handleStop = async () => {
    setIsStopping(true);
    try {
      const response = await fetch('/api/crawl/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        body: JSON.stringify({ jobId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to stop the audit');
      setShowStopConfirm(false);
      setPollNonce((n) => n + 1); // re-check status immediately
    } catch (err) {
      setFatalError(err.message);
    } finally {
      setIsStopping(false);
    }
  };

  const copyLink = async (path, which) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopiedWhich(which);
      setTimeout(() => setCopiedWhich((w) => (w === which ? null : w)), 2000);
    } catch {
      // clipboard blocked — the link is still visible to copy manually
    }
  };

  const createShareLink = async () => {
    setShareBusy(true);
    try {
      const response = await fetch(`/api/share/manage/${jobId}`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': await getCsrfToken() },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the share link');
      setSharePath(data.path);
      copyLink(data.path, 'client'); // copy the client link straight away as a convenience
    } catch (err) {
      setFindingsError(err.message);
    } finally {
      setShareBusy(false);
    }
  };

  const revokeShareLink = async () => {
    setShareBusy(true);
    try {
      const response = await fetch(`/api/share/manage/${jobId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': await getCsrfToken() },
      });
      if (!response.ok) throw new Error('Could not revoke the share link');
      setSharePath(null);
      setCopiedWhich(null);
    } catch (err) {
      setFindingsError(err.message);
    } finally {
      setShareBusy(false);
    }
  };

  const runSeoExport = async () => {
    setExporting('seo');
    try {
      const response = await fetch(`/api/results/${jobId}?statusFilter=pages&page=1&limit=10000`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'SEO export fetch failed');
      const host = hostnameOf(job.url);
      const day = new Date().toISOString().split('T')[0];
      const headers = [
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
      ];
      const rows = (data.links || []).map((p) => {
        const s = p.seo_signals || {};
        return [
          p.url,
          p.seo_score ?? '',
          p.seo_grade ?? '',
          p.seo_title?.text || '',
          p.seo_title?.length ?? '',
          p.seo_metaDescription?.length ?? 0,
          (p.seo_issues || []).map((i) => i.message).join(' | '),
          s.robots?.noindex ? 'YES' : 'no',
          s.robotsTxt?.disallowed ? 'YES' : 'no',
          s.social?.hasOpenGraph ? 'present' : 'MISSING',
          s.structuredData?.hasStructuredData ? s.structuredData.types.join('; ') : 'MISSING',
          s.fundamentals?.htmlLang || 'MISSING',
          s.fundamentals?.hasViewport ? 'present' : 'MISSING',
          s.freshness?.isStale ? 'YES' : 'no',
        ];
      });
      const bom = String.fromCharCode(0xfeff);
      const csv =
        bom +
        [headers, ...rows]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
      download(`seoscrub-seo-fixlist-${host}-${day}.csv`, csv, 'text/csv;charset=utf-8;');
    } catch (err) {
      setFindingsError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const runExport = async (kind) => {
    if (!job || !report) return;
    setExporting(kind);
    try {
      const response = await fetch(`/api/results/${jobId}?statusFilter=all&page=1&limit=10000`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Export fetch failed');
      const sharedSet = new Set(report.sharedTargets);
      // Full inventory, broken rows first — a healthy site still exports every
      // checked URL as proof-of-work instead of an empty file.
      const links = (data.links || []).slice().sort((a, b) => {
        const aBroken = a.is_working !== true;
        const bBroken = b.is_working !== true;
        if (aBroken !== bBroken) return aBroken ? -1 : 1;
        return a.url.localeCompare(b.url);
      });
      const host = hostnameOf(job.url);
      const day = new Date().toISOString().split('T')[0];

      if (kind === 'csv') {
        const headers = [
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
          'Checked At',
        ];
        const rows = links.map((l) => {
          const broken = l.is_working !== true;
          const cls = broken ? classifyFinding(l) : null;
          return [
            broken ? 'BROKEN' : 'OK',
            broken ? deriveSeverity(cls, !!l.is_internal, sharedSet.has(l.url)) : '',
            broken ? CLASS_SHORT[cls] : '',
            l.http_status_code ?? '',
            l.url,
            l.is_internal ? 'Internal' : 'External',
            l.source_url || '',
            l.link_text && l.link_text !== 'Unknown' ? l.link_text : '',
            l.response_time ?? '',
            l.error_message || '',
            l.checked_at || '',
          ];
        });
        const bom = String.fromCharCode(0xfeff); // keeps Excel happy with UTF-8
        const csv =
          bom +
          [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        download(`seoscrub-links-${host}-${day}.csv`, csv, 'text/csv;charset=utf-8;');
      } else {
        const payload = {
          exportInfo: { generatedAt: new Date().toISOString(), jobId, url: job.url },
          job: {
            url: job.url,
            status: job.status,
            settings: job.settings,
            timestamps: job.timestamps,
          },
          report,
          links,
        };
        download(
          `seoscrub-links-${host}-${day}.json`,
          JSON.stringify(payload, null, 2),
          'application/json'
        );
      }
    } catch (err) {
      setFindingsError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const focusEvidence = (term) => {
    setEvidenceOpen(true); // the evidence table lives in a collapsed accordion — open it
    setAppendixFocus({ term: term || '', at: Date.now() });
    requestAnimationFrame(() =>
      appendixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  // Sections number themselves top-to-bottom so the sequence stays gapless
  // even when empty sections (quick wins on a clean site) are skipped.
  let serialCount = 0;
  const nextSerial = () => String(++serialCount).padStart(2, '0');

  const modeLabel = job?.settings?.enableSEO ? 'Full Audit' : 'Quick Check';
  const kpis = report?.kpis;
  const score = report?.score;
  const summary = findingsPayload?.summary;
  const seoPages = seoSummary?.total_pages ?? summary?.pagesAnalyzed ?? 0;
  const progressPercent = Math.min(100, Math.max(0, job?.progress?.percentage ?? 0));
  const progressCurrent = job?.progress?.current ?? 0;
  const progressTotal = job?.progress?.total ?? 0;
  const progressKnown = progressTotal > 0;
  const isQueued = job?.status === 'queued' || job?.status === 'pending';

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {fatalError && (
          <div className="mx-auto max-w-xl border border-danger/40 bg-danger-subtle p-6">
            <p className={`${microLabel} text-danger`}>Report unavailable</p>
            <p className="mt-2 text-sm leading-relaxed text-text">{fatalError}</p>
            <Link
              href="/audit"
              className="mt-4 inline-block font-mono text-xs text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
            >
              &larr; Back to audit setup
            </Link>
          </div>
        )}

        {!fatalError && !job && (
          <p className="py-24 text-center font-mono text-xs text-text-subtle">
            Pulling up audit &#8470; {String(jobId || '').slice(0, 8).toUpperCase()}&hellip;
          </p>
        )}

        {!fatalError && job && (
          <>
            {/* ── Report masthead ─────────────────────────────────────── */}
            <div className="mb-14">
              <div className="mb-4 flex items-center gap-4">
                <p className={`${microLabel} shrink-0 text-action`}>
                  {isRunning ? 'Live Audit' : 'Audit Report'}
                </p>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <p className={`${microLabel} shrink-0 text-text-subtle`}>
                  &#8470; {String(jobId).slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h1 className="break-words font-display text-4xl text-text md:text-5xl">
                    {isRunning ? `Auditing ${hostnameOf(job.url)}` : hostnameOf(job.url)}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-text-muted underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
                    >
                      {job.url}
                    </a>
                    <span className="text-text-subtle">
                      {reportDate(job.timestamps?.createdAt)}
                    </span>
                    <span className="text-text-subtle">
                      {modeLabel} &middot; depth {job.settings?.maxDepth ?? '—'}
                    </span>
                    <span className={STATUS_TONE[job.status] || 'text-text-muted'}>
                      {job.status}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {isRunning && (
                    <Button
                      variant="danger"
                      size="md"
                      type="button"
                      onClick={() => setShowStopConfirm(true)}
                      disabled={isStopping}
                    >
                      {isStopping ? 'Stopping…' : 'Stop audit'}
                    </Button>
                  )}
                  <Link
                    href="/audit"
                    className="font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors hover:text-action hover:decoration-action"
                  >
                    New audit <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Live progress (running / queued) ────────────────────── */}
            {isRunning && (
              <section className="mb-16 border border-border bg-surface">
                <div className="border-b border-border px-6 py-5 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isQueued ? 'bg-info' : 'animate-pulse bg-action'
                        }`}
                        aria-hidden="true"
                      />
                      <p className={`${microLabel} text-action`}>
                        {isQueued ? 'In queue' : 'Crawl in progress'}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-text-muted" aria-live="polite">
                      {isQueued
                        ? 'Waiting for an available worker'
                        : progressKnown
                          ? `${progressPercent}% complete`
                          : 'Mapping site scope'}
                    </p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="p-6 sm:p-8">
                    <h2 className="max-w-2xl font-display text-3xl leading-tight text-text md:text-4xl">
                      {isQueued
                        ? 'Your audit is ready to begin.'
                        : 'We’re tracing the paths your visitors take.'}
                    </h2>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
                      {isQueued
                        ? 'Keep this page open if you like. We’ll begin checking links as soon as a worker is free.'
                        : 'Links are being discovered and checked in real time. Early findings are provisional until the audit finishes.'}
                    </p>

                    <div className="mt-8">
                      <div className="mb-3 flex items-end justify-between gap-4">
                        <p className={`${microLabel} text-text-subtle`}>Audit completion</p>
                        <p className="font-mono text-sm text-text">
                          {progressKnown ? `${progressCurrent} / ${progressTotal}` : 'Preparing scope'}
                        </p>
                      </div>
                      <div
                        className="relative h-2 w-full overflow-hidden border border-border bg-surface-subtle"
                        role="progressbar"
                        aria-label="Audit completion"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressPercent}
                      >
                        <div
                          className="h-full bg-action transition-[width] duration-500"
                          style={{ width: `${isQueued ? 0 : progressPercent}%` }}
                        />
                        <span aria-hidden="true" className="scan-sweep" />
                      </div>
                    </div>

                    <div className="mt-8 grid gap-x-10 gap-y-2 sm:grid-cols-2">
                      <LeaderRow
                        k="Links checked"
                        v={progressKnown ? `${progressCurrent} / ${progressTotal}` : String(progressCurrent)}
                      />
                      <LeaderRow
                        k="Issues found"
                        v={String(job.stats?.brokenLinksFound ?? 0)}
                        tone={job.stats?.brokenLinksFound ? 'text-danger' : 'text-success'}
                      />
                      <LeaderRow k="Elapsed" v={formatDuration(job.timestamps?.elapsedTime)} />
                      <LeaderRow
                        k="Est. remaining"
                        v={
                          job.progress?.estimatedTimeRemaining
                            ? formatDuration(job.progress.estimatedTimeRemaining * 1000)
                            : 'Calculating…'
                        }
                      />
                    </div>
                  </div>

                  <aside className="border-t border-border bg-surface-subtle p-6 lg:border-t-0 lg:border-l sm:p-8">
                    <p className={`${microLabel} text-text-subtle`}>Audit sequence</p>
                    <ol className="mt-6 space-y-5">
                      {[
                        ['01', 'Scheduled', true],
                        ['02', 'Discover links', !isQueued],
                        ['03', 'Check destinations', !isQueued && progressCurrent > 0],
                        ['04', 'Build your report', false],
                      ].map(([number, label, complete], index) => {
                        const active = !complete && ((isQueued && index === 0) || (!isQueued && index === 2));
                        return (
                          <li key={number} className="flex items-center gap-3">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[10px] ${
                                complete || active
                                  ? 'border-action bg-action text-text-on-action'
                                  : 'border-border-strong text-text-subtle'
                              }`}
                            >
                              {number}
                            </span>
                            <span className={complete || active ? 'text-sm text-text' : 'text-sm text-text-muted'}>
                              {label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-text-muted">
                      Your report will appear here automatically when the audit is complete. You can
                      stop now and keep a partial report of everything checked so far.
                    </p>
                  </aside>
                </div>
              </section>
            )}

            {/* ── Failed ──────────────────────────────────────────────── */}
            {job.status === 'failed' && (
              <section className="mb-16 border border-danger/40 bg-danger-subtle p-6">
                <p className={`${microLabel} text-danger`}>Audit failed</p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text">
                  {job.errorMessage ||
                    'The crawl hit an error it could not recover from. Run a fresh audit — transient network problems account for most failures.'}
                </p>
                <Link
                  href="/audit"
                  className="mt-4 inline-block font-mono text-xs text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
                >
                  Run a new audit &rarr;
                </Link>
              </section>
            )}

            {/* ── Report loading / error ──────────────────────────────── */}
            {reportReady && !report && !findingsError && (
              <p className="py-16 text-center font-mono text-xs text-text-subtle">
                Compiling the report&hellip;
              </p>
            )}
            {reportReady && findingsError && (
              <div className="mb-16 border border-danger/40 bg-danger-subtle p-5">
                <p className="text-sm text-text">
                  <span className="font-medium text-danger">Couldn&rsquo;t load the findings.</span>{' '}
                  {findingsError}
                </p>
                <button
                  type="button"
                  onClick={() => setFindingsNonce((n) => n + 1)}
                  className="mt-3 font-mono text-xs text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
                >
                  Try again
                </button>
              </div>
            )}

            {/* ══ The report ═══════════════════════════════════════════ */}
            {report && (
              <>
                {/* Hand-off — the whole point of landing here: send it on ── */}
                <section className="mb-16 border border-border bg-surface lg:mb-20">
                  <div className="border-b border-border px-6 py-5 sm:px-8">
                    <div className="flex items-center gap-4">
                      <p className={`${microLabel} shrink-0 text-action`}>Hand-off</p>
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      <p className={`${microLabel} shrink-0 text-text-subtle`}>
                        {job.status === 'stopped' ? 'Audit stopped' : 'Audit complete'}
                      </p>
                    </div>
                    <h2 className="mt-4 font-display text-2xl text-text md:text-3xl">Send it on.</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                      Two audiences, one audit — a plain-English report for the client, and a
                      working fix list for the SEO / content team. Or take the raw data.
                    </p>
                  </div>

                  <div className="grid gap-px bg-border lg:grid-cols-2">
                    {/* Share a link */}
                    <div className="bg-surface p-6 sm:p-8">
                      <div className="mb-4 flex items-center gap-4">
                        <p className={`${microLabel} shrink-0 text-text-subtle`}>Share a link</p>
                        <span className="h-px flex-1 bg-border" aria-hidden="true" />
                        {sharePath && (
                          <button
                            type="button"
                            onClick={revokeShareLink}
                            disabled={shareBusy}
                            className="shrink-0 font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 transition-colors hover:text-danger hover:decoration-danger"
                          >
                            revoke
                          </button>
                        )}
                      </div>
                      {sharePath ? (
                        <div className="grid gap-px border border-border bg-border">
                          {[
                            {
                              key: 'client',
                              label: 'Client report',
                              hint: 'Plain-English health summary for clients and managers.',
                              path: sharePath,
                            },
                            {
                              key: 'fixlist',
                              label: 'SEO fix list · team tracker',
                              hint: 'Every broken link and SEO issue as an editable work board.',
                              path: `${sharePath}/fix-list`,
                            },
                          ].map((item) => (
                            <div key={item.key} className="bg-surface p-4">
                              <p className="text-sm font-medium text-text">{item.label}</p>
                              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                                {item.hint}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-4">
                                <Link
                                  href={item.path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors hover:text-action hover:decoration-action"
                                >
                                  Open <span aria-hidden="true">&rarr;</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => copyLink(item.path, item.key)}
                                  className="font-mono text-xs text-action underline decoration-action/40 underline-offset-4 transition-colors hover:decoration-action"
                                >
                                  {copiedWhich === item.key ? 'Copied ✓' : 'Copy link'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="mb-5 text-sm leading-relaxed text-text-muted">
                            Creates one public, read-only link. It opens as the client report; the
                            SEO team&rsquo;s fix list is the same link with{' '}
                            <span className="font-mono text-text-subtle">/fix-list</span> — one
                            token, two views.
                          </p>
                          <Button
                            variant="primary"
                            size="md"
                            type="button"
                            onClick={createShareLink}
                            disabled={shareBusy}
                          >
                            {shareBusy ? 'Working…' : 'Create share link'}
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Export the data */}
                    <div className="bg-surface p-6 sm:p-8">
                      <div className="mb-4 flex items-center gap-4">
                        <p className={`${microLabel} shrink-0 text-text-subtle`}>Export the data</p>
                        <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="secondary"
                          size="md"
                          type="button"
                          onClick={() => runExport('csv')}
                          disabled={exporting !== null}
                          title="Every checked link with its status — broken rows include severity, error type, and link text"
                        >
                          {exporting === 'csv' ? 'Exporting…' : 'Links CSV'}
                        </Button>
                        {job.settings?.enableSEO && (
                          <Button
                            variant="secondary"
                            size="md"
                            type="button"
                            onClick={runSeoExport}
                            disabled={exporting !== null}
                            title="Per-page SEO scores, issues, and signals for every analyzed page"
                          >
                            {exporting === 'seo' ? 'Exporting…' : 'SEO pages CSV'}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="md"
                          type="button"
                          onClick={() => runExport('json')}
                          disabled={exporting !== null}
                          title="Same link data as the Links CSV plus the derived report, for programmatic use"
                        >
                          {exporting === 'json' ? 'Exporting…' : 'Links JSON'}
                        </Button>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-text-muted">
                        CSV opens in Excel or Google Sheets; JSON carries the derived report for
                        programmatic use.
                      </p>
                    </div>
                  </div>
                </section>

                {/* 01 · Executive summary */}
                <section className="mb-16 lg:mb-20">
                  <SectionHeading
                    serial={nextSerial()}
                    label="Executive Summary"
                    title="The verdict."
                  />

                  {job.status === 'stopped' && (
                    <div className="mb-6 border border-warning/40 bg-warning-subtle p-3">
                      <p className="text-sm text-text">
                        This audit was stopped early — the figures below cover the{' '}
                        {score.coverage}% of discovered links checked before it stopped.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                      <div className="border border-border bg-surface p-6">
                        <p className={`${microLabel} mb-4 text-text-subtle`}>
                          Link-health grade
                        </p>
                        <div className="flex justify-center">
                          <GradeHex
                            grade={score.grade}
                            sub={`Link health ${score.overall}/100`}
                            size={180}
                            gradeClass="font-display text-8xl"
                            tone={
                              score.overall >= 80
                                ? 'text-success'
                                : score.overall >= 60
                                ? 'text-warning'
                                : 'text-danger'
                            }
                          />
                        </div>
                        <div className="mt-5 space-y-1.5 border-t border-border pt-4">
                          <LeaderRow k="Link integrity" v={`${score.integrity}`} />
                          <LeaderRow k="Response health" v={`${score.response}`} />
                          <LeaderRow k="Coverage" v={`${score.coverage}%`} />
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-8">
                      {/* Link-health numbers only — SEO lives in its own snapshot
                          section so its 0–100 scale never reads as part of the grade. */}
                      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                        {[
                          {
                            label: 'Checked URLs',
                            value: kpis.totalChecked.toLocaleString(),
                          },
                          { label: 'Healthy links', value: kpis.healthy.toLocaleString() },
                          {
                            label: 'Link issues',
                            value: kpis.issues.toLocaleString(),
                            tone: kpis.issues ? 'text-danger' : 'text-success',
                          },
                          { label: 'Affected pages', value: String(kpis.affectedPages) },
                          {
                            label: 'Int / ext broken',
                            value: `${kpis.internalIssues} / ${kpis.externalIssues}`,
                          },
                          {
                            label: 'Env signals',
                            value: String(kpis.environmentExposures || 0),
                            tone: kpis.environmentExposures ? 'text-warning' : 'text-text',
                          },
                          { label: 'Avg response', value: `${kpis.avgResponse} ms` },
                          { label: 'Slow links', value: String(kpis.slowLinks || 0) },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-surface p-4">
                            <p className={`font-mono text-2xl ${stat.tone || 'text-text'}`}>
                              {stat.value}
                            </p>
                            <p className={`${microLabel} mt-1 text-text-subtle`}>{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      <blockquote className="mt-6 border-l-2 border-action pl-5 font-display text-xl leading-snug text-text md:text-2xl">
                        {aiNarrative?.headline ?? report.verdict}
                      </blockquote>
                    </div>
                  </div>
                </section>

                {/* 02 · Key takeaways / AI analysis */}
                <section className="mb-16 lg:mb-20">
                  <SectionHeading
                    serial={nextSerial()}
                    label={aiNarrative ? 'AI SEO Expert Summary' : 'Key Takeaways'}
                    title="What it means."
                  />

                  {aiNarrative ? (
                    <div className="max-w-3xl space-y-6">
                      {aiNarrative.findings.map((f, i) => (
                        <div key={i} className="space-y-1.5 border-l-2 border-border pl-5">
                          <p className="text-base text-text">{f.finding}</p>
                          <p className="text-sm leading-relaxed text-text-muted">{f.why}</p>
                          <p className={`${microLabel} text-action`}>&rarr;&nbsp;{f.action}</p>
                        </div>
                      ))}

                      {aiNarrative.priorityActions?.length > 0 && (
                        <div className="mt-8 border-t border-border pt-6">
                          <p className={`${microLabel} mb-4 text-text-subtle`}>Priority actions</p>
                          <ol className="space-y-2">
                            {aiNarrative.priorityActions.map((action, i) => (
                              <li key={i} className="flex gap-3 text-sm text-text-muted">
                                <span className="shrink-0 font-mono text-action">
                                  {String(i + 1).padStart(2, '0')}
                                </span>
                                {action}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ul className="max-w-3xl space-y-3 text-base leading-relaxed text-text-muted">
                      {report.takeaways.map((line) => (
                        <li key={line} className="flex gap-3">
                          <span className="font-mono text-action" aria-hidden="true">
                            &mdash;
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {kpis.issues === 0 && (
                  <section className="mb-16 lg:mb-20">
                    <div className="border border-success/40 bg-success-subtle p-5">
                      <p className="text-sm leading-relaxed text-text">
                        <span className="font-medium">No broken links found.</span> All{' '}
                        {kpis.totalChecked.toLocaleString()} checked links resolve. The evidence
                        table below is the complete record — re-audit after the next content push.
                      </p>
                    </div>
                  </section>
                )}

                {/* 03 · Quick wins */}
                {report.quickWins.length > 0 && (
                  <section className="mb-16 lg:mb-20">
                    <SectionHeading serial={nextSerial()} label="Quick Wins" title="Start here." />
                    <div className="divide-y divide-border border-y border-border">
                      {report.quickWins.map((task, i) => (
                        <div
                          key={task.rank}
                          className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                        >
                          <span className="shrink-0 font-mono text-sm text-action">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text">{task.action}</p>
                            <p className="mt-1 text-xs leading-relaxed text-text-muted">
                              {task.detail}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-text-muted">
                            {task.instances} inst &middot; {task.effort} &middot; {task.owner}
                          </span>
                          <span className="w-20 shrink-0 font-mono text-xs text-success sm:text-right">
                            {task.gain > 0 ? `+${task.gain} health` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Full technical detail — everything below, collapsed ── */}
                <section className="mb-16 lg:mb-20">
                  <SectionHeading
                    serial={nextSerial()}
                    label="Full Technical Detail"
                    title="Open what you need."
                  />
                  <p className="mb-6 max-w-3xl text-sm leading-relaxed text-text-muted">
                    The complete evidence behind the summary — findings, affected pages, the
                    remediation checklist, SEO signals and methodology. Collapsed by default; open
                    any section, or hand it off with the links up top.
                  </p>
                  <div className="border-b border-border">
                    {kpis.issues > 0 && (
                      <AccordionSection label="Findings · priority" count={kpis.issues}>
                        <div className="border-b border-border">
                      {report.bySeverity
                        .filter((block) => block.count > 0)
                        .map((block) => {
                          const meta = SEVERITY_META[block.severity];
                          return (
                            <details
                              key={block.severity}
                              open={block.severity !== 'minor'}
                              className="group border-t border-border"
                            >
                              <summary className="flex cursor-pointer list-none items-baseline gap-3 py-5 [&::-webkit-details-marker]:hidden">
                                <span
                                  className={`h-2 w-2 shrink-0 self-center ${meta.dot}`}
                                  aria-hidden="true"
                                />
                                <span className="font-display text-2xl capitalize text-text">
                                  {block.severity}
                                </span>
                                <span className="font-mono text-sm text-text-muted">
                                  {block.count}
                                </span>
                                <span className="ml-auto font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:hidden">
                                  show
                                </span>
                                <span className="ml-auto hidden font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:inline">
                                  hide
                                </span>
                              </summary>
                              <p className="-mt-1 mb-4 text-sm text-text-muted">{meta.why}</p>
                              <div className="mb-6 space-y-3">
                                {block.groups.map((group) => (
                                  <div
                                    key={group.cls}
                                    className="border border-border bg-surface p-4"
                                  >
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                      <span className="font-mono text-sm text-text">
                                        {group.count} &times; {group.label}
                                      </span>
                                      <span className="font-mono text-xs text-text-subtle">
                                        {group.internal} internal &middot; {group.external}{' '}
                                        external
                                      </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2 font-mono text-xs">
                                      <span className="shrink-0 text-text-subtle">e.g.</span>
                                      <span className="truncate text-text-muted" title={group.example}>
                                        {group.example}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-xs text-text-muted">{group.action}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        })}
                        </div>
                      </AccordionSection>
                    )}

                    {kpis.issues > 0 && (
                      <AccordionSection label="Findings · category" count={report.categories.length}>
                        <div className="overflow-x-auto border border-border bg-surface">
                      <table className="w-full min-w-[560px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border-strong">
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>
                              Category
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-right text-text-subtle`}>
                              Internal
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-right text-text-subtle`}>
                              External
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-right text-text-subtle`}>
                              Total
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>Example</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {report.categories.map((category) => (
                            <tr key={category.cls}>
                              <td className="px-4 py-3 text-sm text-text">{category.label}</td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-text-muted">
                                {category.internal}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-text-muted">
                                {category.external}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-text">
                                {category.total}
                              </td>
                              <td className="max-w-[260px] px-4 py-3">
                                <span
                                  className="block truncate font-mono text-xs text-text-subtle"
                                  title={category.example}
                                >
                                  {category.example}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      </AccordionSection>
                    )}

                    {kpis.issues > 0 && (
                      <AccordionSection label="Affected pages" count={report.affectedPages.length}>
                        <div className="divide-y divide-border border-y border-border">
                      {report.affectedPages.slice(0, 15).map((page) => (
                        <div
                          key={page.page}
                          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 py-3.5 sm:flex-nowrap sm:gap-x-6"
                        >
                          <span
                            className="min-w-0 truncate font-mono text-sm text-text"
                            title={page.page}
                          >
                            {page.page === 'Discovery' ? 'crawl seed' : pathOf(page.page)}
                          </span>
                          <span
                            className="hidden flex-1 border-b border-dotted border-border-strong sm:block"
                            aria-hidden="true"
                          />
                          <span className="w-20 shrink-0 font-mono text-xs text-text-muted sm:text-right">
                            {page.count} issue{page.count === 1 ? '' : 's'}
                          </span>
                          <span
                            className={`w-16 shrink-0 font-mono text-xs capitalize ${
                              SEVERITY_META[page.worstSeverity].text
                            }`}
                          >
                            {page.worstSeverity}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-text-subtle">
                            {page.classes.map((cls) => CLASS_SHORT[cls]).join(' · ')}
                          </span>
                        </div>
                      ))}
                    </div>
                    {report.affectedPages.length > 15 && (
                      <p className="mt-3 font-mono text-xs text-text-subtle">
                        + {report.affectedPages.length - 15} more pages — the appendix has the full
                        list.
                      </p>
                    )}
                      </AccordionSection>
                    )}

                    {report.tasks.length > 0 && (
                      <AccordionSection label="Remediation plan" count={report.tasks.length}>
                        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-text-muted">
                          Findings rolled up into tasks and ordered by impact against effort — work
                          top to bottom. Each task links to its evidence rows below.
                        </p>
                        <div className="overflow-x-auto border border-border bg-surface">
                      <table className="w-full min-w-[760px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border-strong">
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>#</th>
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>Task</th>
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>Owner</th>
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>Effort</th>
                            <th className={`${microLabel} px-4 py-3 text-right text-text-subtle`}>
                              Instances
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-right text-text-subtle`}>
                              Gain
                            </th>
                            <th className={`${microLabel} px-4 py-3 text-text-subtle`}>
                              Evidence
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border align-baseline">
                          {report.tasks.map((task) => (
                            <tr key={task.rank}>
                              <td className="px-4 py-4 font-mono text-sm text-action">
                                {String(task.rank).padStart(2, '0')}
                              </td>
                              <td className="min-w-[280px] px-4 py-4">
                                <p className="text-sm font-medium text-text">{task.action}</p>
                                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                                  {task.detail}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-text-muted">
                                {task.owner}
                              </td>
                              <td className="px-4 py-4 font-mono text-sm text-text">
                                {task.effort}
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-sm text-text">
                                {task.instances}
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-sm text-success">
                                {task.gain > 0 ? `+${task.gain}` : '—'}
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => focusEvidence(task.search)}
                                  className="whitespace-nowrap font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors hover:text-action hover:decoration-action"
                                >
                                  view <span aria-hidden="true">&rarr;</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      </AccordionSection>
                    )}

                    {/* Detailed findings — controlled so "view evidence" links can open it */}
                    <details
                      ref={appendixRef}
                      open={evidenceOpen}
                      onToggle={(e) => setEvidenceOpen(e.currentTarget.open)}
                      className="group scroll-mt-24 border-t border-border"
                    >
                      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-5 [&::-webkit-details-marker]:hidden">
                        <span className="font-display text-2xl text-text">Detailed findings</span>
                        <span className="font-mono text-sm text-text-muted">evidence table</span>
                        <span className="ml-auto font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:hidden">
                          show
                        </span>
                        <span className="ml-auto hidden font-mono text-xs text-text-subtle underline decoration-border-strong underline-offset-4 group-open:inline">
                          hide
                        </span>
                      </summary>
                      <div className="pb-8">
                        <EvidenceTable
                          jobId={jobId}
                          sharedTargets={report.sharedTargets}
                          focusSearch={appendixFocus}
                        />
                      </div>
                    </details>

                    <AccordionSection label="Methodology">
                      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                      <ColumnHeading>Scope</ColumnHeading>
                      <div className="space-y-1.5">
                        <LeaderRow k="Mode" v={modeLabel} />
                        <LeaderRow k="Crawl depth" v={String(job.settings?.maxDepth ?? '—')} />
                        <LeaderRow
                          k="External links"
                          v={job.settings?.includeExternal ? 'checked' : 'not checked'}
                        />
                        <LeaderRow
                          k="SEO analysis"
                          v={job.settings?.enableSEO ? 'on' : 'off'}
                        />
                        <LeaderRow
                          k="SEO pages analyzed"
                          v={String(seoPages)}
                        />
                        <LeaderRow
                          k="Source pages seen"
                          v={String(summary?.sourcePagesCount ?? '—')}
                        />
                        <LeaderRow
                          k="Links discovered"
                          v={kpis.totalDiscovered.toLocaleString()}
                        />
                        <LeaderRow k="Checked URLs" v={kpis.totalChecked.toLocaleString()} />
                        <LeaderRow k="Started" v={reportDate(job.timestamps?.createdAt)} />
                        <LeaderRow k="Finished" v={reportDate(job.timestamps?.completedAt)} />
                        <LeaderRow
                          k="Duration"
                          v={formatDuration(job.timestamps?.elapsedTime)}
                        />
                      </div>
                    </div>
                    <div>
                      <ColumnHeading>Definitions</ColumnHeading>
                      <div className="space-y-4 text-sm leading-relaxed text-text-muted">
                        <p>
                          A link counts as <span className="font-medium text-text">broken</span>{' '}
                          when it answers with a 4xx or 5xx status, times out, or fails at the
                          DNS/TLS layer. Targets that forbid automated checks (robots.txt) are
                          recorded but weighted lightly.
                        </p>
                        <p>
                          <span className="font-medium text-text">Severity:</span> critical means
                          internal server errors or a target broken on{' '}
                          {SHARED_SOURCE_THRESHOLD}+ pages (a shared nav/footer element); major
                          means other site-owned failures; minor means isolated or third-party
                          issues.
                        </p>
                        <div className="border border-border bg-surface-subtle p-4 font-mono text-xs leading-relaxed text-text-muted">
                          integrity = 100 &times; (1 &minus; weighted &divide; (checked &times;
                          0.5))
                          <br />
                          weights: int 5xx &times;4 &middot; int 4xx &times;2 &middot; timeout
                          &times;1.5 &middot; ext &times;0.5
                          <br />
                          response = 100 at 0% slow (&gt;{SLOW_MS / 1000}s) &rarr; 0 at 25%
                          <br />
                          coverage = checked &divide; discovered
                          <br />
                          <span className="text-text">
                            link health = 70% integrity + 20% response + 10% coverage
                          </span>
                        </div>
                        <p>
                          The score is deliberately explainable — same crawl, same number, every
                          time.
                        </p>
                      </div>
                    </div>
                  </div>
                    </AccordionSection>

                    {/* SEO snapshot — its own score system over its own population
                        (analyzed HTML pages); numeric only, no letter grade until the
                        deeper SEO pipeline (doc 04 §G) earns one. */}
                    <AccordionSection
                      label="SEO snapshot"
                      count={job.settings?.enableSEO ? seoPages : null}
                    >
                  <p className="mb-6 max-w-3xl text-sm leading-relaxed text-text-muted">
                    {job.settings?.enableSEO ? (
                      <>
                        SEO is scored per analyzed HTML page — {seoPages}{' '}
                        {seoPages === 1 ? 'page' : 'pages'} in this audit — and never feeds the
                        link-health grade above. Content metrics (headings, word count, images)
                        are measured on the first 50KB of each page. Treat it as a snapshot of
                        on-page signals, not a full SEO audit.
                      </>
                    ) : (
                      'SEO was not measured in this audit. Run a Full Audit with SEO analysis enabled to add this module.'
                    )}
                  </p>
                  <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-surface p-5">
                      <p className={`${microLabel} text-text-subtle`}>On-Page</p>
                      {seoSummary && seoPages > 0 ? (
                        <>
                          <p className="mt-3 font-mono text-2xl text-text">
                            {Math.round(seoSummary.avg_score || 0)}/100
                          </p>
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            page average &middot; range {seoSummary.min_score ?? '—'}&ndash;
                            {seoSummary.max_score ?? '—'}
                          </p>
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            {seoSummary.total_pages || 0} pages &middot;{' '}
                            {seoSummary.total_issues || 0} issues
                          </p>
                          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                            Per-page titles, meta and issues are in the evidence appendix under
                            SEO pages.
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                          Not measured in this audit — enable SEO analysis at setup.
                        </p>
                      )}
                    </div>
                    <div className="bg-surface p-5">
                      <p className={`${microLabel} text-text-subtle`}>Indexability</p>
                      {seoSummary?.indexability ? (
                        <>
                          <p
                            className={`mt-3 font-mono text-2xl ${
                              seoSummary.indexability.hidden > 0 ? 'text-danger' : 'text-text'
                            }`}
                          >
                            {seoSummary.indexability.indexable}/
                            {seoSummary.indexability.measured_pages}
                          </p>
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            pages visible to search
                          </p>
                          {seoSummary.indexability.hidden > 0 ? (
                            <p className="mt-1 font-mono text-xs text-danger">
                              {seoSummary.indexability.noindexed > 0 &&
                                `${seoSummary.indexability.noindexed} noindexed`}
                              {seoSummary.indexability.noindexed > 0 &&
                                seoSummary.indexability.robots_blocked > 0 &&
                                ' · '}
                              {seoSummary.indexability.robots_blocked > 0 &&
                                `${seoSummary.indexability.robots_blocked} blocked by robots.txt`}
                            </p>
                          ) : (
                            <p className="mt-1 font-mono text-xs text-text-muted">
                              no noindex or robots.txt blocks found
                            </p>
                          )}
                          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                            Per-page detail is under Deeper signals in the evidence appendix.
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                          Not measured in this audit — re-run with SEO analysis enabled.
                        </p>
                      )}
                    </div>
                    <div className="bg-surface p-5">
                      <p className={`${microLabel} text-text-subtle`}>Performance</p>
                      {performance?.score != null ? (
                        <>
                          <p
                            className={`mt-3 font-mono text-2xl ${
                              performance.score >= 90
                                ? 'text-text'
                                : performance.score >= 50
                                  ? 'text-warning'
                                  : 'text-danger'
                            }`}
                          >
                            {performance.score}/100
                          </p>
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            {performance.strategy} &middot; Core Web Vitals
                          </p>
                          {performance.lab && (
                            <p className="mt-1 font-mono text-xs text-text-muted">
                              LCP {performance.lab.lcp || '—'} &middot; CLS{' '}
                              {performance.lab.cls || '—'} &middot; TBT{' '}
                              {performance.lab.tbt || '—'}
                            </p>
                          )}
                          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                            Google PageSpeed on the homepage
                            {performance.field ? ', with real-user field data' : ' (lab data)'}.
                          </p>
                        </>
                      ) : performance?.reason === 'no_key' ? (
                        <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                          Not measured — add a free PageSpeed Insights key
                          (PAGESPEED_API_KEY) to enable Core Web Vitals.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                          Not measured in this audit.
                        </p>
                      )}
                    </div>
                    <div className="bg-surface p-5">
                      <p className={`${microLabel} text-text-subtle`}>Security</p>
                      {seoSummary?.security ? (
                        <>
                          {(() => {
                            const s = seoSummary.security;
                            const httpsPct = s.total_pages
                              ? Math.round((100 * s.https_pages) / s.total_pages)
                              : 0;
                            const flagged = httpsPct < 100 || s.mixed_content_pages > 0;
                            return (
                              <>
                                <p
                                  className={`mt-3 font-mono text-2xl ${
                                    flagged ? 'text-danger' : 'text-text'
                                  }`}
                                >
                                  {httpsPct}% HTTPS
                                </p>
                                <p className="mt-1 font-mono text-xs text-text-muted">
                                  {s.https_pages}/{s.total_pages} pages served securely
                                </p>
                                {s.headers_measured > 0 ? (
                                  <p className="mt-1 font-mono text-xs text-text-muted">
                                    HSTS {s.hsts_pages}/{s.headers_measured} &middot; CSP{' '}
                                    {s.csp_pages}/{s.headers_measured}
                                    {s.mixed_content_pages > 0 &&
                                      ` · ${s.mixed_content_pages} page${
                                        s.mixed_content_pages === 1 ? '' : 's'
                                      } with mixed content`}
                                  </p>
                                ) : (
                                  <p className="mt-1 font-mono text-xs text-text-subtle">
                                    security headers not measured — re-run the audit
                                  </p>
                                )}
                                <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                                  HTTPS coverage, security headers (HSTS/CSP) and mixed content.
                                </p>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                          Not measured in this audit — enable SEO analysis at setup.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* G1 duplicate content + G13 hreflang — always shown when SEO
                      ran, so a clean site still confirms the checks executed. */}
                  {seoSummary && seoPages > 0 && (
                    <div className="mt-px grid grid-cols-1 gap-px border border-t-0 border-border bg-border lg:grid-cols-2">
                      <div className="bg-surface p-5">
                        <p className={`${microLabel} text-text-subtle`}>Duplicate content</p>
                        {seoSummary.duplicates ? (
                          <div className="mt-3 space-y-4">
                            {[
                              ['Titles', seoSummary.duplicates.titles],
                              ['Meta descriptions', seoSummary.duplicates.descriptions],
                            ]
                              .filter(([, sets]) => sets.length > 0)
                              .map(([label, sets]) => (
                                <div key={label}>
                                  <p className="font-mono text-xs text-danger">
                                    {sets.length} duplicated {label.toLowerCase()}
                                  </p>
                                  <ul className="mt-2 space-y-2">
                                    {sets.slice(0, 3).map((set) => (
                                      <li key={set.value}>
                                        <p className="truncate text-xs italic text-text-muted" title={set.value}>
                                          “{set.value}”
                                        </p>
                                        <p className="font-mono text-[11px] text-text-subtle">
                                          {set.count} pages · {set.urls.slice(0, 3).map(pathOf).join(', ')}
                                          {set.urls.length > 3 ? ` +${set.urls.length - 3}` : ''}
                                        </p>
                                      </li>
                                    ))}
                                    {sets.length > 3 ? (
                                      <li className="font-mono text-[11px] text-text-subtle">
                                        +{sets.length - 3} more
                                      </li>
                                    ) : null}
                                  </ul>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                            No duplicate titles or descriptions across analyzed pages.
                          </p>
                        )}
                      </div>

                      <div className="bg-surface p-5">
                        <p className={`${microLabel} text-text-subtle`}>International · hreflang</p>
                        {seoSummary.hreflang ? (
                          <div className="mt-3 space-y-3">
                            <p className="font-mono text-xs text-text-muted">
                              {seoSummary.hreflang.pages_with_hreflang} page
                              {seoSummary.hreflang.pages_with_hreflang === 1 ? '' : 's'} declare hreflang
                            </p>
                            {seoSummary.hreflang.broken_return_tags.length > 0 && (
                              <div>
                                <p className="font-mono text-xs text-danger">
                                  {seoSummary.hreflang.broken_return_tags.length} page
                                  {seoSummary.hreflang.broken_return_tags.length === 1 ? '' : 's'} with
                                  missing return tags
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-text-subtle">
                                  Return tags must be reciprocal — Google ignores the whole set when a
                                  linked page doesn&rsquo;t link back.
                                </p>
                                <ul className="mt-2 space-y-1">
                                  {seoSummary.hreflang.broken_return_tags.slice(0, 5).map((b) => (
                                    <li key={b.url} className="break-all font-mono text-[11px] text-text-muted">
                                      {pathOf(b.url)}
                                      <span className="text-text-subtle">
                                        {' ↛ '}
                                        {b.missingReturnFrom.map(pathOf).join(', ')}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {seoSummary.hreflang.invalid_code_pages.length > 0 && (
                              <p className="font-mono text-xs text-danger">
                                {seoSummary.hreflang.invalid_code_pages.length} page
                                {seoSummary.hreflang.invalid_code_pages.length === 1 ? '' : 's'} with
                                invalid language codes
                              </p>
                            )}
                            {seoSummary.hreflang.broken_return_tags.length === 0 &&
                              seoSummary.hreflang.invalid_code_pages.length === 0 && (
                                <p className="font-mono text-xs text-text-muted">
                                  return tags reciprocal · codes valid
                                </p>
                              )}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
                            No hreflang tags found — single-language site or not internationalized.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                    </AccordionSection>

                    {report.environmentExposures.length > 0 && (
                      <AccordionSection
                        label="Environment exposures"
                        count={report.environmentExposures.length}
                      >
                        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-text-muted">
                          These checked URLs or source pages look like production, staging, UAT,
                          development, or internal endpoints. They can still return 200, so they are
                          tracked separately from broken-link issues.
                        </p>
                        <div className="divide-y divide-border border-y border-border">
                          {report.environmentExposures.slice(0, 12).map((exposure) => (
                            <div
                              key={`${exposure.field}:${exposure.url}`}
                              className="grid gap-2 py-4 text-sm md:grid-cols-[1fr_auto_auto]"
                            >
                              <div className="min-w-0">
                                <p className="break-all font-mono text-xs text-text">
                                  {exposure.url}
                                </p>
                                <p className="mt-1 font-mono text-xs text-text-subtle">
                                  {exposure.field === 'source_url' ? 'source page' : 'checked URL'}
                                  {' · '}
                                  {exposure.reasons.join(', ')}
                                </p>
                              </div>
                              <span className="font-mono text-xs text-text-muted md:text-right">
                                {exposure.statusCode ?? 'no status'}
                              </span>
                              <button
                                type="button"
                                onClick={() => focusEvidence(exposure.search)}
                                className="font-mono text-xs text-text underline decoration-border-strong underline-offset-4 transition-colors hover:text-action hover:decoration-action md:text-right"
                              >
                                evidence <span aria-hidden="true">&rarr;</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        {report.environmentExposures.length > 12 && (
                          <p className="mt-3 font-mono text-xs text-text-subtle">
                            + {report.environmentExposures.length - 12} more environment signals in
                            the appendix.
                          </p>
                        )}
                      </AccordionSection>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <SecurityNotice />
      </main>

      {/* ── Stop confirmation ─────────────────────────────────────────── */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-border bg-surface p-6">
            <p className={`${microLabel} mb-3 text-danger`}>Stop this audit?</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Checking stops immediately. Everything checked so far stays in the report, and the
              report is marked as partial.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="dangerSolid"
                size="md"
                type="button"
                onClick={handleStop}
                disabled={isStopping}
                className="flex-1"
              >
                {isStopping ? 'Stopping…' : 'Stop audit'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="flex-1"
              >
                Keep running
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
