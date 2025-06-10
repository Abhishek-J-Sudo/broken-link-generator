// src/app/components/Header.js
'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <nav className="bg-indigo-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-white hover:text-indigo-200">
              🔗 Broken Link Checker
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/analyze"
              className="text-indigo-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              🔍 Smart Analyzer
            </Link>
            <a
              href="https://github.com/yourusername/broken-link-checker"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
