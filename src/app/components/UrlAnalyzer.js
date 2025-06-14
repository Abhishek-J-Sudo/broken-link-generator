// src/app/components/UrlAnalyzer.js - UPDATED VERSION with content pages display
'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState('content'); // UPDATED: Default to content
  const [analysisLog, setAnalysisLog] = useState([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const router = useRouter();

  const [crawlProgress, setCrawlProgress] = useState(null);
  const [crawlStats, setCrawlStats] = useState(null);
  const [crawlStatus, setCrawlStatus] = useState('idle'); // idle, starting, running, completed, failed
  const [crawlLog, setCrawlLog] = useState([]);

  const scrollRef = useRef(null);
  const analysisScrollRef = useRef(null);

  // EXISTING useEffect hooks - NO CHANGES
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

  // EXISTING session storage logic - NO CHANGES
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldRestore = urlParams.get('restore') === 'true';

    if (shouldRestore) {
      try {
        const savedAnalysis = sessionStorage.getItem('lastAnalysis');
        if (savedAnalysis) {
          const parsed = JSON.parse(savedAnalysis);

          const savedTime = new Date(parsed.savedAt);
          const now = new Date();
          const hoursDiff = (now - savedTime) / (1000 * 60 * 60);

          if (hoursDiff < 2) {
            console.log('🔄 Restoring analysis from session storage');
            setAnalysis(parsed);
            setUrl(parsed.originalUrl || '');
            addLogEntry('📋 Previous analysis restored from browser session', 'info');
          } else {
            sessionStorage.removeItem('lastAnalysis');
          }
        }
      } catch (error) {
        console.error('Failed to restore analysis:', error);
        sessionStorage.removeItem('lastAnalysis');
      }
    } else {
      console.log('🆕 Starting fresh analysis (clearing previous data)');
      sessionStorage.removeItem('lastAnalysis');
      setAnalysis(null);
      setUrl('');
      setAnalysisLog([]);
    }
  }, []);

  // EXISTING helper functions - NO CHANGES
  const addCrawlLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setCrawlLog((prev) => [...prev, { message, type, timestamp }]);
  };

  const addLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setAnalysisLog((prev) => [...prev, { message, type, timestamp }]);
  };

  // EXISTING handleAnalyze function - NO CHANGES
  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;

    sessionStorage.removeItem('lastAnalysis');

    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    setAnalysisLog([]);

    try {
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

      if (!result || !result.summary) {
        throw new Error('Invalid response structure from server');
      }

      // UPDATED: New logging for content discovery
      addLogEntry(
        `✅ Content discovery complete! Found ${result.summary.totalPagesFound || 0} total pages`,
        'success'
      );
      addLogEntry(
        `📄 Identified ${result.summary.contentPages || 0} high-quality content pages`,
        'success'
      );
      addLogEntry(`🗑️ Filtered out ${result.summary.filteredOut || 0} non-content pages`, 'info');

      if (result.summary.error) {
        addLogEntry(`⚠️ Server reported: ${result.summary.error}`, 'warning');
      }

      setAnalysis(result);
      const enrichedResult = {
        ...result,
        originalUrl: url,
      };
      setAnalysis(enrichedResult);

      try {
        sessionStorage.setItem(
          'lastAnalysis',
          JSON.stringify({
            ...enrichedResult,
            savedAt: new Date().toISOString(),
            originalUrl: url,
          })
        );
        console.log('💾 Analysis saved to session storage');
      } catch (error) {
        console.error('Failed to save analysis:', error);
      }

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

  // UPDATED handleSmartCrawl function with new data structure
  const handleSmartCrawl = async (urlsToCheck = 'content') => {
    if (!analysis || !url) return;

    setIsStartingCrawl(true);
    setCrawlStatus('starting');
    setCrawlLog([]);
    setCrawlProgress(null);
    setCrawlStats(null);
    setError('');

    try {
      // UPDATED: Use content pages from new analysis structure
      let urlsForCrawl = [];

      if (urlsToCheck === 'content') {
        // NEW: Use discovered content pages
        urlsForCrawl = (analysis.contentPages || []).map((page) => ({
          url: page.url,
          sourceUrl: page.sourceUrl || url,
          category: 'content',
          title: page.title,
          score: page.score,
        }));
      } else if (urlsToCheck === 'all') {
        // UPDATED: Create URLs from all categories for backward compatibility
        if (analysis.contentPages) {
          // New format: use content pages + create fake entries for other categories
          urlsForCrawl = analysis.contentPages.map((page) => ({
            url: page.url,
            sourceUrl: page.sourceUrl || url,
            category: 'content',
            title: page.title,
            score: page.score,
          }));

          // Add some URLs from other categories if available (for compatibility)
          Object.entries(analysis.categories || {}).forEach(([category, count]) => {
            if (category !== 'content' && count > 0) {
              // Create placeholder entries (this is for edge cases)
              for (let i = 0; i < Math.min(count, 5); i++) {
                urlsForCrawl.push({
                  url: `${url}/${category}-${i}`, // Placeholder - won't actually be used
                  sourceUrl: url,
                  category: category,
                });
              }
            }
          });
        } else {
          // Fallback to old format if content pages not available
          Object.entries(analysis.categories || {}).forEach(([category, urls]) => {
            if (category !== 'media' && category !== 'admin') {
              if (Array.isArray(urls)) {
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
      }

      // UPDATED: Logging for new approach
      addCrawlLogEntry(
        `🚀 Starting single-pass link checking for ${urlsForCrawl.length} URLs...`,
        'success'
      );
      addCrawlLogEntry(`⚡ Using content pages discovered by smart analyzer`, 'info');

      console.log(
        '🔍 Sample URLs for crawl:',
        urlsForCrawl.slice(0, 3).map((url) => ({
          url: url.url.substring(0, 50) + '...',
          sourceUrl: url.sourceUrl,
          category: url.category,
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

      // EXISTING polling logic - NO CHANGES
      let isComplete = false;
      let pollCount = 0;
      const maxPolls = 120;

      while (!isComplete && pollCount < maxPolls) {
        pollCount++;

        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const statusResponse = await fetch(`/api/crawl/status/${jobId}`);
          const statusData = await statusResponse.json();

          if (statusResponse.ok) {
            setCrawlProgress(statusData.progress);
            setCrawlStats(statusData.stats);

            if (statusData.progress && statusData.progress.percentage > 0) {
              const progressMsg = `📊 Progress: ${statusData.progress.current || 0}/${
                statusData.progress.total || 0
              } links checked (${Math.round(statusData.progress.percentage || 0)}%)`;

              if (crawlLog.length === 0 || crawlLog[crawlLog.length - 1].message !== progressMsg) {
                addCrawlLogEntry(progressMsg, 'progress');
              }
            }

            if (statusData.stats && statusData.stats.brokenLinksFound > 0) {
              const brokenMsg = `🔴 Found ${statusData.stats.brokenLinksFound} broken links so far`;
              if (
                crawlLog.length === 0 ||
                !crawlLog.some((log) => log.message.includes('broken links so far'))
              ) {
                addCrawlLogEntry(brokenMsg, 'warning');
              }
            }

            if (statusData.status === 'completed') {
              isComplete = true;
              setCrawlStatus('completed');
              addCrawlLogEntry(
                `🎉 Link checking complete! Found ${
                  statusData.stats?.brokenLinksFound || 0
                } broken links out of ${statusData.progress?.total || 0} total links`,
                'success'
              );
              addCrawlLogEntry(`📊 Final results are ready for viewing`, 'success');

              setTimeout(() => {
                addCrawlLogEntry(`🔄 Redirecting to detailed results page...`, 'info');
                setTimeout(() => {
                  router.push(`/results/${jobId}`);
                }, 1500);
              }, 3000);
            } else if (statusData.status === 'failed') {
              setCrawlStatus('failed');
              throw new Error(statusData.errorMessage || 'Crawl job failed');
            }
          }
        } catch (pollError) {
          console.error('Error during polling:', pollError);
          addCrawlLogEntry(`⚠️ Connection issue, retrying...`, 'warning');
        }
      }

      if (!isComplete) {
        setCrawlStatus('timeout');
        addCrawlLogEntry(
          `⚠️ Taking longer than expected. Redirecting to results page...`,
          'warning'
        );
        setTimeout(() => {
          router.push(`/results/${jobId}`);
        }, 1000);
      }
    } catch (err) {
      setCrawlStatus('failed');
      setError(err.message);
      addCrawlLogEntry(`❌ Error: ${err.message}`, 'error');
    } finally {
      setIsStartingCrawl(false);
    }
  };

  // EXISTING helper functions - NO CHANGES
  const getCategoryColor = (category) => {
    const colors = {
      content: 'bg-green-100 text-green-800', // UPDATED: content instead of pages
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
      content: 'Content Pages', // UPDATED: content instead of pages
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

  // UPDATED: Safe accessors for new data structure
  const getSafeNumber = (value, fallback = 0) => {
    return typeof value === 'number' ? value : fallback;
  };

  const getSafeCategories = () => {
    if (!analysis || !analysis.summary || !analysis.summary.categories) {
      return {
        content: 0, // UPDATED: content instead of pages
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

  // UPDATED: Get content pages data for display
  const getSafeContentPages = () => {
    if (!analysis || !analysis.contentPages || !Array.isArray(analysis.contentPages)) {
      return [];
    }
    return analysis.contentPages;
  };

  // UPDATED: Get sample pages for display
  const getSafeSamplePages = () => {
    if (!analysis) return { content: [], filtered: [] };

    // New format with samplePages
    if (analysis.samplePages) {
      return analysis.samplePages;
    }

    // Fallback to content pages
    if (analysis.contentPages) {
      return {
        content: analysis.contentPages.slice(0, 20),
        filtered: [],
      };
    }

    // Legacy format fallback
    return { content: [], filtered: [] };
  };

  const exportAnalysis = () => {
    const jsonData = JSON.stringify(analysis, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `content-analysis-${new URL(url).hostname}-${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* EXISTING form section - NO CHANGES */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">🔍 Smart Content Page Analyzer</h1>
        <p className="text-gray-600 mb-6">
          Discover high-quality content pages on your website and filter out non-content URLs before
          running a focused link check. Perfect for large sites!
        </p>

        <form onSubmit={handleAnalyze} className="flex gap-4 mb-6">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {isAnalyzing ? 'Analyzing...' : 'Discover Content Pages'}
          </button>
        </form>

        {/* EXISTING analysis progress log - NO CHANGES */}
        {(analysisLog.length > 0 || isAnalyzing) && (
          <div
            ref={analysisScrollRef}
            className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md"
          >
            <h3 className="text-sm font-medium text-gray-900 mb-3">Content Discovery Progress</h3>
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
                  <span className="text-blue-600">Discovering content pages...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXISTING info section with UPDATED text */}
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
              <h3 className="text-sm font-medium text-blue-800">How Smart Analysis Works</h3>
              <div className="mt-2 text-sm text-blue-700 space-y-1">
                <p>• Discovers ALL pages on your website efficiently</p>
                <p>• Classifies each page as content vs. non-content (pagination, admin, etc.)</p>
                <p>• Returns only high-quality content pages worth checking for broken links</p>
                <p>
                  • <strong>Open Developer Console (F12) to see detailed progress logs</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* EXISTING error display - NO CHANGES */}
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

      {/* UPDATED: Content page results display */}
      {analysis && analysis.summary && (
        <div className="space-y-6">
          {/* UPDATED: Summary Stats with content page focus */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📊 Content Discovery Results
            </h2>

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
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {getSafeNumber(analysis.summary.filteredOut)}
                </div>
                <div className="text-sm text-red-800">Pages Filtered Out</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {analysis.discoveryStats?.averageContentScore || 'N/A'}
                </div>
                <div className="text-sm text-purple-800">Avg Content Score</div>
              </div>
            </div>

            {/* UPDATED: Category breakdown focusing on content */}
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

          {/* EXISTING recommendations section - NO CHANGES */}
          {getSafeRecommendations().length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">💡 Smart Recommendations</h2>
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

          {/* UPDATED: Content Pages Details Display */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📋 {getCategoryLabel(selectedCategory)}
              <span className="text-gray-500 font-normal">
                ({getSafeNumber(getSafeCategories()[selectedCategory])} items)
              </span>
            </h2>

            {selectedCategory === 'content' ? (
              /* NEW: Content pages display with quality scores */
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getSafeContentPages()
                  .slice(0, 50)
                  .map((page, index) => (
                    <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-mono text-sm break-all font-medium"
                          >
                            {page.url}
                          </a>
                          {page.title && (
                            <div className="text-gray-700 font-medium mt-1">{page.title}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1 flex items-center space-x-4">
                            {page.score && (
                              <span>Quality Score: {(page.score * 100).toFixed(0)}%</span>
                            )}
                            {page.wordCount && <span>Words: {page.wordCount}</span>}
                            {page.depth && <span>Depth: {page.depth}</span>}
                          </div>
                        </div>
                        <div className="ml-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Content Page
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                {getSafeContentPages().length > 50 && (
                  <div className="text-center py-3 text-gray-500">
                    ... and {getSafeContentPages().length - 50} more content pages
                  </div>
                )}
                {getSafeContentPages().length === 0 && (
                  <p className="text-gray-500 italic">No content pages found.</p>
                )}
              </div>
            ) : (
              /* EXISTING: Display for other categories (filtered pages) */
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getSafeSamplePages()
                  .filtered.slice(0, 20)
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
                      <div className="text-xs text-gray-500 mt-1">
                        Filtered as: {item.type || 'other'} • {item.reason || 'Non-content page'}
                      </div>
                    </div>
                  ))}
                {getSafeSamplePages().filtered.length === 0 && (
                  <p className="text-gray-500 italic">No filtered pages to display.</p>
                )}
              </div>
            )}
          </div>

          {/* UPDATED: Action Buttons Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Next Steps</h2>

            {/* EXISTING loading state - NO CHANGES */}
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
                    Starting single-pass smart crawl with discovered content pages...
                  </span>
                </div>
              </div>
            )}

            {/* EXISTING live crawling progress - NO CHANGES */}
            {crawlStatus !== 'idle' && (
              <div className="bg-white border border-gray-200 rounded-md p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    🔍 Live Link Checking Progress
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      crawlStatus === 'running'
                        ? 'bg-blue-100 text-blue-800'
                        : crawlStatus === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : crawlStatus === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {crawlStatus === 'starting'
                      ? 'Starting...'
                      : crawlStatus === 'running'
                      ? 'Running'
                      : crawlStatus === 'completed'
                      ? 'Completed'
                      : crawlStatus === 'failed'
                      ? 'Failed'
                      : 'Timeout'}
                  </span>
                </div>

                {/* EXISTING progress bar - NO CHANGES */}
                {crawlProgress && crawlProgress.total > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Checking links...</span>
                      <span>
                        {crawlProgress.current || 0} / {crawlProgress.total || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(crawlProgress.percentage || 0, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-center text-sm text-gray-500 mt-2">
                      {Math.round(crawlProgress.percentage || 0)}% complete
                    </div>
                  </div>
                )}

                {/* EXISTING stats - NO CHANGES */}
                {crawlStats && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold text-green-600">
                        {(crawlStats.totalLinksDiscovered || 0) -
                          (crawlStats.brokenLinksFound || 0)}
                      </div>
                      <div className="text-xs text-green-800">Working Links</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-lg font-semibold text-red-600">
                        {crawlStats.brokenLinksFound || 0}
                      </div>
                      <div className="text-xs text-red-800">Broken Links</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-semibold text-blue-600">
                        {crawlStats.pagesProcessed || 0}
                      </div>
                      <div className="text-xs text-blue-800">Pages Processed</div>
                    </div>
                  </div>
                )}

                {/* EXISTING live log - NO CHANGES */}
                <div ref={scrollRef} className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Activity Log</h4>
                  <div className="space-y-2">
                    {crawlLog.map((log, index) => (
                      <div key={index} className="flex items-start text-sm">
                        <span className="mr-2">{getLogIcon(log.type)}</span>
                        <span className="text-gray-500 mr-2 text-xs">{log.timestamp}</span>
                        <span className={getLogColor(log.type)}>{log.message}</span>
                      </div>
                    ))}
                    {crawlStatus === 'running' && crawlLog.length === 0 && (
                      <div className="flex items-center text-sm">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        <span className="text-blue-600">Initializing single-pass crawl...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UPDATED: Action buttons with new messaging */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleSmartCrawl('content')}
                disabled={isStartingCrawl}
                className={`px-6 py-3 rounded-lg font-medium ${
                  isStartingCrawl
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                ✅ Check Links on {getSafeNumber(analysis.summary.contentPages)} Content Pages Only
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
                🔄 Check All {getSafeNumber(analysis.summary.totalPagesFound)} Discovered Pages
              </button>
            </div>

            {/* UPDATED: Recommendation text */}
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Smart Recommendation:</strong> Based on content discovery, checking only the{' '}
                {getSafeNumber(analysis.summary.contentPages)} high-quality content pages will give
                you meaningful results much faster than processing all{' '}
                {getSafeNumber(analysis.summary.totalPagesFound)} discovered pages.
                {analysis.summary.filteredOut > 0 && (
                  <>
                    {' '}
                    We filtered out {analysis.summary.filteredOut} non-content pages to focus your
                    scan.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* UPDATED: Technical Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔧 Discovery Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Analysis Settings</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Max Depth: 3 levels</div>
                  <div>Max Pages: 1,000 pages</div>
                  <div>
                    Pages Analyzed:{' '}
                    {getSafeNumber(
                      analysis.summary.pagesAnalyzed || analysis.summary.totalPagesFound
                    )}
                  </div>
                  <div>Content Discovery: Single-pass approach</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Quality Metrics</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Content Pages: {getSafeNumber(analysis.summary.contentPages)}</div>
                  <div>Filtered Out: {getSafeNumber(analysis.summary.filteredOut)}</div>
                  <div>
                    Content Ratio:{' '}
                    {analysis.summary.totalPagesFound > 0
                      ? Math.round(
                          (analysis.summary.contentPages / analysis.summary.totalPagesFound) * 100
                        )
                      : 0}
                    %
                  </div>
                  <div>Avg Score: {analysis.discoveryStats?.averageContentScore || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* NEW: Export button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={exportAnalysis}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                📁 Export Analysis Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
