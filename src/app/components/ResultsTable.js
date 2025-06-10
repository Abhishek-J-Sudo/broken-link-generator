'use client';

import { useState, useEffect } from 'react';

export default function ResultsTable({
  jobId,
  data,
  dataType,
  pagination,
  onPageChange,
  onFilter,
}) {
  const [currentFilter, setCurrentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const statusColors = {
    checked: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    skipped: 'bg-gray-100 text-gray-800',
  };

  const handleFilterChange = (newFilter) => {
    setCurrentFilter(newFilter);
    if (onFilter) {
      onFilter({ errorType: newFilter, search: searchTerm });
    }
  };

  const handleSearchChange = (e) => {
    const newSearch = e.target.value;
    setSearchTerm(newSearch);

    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      if (onFilter) {
        onFilter({ errorType: currentFilter, search: newSearch });
      }
    }, 500);
  };

  const truncateUrl = (url, maxLength = 60) => {
    if (!url || url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const formatErrorMessage = (errorType, statusCode) => {
    const label = errorTypeLabels[errorType] || 'Unknown Error';
    return statusCode ? `${label} (${statusCode})` : label;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Get table configuration based on data type
  const getTableConfig = () => {
    switch (dataType) {
      case 'broken':
        return {
          title: 'Broken Links Found',
          description: 'Links that are not working properly',
          noDataMessage: 'No Broken Links Found!',
          noDataIcon: '✅',
          noDataSubtext: "Great news! We didn't find any broken links on your website.",
          headers: ['Broken URL', 'Error Type', 'Found On', 'Link Text'],
          showFilters: true,
        };
      case 'all':
        return {
          title: 'All Discovered Links',
          description: 'All links found during the crawl',
          noDataMessage: 'No Links Found',
          noDataIcon: '🔍',
          noDataSubtext: 'No links were discovered during the crawl.',
          headers: ['URL', 'Status', 'Type', 'Depth', 'Found At'],
          showFilters: false,
        };
      case 'working':
        return {
          title: 'Working Links',
          description: 'Links that are functioning correctly',
          noDataMessage: 'No Working Links Found',
          noDataIcon: '⚠️',
          noDataSubtext: 'No working links were found during the crawl.',
          headers: ['URL', 'Status', 'Type', 'Depth', 'Found At'],
          showFilters: false,
        };
      case 'pages':
        return {
          title: 'Scanned Pages',
          description: 'Internal pages that were crawled',
          noDataMessage: 'No Pages Scanned',
          noDataIcon: '📄',
          noDataSubtext: 'No internal pages were scanned during the crawl.',
          headers: ['Page URL', 'Status', 'Depth', 'Found At'],
          showFilters: false,
        };
      default:
        return {
          title: 'Results',
          description: 'Crawl results',
          noDataMessage: 'No Data Found',
          noDataIcon: '❓',
          noDataSubtext: 'No data available.',
          headers: ['URL', 'Status', 'Details'],
          showFilters: false,
        };
    }
  };

  const config = getTableConfig();

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex flex-col items-center">
          <div className="text-6xl mb-4">{config.noDataIcon}</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{config.noDataMessage}</h3>
          <p className="text-gray-600">{config.noDataSubtext}</p>
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
            <h2 className="text-xl font-semibold text-gray-900">{config.title}</h2>
            <p className="text-sm text-gray-600">
              {pagination?.totalCount || 0} {config.description}
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search URLs..."
                value={searchTerm}
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

            {/* Filter - only show for broken links */}
            {config.showFilters && (
              <select
                value={currentFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
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
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {config.headers.map((header, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr key={item.id || index} className="hover:bg-gray-50">
                {dataType === 'broken' && (
                  <>
                    {/* Broken URL */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 font-mono break-all"
                          title={item.url}
                        >
                          {truncateUrl(item.url)}
                        </a>
                        {item.url && item.url.length > 60 && (
                          <span className="text-xs text-gray-500 mt-1">Click to view full URL</span>
                        )}
                      </div>
                    </td>

                    {/* Error Type */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          errorTypeColors[item.error_type] || errorTypeColors.other
                        }`}
                      >
                        {formatErrorMessage(item.error_type, item.status_code)}
                      </span>
                    </td>

                    {/* Source URL */}
                    <td className="px-6 py-4">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-900 hover:text-blue-600 font-mono"
                        title={item.source_url}
                      >
                        {truncateUrl(item.source_url, 40)}
                      </a>
                    </td>

                    {/* Link Text */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600" title={item.link_text}>
                        {item.link_text ? truncateUrl(item.link_text, 30) : 'No text'}
                      </span>
                    </td>
                  </>
                )}

                {(dataType === 'all' || dataType === 'working') && (
                  <>
                    {/* URL */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 font-mono break-all"
                          title={item.url}
                        >
                          {truncateUrl(item.url)}
                        </a>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[item.status] || statusColors.pending
                        }`}
                      >
                        {item.status || 'Unknown'}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {item.is_internal ? 'Internal' : 'External'}
                      </span>
                    </td>

                    {/* Depth */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{item.depth || 0}</span>
                    </td>

                    {/* Found At */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDate(item.created_at)}</span>
                    </td>
                  </>
                )}

                {dataType === 'pages' && (
                  <>
                    {/* Page URL */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 font-mono break-all"
                          title={item.url}
                        >
                          {truncateUrl(item.url)}
                        </a>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[item.status] || statusColors.pending
                        }`}
                      >
                        {item.status || 'Unknown'}
                      </span>
                    </td>

                    {/* Depth */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{item.depth || 0}</span>
                    </td>

                    {/* Found At */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDate(item.created_at)}</span>
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
    </div>
  );
}
