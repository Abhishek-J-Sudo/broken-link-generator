// src/app/results/[jobId]/page.js - Enhanced version with card UI + modern features
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ResultsTable from '@/app/components/ResultsTable';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { jobId } = params;

  const [job, setJob] = useState(null);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    statusFilter: 'all',
    statusCode: '',
    errorType: 'all',
    search: '',
  });
  const [isExporting, setIsExporting] = useState(false);

  // Card-based view state
  const [selectedView, setSelectedView] = useState('broken');
  const [allLinksData, setAllLinksData] = useState(null);
  const [workingLinksData, setWorkingLinksData] = useState(null);
  const [pagesData, setPagesData] = useState(null);

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/crawl/status/${jobId}`);
        const statusData = await response.json();

        if (response.ok) {
          setJob(statusData);

          // If job is completed, load initial results
          if (statusData.status === 'completed') {
            await loadResults();
          }
        } else {
          console.error('Status fetch error:', statusData);
          setError(statusData.error || 'Failed to get job status');
        }
      } catch (err) {
        console.error('Status poll error:', err);
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

  const loadResults = async (page = 1, filterOptions = filters, view = selectedView) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      // Apply modern filtering based on view type
      if (view === 'working') {
        params.append('statusFilter', 'working');
      } else if (view === 'broken') {
        params.append('statusFilter', 'broken');
      } else if (view === 'all') {
        params.append('statusFilter', 'all');
      }

      // Add filter parameters
      if (filterOptions.statusCode) {
        params.append('statusCode', filterOptions.statusCode);
      }

      if (filterOptions.errorType && filterOptions.errorType !== 'all') {
        params.append('errorType', filterOptions.errorType);
      }

      if (filterOptions.search) {
        params.append('search', filterOptions.search);
      }

      console.log(`Loading results for job ${jobId} with params:`, params.toString());

      const response = await fetch(`/api/results/${jobId}?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Results fetch error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load results`);
      }

      const data = await response.json();
      console.log('Results loaded:', data);

      // Store data based on view type
      switch (view) {
        case 'all':
          setAllLinksData(data);
          break;
        case 'working':
          setWorkingLinksData(data);
          break;
        case 'pages':
          setPagesData(data);
          break;
        default: // 'broken'
          setResults(data);
      }

      setCurrentPage(page);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Load results error:', err);
      setError(err.message || 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = async (viewType) => {
    if (selectedView === viewType) return; // Already selected

    setSelectedView(viewType);
    setIsLoading(true);

    // Check if we already have this data
    const existingData = {
      broken: results,
      all: allLinksData,
      working: workingLinksData,
      pages: pagesData,
    }[viewType];

    if (!existingData) {
      await loadResults(1, filters, viewType);
    } else {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadResults(newPage, filters, selectedView);
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    loadResults(1, newFilters, selectedView);
  };

  const exportToCSV = async () => {
    const currentData = getCurrentData();
    if (!currentData || !currentData.links) return;

    setIsExporting(true);
    try {
      // Get ALL results for export (not just current page)
      const exportParams = new URLSearchParams({
        page: '1',
        limit: '10000', // Large number to get all results
      });

      // Apply current view and filters to export
      if (selectedView === 'working') {
        exportParams.append('statusFilter', 'working');
      } else if (selectedView === 'broken') {
        exportParams.append('statusFilter', 'broken');
      } else if (selectedView === 'all') {
        exportParams.append('statusFilter', 'all');
      }

      if (filters.statusCode) {
        exportParams.append('statusCode', filters.statusCode);
      }

      if (filters.errorType && filters.errorType !== 'all') {
        exportParams.append('errorType', filters.errorType);
      }

      if (filters.search) {
        exportParams.append('search', filters.search);
      }

      const response = await fetch(`/api/results/${jobId}?${exportParams}`);
      const allData = await response.json();

      if (response.ok) {
        // Create CSV content with enhanced HTTP status information
        const csvHeaders = [
          'URL',
          'Status',
          'HTTP Code',
          'Response Time (ms)',
          'Is Working',
          'Error Type',
          'Source Page',
          'Link Text',
          'Internal/External',
          'Depth',
          'Checked At',
          'Error Message',
        ];

        const csvRows = allData.links.map((link) => [
          link.url,
          link.status_label || 'Unknown',
          link.http_status_code || 'N/A',
          link.response_time || 'N/A',
          link.is_working ? 'Yes' : 'No',
          link.error_type || 'N/A',
          link.source_url || 'Discovery',
          link.link_text || 'No text',
          link.is_internal ? 'Internal' : 'External',
          link.depth || 0,
          link.checked_at ? new Date(link.checked_at).toLocaleString() : 'N/A',
          link.error_message || 'N/A',
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map((row) =>
            row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')
          ),
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute(
            'download',
            `${selectedView}-links-${new URL(job.url).hostname}-${
              new Date().toISOString().split('T')[0]
            }.csv`
          );
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        throw new Error('Failed to fetch all results for export');
      }
    } catch (err) {
      setError('Failed to export data');
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = async () => {
    const currentData = getCurrentData();
    if (!currentData) return;

    setIsExporting(true);
    try {
      // Get ALL results for export
      const exportParams = new URLSearchParams({
        page: '1',
        limit: '10000',
      });

      // Apply current view and filters
      if (selectedView === 'working') {
        exportParams.append('statusFilter', 'working');
      } else if (selectedView === 'broken') {
        exportParams.append('statusFilter', 'broken');
      } else if (selectedView === 'all') {
        exportParams.append('statusFilter', 'all');
      }

      if (filters.statusCode) {
        exportParams.append('statusCode', filters.statusCode);
      }

      if (filters.errorType && filters.errorType !== 'all') {
        exportParams.append('errorType', filters.errorType);
      }

      if (filters.search) {
        exportParams.append('search', filters.search);
      }

      const response = await fetch(`/api/results/${jobId}?${exportParams}`);
      const allData = await response.json();

      if (response.ok) {
        // Create comprehensive JSON export with HTTP status data
        const exportData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            website: job.url,
            jobId: jobId,
            view: selectedView,
            totalLinksExported: allData.summary?.totalLinksChecked || 0,
            appliedFilters: filters,
          },
          jobDetails: {
            url: job.url,
            status: job.status,
            createdAt: job.timestamps?.createdAt,
            completedAt: job.timestamps?.completedAt,
            duration: job.timestamps?.elapsedTime,
            settings: job.settings,
          },
          statistics: {
            totalLinksChecked: allData.summary?.totalLinksChecked || 0,
            workingLinks: allData.summary?.workingLinks || 0,
            brokenLinks: allData.summary?.brokenLinks || 0,
            successRate: allData.summary?.successRate || 0,
            performance: allData.summary?.performance || {},
            statusCodes: allData.summary?.statusCodes || {},
            errorTypes: allData.summary?.errorTypes || {},
          },
          links: allData.links.map((link) => ({
            url: link.url,
            httpStatusCode: link.http_status_code,
            responseTime: link.response_time,
            isWorking: link.is_working,
            statusLabel: link.status_label,
            errorMessage: link.error_message,
            sourceUrl: link.source_url,
            linkText: link.link_text,
            errorType: link.error_type,
            isInternal: link.is_internal,
            depth: link.depth,
            checkedAt: link.checked_at,
          })),
          summary: allData.summary,
        };

        // Download JSON file
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `${selectedView}-links-report-${new URL(job.url).hostname}-${
            new Date().toISOString().split('T')[0]
          }.json`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to fetch all results for export');
      }
    } catch (err) {
      setError('Failed to export JSON data');
      console.error('JSON export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const getCurrentData = () => {
    return {
      broken: results,
      all: allLinksData,
      working: workingLinksData,
      pages: pagesData,
    }[selectedView];
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError('');
                setIsLoading(true);
                loadResults();
              }}
              className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="block w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Back to Home
            </button>
          </div>
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
      <Header />
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Link Check Results</h1>
              <p className="text-gray-600 break-all">{job?.url}</p>
              <div
                onClick={() => router.push('/')}
                className="block w-full text-gray-500 p-2 cursor-pointer py-2 rounded-md hover:bg-indigo-200"
              >
                ⬅ Back to Home
              </div>
            </div>

            {/* Status Badge & Export Actions */}
            <div className="text-right">
              <div className="flex items-center space-x-3 mb-2">
                {/* Export Buttons - only show when completed */}
                {job?.status === 'completed' && getCurrentData() && (
                  <div className="flex space-x-2">
                    <button
                      onClick={exportToCSV}
                      disabled={isExporting}
                      className={`px-3 py-1 text-sm rounded-md ${
                        isExporting
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isExporting ? '⏳' : '📊'} Export CSV
                    </button>
                    <button
                      onClick={exportToJSON}
                      disabled={isExporting}
                      className={`px-3 py-1 text-sm rounded-md ${
                        isExporting
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isExporting ? '⏳' : '📁'} Export JSON
                    </button>
                  </div>
                )}

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
              </div>
              {job?.timestamps?.elapsedTime && (
                <p className="text-sm text-gray-500">
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

        {/* Enhanced Stats Cards with Modern Data */}
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <button
              onClick={() => handleCardClick('all')}
              className={`bg-white rounded-lg shadow-lg p-6 text-center transition-all hover:shadow-xl hover:scale-105 ${
                selectedView === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {job.stats?.totalLinksDiscovered || 0}
              </div>
              <div className="text-sm text-gray-600">All Links</div>
              {selectedView === 'all' && <div className="text-xs text-blue-600 mt-1">● Active</div>}
            </button>

            <button
              onClick={() => handleCardClick('working')}
              className={`bg-white rounded-lg shadow-lg p-6 text-center transition-all hover:shadow-xl hover:scale-105 ${
                selectedView === 'working' ? 'ring-2 ring-green-500 bg-green-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-green-600 mb-2">
                {(job.stats?.totalLinksDiscovered || 0) - (job.stats?.brokenLinksFound || 0)}
              </div>
              <div className="text-sm text-gray-600">Working Links</div>
              {selectedView === 'working' && (
                <div className="text-xs text-green-600 mt-1">● Active</div>
              )}
            </button>

            <button
              onClick={() => handleCardClick('broken')}
              className={`bg-white rounded-lg shadow-lg p-6 text-center transition-all hover:shadow-xl hover:scale-105 ${
                selectedView === 'broken' ? 'ring-2 ring-red-500 bg-red-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-red-600 mb-2">
                {job.stats?.brokenLinksFound || 0}
              </div>
              <div className="text-sm text-gray-600">Broken Links</div>
              {selectedView === 'broken' && (
                <div className="text-xs text-red-600 mt-1">● Active</div>
              )}
            </button>

            <button
              onClick={() => handleCardClick('pages')}
              className={`bg-white rounded-lg shadow-lg p-6 text-center transition-all hover:shadow-xl hover:scale-105 ${
                selectedView === 'pages' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {job.progress?.current || 0}
              </div>
              <div className="text-sm text-gray-600">Pages Scanned</div>
              {selectedView === 'pages' && (
                <div className="text-xs text-purple-600 mt-1">● Active</div>
              )}
            </button>
          </div>
        )}

        {/* Export Success Message */}
        {isExporting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-blue-800">Preparing export file...</span>
            </div>
          </div>
        )}

        {/* Enhanced Results Table with HTTP Status Support */}
        {job?.status === 'completed' &&
          (() => {
            const currentData = getCurrentData();

            return currentData ? (
              <ResultsTable
                jobId={jobId}
                links={currentData.links}
                pagination={currentData.pagination}
                onPageChange={handlePageChange}
                onFilter={handleFilter}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="animate-pulse">
                  <div className="text-4xl mb-4">🔄</div>
                  <p className="text-gray-600">Loading {selectedView} data...</p>
                </div>
              </div>
            );
          })()}

        {/* Completed - Show results summary for broken links view */}
        {job?.status === 'completed' &&
          results &&
          selectedView === 'broken' &&
          (results.links || []).length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center mb-6">
              <svg
                className="w-16 h-16 text-green-500 mx-auto mb-4"
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                🎉 Excellent! No Broken Links Found
              </h3>
              <p className="text-gray-600 mb-4">
                All {job.stats?.totalLinksDiscovered || 0} links on your website are working
                perfectly.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={exportToJSON}
                  disabled={isExporting}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  📁 Export Report
                </button>
                <button
                  onClick={() => router.push('/analyze')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  🔍 Analyze Another Site
                </button>
              </div>
            </div>
          )}

        {/* Pending/Running State */}
        {job?.status === 'running' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Scanning Your Website</h3>
              <p className="text-gray-600">
                We're checking each link for broken status and measuring response times. This page
                will update automatically when complete.
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
              onClick={() => router.push('/analyze')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
