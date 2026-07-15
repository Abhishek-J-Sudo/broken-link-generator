/**
 * Shared plumbing for the public /share/[token] documents (client summary and
 * team fix list). Both are light-theme, print-first pages fed by the single
 * composite payload from /api/share/view/[token].
 */

import { useEffect, useState } from 'react';

export const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

export function reportDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function csvDownload(filename, headers, rows) {
  const bom = String.fromCharCode(0xfeff);
  const csv =
    bom +
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Fetch the shared-report payload and force the light theme while mounted.
 * Returns { payload, error } — exactly one becomes truthy.
 */
export function useSharedReport(token) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  // Client reports are a light-theme, print-first document regardless of the
  // visitor's OS preference.
  useEffect(() => {
    const previous = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      if (previous) document.documentElement.setAttribute('data-theme', previous);
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share/view/${token}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.status === 404
              ? 'This report link is invalid or has been revoked by the sender.'
              : data.error || 'This report could not be loaded.'
          );
          return;
        }
        setPayload(data);
      } catch {
        if (!cancelled) setError('This report could not be loaded — try again in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { payload, error };
}

export function ShareErrorScreen({ error }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className={`${microLabel} text-text-subtle`}>SeoScrub · Shared Report</p>
      <p className="mt-4 font-display text-2xl text-text">{error}</p>
      <p className="mt-3 text-sm text-text-muted">
        Ask the person who sent you this link for a fresh one.
      </p>
    </main>
  );
}

export function ShareLoadingScreen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6">
      {/* Brand loading trail: scan pulse traveling the link path */}
      <svg width="220" height="16" viewBox="0 0 220 16" aria-hidden="true">
        <line x1="8" y1="8" x2="212" y2="8" stroke="var(--color-border)" strokeWidth="1" />
        <line
          x1="8"
          y1="8"
          x2="212"
          y2="8"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="28 176"
          className="brand-trail"
        />
        <circle cx="8" cy="8" r="2.5" fill="var(--color-border-strong)" />
        <circle cx="110" cy="8" r="2.5" fill="var(--color-border-strong)" />
        <circle cx="212" cy="8" r="2.5" fill="var(--color-border-strong)" />
      </svg>
      <p className={`${microLabel} text-text-subtle`}>Preparing report…</p>
    </main>
  );
}
