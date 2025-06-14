// src/app/analyze/page.js - UPDATED VERSION with content-focused messaging
'use client';

import { useState } from 'react';
import UrlAnalyzer from '@/app/components/UrlAnalyzer';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import ResultsTable from '@/app/components/ResultsTable';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';

export default function UnifiedAnalyzePage() {
  const [currentStep, setCurrentStep] = useState('analyze'); // 'analyze', 'crawl', 'results'
  const [analysisData, setAnalysisData] = useState(null);
  const [crawlJobId, setCrawlJobId] = useState(null);
  const [crawlResults, setCrawlResults] = useState(null);

  // EXISTING handleAnalysisComplete - NO CHANGES
  const handleAnalysisComplete = (analysis) => {
    console.log('📊 Analysis complete:', analysis);
    setAnalysisData(analysis);
    // Stay on analyze step, just show the action buttons
  };

  // UPDATED: handleStartCrawl with content pages support
  const handleStartCrawl = (focusType) => {
    console.log('🚀 Starting crawl with focus:', focusType);
    setCurrentStep('crawl');

    // UPDATED: Support both new and legacy data structures
    const crawlData = {
      sourceAnalysis: true,
      focusType: focusType,
      originalUrl: analysisData.originalUrl || '',
      timestamp: Date.now(),
    };

    // NEW: Support content pages format
    if (analysisData.contentPages && Array.isArray(analysisData.contentPages)) {
      crawlData.contentPages = analysisData.contentPages;
      crawlData.totalAnalyzed =
        analysisData.summary?.totalPagesFound || analysisData.contentPages.length;
      crawlData.filteredOut = analysisData.summary?.filteredOut || 0;

      if (focusType === 'content') {
        crawlData.discoveredUrls = analysisData.contentPages;
      } else {
        // For 'all' option, include content pages (main focus)
        crawlData.discoveredUrls = analysisData.contentPages;
      }
    }
    // FALLBACK: Legacy format support
    else if (analysisData.categories) {
      crawlData.discoveredUrls =
        focusType === 'content'
          ? analysisData.categories.pages?.map((p) => p.url) || []
          : Object.values(analysisData.categories || {})
              .flat()
              .map((item) => item.url);

      crawlData.totalAnalyzed = analysisData.summary?.totalUrls || 0;
      crawlData.categories = analysisData.summary?.categories || {};
      crawlData.recommendations = analysisData.summary?.recommendations || [];
    }

    return crawlData;
  };

  // EXISTING functions - NO CHANGES
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
      {/* EXISTING Header - NO CHANGES */}
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* EXISTING Step 1: URL Analysis - NO CHANGES */}
        {currentStep === 'analyze' && (
          <UrlAnalyzer
            onAnalysisComplete={handleAnalysisComplete}
            onStartCrawl={handleStartCrawl}
            showCrawlButtons={!!analysisData}
            analysisData={analysisData}
          />
        )}

        {/* UPDATED Step 2: Link Checking with content-focused messaging */}
        {currentStep === 'crawl' && analysisData && (
          <div className="space-y-6">
            {/* UPDATED: Analysis Summary with content page focus */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Content Discovery Summary</h3>
                  <p className="text-sm text-gray-600">
                    {/* UPDATED: Support both data formats */}
                    {analysisData.contentPages ? (
                      <>
                        Found {analysisData.summary?.totalPagesFound || 0} total pages, identified{' '}
                        {analysisData.contentPages.length} high-quality content pages
                        {analysisData.summary?.filteredOut > 0 && (
                          <>, filtered out {analysisData.summary.filteredOut} non-content pages</>
                        )}
                      </>
                    ) : (
                      <>
                        Found {analysisData.summary?.totalUrls || 0} URLs,
                        {analysisData.summary?.categories?.pages || 0} content pages
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={resetToAnalyze}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ← Back to Analysis
                </button>
              </div>
            </div>

            {/* UPDATED: Smart Crawl Form with enhanced data */}
            <LargeCrawlForm
              onJobStarted={handleJobStarted}
              analyzedData={{
                // NEW: Support content pages format
                ...(analysisData.contentPages && {
                  contentPages: analysisData.contentPages,
                  summary: analysisData.summary,
                  discoveryStats: analysisData.discoveryStats,
                }),
                // FALLBACK: Legacy format
                ...(!analysisData.contentPages && {
                  discoveredUrls: analysisData.categories?.pages?.map((p) => p.url) || [],
                  categories: analysisData.summary?.categories,
                }),
                // COMMON: Shared properties
                sourceAnalysis: true,
                focusType: 'content',
                originalUrl: analysisData.originalUrl,
              }}
              isFromAnalyzer={true}
              onJobComplete={handleJobComplete}
              embedded={true}
            />
          </div>
        )}

        {/* EXISTING Step 3: Results - NO CHANGES */}
        {currentStep === 'results' && crawlResults && (
          <div className="space-y-6">
            {/* EXISTING Quick Actions - NO CHANGES */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Link Check Complete</h3>
                  <p className="text-sm text-gray-600">
                    Found {crawlResults.brokenLinks?.length || 0} broken links
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={goBackToCrawl}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    ← Back to Crawl
                  </button>
                  <button
                    onClick={resetToAnalyze}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    🔍 Analyze Another Site
                  </button>
                </div>
              </div>
            </div>

            {/* EXISTING Results Display - NO CHANGES */}
            <ResultsTable
              jobId={crawlJobId}
              brokenLinks={crawlResults.brokenLinks}
              pagination={crawlResults.pagination}
            />
          </div>
        )}

        {/* EXISTING Security Notice - NO CHANGES */}
        <SecurityNotice variant="compact" />
      </div>

      {/* EXISTING Footer - NO CHANGES */}
      <Footer />
    </div>
  );
}
