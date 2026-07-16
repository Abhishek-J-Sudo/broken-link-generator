import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import packageJson from '../../../package.json';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Colophon */}
          <div className="md:col-span-6">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/seo-scrub-app-logo-new.png"
                alt=""
                width={93}
                height={113}
                className="h-8 w-auto"
              />
              <span className="font-display text-2xl leading-none text-text">SeoScrub</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed max-w-sm">
              Site audits, link integrity and SEO health &mdash; crawled, prioritized, and written
              up like a report you&rsquo;d pay for.
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-3">
            <p className={`${microLabel} text-text-subtle mb-4`}>Product</p>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/analyze"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  Full Audit
                </Link>
              </li>
              <li>
                <Link
                  href="/#quick-check"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  Quick Check
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="md:col-span-3">
            <p className={`${microLabel} text-text-subtle mb-4`}>Resources</p>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/documentation"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com"
                  target="_blank"
                  className="text-text-muted hover:text-text transition-colors duration-200"
                >
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Meta row */}
        <div className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="font-mono text-xs text-text-subtle">
            &copy; {new Date().getFullYear()} SeoScrub &middot; v{packageJson.version}
          </p>
          <div className="flex items-center gap-4 font-mono text-xs">
            <Link
              href="/documentation"
              className="text-text-subtle hover:text-text transition-colors duration-200"
            >
              Documentation
            </Link>
            <Link
              href="/changelog"
              className="text-text-subtle hover:text-text transition-colors duration-200"
            >
              Changelog
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
