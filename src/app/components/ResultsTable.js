'use client';

import { useState, useEffect } from 'react';

export default function ResultsTable({
  jobId,
  brokenLinks,
  links,
  pagination,
  onPageChange,
  onFilter,
}) {
  // BACKWARD COMPATIBILITY: Support both old (brokenLinks) and new (links) data structures
  const displayData = links || brokenLinks || [];
  const isNewFormat = !!links; // New format has 'links' prop, old format has 'brokenLinks'

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
    invalid_url: 'bg-indigo-100 text-indigo-800',
    other: 'bg-gray-100 text-gray-800',
  };

  const errorTypeLabels = {
    404: 'Not Found',
    500: 'Server Error',
    403: 'Forbidden',
    401: 'Unauthorized',
    timeout: 'Timeout',
    dns_error: 'DNS Error',
    connection_error: 'Connection Failed',
    invalid_url: 'Invalid URL',
    other: 'Other Error',
  };

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

  if (!displayData || displayData.length === 0) {
    const isFilteredBroken = currentFilter.statusFilter === 'broken' || !isNewFormat;
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex flex-col items-center">
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
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isFilteredBroken ? 'No Broken Links Found!' : 'No Links Found'}
          </h3>
          <p className="text-gray-600">
            {isFilteredBroken
              ? 'Great news! All your links are working perfectly.'
              : 'No links match your current filter criteria.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search URLs..."
                defaultValue={currentFilter.search}
                onChange={handleSearchChange}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            {/* Status Filter - only for new format */}
            {isNewFormat && (
              <select
                value={currentFilter.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Links</option>
                <option value="working">✅ Working Links</option>
                <option value="broken">❌ Broken Links</option>
              </select>
            )}

            {/* HTTP Status Code Filter - only for new format */}
            {isNewFormat && (
              <select
                value={currentFilter.statusCode}
                onChange={(e) => handleFilterChange('statusCode', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status Codes</option>
                <option value="200">200 - OK</option>
                <option value="301">301 - Moved Permanently</option>
                <option value="302">302 - Found</option>
                <option value="404">404 - Not Found</option>
                <option value="403">403 - Forbidden</option>
                <option value="500">500 - Server Error</option>
              </select>
            )}

            {/* Error Type Filter */}
            <select
              value={currentFilter.errorType}
              onChange={(e) => handleFilterChange('errorType', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Errors</option>
              <option value="404">404 - Not Found</option>
              <option value="500">500 - Server Error</option>
              <option value="403">403 - Forbidden</option>
              <option value="timeout">Timeout</option>
              <option value="dns_error">DNS Error</option>
              <option value="connection_error">Connection Error</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isNewFormat ? 'URL' : 'Broken URL'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isNewFormat ? 'Status' : 'Error Type'}
              </th>
              {isNewFormat && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isNewFormat ? 'Source' : 'Found On'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isNewFormat ? 'Details' : 'Link Text'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((item, index) => (
              <tr key={item.id || index} className="hover:bg-gray-50">
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
                      <span className="text-xs text-gray-500 mt-1">Click to view full URL</span>
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
                      className="text-sm text-gray-900 hover:text-blue-600 font-mono"
                      title={item.source_url || item.sourceUrl}
                    >
                      {truncateUrl(item.source_url || item.sourceUrl, 40)}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500">Discovery</span>
                  )}
                </td>

                {/* Details/Link Text */}
                <td className="px-6 py-4">
                  {isNewFormat ? (
                    /* New format with more details */
                    <div className="flex flex-col">
                      {/* Link Text */}
                      {item.link_text && (
                        <span className="text-sm text-gray-600 mb-1" title={item.link_text}>
                          {truncateUrl(item.link_text, 30)}
                        </span>
                      )}

                      {/* Error Message for failed links */}
                      {item.error_message && (
                        <span className="text-xs text-red-600" title={item.error_message}>
                          {truncateUrl(item.error_message, 40)}
                        </span>
                      )}

                      {/* Working link indicator */}
                      {item.is_working && <span className="text-xs text-green-600">✓ Working</span>}
                    </div>
                  ) : (
                    /* Old format - just link text */
                    <span className="text-sm text-gray-600" title={item.link_text}>
                      {item.link_text ? truncateUrl(item.link_text, 30) : 'No text'}
                    </span>
                  )}
                </td>
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

      {/* Summary Statistics */}
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
                    {displayData.filter((l) => l.response_time && l.response_time < 1000).length}
                  </div>
                  <div className="text-xs text-gray-600">Fast Responses (&lt;1s)</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-orange-600">
                    {displayData.filter((l) => l.response_time && l.response_time > 5000).length}
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
    </div>
  );
}
