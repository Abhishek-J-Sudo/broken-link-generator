'use client';

import { useState, useEffect, useMemo } from 'react';

export default function ResultsTable({
  jobId,
  brokenLinks, // OLD: backward compatibility
  links, // NEW: enhanced format with HTTP status
  selectedView, // NEW: to know which view is active
  pagination,
  onPageChange,
  onFilter,
}) {
  // ENHANCED: Support both old (brokenLinks) and new (links) data structures
  const displayData = links || brokenLinks || [];
  const isNewFormat = !!links; // New format has 'links' prop, old format has 'brokenLinks'
  const [sortDirection, setSortDirection] = useState(null); // null, 'asc', 'desc'

  const [currentFilter, setCurrentFilter] = useState(
    isNewFormat
      ? {
          statusFilter: 'all', // 'all', 'working', 'broken'
          statusCode: '',
          errorType: 'all',
          search: '',
        }
      : {
          errorType: 'all',
          search: '',
        }
  );

  const statusCategoryColors = {
    success: 'bg-green-100 text-green-800',
    redirect: 'bg-blue-100 text-blue-800',
    client_error: 'bg-red-100 text-red-800',
    server_error: 'bg-orange-100 text-orange-800',
    error: 'bg-gray-100 text-gray-800',
    broken: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const errorTypeColors = {
    404: 'bg-red-100 text-red-800',
    500: 'bg-orange-100 text-orange-800',
    403: 'bg-yellow-100 text-yellow-800',
    401: 'bg-purple-100 text-purple-800',
    timeout: 'bg-blue-100 text-blue-800',
    dns_error: 'bg-gray-100 text-gray-800',
    connection_error: 'bg-pink-100 text-pink-800',
    ssl_error: 'bg-amber-100 text-amber-800',
    invalid_url: 'bg-indigo-100 text-indigo-800',
    other: 'bg-gray-100 text-gray-800',
    security_blocked: 'bg-purple-100 text-purple-800',
    robots_blocked: 'bg-orange-100 text-orange-800',
  };

  const errorTypeLabels = {
    404: 'Not Found',
    500: 'Server Error',
    403: 'Forbidden',
    401: 'Unauthorized',
    timeout: 'Timeout',
    dns_error: 'DNS Error',
    connection_error: 'Connection Failed',
    ssl_error: 'SSL Certificate Error',
    invalid_url: 'Invalid URL',
    other: 'Other Error',
    security_blocked: 'Security Blocked',
    robots_blocked: 'Robots.txt Blocked',
  };

  //sort for response time
  const toggleSort = () => {
    if (sortDirection === null) setSortDirection('desc'); // Slowest first
    else if (sortDirection === 'desc') setSortDirection('asc'); // Fastest first
    else setSortDirection(null); // Back to original order
  };

  // Sort the display data by response time
  const sortedData = useMemo(() => {
    if (!sortDirection || !displayData) return displayData;

    return [...displayData].sort((a, b) => {
      const aTime = a.response_time || 0;
      const bTime = b.response_time || 0;

      return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    });
  }, [displayData, sortDirection]);

  // ENHANCED: Better logic for determining what type of "no results" message to show
  const getNoResultsMessage = () => {
    // Check if any filters are active
    const hasActiveFilters =
      (currentFilter.statusFilter && currentFilter.statusFilter !== 'all') ||
      (currentFilter.statusCode && currentFilter.statusCode !== '') ||
      (currentFilter.errorType &&
        currentFilter.errorType !== 'all' &&
        currentFilter.statusFilter !== 'working') ||
      (currentFilter.search && currentFilter.search !== '');

    if (hasActiveFilters) {
      // Filters are active but no results - this is filtered out data
      return {
        title: 'No Matching Results Found',
        description:
          'No links match your current filter criteria. Try adjusting your filters to see more results.',
        icon: (
          <svg
            className="w-16 h-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ),
        type: 'filtered',
      };
    } else {
      // No filters active - check if we're in broken-only mode or if there genuinely are no broken links
      const isFilteredBroken =
        (currentFilter.statusFilter === 'broken' || !isNewFormat) && !hasActiveFilters;

      if (isFilteredBroken) {
        return {
          title: 'No Broken Links Found!',
          description: 'Great news! All your links are working perfectly.',
          icon: (
            <svg
              className="w-16 h-16 text-green-500 mb-4"
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
          ),
          type: 'success',
        };
      } else {
        return {
          title: 'No Links Found',
          description: 'No links were discovered during the crawl.',
          icon: (
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          ),
          type: 'empty',
        };
      }
    }
  };

  // ENHANCED: Always show the header and filters, even when no results
  const noResultsInfo = !displayData || displayData.length === 0 ? getNoResultsMessage() : null;

  const handleFilterChange = (filterType, value) => {
    const newFilter = { ...currentFilter, [filterType]: value };
    setCurrentFilter(newFilter);

    if (onFilter) {
      onFilter(newFilter);
    }
  };

  const handleSearchChange = (e) => {
    const newSearch = e.target.value;

    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleFilterChange('search', newSearch);
    }, 500);
  };

  const truncateUrl = (url, maxLength = 60) => {
    if (url?.length <= maxLength) return url;
    return url?.substring(0, maxLength) + '...';
  };

  const formatResponseTime = (responseTime) => {
    if (!responseTime) return 'N/A';
    if (responseTime < 1000) return `${responseTime}ms`;
    return `${(responseTime / 1000).toFixed(1)}s`;
  };

  const getStatusBadgeColor = (item) => {
    if (isNewFormat && item.is_working !== undefined) {
      // New format with HTTP status
      if (item.is_working === true) {
        return 'bg-green-100 text-green-800';
      } else if (item.is_working === false) {
        return 'bg-red-100 text-red-800';
      }
    } else {
      // Old format - all items are broken links
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getResponseTimeColor = (responseTime) => {
    if (!responseTime) return 'text-gray-500';
    if (responseTime < 1000) return 'text-green-600';
    if (responseTime < 3000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatErrorMessage = (errorType, statusCode) => {
    const label = errorTypeLabels[errorType] || 'Unknown Error';
    return statusCode ? `${label} (${statusCode})` : label;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-5">
      {/* Header with filters */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isNewFormat ? 'Link Check Results' : 'Broken Links Found'}
            </h2>
            <p className="text-sm text-gray-600">
              {pagination?.totalCount || 0} {isNewFormat ? 'links' : 'broken links'} total
              {isNewFormat &&
                currentFilter.statusFilter === 'working' &&
                ' • Showing only working links'}
              {isNewFormat &&
                currentFilter.statusFilter === 'broken' &&
                ' • Showing only broken links'}
            </p>
          </div>

          {/* Enhanced Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search - always available */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search URLs..."
                defaultValue={currentFilter.search}
                onChange={handleSearchChange}
                className="pl-9 pr-3 py-2 border text-gray-500 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* FIXED: Only show error filter for 'broken' view ONLY */}
            {selectedView === 'broken' && (
              <select
                value={currentFilter.errorType}
                onChange={(e) => handleFilterChange('errorType', e.target.value)}
                className="px-3 py-2 border text-gray-500 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Error Types</option>
                <option value="404">404 - Not Found</option>
                <option value="500">500 - Server Error</option>
                <option value="403">403 - Forbidden</option>
                <option value="connection_error">Connection Error</option>
                <option value="ssl_error">SSL Certificate Error</option>
                <option value="timeout">Timeout</option>
                <option value="dns_error">DNS Error</option>
                <option value="other">Other</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ENHANCED: Show appropriate no results message */}
      {noResultsInfo ? (
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            {noResultsInfo.icon}
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{noResultsInfo.title}</h3>
            <p className="text-gray-600">{noResultsInfo.description}</p>

            {/* ENHANCED: Show clear filters button for filtered results */}
            {noResultsInfo.type === 'filtered' && (
              <button
                onClick={() => {
                  const resetFilters = isNewFormat
                    ? { statusFilter: 'all', statusCode: '', errorType: 'all', search: '' }
                    : { errorType: 'all', search: '' };
                  setCurrentFilter(resetFilters);
                  if (onFilter) onFilter(resetFilters);
                }}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Enhanced Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedView === 'pages' ? 'Page URL' : isNewFormat ? 'URL' : 'Broken URL'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedView === 'pages' ? 'Status' : isNewFormat ? 'Status' : 'Error Type'}
                  </th>
                  {selectedView === 'pages' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Depth
                    </th>
                  )}
                  {isNewFormat && selectedView !== 'pages' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={toggleSort}
                        className="flex items-center hover:text-gray-700 focus:outline-none"
                      >
                        Response Time
                        {sortDirection === 'asc' && <span className="ml-1">▲</span>}
                        {sortDirection === 'desc' && <span className="ml-1">▼</span>}
                        {sortDirection === null && <span className="ml-1 text-gray-300">↕</span>}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedView === 'pages' ? 'Found At' : isNewFormat ? 'Source' : 'Found On'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    {/* NEW: Pages view columns */}
                    {selectedView === 'pages' ? (
                      <>
                        {/* Page URL */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono break-all text-blue-600 hover:text-blue-800"
                              title={item.url}
                            >
                              {truncateUrl(item.url)}
                            </a>
                            {item.url?.length > 60 && (
                              <span className="text-xs text-gray-500 mt-1">
                                Click to view full URL
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.is_working === true
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {item.is_working === true ? 'Checked' : 'Pending'}
                          </span>
                        </td>

                        {/* Depth */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{item.depth || 0}</span>
                        </td>

                        {/* Found At */}
                        <td className="px-6 py-4">
                          <span className="text-xs text-gray-500">
                            {item.checked_at ? new Date(item.checked_at).toLocaleString() : 'N/A'}
                          </span>
                        </td>
                      </>
                    ) : (
                      /* Existing table columns for other views */
                      <>
                        {/* URL */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-sm font-mono break-all ${
                                isNewFormat
                                  ? item.is_working
                                    ? 'text-blue-600 hover:text-blue-800'
                                    : 'text-red-600 hover:text-red-800'
                                  : 'text-red-600 hover:text-red-800'
                              }`}
                              title={item.url}
                            >
                              {truncateUrl(item.url)}
                            </a>
                            {item.url?.length > 60 && (
                              <span className="text-xs text-gray-500 mt-1">
                                Click to view full URL
                              </span>
                            )}

                            {/* Internal/External indicator - new format only */}
                            {isNewFormat && item.is_internal !== undefined && (
                              <div className="flex items-center mt-1 space-x-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    item.is_internal
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {item.is_internal ? 'Internal' : 'External'}
                                </span>
                                {item.depth > 0 && (
                                  <span className="text-xs text-gray-500">Depth: {item.depth}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status/Error Type */}
                        <td className="px-6 py-4">
                          {isNewFormat ? (
                            /* New format with HTTP status */
                            <div className="flex flex-col space-y-1">
                              {/* HTTP Status Code */}
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                                  item
                                )}`}
                              >
                                {item.http_status_code ? `${item.http_status_code}` : 'ERROR'}
                              </span>

                              {/* Status Label */}
                              <span className="text-xs text-gray-600">
                                {item.status_label || 'Unknown'}
                              </span>

                              {/* Error Type for broken links */}
                              {!item.is_working && item.error_type && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    errorTypeColors[item.error_type] || errorTypeColors.other
                                  }`}
                                >
                                  {item.error_type.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Old format - just error type */
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                errorTypeColors[item.error_type] || errorTypeColors.other
                              }`}
                            >
                              {formatErrorMessage(item.error_type, item.status_code)}
                            </span>
                          )}
                        </td>

                        {/* Response Time - new format only */}
                        {isNewFormat && (
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span
                                className={`text-sm font-medium ${getResponseTimeColor(
                                  item.response_time
                                )}`}
                              >
                                {formatResponseTime(item.response_time)}
                              </span>
                              {item.checked_at && (
                                <span className="text-xs text-gray-500">
                                  {new Date(item.checked_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Source */}
                        <td className="px-6 py-4">
                          {item.source_url || item.sourceUrl ? (
                            <a
                              href={item.source_url || item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-blue-600 font-mono"
                              title={item.source_url || item.sourceUrl}
                            >
                              {truncateUrl(item.source_url || item.sourceUrl, 40)}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-500">Discovery</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {pagination.currentPage} of {pagination.totalPages} (
                  {pagination.totalCount} total results)
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => onPageChange && onPageChange(pagination.prevPage)}
                    disabled={!pagination.hasPrevPage}
                    className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium ${
                      pagination.hasPrevPage
                        ? 'text-gray-700 bg-white hover:bg-gray-50'
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    Previous
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.currentPage - 2);
                    const pageNum = startPage + i;
                    if (pageNum > pagination.totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange && onPageChange(pageNum)}
                        className={`px-3 py-2 border rounded-md text-sm font-medium ${
                          pageNum === pagination.currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => onPageChange && onPageChange(pagination.nextPage)}
                    disabled={!pagination.hasNextPage}
                    className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium ${
                      pagination.hasNextPage
                        ? 'text-gray-700 bg-white hover:bg-gray-50'
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Summary Statistics */}
          {displayData.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {isNewFormat ? (
                  /* New format with working/broken stats */
                  <>
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {displayData.filter((l) => l.is_working === true).length}
                      </div>
                      <div className="text-xs text-gray-600">Working Links</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-red-600">
                        {displayData.filter((l) => l.is_working === false).length}
                      </div>
                      <div className="text-xs text-gray-600">Broken Links</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {
                          displayData.filter((l) => l.response_time && l.response_time < 1000)
                            .length
                        }
                      </div>
                      <div className="text-xs text-gray-600">Fast Responses (&lt;1s)</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-orange-600">
                        {
                          displayData.filter((l) => l.response_time && l.response_time > 5000)
                            .length
                        }
                      </div>
                      <div className="text-xs text-gray-600">Slow Responses (&gt;5s)</div>
                    </div>
                  </>
                ) : (
                  /* Old format - just broken link stats */
                  <>
                    <div>
                      <div className="text-lg font-semibold text-red-600">{displayData.length}</div>
                      <div className="text-xs text-gray-600">Total Broken</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-orange-600">
                        {displayData.filter((l) => l.error_type === '404').length}
                      </div>
                      <div className="text-xs text-gray-600">404 Errors</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {displayData.filter((l) => l.error_type === '500').length}
                      </div>
                      <div className="text-xs text-gray-600">Server Errors</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-600">
                        {
                          displayData.filter((l) =>
                            ['timeout', 'dns_error', 'connection_error'].includes(l.error_type)
                          ).length
                        }
                      </div>
                      <div className="text-xs text-gray-600">Connection Issues</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
