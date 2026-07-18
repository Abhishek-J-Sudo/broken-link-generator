// src/app/audits/page.js — Audit history. The "Previous Audits" ledger,
// promoted to its own route so past reports are reachable from the header
// (not only buried at the bottom of the setup page).
'use client';

import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Button from '@/app/components/Button';
import PreviousAudits from '@/app/components/PreviousAudits';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

export default function AuditsHistoryPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <p className={`${microLabel} shrink-0 text-action`}>History</p>
              <span className="h-px w-24 bg-border" aria-hidden="true" />
            </div>
            <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">Your audits.</h1>
            <p className="max-w-2xl leading-relaxed text-text-muted">
              Every audit you&rsquo;ve run, most recent first. Open any one to read its report,
              export the data, or share it.
            </p>
          </div>
          <Button href="/audit" size="lg" className="shrink-0">
            New audit
            <span aria-hidden="true">&rarr;</span>
          </Button>
        </div>

        <PreviousAudits heading="All audits" className="" />
      </main>

      <Footer />
    </div>
  );
}
