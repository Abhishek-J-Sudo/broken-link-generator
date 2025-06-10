'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';

export default function HomePage() {
  const [recentJobs, setRecentJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isFromAnalyzer, setIsFromAnalyzer] = useState(false);
  const [analyzedData, setAnalyzedData] = useState(null);

  // Load recent jobs and check for analyzer data on component mount
  useEffect(() => {
    loadRecentJobs();
    checkForAnalyzerData();
  }, []);

  const loadRecentJobs = async () => {
    try {
      // For now, we'll skip recent jobs since we don't have that API endpoint yet
      // You could add this later by creating an endpoint that gets recent jobs from the database
      setRecentJobs([]);
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const checkForAnalyzerData = () => {
    try {
      // Check if we're coming from the analyzer
      const urlParams = new URLSearchParams(window.location.search);
      const fromAnalyzer = urlParams.get('source') === 'analyzer';
      const analyzerDataKey = urlParams.get('key');

      if (fromAnalyzer && analyzerDataKey) {
        const storedData = sessionStorage.getItem(`analyzer_${analyzerDataKey}`);
        if (storedData) {
          const data = JSON.parse(storedData);
          setAnalyzedData(data);
          setIsFromAnalyzer(true);
          console.log('🎯 Loaded analyzer data:', data);
        }
      }
    } catch (error) {
      console.error('Error loading analyzer data:', error);
    }
  };

  const handleJobStarted = (jobResult) => {
    console.log('New job started:', jobResult);
    // Could add the new job to recent jobs list
    // setRecentJobs(prev => [jobResult, ...prev.slice(0, 4)]);
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-indigo-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">🔗 Broken Link Checker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/analyze"
                className="text-indigo-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                🔍 URL Analyzer
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

      {/* Show analyzer integration message */}
      {isFromAnalyzer && analyzedData && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-white mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-white">🎯 Analysis Complete!</h2>
              </div>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  <strong>Using analyzed data from URL Analyzer:</strong>
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong>{analyzedData.discoveredUrls?.length || 0} URLs</strong> ready for
                    checking
                  </li>
                  <li>
                    Focus:{' '}
                    <strong>
                      {analyzedData.focusType === 'content' ? 'Content Pages Only' : 'All URLs'}
                    </strong>
                  </li>
                  <li>
                    Categories:{' '}
                    {Object.entries(analyzedData.categories || {})
                      .filter(([, count]) => count > 0)
                      .map(([cat, count]) => `${count} ${cat}`)
                      .join(', ')}
                  </li>
                </ul>

                {analyzedData.recommendations && analyzedData.recommendations.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium">Analyzer Recommendations:</p>
                    <ul className="list-disc list-inside mt-1">
                      {analyzedData.recommendations.slice(0, 2).map((rec, i) => (
                        <li key={i}>{rec.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Simplified like first iteration */}
      <div
        className={`${isFromAnalyzer ? 'bg-white' : 'bg-gradient-to-br from-indigo-50 to-white'}`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-900 mb-4">
              {isFromAnalyzer ? 'Smart Broken Link Checking' : 'Find Broken Links on Your Website'}
            </h1>
            <p className="text-lg text-indigo-700 max-w-2xl mx-auto">
              {isFromAnalyzer
                ? 'Your website has been analyzed. Choose how you want to check for broken links.'
                : 'Automatically scan your website for broken links and get detailed reports. Supports both small sites and large websites with 1000+ pages.'}
            </p>
          </div>

          {/* Action Buttons */}
          {!isFromAnalyzer && (
            <div className="flex justify-center space-x-4 mb-8">
              <Link
                href="/analyze"
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center"
              >
                🔍 Analyze URL Structure First
              </Link>
              <button className="bg-indigo-100 text-indigo-700 px-6 py-3 rounded-lg font-medium hover:bg-indigo-200 transition-colors">
                📖 View Documentation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Form - Takes most space like first iteration */}
          <div className="lg:col-span-3">
            <LargeCrawlForm
              onJobStarted={handleJobStarted}
              analyzedData={analyzedData}
              isFromAnalyzer={isFromAnalyzer}
            />
          </div>

          {/* Sidebar - Condensed */}
          <div className="lg:col-span-1">
            {/* Quick Features */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">✅ What We Check</h3>
              <ul className="space-y-2 text-sm text-indigo-700">
                <li>• Internal pages & links</li>
                <li>• External links (optional)</li>
                <li>• Images & resources</li>
                <li>• HTTP status codes</li>
              </ul>
            </div>

            {/* Performance Info */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">⚡ Performance</h3>
              <div className="space-y-2 text-xs text-indigo-700">
                <div>Small sites: 2-10 min</div>
                <div>Medium sites: 10-30 min</div>
                <div>Large sites: 30-90 min</div>
                <div className="text-indigo-600 font-medium">1300+ pages: ~60 min</div>
              </div>
            </div>

            {/* Recent Jobs */}
            {recentJobs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4">
                <h3 className="text-sm font-semibold text-indigo-900 mb-3">📋 Recent Scans</h3>
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{job.url}</p>
                          <p className="text-xs text-gray-500">{formatTimeAgo(job.created_at)}</p>
                        </div>
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      {job.status === 'completed' && (
                        <a
                          href={`/results/${job.id}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          View Results →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-4 mt-6">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3">💡 Pro Tips</h3>
              <ul className="space-y-1 text-xs text-indigo-700">
                <li>• Use URL Analyzer first for large sites</li>
                <li>• Start with depth 2-3 for faster results</li>
                <li>• Large site mode handles 1000+ pages</li>
                <li>
                  •{' '}
                  {isFromAnalyzer
                    ? 'Smart mode uses pre-analyzed data'
                    : 'Check external links for full audits'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards - Like first iteration but enhanced */}
      <div className="bg-indigo-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-indigo-900 text-center mb-8">
            Powerful Link Checking Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-6 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">Fast Scanning</h3>
              <p className="text-sm text-indigo-700">
                Concurrent processing checks multiple links simultaneously for quick results.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-6 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-3">🔍</div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">Smart Analysis</h3>
              <p className="text-sm text-indigo-700">
                URL structure analyzer helps optimize crawls for large websites.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-6 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-3">📊</div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">Detailed Reports</h3>
              <p className="text-sm text-indigo-700">
                Get comprehensive reports with error types, source pages, and link context.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-6 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-3">🔄</div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">Real-time Progress</h3>
              <p className="text-sm text-indigo-700">
                Watch your scan progress in real-time with live updates and status tracking.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-indigo-900 border-t border-indigo-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-indigo-300">Built with Next.js, Supabase, and Vercel</div>
            <div className="flex space-x-6">
              <Link href="/analyze" className="text-sm text-indigo-300 hover:text-white">
                URL Analyzer
              </Link>
              <a
                href="https://github.com/yourusername/broken-link-checker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-300 hover:text-white"
              >
                GitHub
              </a>
              <a href="#" className="text-sm text-indigo-300 hover:text-white">
                Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
