'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ResultsTable from '@/components/ResultsTable';

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { jobId } = params;

  const [job, setJob] = useState(null);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ errorType: 'all', search: '' });

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/crawl/status/${jobId}`);
        const statusData = await response.json();

        if (response.ok) {
          setJob(statusData);

          // If job is completed, load results
          if (statusData.status === 'completed') {
            await loadResults();
          }
        } else {
          setError(statusData.error || 'Failed to get job status');
        }
      } catch (err) {
        setError('Failed to connect to server');
      }
    };

    // Initial load
    pollStatus();

    // Set up polling interval for running jobs
    const interval = setInterval(() => {
      if (job?.status === 'running' || !job) {
        pollStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const loadResults = async (page = 1, filterOptions = filters) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (filterOptions.errorType && filterOptions.errorType !== 'all') {
        params.append('errorType', filterOptions.errorType);
      }

      if (filterOptions.search) {
        params.append('search', filterOptions.search);
      }

      const response = await fetch(`/api/results/${jobId}?${params}`);
      const data = await response.json();

      if (response.ok) {
        setResults(data);
        setCurrentPage(page);
      } else {
        setError(data.error || 'Failed to load results');
      }
    } catch (err) {
      setError('Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadResults(newPage, filters);
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    loadResults(1, newFilters); // Reset to page 1 when filtering
  };

  const getProgressPercentage = () => {
    if (!job?.progress) return 0;
    return job.progress.percentage || 0;
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 flex items-center"
              >
                ← Back to Home
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Link Check Results</h1>
              <p className="text-gray-600 break-all">{job?.url}</p>
            </div>

            {/* Status Badge */}
            <div className="text-right">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  job?.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : job?.status === 'running'
                    ? 'bg-blue-100 text-blue-800'
                    : job?.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {job?.status}
              </span>
              {job?.timestamps?.elapsedTime && (
                <p className="text-sm text-gray-500 mt-1">
                  {formatDuration(job.timestamps.elapsedTime)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Section */}
        {job?.status === 'running' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Scan in Progress</h2>
              <span className="text-sm text-gray-600">
                {job.progress?.current || 0} / {job.progress?.total || 0} links checked
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>

            <p className="text-sm text-gray-600">
              {getProgressPercentage()}% complete
              {job.progress?.estimatedTimeRemaining && (
                <>
                  {' '}
                  · About {Math.round(job.progress.estimatedTimeRemaining / 60)} minutes remaining
                </>
              )}
            </p>
          </div>
        )}

        {/* Stats Summary */}
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {job.stats?.totalLinksDiscovered || 0}
              </div>
              <div className="text-sm text-gray-600">Links Found</div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {(job.stats?.totalLinksDiscovered || 0) - (job.stats?.brokenLinksFound || 0)}
              </div>
              <div className="text-sm text-gray-600">Working Links</div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-2xl font-bold text-red-600 mb-2">
                {job.stats?.brokenLinksFound || 0}
              </div>
              <div className="text-sm text-gray-600">Broken Links</div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {job.progress?.current || 0}
              </div>
              <div className="text-sm text-gray-600">Pages Scanned</div>
            </div>
          </div>
        )}

        {/* Results Table */}
        {job?.status === 'completed' && results && (
          <ResultsTable
            jobId={jobId}
            brokenLinks={results.brokenLinks}
            pagination={results.pagination}
            onPageChange={handlePageChange}
            onFilter={handleFilter}
          />
        )}

        {/* Pending/Running State */}
        {job?.status === 'running' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Scanning Your Website</h3>
              <p className="text-gray-600">
                We're crawling through your pages and checking all links. This page will update
                automatically when complete.
              </p>
            </div>
          </div>
        )}

        {/* Failed State */}
        {job?.status === 'failed' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <svg
              className="w-16 h-16 text-red-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Scan Failed</h3>
            <p className="text-gray-600 mb-4">
              {job.errorMessage || 'The scan encountered an error and could not be completed.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
