/**
 * Unified Analyze Page - Enhanced for Smart Analyzer Content Discovery
 * MERGED: Main branch working page + Smart analyzer content page support
 */

'use client';

import { useState } from 'react';
import UrlAnalyzer from '@/app/components/UrlAnalyzer';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import ResultsTable from '@/app/components/ResultsTable';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';

export default function UnifiedAnalyzePage() {
  // MAIN BRANCH STATE - PRESERVED EXACTLY
  const [currentStep, setCurrentStep] = useState('analyze'); // 'analyze', 'crawl', 'results'
  const [analysisData, setAnalysisData] = useState(null);
  const [crawlJobId, setCrawlJobId] = useState(null);
  const [crawlResults, setCrawlResults] = useState(null);

  // MAIN BRANCH: Analysis completion handler - PRESERVED
  const handleAnalysisComplete = (analysis) => {
    console.log('📊 Analysis complete:', analysis);
    setAnalysisData(analysis);
    // Stay on analyze step, just show the action buttons
  };

  // ENHANCED: Crawl start handler with content pages support
  const handleStartCrawl = (focusType) => {
    console.log('🚀 Starting crawl with focus:', focusType);
    setCurrentStep('crawl');

    // ENHANCED: Support both new and legacy data structures
    const crawlData = {
      sourceAnalysis: true,
      focusType: focusType,
      originalUrl: analysisData.originalUrl || '',
      timestamp: Date.now(),
    };

    // NEW: Support content discovery format
    if (analysisData.contentPages && Array.isArray(analysisData.contentPages)) {
      crawlData.contentPages = analysisData.contentPages;
      crawlData.totalAnalyzed =
        analysisData.summary?.totalPagesFound || analysisData.contentPages.length;
      crawlData.filteredOut = analysisData.summary?.filteredOut || 0;
      crawlData.analysisType = 'content_discovery';

      if (focusType === 'content') {
        // Use discovered content pages
        crawlData.discoveredUrls = analysisData.contentPages;
      } else {
        // For 'all' option, try to include all discovered pages if available
        crawlData.discoveredUrls =
          analysisData.allDiscoveredPages?.slice(0, 500) || analysisData.contentPages;
      }
    }
    // FALLBACK: Legacy pattern analysis format support
    else if (analysisData.categories) {
      crawlData.totalAnalyzed = analysisData.summary?.totalUrls || 0;
      crawlData.categories = analysisData.summary?.categories || {};
      crawlData.recommendations = analysisData.summary?.recommendations || [];
      crawlData.analysisType = 'pattern_analysis';

      crawlData.discoveredUrls =
        focusType === 'content'
          ? analysisData.categories.pages?.map((p) => p.url) || []
          : Object.values(analysisData.categories || {})
              .flat()
              .map((item) => (typeof item === 'string' ? item : item.url));
    }

    console.log(`📊 Prepared crawl data:`, {
      type: crawlData.analysisType,
      urlCount: crawlData.discoveredUrls?.length || 0,
      focusType,
    });

    return crawlData;
  };

  // MAIN BRANCH: Job lifecycle handlers - PRESERVED EXACTLY
  const handleJobStarted = (jobResult) => {
    console.log('✅ Job started:', jobResult);
    setCrawlJobId(jobResult.jobId);
    // Stay on crawl step to show progress
  };

  const handleJobComplete = (results) => {
    console.log('🎉 Job complete:', results);
    setCrawlResults(results);
    setCurrentStep('results');
  };

  const resetToAnalyze = () => {
    setCurrentStep('analyze');
    setAnalysisData(null);
    setCrawlJobId(null);
    setCrawlResults(null);
  };

  const goBackToCrawl = () => {
    setCurrentStep('crawl');
    setCrawlResults(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MAIN BRANCH: Header - NO CHANGES */}
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* MAIN BRANCH: Step 1 - URL Analysis - NO CHANGES */}
        {currentStep === 'analyze' && (
          <UrlAnalyzer
            onAnalysisComplete={handleAnalysisComplete}
            onStartCrawl={handleStartCrawl}
            showCrawlButtons={!!analysisData}
            analysisData={analysisData}
          />
        )}

        {/* ENHANCED: Step 2 - Link Checking with content discovery support */}
        {currentStep === 'crawl' && analysisData && (
          <div className="space-y-6">
            {/* ENHANCED: Analysis Summary with dual format support */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {analysisData.contentPages
                      ? 'Content Discovery Summary'
                      : 'URL Analysis Summary'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {/* NEW: Content discovery messaging */}
                    {analysisData.contentPages ? (
                      <>
                        Found {analysisData.summary?.totalPagesFound || 0} total pages, identified{' '}
                        <strong>
                          {analysisData.contentPages.length} high-quality content pages
                        </strong>
                        {analysisData.summary?.filteredOut > 0 && (
                          <>
                            , filtered out <strong>{analysisData.summary.filteredOut}</strong>{' '}
                            non-content pages
                          </>
                        )}
                      </>
                    ) : (
                      /* FALLBACK: Pattern analysis messaging */
                      <>
                        Found <strong>{analysisData.summary?.totalUrls || 0} URLs</strong> across{' '}
                        <strong>{analysisData.summary?.pagesAnalyzed || 0} pages</strong>, including{' '}
                        <strong>
                          {analysisData.summary?.categories?.pages || 0} content pages
                        </strong>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={resetToAnalyze}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Back to Analysis
                </button>
              </div>
            </div>

            {/* ENHANCED: Analysis Type Indicator */}
            <div
              className={`rounded-lg p-4 border-l-4 ${
                analysisData.contentPages
                  ? 'bg-green-50 border-green-400'
                  : 'bg-blue-50 border-blue-400'
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {analysisData.contentPages ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h4
                    className={`text-sm font-medium ${
                      analysisData.contentPages ? 'text-green-800' : 'text-blue-800'
                    }`}
                  >
                    {analysisData.contentPages
                      ? 'Smart Content Discovery Active'
                      : 'Pattern Analysis Completed'}
                  </h4>
                  <p
                    className={`text-sm ${
                      analysisData.contentPages ? 'text-green-700' : 'text-blue-700'
                    }`}
                  >
                    {analysisData.contentPages
                      ? 'Using single-pass approach: visit content pages → extract all links → check status'
                      : 'Using traditional approach: check discovered URLs directly or crawl for more'}
                  </p>
                </div>
              </div>
            </div>

            {/* ENHANCED: Crawl Form with proper data formatting */}
            <LargeCrawlForm
              onJobStarted={handleJobStarted}
              analyzedData={{
                // NEW: Content discovery format support
                ...(analysisData.contentPages && {
                  contentPages: analysisData.contentPages,
                  summary: analysisData.summary,
                  analysisType: 'content_discovery',
                  allDiscoveredPages: analysisData.allDiscoveredPages,
                }),
                // FALLBACK: Legacy pattern analysis format
                ...(!analysisData.contentPages &&
                  analysisData.categories && {
                    discoveredUrls: Object.values(analysisData.categories)
                      .flat()
                      .map((item) => (typeof item === 'string' ? item : item.url))
                      .filter(Boolean),
                    categories: analysisData.summary?.categories,
                    analysisType: 'pattern_analysis',
                  }),
                // COMMON: Shared properties for both formats
                sourceAnalysis: true,
                focusType: 'content',
                originalUrl: analysisData.originalUrl,
                timestamp: Date.now(),
                recommendations: analysisData.summary?.recommendations || [],
              }}
              isFromAnalyzer={true}
              onJobComplete={handleJobComplete}
            />

            {/* ENHANCED: Quick Stats Preview */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">What Will Be Checked</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {analysisData.contentPages ? (
                  /* NEW: Content discovery stats */
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>
                        <strong>{analysisData.contentPages.length}</strong> content pages to visit
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span>
                        <strong>All links</strong> within those pages
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <span>
                        <strong>Single-pass</strong> efficient approach
                      </span>
                    </div>
                  </>
                ) : (
                  /* FALLBACK: Pattern analysis stats */
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span>
                        <strong>{analysisData.summary?.categories?.pages || 0}</strong> content
                        pages
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                      <span>
                        <strong>{analysisData.summary?.totalUrls || 0}</strong> total URLs found
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span>
                        <strong>Pattern-based</strong> filtering
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAIN BRANCH: Step 3 - Results Display - PRESERVED EXACTLY */}
        {currentStep === 'results' && crawlResults && (
          <div className="space-y-6">
            {/* EXISTING: Quick Actions Bar - NO CHANGES */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Crawl Results</h3>
                  <p className="text-sm text-gray-600">
                    Found {crawlResults.brokenLinksCount || 0} broken links out of{' '}
                    {crawlResults.totalLinksChecked || 0} total links checked
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={goBackToCrawl}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ← Back to Crawl
                  </button>
                  <button
                    onClick={resetToAnalyze}
                    className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </div>

            {/* EXISTING: Results Table - NO CHANGES */}
            <ResultsTable
              jobId={crawlJobId}
              brokenLinks={crawlResults.brokenLinks}
              onPageChange={(page) => {
                // Handle pagination if needed
                console.log('Page changed to:', page);
              }}
              onFilter={(filters) => {
                // Handle filtering if needed
                console.log('Filters applied:', filters);
              }}
            />
          </div>
        )}
      </div>

      {/* MAIN BRANCH: Footer and Security Notice - PRESERVED */}
      <div className="mt-12">
        <SecurityNotice variant="compact" />
      </div>
      <Footer />
    </div>
  );
}
