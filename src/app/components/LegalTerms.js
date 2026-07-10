'use client';

import { useState } from 'react';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const LIABILITY_TERMS = [
  'You are solely responsible for ensuring scans are legal and authorized',
  'You must comply with all applicable laws (CFAA, GDPR, cybersecurity laws)',
  'Unauthorized scanning may result in criminal or civil penalties',
  'You indemnify and hold harmless the service provider from any legal issues',
];

const DISCLAIMER_TERMS = [
  'Service provided “as-is” without any warranties or guarantees',
  'We are not liable for any damages, losses, or legal consequences',
  'No responsibility for false positives, missed issues, or service errors',
  'Service may be discontinued or modified without notice',
];

function TermList({ items }) {
  return (
    <ul className="space-y-2 text-sm text-text-muted leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="text-action" aria-hidden="true">
            &mdash;
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function LegalTerms({ variant = 'banner' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'banner') {
    return (
      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className={`${microLabel} shrink-0 text-text-subtle`}>Legal Notice</p>
            <p className="text-sm text-text-muted">
              By using this service you agree to its terms; you are solely responsible for ensuring
              your scans are authorized.
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-mono text-xs text-text underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action transition-colors duration-200"
            >
              {isExpanded ? 'Hide full terms' : 'View full terms'}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-6 border-t border-border pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <p className={`${microLabel} text-text-subtle mb-4`}>
                    01 &middot; User Liability
                  </p>
                  <TermList items={LIABILITY_TERMS} />
                </div>
                <div>
                  <p className={`${microLabel} text-text-subtle mb-4`}>
                    02 &middot; Service Disclaimer
                  </p>
                  <TermList items={DISCLAIMER_TERMS} />
                </div>
              </div>
              <p className="mt-6 border-t border-border pt-4 text-xs text-text-muted">
                By proceeding, you acknowledge that you have read and agree to these terms. If you
                do not agree, you must not use this service.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Compact footer version
  return (
    <div className="border-t border-border pt-4">
      <p className="text-sm text-text-muted">
        <span className={`${microLabel} text-text-subtle mr-3`}>Legal</span>
        You are solely responsible for ensuring authorized use. Service provided &ldquo;as-is&rdquo;
        without warranties; the operator is not liable for any legal consequences of your usage.
      </p>
    </div>
  );
}
