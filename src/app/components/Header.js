'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';
import Button from './Button';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/audits', label: 'My audits' },
    { href: '/documentation', label: 'Documentation' },
  ];

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/seo-scrub-app-logo-new.png"
              alt=""
              width={93}
              height={113}
              priority
              className="h-8 w-auto"
            />
            <span className="font-display text-2xl leading-none text-text">SeoScrub</span>
            <span className="hidden sm:inline-block border-l border-border pl-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-subtle">
              Site Audit
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-muted hover:text-text transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            <ThemeToggle />
            <Button href="/audit" size="sm">
              Start Audit
              <span aria-hidden="true">&rarr;</span>
            </Button>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-subtle transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-2 text-sm font-medium text-text-muted hover:text-text transition-colors duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                href="/audit"
                size="sm"
                className="mt-3 w-fit"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Start Audit
                <span aria-hidden="true">&rarr;</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
