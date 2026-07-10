'use client';

import { useState } from 'react';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const ALLOWED = [
  'Websites you own or manage',
  'Sites with explicit permission',
  'Public websites for legitimate testing',
  'Respects robots.txt and rate limits',
];

const BLOCKED = [
  'localhost and 127.0.0.1',
  'Private networks (192.168.x.x, 10.x.x.x)',
  'Cloud metadata services (AWS, Azure, GCP)',
  'Internal domains (.internal, .local)',
];

function NoticeList({ items, marker = '—', markerTone = 'text-action' }) {
  return (
    <ul className="space-y-2 text-sm text-text-muted leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className={`${markerTone} font-mono`} aria-hidden="true">
            {marker}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function RobotsHint() {
  return (
    <div className="mt-6 border-t border-border pt-4 text-xs text-text-muted">
      <span className={`${microLabel} text-text-subtle mr-3`}>For Website Owners</span>
      This tool only checks link availability and doesn&rsquo;t store content. To block our scanner,
      add to robots.txt:
      <code className="mt-2 block w-fit rounded-sm bg-surface-subtle px-3 py-2 font-mono text-xs text-text">
        User-agent: SeoScrub Bot
        <br />
        Disallow: /
      </code>
    </div>
  );
}

export default function SecurityNotice({ variant = 'compact' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <div className="mt-8 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <p className={`${microLabel} shrink-0 text-text-subtle`}>Security Notice</p>
          <p className="text-sm text-text-muted">
            Only scan websites you own or have permission to test. Internal networks and
            unauthorized scanning are automatically blocked.
          </p>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="font-mono text-xs text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action transition-colors duration-200"
          >
            {isExpanded ? 'Less info' : 'More info'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-6 border-t border-border pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <p className={`${microLabel} text-text-subtle mb-4`}>01 &middot; Allowed</p>
                <NoticeList items={ALLOWED} marker="+" markerTone="text-success" />
              </div>
              <div>
                <p className={`${microLabel} text-text-subtle mb-4`}>
                  02 &middot; Automatically Blocked
                </p>
                <NoticeList items={BLOCKED} marker="&times;" markerTone="text-danger" />
              </div>
            </div>
            <RobotsHint />
          </div>
        )}
      </div>
    );
  }

  // Full variant for form pages
  return (
    <div className="mb-6 border border-border bg-surface p-6">
      <p className={`${microLabel} text-text-subtle mb-2`}>Security &amp; Usage Guidelines</p>
      <p className="text-sm text-text-muted leading-relaxed mb-6">
        Only scan websites you own or have permission to test. Requests respect robots.txt and run
        rate-limited; large scans may still trigger security alerts on target websites.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-border pt-6">
        <div>
          <p className={`${microLabel} text-text-subtle mb-4`}>01 &middot; Allowed</p>
          <NoticeList items={ALLOWED} marker="+" markerTone="text-success" />
        </div>
        <div>
          <p className={`${microLabel} text-text-subtle mb-4`}>02 &middot; Automatically Blocked</p>
          <NoticeList items={BLOCKED} marker="&times;" markerTone="text-danger" />
        </div>
      </div>
      <RobotsHint />
    </div>
  );
}
