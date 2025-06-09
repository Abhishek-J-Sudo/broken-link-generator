'use client';

import { useState, useEffect } from 'react';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';

export default function HomePage() {
  const [recentJobs, setRecentJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Load recent jobs on component mount
  useEffect(() => {
    loadRecentJobs();
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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Find & Fix Broken Links
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-8">
              Scan your website for broken links automatically. Get detailed reports and improve
              your site's SEO and user experience.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="/analyze"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                🔍 Analyze URL Structure First
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <LargeCrawlForm onJobStarted={handleJobStarted} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Features */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What We Check</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">All internal links and pages</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">External links (optional)</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">Images, stylesheets, and resources</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">HTTP status codes and errors</span>
                </li>
              </ul>
            </div>

            {/* Recent Jobs */}
            {recentJobs.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scans</h3>
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="border-b border-gray-200 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{job.url}</p>
                          <p className="text-xs text-gray-500">{formatTimeAgo(job.created_at)}</p>
                        </div>
                        <span
                          className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      {job.status === 'completed' && (
                        <a
                          href={`/results/${job.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          View Results →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats or Tips */}
            <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Pro Tips</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li>• Start with depth 2-3 for faster results</li>
                <li>• Check external links for comprehensive audits</li>
                <li>• Run scans regularly to catch new broken links</li>
                <li>• Focus on high-traffic pages first</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer/Additional Info */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast Scanning</h3>
            <p className="text-gray-600">
              Concurrent processing checks multiple links simultaneously for quick results.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Detailed Reports</h3>
            <p className="text-gray-600">
              Get comprehensive reports with error types, source pages, and link context.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">🔄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Progress</h3>
            <p className="text-gray-600">
              Watch your scan progress in real-time with live updates and status tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
