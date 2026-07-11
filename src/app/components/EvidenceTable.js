// src/app/components/EvidenceTable.js — the detailed-findings appendix of the
// audit report (doc 09 §9). Evidence, not the lead: one row per checked link,
// filterable and pageable, expanding to the raw failure detail.
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  classifyFinding,
  deriveSeverity,
  actionForClass,
  pathOf,
  CLASS_SHORT,
} from '@/lib/auditReport';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const SEVERITY_TONE = {
  critical: 'text-danger',
  major: 'text-warning',
  minor: 'text-text-muted',
};

const ERROR_TYPE_LABELS = {
  404: 'Not Found',
  500: 'Server Error',
  403: 'Forbidden',
  401: 'Unauthorized',
  timeout: 'Timeout',
  dns_error: 'DNS Error',
  connection_error: 'Connection Failed',
  ssl_error: 'SSL Error',
  invalid_url: 'Invalid URL',
  security_blocked: 'Security Blocked',
  robots_blocked: 'Robots Blocked',
  other: 'Other',
};

const VIEWS = [
  { id: 'broken', label: 'Broken' },
  { id: 'all', label: 'All checked' },
  { id: 'working', label: 'Working' },
];

export default function EvidenceTable({ jobId, sharedTargets = [], focusSearch = null }) {
  const shared = useRef(new Set(sharedTargets));
  shared.current = new Set(sharedTargets);

  const [view, setView] = useState('broken');
  const [errorType, setErrorType] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [errorOptions, setErrorOptions] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | done | error
  const [expanded, setExpanded] = useState(new Set());

  // The remediation plan's "evidence →" links land here with a search term.
  useEffect(() => {
    if (!focusSearch?.at) return;
    const term = focusSearch.term || '';
    setView('broken');
    setErrorType('all');
    setSearch(term);
    setSearchDraft(term);
    setPage(1);
  }, [focusSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '50',
          statusFilter: view,
        });
        if (errorType !== 'all') params.set('errorType', errorType);
        if (search) params.set('search', search);

        const response = await fetch(`/api/results/${jobId}?${params}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load findings');
        if (cancelled) return;

        setData(payload);
        setExpanded(new Set());
        setStatus('done');
        if (errorType === 'all' && payload.filterOptions?.errorTypes) {
          setErrorOptions(payload.filterOptions.errorTypes);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, view, errorType, search, page]);

  const toggleRow = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const changeView = (id) => {
    setView(id);
    setPage(1);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const rows = data?.links || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  const viewCount = (id) => {
    if (!summary) return null;
    if (id === 'broken') return summary.brokenLinks;
    if (id === 'working') return summary.workingLinks;
    return summary.totalLinksChecked;
  };

  return (
    <div>
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => changeView(v.id)}
              className={`font-mono text-xs uppercase tracking-[0.14em] underline-offset-4 transition-colors ${
                view === v.id
                  ? 'text-text underline decoration-action decoration-2'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              {v.label}
              {viewCount(v.id) != null && (
                <span className={view === v.id ? 'text-action' : ''}> {viewCount(v.id)}</span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search URLs…"
            aria-label="Search URLs"
            className="w-44 rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text placeholder:text-text-subtle focus:border-action focus:outline-none sm:w-56"
          />
          <select
            value={errorType}
            onChange={(e) => {
              setErrorType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by error type"
            className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text focus:border-action focus:outline-none"
          >
            <option value="all">All error types</option>
            {errorOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {ERROR_TYPE_LABELS[opt.type] || opt.type} ({opt.count})
              </option>
            ))}
          </select>
        </form>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="w-8 px-2 py-3" aria-label="Expand" />
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>Priority</th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>URL</th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>Source page</th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>Type</th>
              <th className={`${microLabel} px-3 py-3 text-right text-text-subtle`}>Code</th>
              <th className={`${microLabel} px-3 py-3 text-right text-text-subtle`}>ms</th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>Scope</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {status === 'loading' && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center font-mono text-xs text-text-subtle">
                  Loading findings&hellip;
                </td>
              </tr>
            )}
            {status === 'error' && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-danger">
                  Couldn&rsquo;t load the findings — try again.
                </td>
              </tr>
            )}
            {status === 'done' && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">
                  No links match this view.
                </td>
              </tr>
            )}

            {status === 'done' &&
              rows.map((row) => {
                const broken = row.is_working !== true;
                const cls = broken ? classifyFinding(row) : null;
                const severity = broken
                  ? deriveSeverity(cls, !!row.is_internal, shared.current.has(row.url))
                  : null;
                const isOpen = expanded.has(row.id);
                return (
                  <FragmentRow
                    key={row.id}
                    row={row}
                    cls={cls}
                    severity={severity}
                    isOpen={isOpen}
                    onToggle={() => toggleRow(row.id)}
                  />
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between font-mono text-xs">
          <span className="text-text-subtle">
            Page {pagination.currentPage} of {pagination.totalPages} &middot;{' '}
            {pagination.totalCount} rows
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage(page - 1)}
              className={`underline-offset-4 ${
                pagination.hasPrevPage
                  ? 'text-text underline decoration-border-strong hover:text-action hover:decoration-action'
                  : 'cursor-not-allowed text-text-subtle'
              }`}
            >
              &larr; Prev
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage(page + 1)}
              className={`underline-offset-4 ${
                pagination.hasNextPage
                  ? 'text-text underline decoration-border-strong hover:text-action hover:decoration-action'
                  : 'cursor-not-allowed text-text-subtle'
              }`}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ row, cls, severity, isOpen, onToggle }) {
  const broken = row.is_working !== true;
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer align-baseline transition-colors hover:bg-surface-subtle"
      >
        <td className="px-2 py-2.5 text-center font-mono text-xs text-text-subtle">
          {isOpen ? '−' : '+'}
        </td>
        <td className="px-3 py-2.5">
          {severity ? (
            <span className={`font-mono text-xs capitalize ${SEVERITY_TONE[severity]}`}>
              {severity}
            </span>
          ) : (
            <span className="font-mono text-xs text-text-subtle">&mdash;</span>
          )}
        </td>
        <td className="max-w-[280px] px-3 py-2.5">
          <span className="block truncate font-mono text-xs text-text" title={row.url}>
            {row.url}
          </span>
        </td>
        <td className="max-w-[200px] px-3 py-2.5">
          <span
            className="block truncate font-mono text-xs text-text-muted"
            title={row.source_url}
          >
            {row.source_url === 'Discovery' ? 'crawl seed' : pathOf(row.source_url)}
          </span>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
          {broken ? CLASS_SHORT[cls] : 'OK'}
        </td>
        <td
          className={`px-3 py-2.5 text-right font-mono text-xs ${
            broken ? 'text-danger' : 'text-text-muted'
          }`}
        >
          {row.http_status_code ?? '—'}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
          {row.response_time ?? '—'}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
          {row.is_internal ? 'INT' : 'EXT'}
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-surface-subtle">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-x-10 gap-y-2 text-xs sm:grid-cols-2">
              <Detail label="Full URL">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
                >
                  {row.url}
                </a>
              </Detail>
              <Detail label="Found on">
                <span className="break-all font-mono text-text-muted">{row.source_url}</span>
              </Detail>
              {row.link_text && row.link_text !== 'Unknown' && (
                <Detail label="Link text">
                  <span className="text-text-muted">&ldquo;{row.link_text}&rdquo;</span>
                </Detail>
              )}
              {row.error_message && (
                <Detail label="Error">
                  <span className="font-mono text-danger">{row.error_message}</span>
                </Detail>
              )}
              {broken && (
                <Detail label="Recommended action">
                  <span className="text-text">{actionForClass(cls, !!row.is_internal)}</span>
                </Detail>
              )}
              {row.has_seo_data && row.seo_score != null && (
                <Detail label="SEO score">
                  <span className="font-mono text-text-muted">
                    {row.seo_score}/100 ({row.seo_grade})
                  </span>
                </Detail>
              )}
              {row.checked_at && (
                <Detail label="Checked at">
                  <span className="font-mono text-text-subtle">
                    {new Date(row.checked_at).toLocaleString()}
                  </span>
                </Detail>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${microLabel} shrink-0 text-text-subtle`}>{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
