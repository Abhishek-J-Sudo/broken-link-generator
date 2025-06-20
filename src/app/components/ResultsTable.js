'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  TrendingUp,
} from 'lucide-react';

export default function ResultsTable({
  jobId,
  brokenLinks, // OLD: backward compatibility
  links, // NEW: enhanced format with HTTP status
  selectedView, // NEW: to know which view is active
  pagination,
  onPageChange,
  onFilter,
  job,
  crawlMode,
}) {
  // ENHANCED: Support both old (brokenLinks) and new (links) data structures
  const displayData = links || brokenLinks || [];
  const isNewFormat = !!links; // New format has 'links' prop, old format has 'brokenLinks'
  const [sortDirection, setSortDirection] = useState(null); // null, 'asc', 'desc'
  const [seoSortDirection, setSeoSortDirection] = useState(null); // null, 'asc', 'desc'

  // NEW: Expandable rows state
  const [expandedRows, setExpandedRows] = useState(new Set());

  const [currentFilter, setCurrentFilter] = useState(
    isNewFormat
      ? {
          statusFilter: 'all', // 'all', 'working', 'broken'
          statusCode: '',
          errorType: 'all',
          search: '',
          seoScore: 'all',
        }
      : {
          errorType: 'all',
          search: '',
        }
  );

  // Color mappings (keep existing)
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

  // SEO helper functions
  const getSeoScoreColor = (score) => {
    if (score === null || score === undefined) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-red-100 text-red-800 border border-red-200';
  };

  const getSeoScoreLabel = (score) => {
    if (score === null || score === undefined) return 'No Data';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Needs Work';
    return 'Poor';
  };

  const getSeoScoreBadgeColor = (score) => {
    if (score === null || score === undefined) return 'bg-gray-100 text-gray-600';
    if (score >= 80) return 'bg-emerald-500 text-white';
    if (score >= 60) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  const hasSeoData = (item) => {
    return item.seo_score !== null && item.seo_score !== undefined;
  };

  const getTableTitle = () => {
    // Determine the mode part
    let mode = 'Link Check';
    // Check for content pages mode from either source
    if (crawlMode === 'content_pages' || job?.settings?.crawlMode === 'content_pages') {
      mode = 'Content Page Crawl';
    } else if (crawlMode === 'discovered_links' || job?.settings?.crawlMode === 'discovered_links')
      mode = 'Discovered Links';

    // Determine the SEO part
    const seoEnabled = job?.settings?.enableSEO;
    const hasSeoData = seoEnabled && crawlHasSeoData;

    if (hasSeoData) {
      return `${mode} : SEO Analysis`;
    } else {
      return `${mode} Results`;
    }
  };

  // Check if this crawl has any SEO data
  const crawlHasSeoData = useMemo(() => {
    const result = displayData.some((item) => hasSeoData(item));
    console.log('🔍 SEO Debug:', {
      crawlHasSeoData: result,
      displayDataLength: displayData.length,
      firstItem: displayData[0],
      seoScores: displayData.map((item) => item.seo_score),
      seoAnalysisData: displayData.map((item) => item.seo_analysis),
      hasSeoDataResults: displayData.map((item) => hasSeoData(item)),
      firstItemKeys: displayData[0] ? Object.keys(displayData[0]) : [],
      firstItemSeoScore: displayData[0]?.seo_score,
      firstItemSeoAnalysis: displayData[0]?.seo_analysis,
      rawFirstItem: displayData[0],
    });
    return result;
  }, [displayData]);

  // NEW: Toggle expandable rows
  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Sort functions (keep existing)
  const toggleSort = () => {
    if (sortDirection === null) setSortDirection('desc'); // Slowest first
    else if (sortDirection === 'desc') setSortDirection('asc'); // Fastest first
    else setSortDirection(null); // Back to original order
  };

  const toggleSeoSort = () => {
    if (seoSortDirection === null) setSeoSortDirection('desc'); // Best scores first
    else if (seoSortDirection === 'desc') setSeoSortDirection('asc'); // Worst scores first
    else setSeoSortDirection(null); // Back to original order
  };

  // Sort the display data
  const sortedData = useMemo(() => {
    let data = displayData;

    // Apply response time sorting first if active
    if (sortDirection && data) {
      data = [...data].sort((a, b) => {
        const aTime = a.response_time || 0;
        const bTime = b.response_time || 0;
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }

    // Apply SEO score sorting if active (overrides response time sorting)
    if (seoSortDirection && data) {
      data = [...data].sort((a, b) => {
        const aScore = a.seo_score || 0;
        const bScore = b.seo_score || 0;
        return seoSortDirection === 'asc' ? aScore - bScore : bScore - aScore;
      });
    }

    return data || [];
  }, [displayData, sortDirection, seoSortDirection]);

  // NEW: Helper functions for the enhanced UI
  const getStatusIcon = (isWorking) => {
    return isWorking ? (
      <CheckCircle className="w-4 h-4 text-emerald-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getIssueIcon = (type) => {
    switch (type) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'major':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'minor':
        return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  // Keep existing helper functions
  const getNoResultsMessage = () => {
    const hasActiveFilters =
      (currentFilter.statusFilter && currentFilter.statusFilter !== 'all') ||
      (currentFilter.statusCode && currentFilter.statusCode !== '') ||
      (currentFilter.errorType &&
        currentFilter.errorType !== 'all' &&
        currentFilter.statusFilter !== 'working') ||
      (currentFilter.search && currentFilter.search !== '');

    if (hasActiveFilters) {
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
      const isFilteredBroken =
        (currentFilter.statusFilter === 'broken' || !isNewFormat) && !hasActiveFilters;
      if (!isFilteredBroken) {
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

  const noResultsInfo = !displayData || displayData.length === 0 ? getNoResultsMessage() : null;

  // Keep existing event handlers
  const handleFilterChange = (filterType, value) => {
    const newFilter = { ...currentFilter, [filterType]: value };
    setCurrentFilter(newFilter);
    if (onFilter) {
      onFilter(newFilter);
    }
  };

  const handleSearchChange = (e) => {
    const newSearch = e.target.value;
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleFilterChange('search', newSearch);
    }, 500);
  };

  // Keep existing utility functions
  const truncateUrl = (url, maxLength = 60) => {
    if (url?.length <= maxLength) return url;
    return url?.substring(0, maxLength) + '...';
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatResponseTime = (responseTime) => {
    if (!responseTime) return 'N/A';
    if (responseTime < 1000) return `${responseTime}ms`;
    return `${(responseTime / 1000).toFixed(1)}s`;
  };

  const getStatusBadgeColor = (item) => {
    if (isNewFormat && item.is_working !== undefined) {
      if (item.is_working === true) {
        return 'bg-green-100 text-green-800';
      } else if (item.is_working === false) {
        return 'bg-red-100 text-red-800';
      }
    } else {
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5 border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">{getTableTitle()}</h2>
            <p className="text-slate-600 text-sm">
              {pagination?.totalCount || 0} {isNewFormat ? 'links' : 'broken links'} total
              {expandedRows.size > 0 && ` • ${expandedRows.size} expanded`}
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

            {/* SEO Filter - only show if crawl has SEO data */}
            {isNewFormat && crawlHasSeoData && (
              <select
                value={currentFilter.seoScore}
                onChange={(e) => handleFilterChange('seoScore', e.target.value)}
                className="px-3 py-2 border text-gray-500 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All SEO Scores</option>
                <option value="good">Good (80+)</option>
                <option value="needs-work">Needs Work (60-79)</option>
                <option value="poor">Poor (&lt;60)</option>
                <option value="no-data">No SEO Data</option>
              </select>
            )}

            {/* Error filter for broken view only */}
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

      {/* Show appropriate no results message */}
      {noResultsInfo ? (
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            {noResultsInfo.icon}
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{noResultsInfo.title}</h3>
            <p className="text-gray-600">{noResultsInfo.description}</p>

            {/* Show clear filters button for filtered results */}
            {noResultsInfo.type === 'filtered' && (
              <button
                onClick={() => {
                  const resetFilters = isNewFormat
                    ? {
                        statusFilter: 'all',
                        statusCode: '',
                        errorType: 'all',
                        search: '',
                        seoScore: 'all',
                      }
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
          {/* Enhanced Expandable Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-8">
                    {/* Expand column */}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {selectedView === 'pages' ? 'Page URL' : isNewFormat ? 'URL' : 'Broken URL'}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  {isNewFormat && selectedView !== 'pages' && crawlHasSeoData && (
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer"
                      onClick={toggleSeoSort}
                    >
                      SEO Score
                      {seoSortDirection === 'asc' && <ChevronUp className="w-3 h-3 inline ml-1" />}
                      {seoSortDirection === 'desc' && (
                        <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Issues
                  </th>
                  {isNewFormat && selectedView !== 'pages' && (
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer"
                      onClick={toggleSort}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      Response
                      {sortDirection === 'asc' && <ChevronUp className="w-3 h-3 inline ml-1" />}
                      {sortDirection === 'desc' && <ChevronDown className="w-3 h-3 inline ml-1" />}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white">
                {sortedData.map((item, index) => (
                  <React.Fragment key={item.url || index}>
                    {/* Main Row */}
                    <tr
                      key={item.url || index}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 ${
                        expandedRows.has(item.id || index) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleRow(item.id || index)}
                    >
                      {/* Expand/Collapse Button */}
                      <td className="px-6 py-4 text-center">
                        {expandedRows.has(item.id || index) ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                      </td>

                      {/* URL */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          {getStatusIcon(item.is_working)}
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium break-all ${
                                item.is_working ? 'text-blue-600' : 'text-red-600'
                              }`}
                            >
                              {truncateText(item.url, 60)}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.is_internal
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {item.is_internal ? 'Internal' : 'External'}
                              </span>
                              <span className="text-xs text-slate-500">Depth: {item.depth}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                            item.is_working
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {item.http_status_code || 'ERROR'}
                        </div>
                      </td>

                      {/* SEO Score */}
                      {isNewFormat && selectedView !== 'pages' && crawlHasSeoData && (
                        <td className="px-6 py-4">
                          {hasSeoData(item) ? (
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getSeoScoreBadgeColor(
                                  item.seo_score
                                )}`}
                              >
                                {item.seo_score}
                              </div>
                              <div className="text-xs">
                                <div
                                  className={`font-medium ${
                                    item.seo_score >= 80
                                      ? 'text-emerald-700'
                                      : item.seo_score >= 60
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                  }`}
                                >
                                  {item.seo_grade ||
                                    (item.seo_score >= 80 ? 'A' : item.seo_score >= 60 ? 'B' : 'C')}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                <span className="text-xs text-slate-500">--</span>
                              </div>
                              <div className="text-xs text-slate-500">No Data</div>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Issues Count */}
                      <td className="px-6 py-4">
                        {item.seo_issues && item.seo_issues.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                item.seo_issues.some((issue) => issue.type === 'critical')
                                  ? 'bg-red-100 text-red-800'
                                  : item.seo_issues.some((issue) => issue.type === 'major')
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.seo_issues.length} issue
                              {item.seo_issues.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : item.is_working === false ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            1 issue
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">No issues</span>
                        )}
                      </td>

                      {/* Response Time */}
                      {isNewFormat && selectedView !== 'pages' && (
                        <td className="px-6 py-4">
                          <span
                            className={`text-sm font-medium ${
                              !item.response_time
                                ? 'text-slate-500'
                                : item.response_time < 1000
                                ? 'text-emerald-600'
                                : item.response_time < 3000
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }`}
                          >
                            {formatResponseTime(item.response_time)}
                          </span>
                        </td>
                      )}
                    </tr>

                    {/* Expanded SEO Details Row */}
                    {expandedRows.has(item.id || index) && (
                      <tr className="bg-slate-50">
                        <td colSpan="6" className="px-6 py-6">
                          <div className="max-w-6xl">
                            {hasSeoData(item) ? (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column - Page Content */}
                                <div className="space-y-4">
                                  <h4 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Page Content Analysis
                                  </h4>

                                  {/* Page Title */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <div className="flex justify-between items-start mb-2">
                                      <h5 className="font-medium text-slate-900">Page Title</h5>
                                      <span
                                        className={`text-xs px-2 py-1 rounded ${
                                          !item.seo_title?.text
                                            ? 'bg-red-100 text-red-800'
                                            : item.seo_title.text.length < 30
                                            ? 'bg-amber-100 text-amber-800'
                                            : item.seo_title.text.length > 60
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {item.seo_title?.text
                                          ? `${item.seo_title.text.length} chars`
                                          : 'Missing'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {item.seo_title?.text || 'No title tag found'}
                                    </p>
                                  </div>

                                  {/* Meta Description */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <div className="flex justify-between items-start mb-2">
                                      <h5 className="font-medium text-slate-900">
                                        Meta Description
                                      </h5>
                                      <span
                                        className={`text-xs px-2 py-1 rounded ${
                                          !item.seo_metaDescription?.text
                                            ? 'bg-red-100 text-red-800'
                                            : item.seo_metaDescription.text.length < 120
                                            ? 'bg-amber-100 text-amber-800'
                                            : item.seo_metaDescription.text.length > 160
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {item.seo_metaDescription?.text
                                          ? `${item.seo_metaDescription.text.length} chars`
                                          : 'Missing'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {item.seo_metaDescription?.text ||
                                        'No meta description found'}
                                    </p>
                                  </div>

                                  {/* Content Structure */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <h5 className="font-medium text-slate-900 mb-3">
                                      Content Structure
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">
                                          {item.seo_content.word_count || 0}
                                        </div>
                                        <div className="text-xs text-slate-600">Words</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">
                                          {(item.seo_headings.h1_count || 0) +
                                            (item.seo_headings.h2_count || 0) +
                                            (item.seo_headings.h3_count || 0)}
                                        </div>
                                        <div className="text-xs text-slate-600">Headings</div>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex gap-4 text-sm  text-slate-400">
                                      <span>H1: {item.seo_headings.h1_count || 0}</span>
                                      <span>H2: {item.seo_headings.h2_count || 0}</span>
                                      <span>H3: {item.seo_headings.h3_count || 0}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Column - Technical & Issues */}
                                <div className="space-y-4">
                                  <h4 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Technical & Issues
                                  </h4>

                                  {/* Technical Details */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <h5 className="font-medium text-slate-900 mb-3">
                                      Technical Details
                                    </h5>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">HTTPS:</span>
                                        <span
                                          className={
                                            item.seo_technical.isHttps
                                              ? 'text-emerald-600'
                                              : 'text-red-600'
                                          }
                                        >
                                          {item.seo_technical.isHttps ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Canonical URL:</span>
                                        <span
                                          className={
                                            item.seo_technical.canonical_url
                                              ? 'text-emerald-600'
                                              : 'text-amber-600'
                                          }
                                        >
                                          {item.seo_technical.canonical_url ? 'Present' : 'Missing'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Images:</span>
                                        <span className="text-gray-700">
                                          {item.seo_images.total_images || 0} total
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Alt Coverage:</span>
                                        <span
                                          className={`${
                                            (item.seo_images.alt_coverage || 0) >= 90
                                              ? 'text-emerald-600'
                                              : (item.seo_images.alt_coverage || 0) >= 70
                                              ? 'text-amber-600'
                                              : 'text-red-600'
                                          }`}
                                        >
                                          {item.seo_images.alt_coverage || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Issues List */}
                                  <div className="bg-white p-4 rounded-lg border">
                                    <h5 className="font-medium text-slate-900 mb-3">SEO Issues</h5>
                                    {item.seo_issues && item.seo_issues.length > 0 ? (
                                      <div className="space-y-2">
                                        {item.seo_issues.map((issue, idx) => (
                                          <div
                                            key={`${issue.type}-${idx}`}
                                            className="flex items-start gap-2 text-sm"
                                          >
                                            {getIssueIcon(issue.type)}
                                            <span className="text-slate-700">{issue.message}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : !item.is_working ? (
                                      <div className="flex items-start gap-2 text-sm">
                                        <XCircle className="w-4 h-4 text-red-500" />
                                        <span className="text-slate-700">
                                          {formatErrorMessage(
                                            item.error_type,
                                            item.http_status_code
                                          )}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                                        <CheckCircle className="w-4 h-4" />
                                        No issues found
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-slate-900 mb-2">
                                  No SEO Analysis Available
                                </h4>
                                <p className="text-slate-600">
                                  {item.is_working
                                    ? 'SEO analysis failed or is still processing'
                                    : 'Page could not be accessed for analysis'}
                                </p>
                                {!item.is_working && (
                                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm text-red-700">
                                      <XCircle className="w-4 h-4" />
                                      <span className="font-medium">Link Status:</span>
                                      <span>
                                        {formatErrorMessage(item.error_type, item.http_status_code)}
                                      </span>
                                    </div>
                                    {item.response_time && (
                                      <div className="text-xs text-red-600 mt-1">
                                        Response time: {formatResponseTime(item.response_time)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
                    {crawlHasSeoData && (
                      <div>
                        <div className="text-lg font-semibold text-emerald-600">
                          {displayData.filter((l) => hasSeoData(l) && l.seo_score >= 80).length}
                        </div>
                        <div className="text-xs text-gray-600">Good SEO (80+)</div>
                      </div>
                    )}
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {
                          displayData.filter((l) => l.response_time && l.response_time < 1000)
                            .length
                        }
                      </div>
                      <div className="text-xs text-gray-600">Fast Responses (&lt;1s)</div>
                    </div>
                  </>
                ) : (
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
