// src/app/page.js - Simplified & Clean Homepage
'use client';

import { useState } from 'react';
import Link from 'next/link';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function HomePage() {
  const [recentJobs, setRecentJobs] = useState([]);

  const handleJobStarted = (jobResult) => {
    console.log('New job started:', jobResult);
    // Could add the new job to recent jobs list in the future
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <Header />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-indigo-900 mb-6">
              Find Every Broken Link on Your Website
            </h1>
            <p className="text-xl text-indigo-700 max-w-3xl mx-auto mb-8">
              Automatically scan your website for broken links and get detailed reports. Supports
              both small sites and large websites with 1000+ pages.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link
                href="/analyze"
                className="bg-indigo-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center text-lg"
              >
                🔍 Smart Analyzer (Recommended)
              </Link>
              <div className="text-indigo-600 font-medium px-4 py-2 text-sm self-center">
                or use the basic checker below
              </div>
            </div>

            {/* Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="bg-white/50 rounded-lg p-4">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-medium text-indigo-900">Lightning Fast</div>
                <div className="text-sm text-indigo-700">
                  Concurrent processing for quick results
                </div>
              </div>
              <div className="bg-white/50 rounded-lg p-4">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-medium text-indigo-900">Smart Analysis</div>
                <div className="text-sm text-indigo-700">Analyzes URL structure first</div>
              </div>
              <div className="bg-white/50 rounded-lg p-4">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-medium text-indigo-900">Detailed Reports</div>
                <div className="text-sm text-indigo-700">Complete breakdown with context</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Link Checker</h2>
                <p className="text-gray-600">
                  Enter a URL to start checking for broken links. For large sites or advanced
                  analysis, try our{' '}
                  <Link
                    href="/analyze"
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Smart Analyzer
                  </Link>{' '}
                  instead.
                </p>
              </div>

              <LargeCrawlForm onJobStarted={handleJobStarted} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Quick Features */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">✅ What We Check</h3>
              <ul className="space-y-2 text-sm text-indigo-700">
                <li>• Internal pages & links</li>
                <li>• External links (optional)</li>
                <li>• Images & resources</li>
                <li>• HTTP status codes</li>
                <li>• Detailed error classification</li>
              </ul>
            </div>

            {/* Performance Info */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">
                ⚡ Expected Performance
              </h3>
              <div className="space-y-2 text-xs text-indigo-700">
                <div className="flex justify-between">
                  <span>Small sites:</span>
                  <span className="font-medium">2-10 min</span>
                </div>
                <div className="flex justify-between">
                  <span>Medium sites:</span>
                  <span className="font-medium">10-30 min</span>
                </div>
                <div className="flex justify-between">
                  <span>Large sites:</span>
                  <span className="font-medium">30-90 min</span>
                </div>
                <div className="flex justify-between border-t border-indigo-100 pt-2">
                  <span>1000+ pages:</span>
                  <span className="font-bold text-indigo-600">Use Smart Analyzer</span>
                </div>
              </div>
            </div>

            {/* Smart Analyzer Promo */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm p-4 text-white mb-6">
              <h3 className="text-sm font-semibold mb-2">🚀 Try Smart Analyzer</h3>
              <p className="text-xs mb-3 opacity-90">
                Analyze URL structure first, then run focused checks. Perfect for large sites!
              </p>
              <Link
                href="/analyze"
                className="bg-white text-indigo-600 px-3 py-2 rounded text-xs font-medium hover:bg-indigo-50 transition-colors block text-center"
              >
                Start Smart Analysis →
              </Link>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">💡 Pro Tips</h3>
              <ul className="space-y-1 text-xs text-indigo-700">
                <li>• Start with depth 2-3 for faster results</li>
                <li>• Use Smart Analyzer for sites with 100+ pages</li>
                <li>• Large site mode handles 1000+ pages automatically</li>
                <li>• Check external links for complete audits</li>
                <li>• Results include source page context</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Approach</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We offer two ways to check your links. Pick the one that fits your needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Checker */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">🔗</div>
                <h3 className="text-xl font-bold text-gray-900">Basic Checker</h3>
                <p className="text-gray-600 text-sm">Simple and direct</p>
              </div>
              <ul className="space-y-2 text-sm text-gray-700 mb-6">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Direct URL scanning
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Best for small-medium sites
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Quick setup
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Real-time progress
                </li>
              </ul>
              <div className="text-center">
                <div className="text-sm text-gray-500">Available above ↑</div>
              </div>
            </div>

            {/* Smart Analyzer */}
            <div className="border-2 border-indigo-500 rounded-lg p-6 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Recommended
                </span>
              </div>
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">🔍</div>
                <h3 className="text-xl font-bold text-gray-900">Smart Analyzer</h3>
                <p className="text-gray-600 text-sm">Intelligent and efficient</p>
              </div>
              <ul className="space-y-2 text-sm text-gray-700 mb-6">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  URL structure analysis first
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Perfect for large sites (1000+ pages)
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Focused, intelligent crawling
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Filters out junk URLs
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Unified workflow
                </li>
              </ul>
              <div className="text-center">
                <Link
                  href="/analyze"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Try Smart Analyzer →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
