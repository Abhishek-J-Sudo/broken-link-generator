'use client';

import { useEffect, useRef, useState } from 'react';
import {
  classifyFinding,
  deriveSeverity,
  actionForClass,
  pathOf,
  CLASS_SHORT,
} from '@/lib/auditReport';
import SerpPreview from './SerpPreview';

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
  { id: 'all', label: 'All checked URLs' },
  { id: 'working', label: 'Healthy links' },
  { id: 'pages', label: 'SEO pages' },
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
  const [status, setStatus] = useState('loading');
  const [expanded, setExpanded] = useState(new Set());

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
        setErrorOptions(payload.filterOptions?.errorTypes || []);
        setStatus('done');
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
    if (id !== 'broken') setErrorType('all');
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
  const isPageView = view === 'pages';

  const viewCount = (id) => {
    if (!summary) return null;
    if (id === 'broken') return summary.brokenLinks;
    if (id === 'working') return summary.workingLinks;
    if (id === 'pages') return summary.pagesAnalyzed;
    return summary.totalLinksChecked;
  };

  return (
    <div>
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

        <p className="basis-full text-xs leading-relaxed text-text-subtle sm:basis-auto">
          {isPageView
            ? 'Page-level SEO rows from the HTML pages analyzed during this audit.'
            : 'Link rows are every URL checked for HTTP health; assets can appear here when they were found on a page.'}
        </p>

        <form onSubmit={submitSearch} className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search URLs..."
            aria-label="Search URLs"
            className="w-44 rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text placeholder:text-text-subtle focus:border-action sm:w-56"
          />
          <select
            value={errorType}
            onChange={(e) => {
              setErrorType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by error type"
            disabled={view !== 'broken'}
            className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text focus:border-action disabled:cursor-not-allowed disabled:text-text-subtle"
          >
            <option value="all">
              {view === 'broken' ? 'All error types' : 'Error types: broken only'}
            </option>
            {errorOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {ERROR_TYPE_LABELS[opt.type] || opt.type} ({opt.count})
              </option>
            ))}
          </select>
        </form>
      </div>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="w-8 px-2 py-3" aria-label="Expand" />
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>
                {isPageView ? 'SEO' : 'Priority'}
              </th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>
                {isPageView ? 'Page URL' : 'URL'}
              </th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>
                {isPageView ? 'Title / Meta' : 'Source page'}
              </th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>
                {isPageView ? 'Issues' : 'Type'}
              </th>
              <th className={`${microLabel} px-3 py-3 text-right text-text-subtle`}>Code</th>
              <th className={`${microLabel} px-3 py-3 text-right text-text-subtle`}>ms</th>
              <th className={`${microLabel} px-3 py-3 text-text-subtle`}>
                {isPageView ? 'HTTPS' : 'Scope'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {status === 'loading' && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center font-mono text-xs text-text-subtle">
                  Loading findings...
                </td>
              </tr>
            )}

            {status === 'error' && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-danger">
                  Couldn&apos;t load the findings. Try again.
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
              rows.map((row, index) => {
                const broken = row.is_working !== true;
                const cls = broken ? classifyFinding(row) : null;
                const severity = broken
                  ? deriveSeverity(cls, !!row.is_internal, shared.current.has(row.url))
                  : null;
                const rowKey = row.id || `${row.row_kind || 'link'}:${row.url}:${index}`;
                const isOpen = expanded.has(rowKey);

                return (
                  <FragmentRow
                    key={rowKey}
                    row={row}
                    cls={cls}
                    severity={severity}
                    isOpen={isOpen}
                    onToggle={() => toggleRow(rowKey)}
                  />
                );
              })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between font-mono text-xs">
          <span className="text-text-subtle">
            Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalCount} rows
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
              ← Prev
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
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ row, cls, severity, isOpen, onToggle }) {
  const broken = row.is_working !== true;
  const isPage = row.row_kind === 'seo_page';
  const issueMessages = (row.seo_issues || [])
    .slice(0, 6)
    .map((issue) => issue.message || issue.type || String(issue));

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer align-baseline transition-colors hover:bg-surface-subtle"
      >
        <td className="px-2 py-2.5 text-center font-mono text-xs text-text-subtle">
          {isOpen ? '-' : '+'}
        </td>
        <td className="px-3 py-2.5">
          {isPage ? (
            <span className="font-mono text-xs text-text">
              {row.seo_score ?? '-'} / 100 {row.seo_grade ? `(${row.seo_grade})` : ''}
            </span>
          ) : severity ? (
            <span className={`font-mono text-xs capitalize ${SEVERITY_TONE[severity]}`}>
              {severity}
            </span>
          ) : (
            <span className="font-mono text-xs text-text-subtle">-</span>
          )}
        </td>
        <td className="max-w-[280px] px-3 py-2.5">
          <span className="block truncate font-mono text-xs text-text" title={row.url}>
            {row.url}
          </span>
        </td>
        <td className="max-w-[200px] px-3 py-2.5">
          {isPage ? (
            <span className="block truncate text-xs text-text-muted" title={row.seo_title?.text}>
              {row.seo_title?.text || 'Untitled page'}
            </span>
          ) : (
            <span
              className="block truncate font-mono text-xs text-text-muted"
              title={row.source_url}
            >
              {row.source_url === 'Discovery' ? 'crawl seed' : pathOf(row.source_url)}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
          {isPage ? row.seo_issues_count || 0 : broken ? CLASS_SHORT[cls] : 'OK'}
        </td>
        <td
          className={`px-3 py-2.5 text-right font-mono text-xs ${
            broken ? 'text-danger' : 'text-text-muted'
          }`}
        >
          {row.http_status_code ?? '-'}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
          {row.response_time ?? '-'}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
          {isPage ? (row.seo_technical?.isHttps ? 'YES' : 'NO') : row.is_internal ? 'INT' : 'EXT'}
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-surface-subtle">
          <td colSpan={8} className="px-4 py-4">
            {isPage ? (
              <SeoPageDetails row={row} issueMessages={issueMessages} />
            ) : (
              <div className="grid gap-x-10 gap-y-4 text-xs sm:grid-cols-2">
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
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SeoPageDetails({ row, issueMessages }) {
  return (
    <div className="space-y-4 text-xs">
      <Detail label="Page URL">
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-mono text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action"
        >
          {row.url}
        </a>
      </Detail>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {row.seo_title && (
            <Detail label="Title">
              <span className="text-text-muted">
                {row.seo_title.text}
                {row.seo_title.length != null ? ` (${row.seo_title.length} chars)` : ''}
              </span>
            </Detail>
          )}

          <Detail label="Images (first 50KB)">
            <span className="font-mono text-text-muted">
              {row.seo_images?.missing_alt || 0} missing alt / {row.seo_images?.total_images || 0}{' '}
              total
            </span>
          </Detail>

          {row.seo_issues?.length > 0 && (
            <Detail label="SEO issues">
              <ul className="space-y-2 text-text-muted">
                {issueMessages.map((message, index) => (
                  <li key={`${row.url}:issue:${index}`} className="flex gap-2">
                    <span className="font-mono text-action" aria-hidden="true">
                      -
                    </span>
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            </Detail>
          )}
        </div>

        <div className="space-y-4">
          <Detail label="Structure (first 50KB)">
            <span className="font-mono text-text-muted">
              H1 {row.seo_headings?.h1_count || 0} · H2 {row.seo_headings?.h2_count || 0} · Words{' '}
              {row.seo_content?.word_count || 0} · Images {row.seo_images?.total_images || 0}
            </span>
          </Detail>

          {row.seo_metaDescription && (
            <Detail label="Meta description">
              <span className="text-text-muted">
                {row.seo_metaDescription.text}
                {row.seo_metaDescription.length != null
                  ? ` (${row.seo_metaDescription.length} chars)`
                  : ''}
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
      </div>

      {(row.seo_title || row.seo_metaDescription) && (
        <div className="border-t border-border pt-4">
          <span className={`${microLabel} text-text-subtle`}>Search result preview</span>
          <div className="mt-3">
            <SerpPreview
              url={row.url}
              title={row.seo_title?.text}
              description={row.seo_metaDescription?.text}
            />
          </div>
        </div>
      )}

      {row.seo_signals && <SignalsDetails signals={row.seo_signals} />}
    </div>
  );
}

function SignalsDetails({ signals }) {
  const indexProblems = [];
  if (signals.robots?.noindex) indexProblems.push(`noindex via ${signals.robots.noindexSource}`);
  if (signals.robotsTxt?.disallowed)
    indexProblems.push(`robots.txt disallows "${signals.robotsTxt.matchedRule}"`);

  const social = signals.social;
  const socialSummary = !social
    ? null
    : !social.hasOpenGraph
      ? 'no Open Graph tags'
      : social.missingOpenGraph.length > 0
        ? `missing ${social.missingOpenGraph.join(', ')}`
        : 'Open Graph complete';

  const structured = signals.structuredData;
  const outline = signals.headings?.outline || [];
  const freshness = signals.freshness;
  const freshnessDate = freshness?.modifiedTime || freshness?.publishedTime || freshness?.lastModifiedHeader;
  const fundamentals = signals.fundamentals;

  const hreflang = signals.hreflang;
  const hreflangSummary = !hreflang?.present
    ? null
    : `${hreflang.count} alternate${hreflang.count === 1 ? '' : 's'}${
        hreflang.hasXDefault ? ' · x-default' : ''
      }${hreflang.selfReferences ? '' : ' · no self-reference'}`;

  return (
    <div className="border-t border-border pt-4">
      <span className={`${microLabel} text-text-subtle`}>Deeper signals</span>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Detail label="Indexability">
          {indexProblems.length > 0 ? (
            <span className="font-mono text-danger">{indexProblems.join(' · ')}</span>
          ) : (
            <span className="font-mono text-text-muted">
              indexable{signals.robots?.nofollow ? ' · nofollow' : ''}
            </span>
          )}
        </Detail>

        <Detail label="Social preview">
          <span className="font-mono text-text-muted">
            {socialSummary}
            {social?.hasTwitterCard ? ` · twitter:${social.twitter.card}` : ''}
          </span>
        </Detail>

        <Detail label="Structured data">
          <span className="font-mono text-text-muted">
            {structured?.hasStructuredData ? structured.types.join(', ') : 'none'}
            {structured?.invalidBlocks > 0 ? ` · ${structured.invalidBlocks} invalid block(s)` : ''}
          </span>
        </Detail>

        <Detail label="Heading outline">
          <span className="font-mono text-text-muted">
            {outline.length > 0 ? outline.slice(0, 12).join(' → ') : 'no headings'}
            {outline.length > 12 ? ' …' : ''}
            {signals.headings?.skippedLevels ? (
              <span className="text-danger"> · skips {signals.headings.skippedLevels}</span>
            ) : null}
          </span>
        </Detail>

        <Detail label="Fundamentals">
          <span className="font-mono text-text-muted">
            lang {fundamentals?.htmlLang || 'missing'} · viewport{' '}
            {fundamentals?.hasViewport ? 'present' : 'missing'} · URL{' '}
            {fundamentals?.urlTooLong || fundamentals?.urlHasUnderscores
              ? [
                  fundamentals?.urlTooLong ? 'over 100 chars' : null,
                  fundamentals?.urlHasUnderscores ? 'has underscores' : null,
                ]
                  .filter(Boolean)
                  .join(', ')
              : 'ok'}
          </span>
        </Detail>

        <Detail label="Freshness">
          <span className="font-mono text-text-muted">
            {freshnessDate
              ? `${new Date(freshnessDate).toLocaleDateString()}${
                  freshness.ageMonths != null ? ` (~${freshness.ageMonths} mo old)` : ''
                }`
              : 'no date signals'}
            {freshness?.isStale ? <span className="text-danger"> · stale</span> : null}
          </span>
        </Detail>

        {hreflangSummary && (
          <Detail label="hreflang">
            <span className="font-mono text-text-muted">
              {hreflangSummary}
              {hreflang.invalidCodes?.length > 0 ? (
                <span className="text-danger"> · invalid: {hreflang.invalidCodes.join(', ')}</span>
              ) : null}
            </span>
          </Detail>
        )}
      </div>
    </div>
  );
}

function Detail({ label, children, wide = false }) {
  return (
    <div className={`grid gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={`${microLabel} text-text-subtle`}>{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
