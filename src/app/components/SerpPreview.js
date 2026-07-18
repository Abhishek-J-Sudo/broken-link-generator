'use client';

// G12 — SERP preview. A pixel-accurate facsimile of how a page's title + meta
// description render in a Google result, so a non-technical stakeholder can see
// exactly what a searcher sees. Truncation is measured in Arial at Google's sizes
// (that's what the real SERP uses), so the text is rendered in Arial too — what
// you see here is what gets cut off there. This is a deliberate facsimile, not
// app chrome, so it steps outside the house type scale on purpose.

import { useEffect, useMemo, useState } from 'react';

const TITLE_FONT = '20px Arial, sans-serif';
const DESC_FONT = '14px Arial, sans-serif';
const TITLE_MAX_PX = 600; // Google truncates the title link near ~600px
const DESC_MAX_PX = 920; // description spans ~2 lines before the ellipsis

// One reused offscreen canvas for text measurement (client-only).
let _canvas;
function measure(text, font) {
  if (typeof document === 'undefined') return null;
  _canvas = _canvas || document.createElement('canvas');
  const ctx = _canvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

function truncateToPixels(text, font, maxPx, charFallback) {
  if (!text) return { text: '', truncated: false };
  const full = measure(text, font);
  if (full == null) {
    // SSR / no-canvas fallback: rough character cap keeps first render stable.
    return text.length > charFallback
      ? { text: `${text.slice(0, charFallback).trimEnd()}…`, truncated: true }
      : { text, truncated: false };
  }
  if (full <= maxPx) return { text, truncated: false };

  const ellipsisPx = measure('…', font);
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(text.slice(0, mid), font) + ellipsisPx <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  return { text: `${text.slice(0, lo).trimEnd()}…`, truncated: true };
}

function breadcrumb(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      });
    return { host, trail: [host, ...parts].join(' › ') };
  } catch {
    return { host: url, trail: url };
  }
}

export default function SerpPreview({ url, title, description }) {
  // Measure only after mount so the server and first client render match
  // (both untruncated); the effect upgrades to pixel-accurate truncation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rawTitle = (title || '').trim();
  const rawDesc = (description || '').trim();
  const displayTitle = rawTitle || 'No title tag — Google generates one from the page';

  const t = useMemo(
    () =>
      mounted
        ? truncateToPixels(displayTitle, TITLE_FONT, TITLE_MAX_PX, 60)
        : { text: displayTitle, truncated: false },
    [mounted, displayTitle]
  );
  const d = useMemo(
    () => (mounted ? truncateToPixels(rawDesc, DESC_FONT, DESC_MAX_PX, 160) : { text: rawDesc, truncated: false }),
    [mounted, rawDesc]
  );

  const { host, trail } = breadcrumb(url);

  return (
    <div className="max-w-[600px] rounded-lg border border-border bg-surface p-4">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-border text-[11px] font-semibold uppercase text-text-subtle">
          {host.charAt(0)}
        </span>
        <span className="min-w-0 leading-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
          <span className="block truncate text-[14px] text-text">{host}</span>
          <span className="block truncate text-[12px] text-text-subtle">{trail}</span>
        </span>
      </div>

      <div
        className={`text-[20px] leading-snug ${rawTitle ? 'text-action' : 'italic text-text-subtle'}`}
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {t.text}
      </div>

      {d.text ? (
        <p className="mt-1 text-[14px] leading-snug text-text-muted" style={{ fontFamily: 'Arial, sans-serif' }}>
          {d.text}
        </p>
      ) : (
        <p className="mt-1 text-[13px] italic leading-snug text-text-subtle">
          No meta description — Google will assemble a snippet from page content.
        </p>
      )}
    </div>
  );
}
