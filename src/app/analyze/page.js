// src/app/analyze/page.js - FIXED VERSION - Keep original UI structure with just data updates
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

  const handleAnalysisComplete = (analysis) => {
    console.log('📊 Analysis complete:', analysis);
    setAnalysisData(analysis);
    // Stay on analyze step, just show the action buttons
  };

  const handleStartCrawl = (focusType) => {
    console.log('🚀 Starting crawl with focus:', focusType);
    setCurrentStep('crawl');

    // 🔥 UPDATED: Enhanced crawl data with new structure
    const crawlData = {
      sourceAnalysis: true,
      focusType: focusType,
      // 🔥 NEW: Support both crawl modes
      discoveredUrls:
        focusType === 'content_pages'
          ? analysisData.categories.pages.map((p) => ({
              url: p.url,
              sourceUrl: p.sourceUrl || analysisData.originalUrl,
            }))
          : focusType === 'discovered_links'
          ? analysisData.discoveredLinks || []
          : analysisData.categories.pages.map((p) => p.url), // Fallback for backward compatibility
      totalAnalyzed: analysisData.summary.totalUrls,
      totalLinksFound: analysisData.summary.totalLinksFound || 0, // 🔥 NEW
      categories: analysisData.summary.categories,
      recommendations: analysisData.summary.recommendations,
      timestamp: Date.now(),
      originalUrl: analysisData.originalUrl || '',
    };

    return crawlData;
  };

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
      {/* Header with Step Indicator */}
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Step 1: URL Analysis */}
        {currentStep === 'analyze' && (
          <UrlAnalyzer
            onAnalysisComplete={handleAnalysisComplete}
            onStartCrawl={handleStartCrawl}
            showCrawlButtons={!!analysisData}
            analysisData={analysisData}
          />
        )}

        {/* Step 2: Link Checking */}
        {currentStep === 'crawl' && analysisData && (
          <div className="space-y-6">
            {/* 🔥 UPDATED: Enhanced Analysis Summary */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Analysis Summary</h3>
                  <p className="text-sm text-gray-600">
                    Found {analysisData.summary.totalUrls} URLs,{' '}
                    {analysisData.summary.totalLinksFound || 0} total links,{' '}
                    {analysisData.summary.categories.pages} content pages
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

            {/* 🔥 UPDATED: Smart Crawl Form with enhanced data */}
            <LargeCrawlForm
              onJobStarted={handleJobStarted}
              analyzedData={{
                sourceAnalysis: true,
                // 🔥 NEW: Pass both content pages and discovered links
                discoveredUrls:
                  analysisData.discoveredLinks || analysisData.categories.pages.map((p) => p.url),
                contentPages: analysisData.categories.pages, // For content pages mode
                categories: analysisData.summary.categories,
                focusType: 'enhanced_modes', // 🔥 NEW: Indicate enhanced modes
                originalUrl: analysisData.originalUrl,
                totalLinksFound: analysisData.summary.totalLinksFound || 0, // 🔥 NEW
              }}
              isFromAnalyzer={true}
              onJobComplete={handleJobComplete}
              embedded={true}
            />
          </div>
        )}

        {/* Step 3: Results */}
        {currentStep === 'results' && crawlResults && (
          <div className="space-y-6">
            {/* 🔥 UPDATED: Enhanced completion summary */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Link Check Complete</h3>
                  <p className="text-sm text-gray-600">
                    Found {crawlResults.brokenLinks?.length || 0} broken links
                    {crawlResults.summary?.totalLinksChecked &&
                      ` out of ${crawlResults.summary.totalLinksChecked} total links checked`}
                    {crawlResults.summary?.successRate &&
                      ` (${crawlResults.summary.successRate}% success rate)`}
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

            {/* Results Display */}
            <ResultsTable
              jobId={crawlJobId}
              brokenLinks={crawlResults.brokenLinks}
              pagination={crawlResults.pagination}
            />
          </div>
        )}

        {/* Security Notice */}
        <SecurityNotice variant="compact" />
      </div>

      <Footer />
    </div>
  );
}
