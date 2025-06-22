'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, GitBranch, Bug, Zap, Plus, Star, AlertCircle, Shield } from 'lucide-react';

const Changelog = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Real development journey based on actual git history
  const changelogData = [
    {
      version: '0.1.0',
      date: '2025-06-01', // Initial commit period
      type: 'major',
      title: 'Project Genesis - Foundation',
      description: 'Initial Next.js project setup and basic infrastructure',
      changes: [
        {
          type: 'feature',
          description: 'Next.js project initialization with Create Next App',
        },
        {
          type: 'feature',
          description: 'Basic project structure and folder organization',
        },
        {
          type: 'feature',
          description: 'Initial URL analyzer implementation',
        },
        {
          type: 'feature',
          description: 'Core crawling engine foundation',
        },
      ],
      commits: [
        {
          hash: 'a6175d1',
          message: 'Initial commit from Create Next App',
          author: 'Abhishek J',
        },
        { hash: '63c8b70', message: 'Added missing folders', author: 'Abhishek J' },
        { hash: 'c51681d', message: 'Fixes for URL analyzer', author: 'Abhishek J' },
      ],
    },
    {
      version: '0.2.0',
      date: '2025-06-05',
      type: 'minor',
      title: 'Core Functionality & UI Development',
      description: 'Basic broken link checking functionality and user interface',
      changes: [
        {
          type: 'feature',
          description: 'Working broken link detection system',
        },
        {
          type: 'feature',
          description: 'Results page with detailed link analysis',
        },
        {
          type: 'feature',
          description: 'Live crawl status tracking',
        },
        {
          type: 'improvement',
          description: 'Enhanced URL analyzer with better data flow',
        },
        {
          type: 'fix',
          description: 'Fixed crawl job startup issues',
        },
      ],
      commits: [
        { hash: '13938ee', message: 'Fixes for UI', author: 'Abhishek J' },
        { hash: '51c3b47', message: 'Failed to start crawl job fix', author: 'Abhishek J' },
        {
          hash: 'afe874e',
          message: 'Changes to UI - homepage and data back from URLAnalyzer',
          author: 'Abhishek J',
        },
        {
          hash: '1554aa2',
          message: 'Added live crawl status on analyze page',
          author: 'Abhishek J',
        },
      ],
    },
    {
      version: '0.3.0',
      date: '2025-06-08',
      type: 'minor',
      title: 'Enhanced Results & Data Visualization',
      description: 'Improved results display with detailed breakdown and status information',
      changes: [
        {
          type: 'feature',
          description: 'Detailed results page with HTTP status codes',
        },
        {
          type: 'feature',
          description: 'Broken link summary and statistics',
        },
        {
          type: 'feature',
          description: 'Enhanced card-based UI for results display',
        },
        {
          type: 'improvement',
          description: 'Better source URL tracking and display',
        },
        {
          type: 'improvement',
          description: 'Working HTTP status integration',
        },
      ],
      commits: [
        { hash: '180f1a5', message: 'Finally a working version', author: 'Abhishek J' },
        {
          hash: '262309c',
          message: 'Added detail view in results page',
          author: 'Abhishek J',
        },
        {
          hash: '8c64296',
          message: 'Added HTTP response status in results page',
          author: 'Abhishek J',
        },
        { hash: '70d068f', message: 'Fixed broken link summary', author: 'Abhishek J' },
      ],
    },
    {
      version: '0.4.0',
      date: '2025-06-10',
      type: 'minor',
      title: 'Traditional Crawl & UI Enhancements',
      description: 'Implementation of traditional crawl mode and major UI improvements',
      changes: [
        {
          type: 'feature',
          description: 'Traditional crawl mode implementation',
        },
        {
          type: 'feature',
          description: 'Enhanced filtering system for results',
        },
        {
          type: 'feature',
          description: 'Improved card-based results display',
        },
        {
          type: 'improvement',
          description: 'Better large crawl form interface',
        },
        {
          type: 'fix',
          description: 'Various UI fixes and performance improvements',
        },
      ],
      commits: [
        { hash: '45edba8', message: 'Traditional crawl fix - homepage', author: 'Abhishek J' },
        {
          hash: '846ced5',
          message: 'Remove largecrawlmode checkbox and its functions',
          author: 'Abhishek J',
        },
        {
          hash: '761aa9d',
          message: 'UI changes again to results page/table - added better card UI',
          author: 'Abhishek J',
        },
        {
          hash: '2adeed6',
          message: 'Final UI card changes to results page',
          author: 'Abhishek J',
        },
      ],
    },
    {
      version: '0.5.0',
      date: '2025-06-12',
      type: 'minor',
      title: 'Security & Production Hardening',
      description: 'Comprehensive security updates and production-ready features',
      changes: [
        {
          type: 'security',
          description: 'Enhanced input validation with Zod schema validation',
        },
        {
          type: 'security',
          description: 'CSRF protection implementation',
        },
        {
          type: 'security',
          description: 'Advanced rate limiting system',
        },
        {
          type: 'security',
          description: 'Security event logging and monitoring',
        },
        {
          type: 'feature',
          description: 'Production robots.txt and database cleanup automation',
        },
      ],
      commits: [
        { hash: 'f49a15d', message: 'Security updates integrated', author: 'Abhishek J' },
        {
          hash: '8837469',
          message: 'Installed zod, added input validation using zod',
          author: 'Abhishek J',
        },
        { hash: '95ef9c3', message: 'Upgraded rate limit', author: 'Abhishek J' },
        { hash: 'bcddc8d', message: 'Add production robots.txt', author: 'Abhishek J' },
      ],
    },
    {
      version: '0.6.0',
      date: '2025-06-14',
      type: 'minor',
      title: 'Smart Analyzer & Advanced Features',
      description:
        'Implementation of intelligent content analysis and enhanced crawling capabilities',
      changes: [
        {
          type: 'feature',
          description: 'Smart analyzer with content page classification',
        },
        {
          type: 'feature',
          description: 'Enhanced internal/external link detection',
        },
        {
          type: 'feature',
          description: 'Stop crawl functionality for better control',
        },
        {
          type: 'feature',
          description: 'Live log entries and improved UI feedback',
        },
        {
          type: 'improvement',
          description: 'Better duplicate detection and handling',
        },
      ],
      commits: [
        {
          hash: 'af85b3f',
          message: 'Increased Crawl Limit, Content Page Classification Added',
          author: 'Abhishek J',
        },
        {
          hash: 'fa0d786',
          message: 'Updated better internal/external link detection',
          author: 'Abhishek J',
        },
        {
          hash: 'e2d0653',
          message: 'Added stop crawl button for crawls',
          author: 'Abhishek J',
        },
        {
          hash: 'e1901de',
          message: 'Counting duplicates ui - component - urlanalyzer',
          author: 'Abhishek J',
        },
      ],
    },
    {
      version: '0.7.0',
      date: '2025-06-16',
      type: 'minor',
      title: 'SEO Integration & Analysis',
      description: 'Comprehensive SEO analysis capabilities integrated into the platform',
      changes: [
        {
          type: 'feature',
          description: 'Complete SEO analysis integration with scoring',
        },
        {
          type: 'feature',
          description: 'SEO database schema and data management',
        },
        {
          type: 'feature',
          description: 'SEO summary API and reporting',
        },
        {
          type: 'feature',
          description: 'Enhanced export functionality with SEO data',
        },
        {
          type: 'improvement',
          description: 'Results table with SEO insights display',
        },
      ],
      commits: [
        {
          hash: '7bbdf3c',
          message: 'SEO Integration - new lib file - seodetector',
          author: 'Abhishek J',
        },
        {
          hash: '75e2d38',
          message: 'SEO integration - phase 2 component updates',
          author: 'Abhishek J',
        },
        {
          hash: 'eb8ee1c',
          message: 'SEO Integration Phase 3 - added new api seo summary route',
          author: 'Abhishek J',
        },
        {
          hash: '794472f',
          message: 'Added enable seo in crawlsettingschema',
          author: 'Abhishek J',
        },
      ],
    },
    {
      version: '0.8.0',
      date: '2025-06-18',
      type: 'minor',
      title: 'UI Revamp & Performance Optimization',
      description: 'Major UI overhaul with enhanced user experience and performance improvements',
      changes: [
        {
          type: 'improvement',
          description: 'Complete results table redesign with Lucide React icons',
        },
        {
          type: 'improvement',
          description: 'Enhanced database query optimization',
        },
        {
          type: 'improvement',
          description: 'Better SEO results integration and display',
        },
        {
          type: 'fix',
          description: 'Fixed database joins and manual mapping issues',
        },
        {
          type: 'feature',
          description: 'Dynamic crawl mode detection and UI adaptation',
        },
      ],
      commits: [
        {
          hash: '13f0cdc',
          message: 'UI Update - revamped Results table - added lucide-react library',
          author: 'Abhishek J',
        },
        {
          hash: 'dad9ed6',
          message: 'Fixes - SEO api/UI - used manually mapping instead of database joins',
          author: 'Abhishek J',
        },
        {
          hash: '753d48e',
          message: 'Crawl fix + UI updates - Fixed traditional crawl',
          author: 'Abhishek J',
        },
      ],
    },
    {
      version: '0.9.0',
      date: '2025-06-20',
      type: 'minor',
      title: 'AI-Powered Revamp & Component Architecture',
      description: 'Complete AI-assisted redesign with modular component architecture',
      changes: [
        {
          type: 'feature',
          description: 'Full AI-powered UI redesign and optimization',
        },
        {
          type: 'improvement',
          description: 'Modular component architecture implementation',
        },
        {
          type: 'improvement',
          description: 'Enhanced SEO score sorting and filtering',
        },
        {
          type: 'fix',
          description: 'SEO summary folder path corrections',
        },
        {
          type: 'fix',
          description: 'Export documentation and sorting improvements',
        },
      ],
      commits: [
        {
          hash: '8d13b37',
          message: 'Full AI Revamp (Only) - divided homepage into component chunks',
          author: 'Abhishek J',
        },
        {
          hash: '3e20c72',
          message: 'UI fixes, export docs fixes, seo score sorting fixed(partial)',
          author: 'Abhishek J',
        },
        { hash: 'e0e3d2e', message: 'Fixed sorting', author: 'Abhishek J' },
      ],
    },
  ];

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'improvement':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'fix':
        return <Bug className="w-4 h-4 text-red-500" />;
      case 'security':
        return <Shield className="w-4 h-4 text-orange-500" />;
      default:
        return <Star className="w-4 h-4 text-gray-500" />;
    }
  };

  const getVersionTypeColor = (type) => {
    switch (type) {
      case 'major':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'minor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'patch':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredData =
    selectedFilter === 'all'
      ? changelogData
      : changelogData.filter((release) =>
          release.changes.some((change) => change.type === selectedFilter)
        );

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Changelog</h1>
        <p className="text-gray-600">
          Track the evolution of Broken Link Checker - From MVP to AI-Powered Platform
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        {['all', 'feature', 'improvement', 'fix', 'security'].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === filter
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {filteredData.map((release, index) => (
          <div key={release.version} className="relative mb-12">
            {/* Timeline dot */}
            <div className="absolute left-6 w-4 h-4 bg-indigo-600 rounded-full border-4 border-white shadow"></div>

            {/* Content */}
            <div className="ml-16">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${getVersionTypeColor(
                          release.type
                        )}`}
                      >
                        v{release.version}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">{release.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(release.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  {release.description && (
                    <p className="mt-2 text-gray-600">{release.description}</p>
                  )}
                </div>

                {/* Changes */}
                <div className="px-6 py-4">
                  <h4 className="font-medium text-gray-900 mb-3">Changes:</h4>
                  <ul className="space-y-2">
                    {release.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="flex items-start gap-3">
                        {getTypeIcon(change.type)}
                        <span className="text-gray-700">{change.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Commits */}
                {release.commits && release.commits.length > 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <details className="cursor-pointer">
                      <summary className="font-medium text-gray-900 flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        View Commits ({release.commits.length})
                      </summary>
                      <div className="mt-3 space-y-2">
                        {release.commits.map((commit, commitIndex) => (
                          <div key={commitIndex} className="flex items-start gap-3 text-sm">
                            <code className="bg-gray-400 px-2 py-1 rounded text-xs font-mono">
                              {commit.hash}
                            </code>
                            <div>
                              <div className="text-gray-700">{commit.message}</div>
                              <div className="text-gray-500">by {commit.author}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Development Stats */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-indigo-900 mb-4">Development Journey Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-indigo-600">20+</div>
            <div className="text-sm text-indigo-700">Days Development</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">85+</div>
            <div className="text-sm text-indigo-700">Total Commits</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">9</div>
            <div className="text-sm text-indigo-700">Major Releases</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">100%</div>
            <div className="text-sm text-indigo-700">Functional</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {/* <div className="text-center text-gray-500 text-sm mt-12">
        <p>Built with ❤️ by Abhishek J | Made with Claude.ai</p>
        <p className="mt-1">
          <a
            href="https://github.com/Abhishek-J-Sudo/broken-link-generator"
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View on GitHub →
          </a>
        </p>
      </div> */}
    </div>
  );
};

export default Changelog;
