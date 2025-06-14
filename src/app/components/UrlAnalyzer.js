/**
 * UrlAnalyzer Component - Part 1: Setup & Analysis Functions
 * MERGED: Main branch working component + Smart analyzer content discovery support
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UrlAnalyzer({
  onAnalysisComplete,
  onStartCrawl,
  showCrawlButtons = false,
  analysisData = null,
}) {
  // MAIN BRANCH STATE - PRESERVED EXACTLY
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('content'); // UPDATED: Default to content pages
  const [analysisLog, setAnalysisLog] = useState([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const router = useRouter();

  // MAIN BRANCH CRAWL STATE - PRESERVED EXACTLY
  const [crawlProgress, setCrawlProgress] = useState(null);
  const [crawlStats, setCrawlStats] = useState(null);
  const [crawlStatus, setCrawlStatus] = useState('idle'); // idle, starting, running, completed, failed
  const [crawlLog, setCrawlLog] = useState([]);

  const scrollRef = useRef(null);
  const analysisScrollRef = useRef(null);

  // MAIN BRANCH EFFECTS - PRESERVED EXACTLY
  useEffect(() => {
    if (scrollRef.current && crawlLog.length > 0) {
      setTimeout(() => {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, [crawlLog]);

  useEffect(() => {
    if (analysisScrollRef.current && analysisLog.length > 0) {
      setTimeout(() => {
        analysisScrollRef.current.scrollTop = analysisScrollRef.current.scrollHeight;
      }, 100);
    }
  }, [analysisLog]);

  // MAIN BRANCH: Load cached analysis - PRESERVED
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('lastAnalysis');
      if (cached) {
        const parsedAnalysis = JSON.parse(cached);
        setAnalysis(parsedAnalysis);
        setUrl(parsedAnalysis.originalUrl || '');
        onAnalysisComplete?.(parsedAnalysis);
      }
    } catch (error) {
      console.error('Error loading cached analysis:', error);
      setAnalysisLog([]);
    }
  }, []);

  // MAIN BRANCH LOG FUNCTIONS - PRESERVED EXACTLY
  const addCrawlLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setCrawlLog((prev) => [...prev, { message, type, timestamp }]);
  };

  const addLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setAnalysisLog((prev) => [...prev, { message, type, timestamp }]);
  };

  // ENHANCED: Analysis function with content discovery support
  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;

    // Clear previous analysis data
    sessionStorage.removeItem('lastAnalysis');

    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    setAnalysisLog([]);

    try {
      // Validate URL
      const urlObj = new URL(url);
      addLogEntry(`🚀 Starting content discovery for ${urlObj.hostname}`, 'success');
      addLogEntry(`📊 This will discover content pages and filter out non-content URLs`, 'info');
      addLogEntry(`🔍 Check your browser's developer console (F12) for detailed logs`, 'info');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          maxDepth: 3,
          maxPages: 1000, // UPDATED: Higher limit for content discovery
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

      // ENHANCED: Support both content discovery and pattern analysis results
      let processedResult = result;

      if (result.contentPages && Array.isArray(result.contentPages)) {
        // NEW: Content discovery result format
        addLogEntry(
          `✅ Content discovery complete! Found ${result.summary.contentPages} content pages out of ${result.summary.totalPagesFound} total pages`,
          'success'
        );
        addLogEntry(
          `🎯 Filtered out ${result.summary.filteredOut} non-content pages (pagination, admin, etc.)`,
          'info'
        );

        // Enhance the result with originalUrl for compatibility
        processedResult = {
          ...result,
          originalUrl: url,
          analysisType: 'content_discovery',
        };
      } else if (result.categories) {
        // EXISTING: Pattern analysis result format
        addLogEntry(
          `✅ Pattern analysis complete! Found ${result.summary.totalUrls} URLs across ${result.summary.pagesAnalyzed} pages`,
          'success'
        );
        addLogEntry(
          `📊 Discovered ${Object.keys(result.categories).length} different URL patterns`,
          'info'
        );

        // Enhance the result with originalUrl for compatibility
        processedResult = {
          ...result,
          originalUrl: url,
          analysisType: 'pattern_analysis',
        };
      }

      // Cache the analysis
      try {
        sessionStorage.setItem('lastAnalysis', JSON.stringify(processedResult));
      } catch (cacheError) {
        console.warn('Could not cache analysis:', cacheError);
      }

      setAnalysis(processedResult);
      onAnalysisComplete?.(processedResult);

      addLogEntry(
        `🎉 Ready for link checking! You can now start crawling to find broken links.`,
        'success'
      );
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error.message);
      addLogEntry(`❌ Analysis failed: ${error.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ENHANCED: Smart crawl handling with content page support
  const handleSmartCrawl = async (focusType = 'content') => {
    if (!analysis) return;

    setIsStartingCrawl(true);
    setCrawlStatus('starting');
    setCrawlLog([]);
    addCrawlLogEntry(`🎯 Starting smart crawl with focus: ${focusType}`, 'success');

    try {
      let urlsForCrawl = [];

      // NEW: Handle content discovery results
      if (analysis.contentPages && Array.isArray(analysis.contentPages)) {
        addCrawlLogEntry(
          `📄 Using ${analysis.contentPages.length} content pages from discovery`,
          'info'
        );

        if (focusType === 'content') {
          // Use only content pages
          urlsForCrawl = analysis.contentPages.map((page) => ({
            url: page.url,
            sourceUrl: page.sourceUrl || analysis.originalUrl,
            type: 'content',
            isContent: true,
          }));
        } else {
          // Use all discovered pages
          urlsForCrawl =
            analysis.allDiscoveredPages?.slice(0, 500).map((page) => ({
              url: page.url,
              sourceUrl: page.sourceUrl || analysis.originalUrl,
              type: page.type,
              isContent: page.isContent,
            })) ||
            analysis.contentPages.map((page) => ({
              url: page.url,
              sourceUrl: page.sourceUrl || analysis.originalUrl,
              type: 'content',
              isContent: true,
            }));
        }
      }
      // FALLBACK: Handle pattern analysis results (main branch compatibility)
      else if (analysis.categories) {
        addCrawlLogEntry(
          `📊 Using pattern analysis data with ${
            Object.keys(analysis.categories).length
          } categories`,
          'info'
        );

        const categories = analysis.categories || {};
        Object.entries(categories).forEach(([category, urls]) => {
          if (Array.isArray(urls) && urls.length > 0) {
            if (focusType === 'content' && category === 'pages') {
              // Only include content pages
              urlsForCrawl.push(
                ...urls.map((item) => ({
                  url: item.url,
                  sourceUrl: item.sourceUrl || item.source_url || item.sourcePageUrl || url,
                  category,
                }))
              );
            } else if (focusType === 'all') {
              // Include all categories
              urlsForCrawl.push(
                ...urls.map((item) => ({
                  url: item.url,
                  sourceUrl: item.sourceUrl || item.source_url || item.sourcePageUrl || url,
                  category,
                }))
              );
            }
          }
        });
      }

      // ENHANCED: Updated logging for new approach
      if (analysis.contentPages) {
        addCrawlLogEntry(`🚀 Starting single-pass link checking for content pages...`, 'success');
        addCrawlLogEntry(`⚡ Using content pages discovered by smart analyzer`, 'info');
      } else {
        addCrawlLogEntry(`🚀 Starting smart crawl for ${urlsForCrawl.length} URLs...`, 'success');
        addCrawlLogEntry(`📊 Using pattern analysis data`, 'info');
      }

      console.log(
        '🔍 Sample URLs for crawl:',
        urlsForCrawl.slice(0, 3).map((url) => ({
          url: url.url.substring(0, 50) + '...',
          sourceUrl: url.sourceUrl,
          category: url.category || url.type,
        }))
      );

      // EXISTING crawl start logic - NO CHANGES
      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          settings: {
            maxDepth: 2,
            includeExternal: false,
            timeout: 10000,
            usePreAnalyzedUrls: true,
          },
          preAnalyzedUrls: urlsForCrawl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start smart crawl');
      }

      const jobId = result.jobId;
      setCrawlStatus('running');
      addCrawlLogEntry(`✅ Crawl job created: ${jobId}`, 'success');
      addCrawlLogEntry(`🔍 Now checking each link for broken status...`, 'info');

      // Pass crawl data back to parent if available
      if (onStartCrawl) {
        const crawlData = {
          sourceAnalysis: true,
          focusType: focusType,
          originalUrl: analysis.originalUrl || url,
          discoveredUrls: urlsForCrawl,
          totalAnalyzed:
            analysis.summary?.totalPagesFound || analysis.summary?.totalUrls || urlsForCrawl.length,
          categories: analysis.summary?.categories || {},
          timestamp: Date.now(),
          jobId: jobId,
          analysisType: analysis.analysisType || 'unknown',
        };
        onStartCrawl(crawlData);
      }

      // Start monitoring crawl progress
      monitorCrawlProgress(jobId);
    } catch (error) {
      console.error('Smart crawl error:', error);
      setError(error.message);
      setCrawlStatus('failed');
      addCrawlLogEntry(`❌ Smart crawl failed: ${error.message}`, 'error');
    } finally {
      setIsStartingCrawl(false);
    }
  };

  // MAIN BRANCH: Monitor crawl progress - PRESERVED EXACTLY
  const monitorCrawlProgress = async (jobId) => {
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/crawl/status/${jobId}`);
        const status = await response.json();

        if (response.ok) {
          setCrawlProgress(status.progress);
          setCrawlStats(status.stats);

          if (status.job?.status === 'completed') {
            setCrawlStatus('completed');
            addCrawlLogEntry(`🎉 Crawl completed successfully!`, 'success');
            addCrawlLogEntry(
              `📊 Found ${status.stats?.brokenLinks || 0} broken links out of ${
                status.stats?.totalChecked || 0
              } total links`,
              'info'
            );

            // Navigate to results
            setTimeout(() => {
              router.push(`/results/${jobId}`);
            }, 2000);

            return; // Stop monitoring
          } else if (status.job?.status === 'failed') {
            setCrawlStatus('failed');
            addCrawlLogEntry(`❌ Crawl failed: ${status.job.error || 'Unknown error'}`, 'error');
            return; // Stop monitoring
          } else {
            // Still running, continue monitoring
            addCrawlLogEntry(
              `📊 Progress: ${status.progress?.current || 0}/${
                status.progress?.total || 0
              } (${Math.round(
                ((status.progress?.current || 0) / (status.progress?.total || 1)) * 100
              )}%)`,
              'info'
            );
          }
        }
      } catch (error) {
        console.error('Error checking crawl status:', error);
        addCrawlLogEntry(`⚠️ Error checking progress: ${error.message}`, 'warning');
      }

      // Continue monitoring every 3 seconds
      setTimeout(checkProgress, 3000);
    };

    // Start monitoring
    setTimeout(checkProgress, 1000);
  };

  // HELPER FUNCTIONS FOR DISPLAY - ENHANCED FOR BOTH FORMATS
  const getSafeNumber = (value) => {
    return typeof value === 'number' && !isNaN(value) ? value : 0;
  };

  const getSafeArray = (value) => {
    return Array.isArray(value) ? value : [];
  };

  const getDisplayCategories = () => {
    if (!analysis) return {};

    // NEW: Content discovery format
    if (analysis.contentPages) {
      return {
        content: getSafeArray(analysis.contentPages),
        ...(analysis.summary?.categories || {}),
      };
    }
    // EXISTING: Pattern analysis format
    else if (analysis.categories) {
      return analysis.categories;
    }

    return {};
  };

  const getCrawlButtonText = (focusType) => {
    if (!analysis) return 'Check Links';

    // NEW: Content discovery format
    if (analysis.contentPages) {
      const contentCount = analysis.contentPages.length;
      const totalCount = analysis.summary?.totalPagesFound || contentCount;

      if (focusType === 'content') {
        return `🎯 Check Links on ${contentCount} Content Pages`;
      } else {
        return `🔄 Check Links on All ${totalCount} Pages`;
      }
    }
    // EXISTING: Pattern analysis format
    else if (analysis.categories) {
      const contentPages = getSafeArray(analysis.categories.pages).length;
      const totalUrls = analysis.summary?.totalUrls || 0;

      if (focusType === 'content') {
        return `🎯 Check Links on ${contentPages} Content Pages`;
      } else {
        return `🔄 Check Links on All ${totalUrls} URLs`;
      }
    }

    return 'Check Links';
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Smart URL Analyzer</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Discover your site's content pages intelligently. Our smart analyzer finds real content
          pages and filters out non-essential URLs like pagination, admin pages, and archives.
        </p>
      </div>

      {/* Analysis Form */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔍 Analyze Website Structure</h2>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Website URL to Analyze
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border text-gray-500 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isAnalyzing}
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing || !url}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              isAnalyzing || !url
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Discovering Content Pages...
              </span>
            ) : (
              '🚀 Start Content Discovery'
            )}
          </button>
        </form>

        {/* Enhanced Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 How Smart Analysis Works</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              • <strong>Content Discovery:</strong> Finds real content pages (articles, posts,
              product pages)
            </p>
            <p>
              • <strong>Smart Filtering:</strong> Automatically excludes pagination, admin URLs, and
              archives
            </p>
            <p>
              • <strong>Efficient Processing:</strong> Focuses on pages that actually contain links
              worth checking
            </p>
            <p>
              • <strong>Scalable:</strong> Handles sites from 50 to 1000+ pages efficiently
            </p>
            <p>
              • <strong>Fallback Support:</strong> Uses pattern analysis for complex sites when
              needed
            </p>
          </div>
        </div>

        {/* Analysis Progress Log */}
        {analysisLog.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Analysis Progress</h3>
            <div
              ref={analysisScrollRef}
              className="bg-gray-50 border rounded-lg p-4 h-40 overflow-y-auto space-y-2"
            >
              {analysisLog.map((entry, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="text-gray-500 font-mono">{entry.timestamp}</span>
                  <span
                    className={`${
                      entry.type === 'error'
                        ? 'text-red-600'
                        : entry.type === 'success'
                        ? 'text-green-600'
                        : entry.type === 'warning'
                        ? 'text-yellow-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXISTING error display - NO CHANGES */}
        {error && !isAnalyzing && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
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

      {/* ENHANCED: Analysis Results Display for both formats */}
      {analysis && analysis.summary && (
        <div className="space-y-6">
          {/* ENHANCED: Summary Stats with format detection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {analysis.contentPages
                ? '📊 Content Discovery Results'
                : '📊 URL Pattern Analysis Results'}
            </h2>

            {/* NEW: Content Discovery Results */}
            {analysis.contentPages ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {getSafeNumber(analysis.summary.totalPagesFound)}
                  </div>
                  <div className="text-sm text-blue-800">Total Pages Found</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {getSafeNumber(analysis.summary.contentPages)}
                  </div>
                  <div className="text-sm text-green-800">Content Pages</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {getSafeNumber(analysis.summary.filteredOut)}
                  </div>
                  <div className="text-sm text-orange-800">Filtered Out</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(
                      (getSafeNumber(analysis.summary.contentPages) /
                        Math.max(getSafeNumber(analysis.summary.totalPagesFound), 1)) *
                        100
                    )}
                    %
                  </div>
                  <div className="text-sm text-purple-800">Content Ratio</div>
                </div>
              </div>
            ) : (
              /* EXISTING: Pattern Analysis Results - PRESERVED */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {getSafeNumber(analysis.summary.totalUrls)}
                  </div>
                  <div className="text-sm text-blue-800">Total URLs</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {getSafeNumber(analysis.summary.pagesAnalyzed)}
                  </div>
                  <div className="text-sm text-green-800">Pages Analyzed</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {getSafeNumber(analysis.summary.categories?.pages) || 0}
                  </div>
                  <div className="text-sm text-purple-800">Content Pages</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {Object.values(analysis.summary.categories || {}).reduce(
                      (sum, count) => sum + (count || 0),
                      0
                    ) - (getSafeNumber(analysis.summary.categories?.pages) || 0)}
                  </div>
                  <div className="text-sm text-orange-800">Other URLs</div>
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                {analysis.contentPages ? 'Page Categories Discovered:' : 'URL Categories Found:'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {Object.entries(analysis.summary.categories || {}).map(([category, count]) => (
                  <div key={category} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                    <span className="capitalize">
                      {category.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                    <span className="font-semibold">{getSafeNumber(count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Next Steps</h3>
            <p className="text-gray-600 mb-6">
              {analysis.contentPages
                ? `Ready to check links! We found ${analysis.contentPages.length} content pages that likely contain links worth checking.`
                : `Analysis complete! Choose how you want to check for broken links across the ${
                    analysis.summary?.totalUrls || 0
                  } discovered URLs.`}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleSmartCrawl('content')}
                disabled={isStartingCrawl || crawlStatus === 'running'}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {getCrawlButtonText('content')}
              </button>

              <button
                onClick={() => handleSmartCrawl('all')}
                disabled={isStartingCrawl || crawlStatus === 'running'}
                className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {getCrawlButtonText('all')}
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              <p>
                <strong>Content Pages:</strong>{' '}
                {analysis.contentPages
                  ? 'Focus on discovered content pages for faster, more relevant results'
                  : 'Focus on main content pages (articles, posts, product pages)'}
              </p>
              <p>
                <strong>All Pages:</strong> Check every discovered URL including navigation,
                archives, and system pages
              </p>
            </div>
          </div>

          {/* ENHANCED: Sample URLs Display */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {analysis.contentPages ? '📄 Sample Content Pages' : '📄 Sample URLs by Category'}
            </h3>

            {analysis.contentPages ? (
              /* NEW: Content pages sample display */
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-medium text-green-700 mb-2">
                    Content Pages ({analysis.contentPages.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {analysis.contentPages.slice(0, 10).map((page, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 text-sm bg-green-50 p-2 rounded"
                      >
                        <span className="text-green-600">📄</span>
                        <span className="text-gray-700 font-mono text-xs flex-1 truncate">
                          {page.url}
                        </span>
                        {page.title && <span className="text-gray-500 text-xs">{page.title}</span>}
                      </div>
                    ))}
                    {analysis.contentPages.length > 10 && (
                      <div className="text-xs text-gray-500 text-center py-2">
                        + {analysis.contentPages.length - 10} more content pages...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* EXISTING: Pattern analysis sample display - PRESERVED */
              <div className="space-y-4">
                {Object.entries(getDisplayCategories()).map(([category, urls]) => {
                  const urlArray = getSafeArray(urls).slice(0, 5);
                  if (urlArray.length === 0) return null;

                  const categoryColors = {
                    pages: 'bg-green-50 text-green-700',
                    withParams: 'bg-blue-50 text-blue-700',
                    pagination: 'bg-yellow-50 text-yellow-700',
                    dates: 'bg-purple-50 text-purple-700',
                    media: 'bg-red-50 text-red-700',
                    admin: 'bg-orange-50 text-orange-700',
                    api: 'bg-gray-50 text-gray-700',
                    other: 'bg-gray-50 text-gray-700',
                  };

                  return (
                    <div key={category}>
                      <h4
                        className={`text-md font-medium mb-2 ${
                          categoryColors[category] || 'text-gray-700'
                        }`}
                      >
                        {category.charAt(0).toUpperCase() +
                          category.slice(1).replace(/([A-Z])/g, ' $1')}{' '}
                        ({getSafeArray(urls).length})
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {urlArray.map((item, index) => (
                          <div
                            key={index}
                            className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded truncate"
                          >
                            {typeof item === 'string' ? item : item.url || 'Invalid URL'}
                          </div>
                        ))}
                        {getSafeArray(urls).length > 5 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            + {getSafeArray(urls).length - 5} more URLs...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* EXISTING: Recommendations - PRESERVED */}
          {analysis.summary?.recommendations && analysis.summary.recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Recommendations</h3>
              <div className="space-y-3">
                {analysis.summary.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      rec.type === 'warning'
                        ? 'bg-yellow-50 border-yellow-400'
                        : rec.type === 'suggestion'
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-green-50 border-green-400'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{rec.message}</p>
                    {rec.action && <p className="text-sm text-gray-600 mt-1">{rec.action}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXISTING: Crawl Progress Display - PRESERVED */}
      {(crawlStatus === 'starting' || crawlStatus === 'running') && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Link Checking in Progress</h3>

          {crawlProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>
                  {crawlProgress.current || 0} / {crawlProgress.total || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      ((crawlProgress.current || 0) / (crawlProgress.total || 1)) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {crawlStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-lg font-bold text-blue-600">
                  {crawlStats.totalChecked || 0}
                </div>
                <div className="text-sm text-blue-800">Checked</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-600">
                  {(crawlStats.totalChecked || 0) - (crawlStats.brokenLinks || 0)}
                </div>
                <div className="text-sm text-green-800">Working</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-lg font-bold text-red-600">{crawlStats.brokenLinks || 0}</div>
                <div className="text-sm text-red-800">Broken</div>
              </div>
            </div>
          )}

          {/* Crawl Log */}
          <div className="border-t pt-4">
            <h4 className="text-md font-medium text-gray-900 mb-2">📋 Activity Log</h4>
            <div
              ref={scrollRef}
              className="bg-gray-50 border rounded-lg p-3 h-32 overflow-y-auto space-y-1"
            >
              {crawlLog.map((entry, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="text-gray-500 font-mono text-xs">{entry.timestamp}</span>
                  <span
                    className={`${
                      entry.type === 'error'
                        ? 'text-red-600'
                        : entry.type === 'success'
                        ? 'text-green-600'
                        : entry.type === 'warning'
                        ? 'text-yellow-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EXISTING: Crawl Complete/Failed Status - PRESERVED */}
      {crawlStatus === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">Crawl Completed Successfully!</h3>
              <p className="text-green-700">
                Found {crawlStats?.brokenLinks || 0} broken links out of{' '}
                {crawlStats?.totalChecked || 0} total links. Redirecting to results page...
              </p>
            </div>
          </div>
        </div>
      )}

      {crawlStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
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
              <h3 className="text-lg font-medium text-red-800">Crawl Failed</h3>
              <p className="text-red-700">
                The link checking process encountered an error. Please try again or contact support
                if the problem persists.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
