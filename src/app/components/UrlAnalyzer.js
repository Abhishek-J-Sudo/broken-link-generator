// src/app/components/UrlAnalyzer.js - COMPLETE VERSION with ALL original features
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UrlAnalyzer({
  onAnalysisComplete,
  onStartCrawl,
  showCrawlButtons = false,
  analysisData = null,
}) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('pages');
  const [analysisLog, setAnalysisLog] = useState([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const router = useRouter();

  const addLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setAnalysisLog((prev) => [...prev, { message, type, timestamp }]);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;

    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    setAnalysisLog([]);

    try {
      // Validate URL
      const urlObj = new URL(url);
      addLogEntry(`🚀 Starting analysis of ${urlObj.hostname}`, 'success');
      addLogEntry(`📊 This will analyze up to 100 pages to understand URL structure`, 'info');
      addLogEntry(`🔍 Check your browser's developer console (F12) for detailed logs`, 'info');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          maxDepth: 3,
          maxPages: 100,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Validate result structure
      if (!result || !result.summary) {
        throw new Error('Invalid response structure from server');
      }

      addLogEntry(`✅ Analysis complete! Found ${result.summary.totalUrls || 0} URLs`, 'success');
      addLogEntry(`📄 Analyzed ${result.summary.pagesAnalyzed || 0} pages`, 'success');
      addLogEntry(`🔗 Total links discovered: ${result.summary.totalLinksFound || 'N/A'}`, 'info');

      // Add debug info if available
      if (result.summary.debug) {
        addLogEntry(`🔧 Debug info: ${JSON.stringify(result.summary.debug)}`, 'info');
      }

      if (result.summary.error) {
        addLogEntry(`⚠️ Server reported: ${result.summary.error}`, 'warning');
      }

      setAnalysis(result);
      const enrichedResult = {
        ...result,
        originalUrl: url, // Add the original URL
      };
      setAnalysis(enrichedResult);
      if (onAnalysisComplete) {
        onAnalysisComplete(enrichedResult);
      }
    } catch (err) {
      addLogEntry(`❌ Error: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSmartCrawl = async (urlsToCheck = 'pages') => {
    if (!analysis || !url) return;

    setIsStartingCrawl(true);
    setError('');

    try {
      // Determine which URLs to check based on user selection
      let urlsForCrawl = [];

      if (urlsToCheck === 'pages') {
        // Only check content pages - most efficient
        urlsForCrawl = analysis.categories.pages.map((item) => ({
          url: item.url,
          sourceUrl: item.sourceUrl || url,
          category: 'pages',
        }));
      } else if (urlsToCheck === 'all') {
        // Check all discovered URLs
        Object.entries(analysis.categories).forEach(([category, urls]) => {
          if (category !== 'media' && category !== 'admin') {
            // Skip media and admin
            urlsForCrawl.push(
              ...urls.map((item) => ({
                url: item.url,
                sourceUrl: item.sourceUrl || url,
                category,
              }))
            );
          }
        });
      }

      console.log(`🚀 ENHANCED START: Starting crawl for: ${url}`);
      console.log(`📊 ENHANCED START: Has analyzed data: ${!!analysis}`);
      console.log(`🎯 ENHANCED START: Using pre-analyzed data with ${urlsForCrawl.length} URLs`);

      // Show "Check Links" phase
      addLogEntry(`🚀 Starting link checking for ${urlsForCrawl.length} URLs...`, 'success');
      addLogEntry(`⚡ This may take a few minutes depending on the number of links`, 'info');

      // Start crawl with pre-analyzed URLs
      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          settings: {
            maxDepth: 2, // Lower depth since we're using pre-analyzed URLs
            includeExternal: false,
            timeout: 10000,
            usePreAnalyzedUrls: true, // Flag to indicate we're using pre-analyzed data
          },
          preAnalyzedUrls: urlsForCrawl, // Pass the URLs we want to check
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start smart crawl');
      }

      console.log('✅ Smart crawl started:', result);
      const jobId = result.jobId;

      // Show checking progress
      addLogEntry(`✅ Crawl job created: ${jobId}`, 'success');
      addLogEntry(`🔍 Checking links in progress...`, 'info');

      // Now poll for completion
      let isComplete = false;
      let pollCount = 0;
      const maxPolls = 120; // Maximum 4 minutes of polling (2 second intervals)

      while (!isComplete && pollCount < maxPolls) {
        pollCount++;

        // Wait 2 seconds between polls
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          // Check job status
          const statusResponse = await fetch(`/api/crawl/status/${jobId}`);
          const statusData = await statusResponse.json();

          if (statusResponse.ok) {
            console.log(
              `📊 Polling ${pollCount}: Status = ${statusData.status}, Progress = ${
                statusData.progress?.percentage || 0
              }%`
            );

            // Update progress in logs
            if (statusData.progress && statusData.progress.percentage > 0) {
              addLogEntry(
                `📊 Progress: ${statusData.progress.current || 0}/${
                  statusData.progress.total || 0
                } links checked (${statusData.progress.percentage || 0}%)`,
                'info'
              );
            }

            if (statusData.status === 'completed') {
              isComplete = true;
              addLogEntry(
                `🎉 Link checking complete! Found ${
                  statusData.stats?.brokenLinksFound || 0
                } broken links`,
                'success'
              );

              // Small delay to show completion message, then redirect
              setTimeout(() => {
                router.push(`/results/${jobId}`);
              }, 1500);
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.errorMessage || 'Crawl job failed');
            }
            // If status is 'running', continue polling
          } else {
            console.error('Error checking status:', statusData);
          }
        } catch (pollError) {
          console.error('Error during polling:', pollError);
          // Continue polling unless it's a critical error
        }
      }

      if (!isComplete) {
        // Timeout reached
        addLogEntry(`⚠️ Taking longer than expected. Redirecting to results page...`, 'warning');
        setTimeout(() => {
          router.push(`/results/${jobId}`);
        }, 1000);
      }
    } catch (err) {
      console.error('❌ Error starting smart crawl:', err);
      setError(err.message);
      addLogEntry(`❌ Error: ${err.message}`, 'error');
    } finally {
      setIsStartingCrawl(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      pages: 'bg-green-100 text-green-800',
      withParams: 'bg-yellow-100 text-yellow-800',
      pagination: 'bg-blue-100 text-blue-800',
      dates: 'bg-purple-100 text-purple-800',
      media: 'bg-gray-100 text-gray-800',
      admin: 'bg-red-100 text-red-800',
      api: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.other;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      pages: 'Content Pages',
      withParams: 'URLs with Parameters',
      pagination: 'Pagination URLs',
      dates: 'Date Archives',
      media: 'Media Files',
      admin: 'Admin/System',
      api: 'API Endpoints',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  // Safe accessors with null checks
  const getSafeNumber = (value, fallback = 0) => {
    return typeof value === 'number' ? value : fallback;
  };

  const getSafeCategories = () => {
    if (!analysis || !analysis.summary || !analysis.summary.categories) {
      return {
        pages: 0,
        withParams: 0,
        pagination: 0,
        dates: 0,
        media: 0,
        admin: 0,
        api: 0,
        other: 0,
      };
    }
    return analysis.summary.categories;
  };

  const getSafeRecommendations = () => {
    if (!analysis || !analysis.summary || !Array.isArray(analysis.summary.recommendations)) {
      return [];
    }
    return analysis.summary.recommendations;
  };

  const getSafePatterns = () => {
    if (!analysis || !analysis.summary || !Array.isArray(analysis.summary.topPatterns)) {
      return [];
    }
    return analysis.summary.topPatterns;
  };

  const getSafeCategoryData = (category) => {
    if (!analysis || !analysis.categories || !Array.isArray(analysis.categories[category])) {
      return [];
    }
    return analysis.categories[category];
  };

  const exportAnalysis = () => {
    const jsonData = JSON.stringify(analysis, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `url-analysis-${new URL(url).hostname}-${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">🔍 URL Structure Analyzer</h1>
        <p className="text-gray-600 mb-6">
          Analyze your website's URL structure to see what types of pages exist before running a
          full crawl. This helps identify junk URLs and estimate real crawl scope.
        </p>

        <form onSubmit={handleAnalyze} className="flex gap-4 mb-6">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isAnalyzing || !url}
            className={`px-6 py-2 rounded-md font-medium ${
              isAnalyzing || !url
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze URLs'}
          </button>
        </form>

        {/* Analysis Progress Log */}
        {(analysisLog.length > 0 || isAnalyzing) && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Analysis Progress</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {analysisLog.map((log, index) => (
                <div key={index} className="flex items-start text-sm">
                  <span className="mr-2">{getLogIcon(log.type)}</span>
                  <span className="text-gray-500 mr-2 text-xs">{log.timestamp}</span>
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))}
              {isAnalyzing && (
                <div className="flex items-center text-sm">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-blue-600">Analyzing website structure...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">How it works</h3>
              <div className="mt-2 text-sm text-blue-700 space-y-1">
                <p>• Crawls up to 100 pages to discover URL patterns</p>
                <p>• Categorizes URLs by type (content, pagination, admin, etc.)</p>
                <p>• Shows what to expect in a full crawl</p>
                <p>
                  • <strong>Open Developer Console (F12) to see detailed progress logs</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && !isAnalyzing && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {analysis && analysis.summary && (
        <div className="space-y-6">
          {/* JavaScript Site Detection */}
          {analysis.summary.isJavaScriptSite && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-yellow-600"
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
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-yellow-800">
                    JavaScript-Heavy Site Detected
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      This website loads its content dynamically using JavaScript. Our static
                      analyzer can only see the initial HTML shell.
                    </p>

                    {analysis.summary.frameworks &&
                      Object.entries(analysis.summary.frameworks).some(
                        ([, detected]) => detected
                      ) && (
                        <div className="mt-3">
                          <p className="font-medium">Detected frameworks:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(analysis.summary.frameworks)
                              .filter(([, detected]) => detected)
                              .map(([framework]) => (
                                <span
                                  key={framework}
                                  className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                                >
                                  {framework.charAt(0).toUpperCase() + framework.slice(1)}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                    <div className="mt-3">
                      <p className="font-medium">Recommended next steps:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>
                          Use the <strong>Full Broken Link Checker</strong> instead (may work better
                          with JavaScript sites)
                        </li>
                        <li>Check the sitemap.xml for site structure</li>
                        <li>Try specific pages manually</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Debug Information */}
          {analysis.summary.debug && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">🔧 Debug Information</h3>
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  Original Links Found: {analysis.summary.debug.originalLinksCount || 'N/A'}
                </div>
                <div>Processed Links: {analysis.summary.debug.processedLinksCount || 'N/A'}</div>
                {analysis.summary.debug.errors && analysis.summary.debug.errors.length > 0 && (
                  <div>
                    <div className="font-medium">Errors:</div>
                    <ul className="list-disc list-inside ml-4">
                      {analysis.summary.debug.errors.map((error, i) => (
                        <li key={i} className="text-red-600">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Analysis Summary</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {getSafeNumber(analysis.summary.totalUrls)}
                </div>
                <div className="text-sm text-blue-800">
                  {analysis.summary.isJavaScriptSite ? 'URLs Found (Sitemap)' : 'Total URLs Found'}
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {getSafeNumber(getSafeCategories().pages)}
                </div>
                <div className="text-sm text-green-800">Content Pages</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {getSafeNumber(analysis.summary.pagesAnalyzed)}
                </div>
                <div className="text-sm text-yellow-800">Pages Analyzed</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{getSafePatterns().length}</div>
                <div className="text-sm text-purple-800">URL Patterns</div>
              </div>
            </div>

            {/* Alternative Sources for JS sites */}
            {analysis.alternatives && analysis.alternatives.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  🔍 Alternative URL Sources Found
                </h3>
                {analysis.alternatives.map((alt, index) => (
                  <div
                    key={index}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900">
                          {alt.type === 'sitemap' ? '🗺️ Sitemap.xml' : '🤖 Robots.txt'}
                        </h4>
                        <p className="text-sm text-blue-700">
                          Found {alt.total} URLs from {alt.type}
                        </p>
                      </div>
                      <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        View URLs
                      </button>
                    </div>
                    {alt.urls && alt.urls.length > 0 && (
                      <div className="mt-3 text-xs">
                        <p className="text-blue-600 font-medium">Sample URLs:</p>
                        <div className="mt-1 space-y-1">
                          {alt.urls.slice(0, 3).map((url, i) => (
                            <div key={i} className="font-mono text-blue-800 break-all">
                              {url}
                            </div>
                          ))}
                          {alt.urls.length > 3 && (
                            <div className="text-blue-600">... and {alt.urls.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Category Breakdown - only show if we have real categories */}
            {!analysis.summary.isJavaScriptSite && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(getSafeCategories()).map(([category, count]) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      selectedCategory === category
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                        category
                      )}`}
                    >
                      {getCategoryLabel(category)}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{count}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Recommendations */}
          {getSafeRecommendations().length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">💡 Recommendations</h2>
              <div className="space-y-3">
                {getSafeRecommendations().map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      rec.type === 'warning'
                        ? 'bg-yellow-50 border-yellow-400'
                        : rec.type === 'info'
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-green-50 border-green-400'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{rec.message}</p>
                    <p className="text-sm text-gray-600 mt-1">{rec.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Top URL Patterns */}
          {getSafePatterns().length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🔗 Most Common URL Patterns
              </h2>
              <div className="space-y-3">
                {getSafePatterns()
                  .slice(0, 8)
                  .map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <code className="text-sm font-mono text-gray-800">{pattern.pattern}</code>
                        <div className="text-xs text-gray-500 mt-1">
                          Examples: {(pattern.examples || []).slice(0, 2).join(', ')}
                          {(pattern.examples || []).length > 2 &&
                            ` ... +${pattern.examples.length - 2} more`}
                        </div>
                      </div>
                      <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {pattern.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* URL Category Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📋 {getCategoryLabel(selectedCategory)}
              <span className="text-gray-500 font-normal">
                ({getSafeNumber(getSafeCategories()[selectedCategory])} URLs)
              </span>
            </h2>

            {getSafeCategoryData(selectedCategory).length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getSafeCategoryData(selectedCategory)
                  .slice(0, 50)
                  .map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-mono text-sm break-all"
                      >
                        {item.url}
                      </a>
                      {item.pattern && (
                        <div className="text-xs text-gray-500 mt-1">
                          Pattern: <code>{item.pattern}</code>
                          {item.sourceUrl && ` • Found on: ${new URL(item.sourceUrl).pathname}`}
                        </div>
                      )}
                    </div>
                  ))}
                {getSafeCategoryData(selectedCategory).length > 50 && (
                  <div className="text-center py-3 text-gray-500">
                    ... and {getSafeCategoryData(selectedCategory).length - 50} more URLs
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">No URLs found in this category.</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Next Steps</h2>

            {/* Loading State */}
            {isStartingCrawl && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
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
                  <span className="text-blue-800">
                    Starting smart crawl with pre-analyzed URLs...
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleSmartCrawl('pages')}
                disabled={isStartingCrawl}
                className={`px-6 py-3 rounded-lg font-medium ${
                  isStartingCrawl
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                ✅ Crawl {analysis.summary.categories.pages} Content Pages Only
              </button>
              <button
                onClick={() => handleSmartCrawl('all')}
                disabled={isStartingCrawl}
                className={`px-6 py-3 rounded-lg font-medium ${
                  isStartingCrawl
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                🔄 Crawl All {analysis.summary.totalUrls} URLs
              </button>
              <button
                disabled={true}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium opacity-50 cursor-not-allowed"
              >
                📊 Export Analysis Report (Coming Soon)
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Recommendation:</strong> Based on this analysis, crawling only the{' '}
                {analysis.summary.categories.pages} content pages will give you meaningful results
                much faster than processing all {analysis.summary.totalUrls} URLs.
              </p>
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔧 Technical Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Analysis Settings</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Max Depth: 3 levels</div>
                  <div>Max Pages: 100 pages</div>
                  <div>Pages Analyzed: {getSafeNumber(analysis.summary.pagesAnalyzed)}</div>
                  <div>
                    Coverage:{' '}
                    {Math.round((getSafeNumber(analysis.summary.pagesAnalyzed) / 100) * 100)}%
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">URL Distribution</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  {Object.entries(getSafeCategories())
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([category, count]) => (
                      <div key={category} className="flex justify-between">
                        <span>{getCategoryLabel(category)}:</span>
                        <span>
                          {count} (
                          {Math.round(
                            (count / Math.max(getSafeNumber(analysis.summary.totalUrls), 1)) * 100
                          )}
                          %)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
