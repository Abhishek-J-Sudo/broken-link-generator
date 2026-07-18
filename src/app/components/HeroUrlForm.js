'use client';

// Homepage hero entry — a single URL box. It doesn't run anything itself; it
// hands off to /audit with the URL pre-filled, so there's still exactly one
// place an audit is configured and started (no competing settings here).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/app/components/Button';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

export default function HeroUrlForm() {
  const [url, setUrl] = useState('');
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      router.push('/audit');
      return;
    }
    // Accept a bare domain ("example.com") by assuming https — the setup page
    // still validates and lets them correct it before anything runs.
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    router.push(`/audit?url=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="mb-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          aria-label="Website URL to audit"
          className="w-full flex-1 rounded-md border border-border bg-surface px-4 py-3.5 font-mono text-sm text-text transition-colors placeholder:text-text-subtle focus:border-action"
        />
        <Button type="submit" size="lg" className="shrink-0">
          Audit
          <span aria-hidden="true">&rarr;</span>
        </Button>
      </form>
      <p className={`${microLabel} mt-3 text-text-subtle`}>
        Free &middot; No sign-up &middot; Choose Quick or Full on the next step &middot;{' '}
        <Link href="/audit" className="text-text-subtle underline decoration-border-strong underline-offset-4 hover:text-action hover:decoration-action">
          or open setup
        </Link>
      </p>
    </div>
  );
}
