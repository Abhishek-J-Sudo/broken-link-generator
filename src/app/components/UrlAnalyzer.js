// src/app/components/UrlAnalyzer.js - FIXED VERSION
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
  const [analysis, setAnalysis] = useState(analysisData);
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

      const enrichedResult = {
        ...result,
        originalUrl: url,
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

  const handleSmartCrawl = async (crawlType = 'pages') => {
    if (!analysis || !url) return;

    setIsStartingCrawl(true);
    setError('');

    try {
      addLogEntry(
        `🚀 Starting ${crawlType === 'pages' ? 'content pages' : 'full'} crawl...`,
        'success'
      );

      // Use the regular crawl endpoint with appropriate settings
      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          settings: {
            maxDepth: crawlType === 'pages' ? 2 : 3, // Shallower for content-only crawls
            includeExternal: false,
            timeout: 10000,
            crawlType, // Pass the crawl type for potential optimization
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start crawl');
      }

      addLogEntry(`✅ Crawl job created: ${result.jobId}`, 'success');
      addLogEntry(`🔍 Redirecting to results page...`, 'info');

      // Redirect to results page
      setTimeout(() => {
        router.push(`/results/${result.jobId}`);
      }, 1500);
    } catch (err) {
      console.error('❌ Error starting crawl:', err);
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
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Analysis Summary</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {getSafeNumber(analysis.summary.totalUrls)}
                </div>
                <div className="text-sm text-blue-800">Total URLs Found</div>
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

            {/* Category Breakdown */}
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
                  .slice(0, 20)
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
                        </div>
                      )}
                    </div>
                  ))}
                {getSafeCategoryData(selectedCategory).length > 20 && (
                  <div className="text-center py-3 text-gray-500">
                    ... and {getSafeCategoryData(selectedCategory).length - 20} more URLs
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
                  <span className="text-blue-800">Starting smart crawl...</span>
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
                ✅ Check {getSafeCategories().pages} Content Pages Only
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
                🔄 Check All {analysis.summary.totalUrls} URLs
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Recommendation:</strong> Based on this analysis, checking only the{' '}
                {getSafeCategories().pages} content pages will give you meaningful results much
                faster than processing all {analysis.summary.totalUrls} URLs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
