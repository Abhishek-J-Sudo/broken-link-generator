'use client';

// Shared "Previous Audits" ledger — the recent-jobs list backed by
// /api/jobs/recent. Used on the audit setup page and on the /audits history
// route so both stay in sync.

import { useEffect, useState } from 'react';
import Link from 'next/link';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const STATUS_TONE = {
  completed: 'text-success',
  running: 'text-info',
  queued: 'text-info',
  failed: 'text-danger',
  stopped: 'text-warning',
};

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

function brokenReadout(job) {
  if (job.status === 'completed' || job.status === 'stopped') return `${job.brokenCount} broken`;
  if (job.status === 'running') return `${job.brokenCount} so far`;
  return '—';
}

export default function PreviousAudits({ heading = 'Previous Audits', className = 'mt-16 lg:mt-20' }) {
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
    <section className={className}>
      <div className="mb-6 flex items-center gap-4">
        <p className={`${microLabel} shrink-0 text-text-subtle`}>{heading}</p>
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
