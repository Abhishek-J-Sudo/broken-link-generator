// src/app/analyze/page.js - Unified page with analyzer + crawler
'use client';

import { useState } from 'react';
import UrlAnalyzer from '@/app/components/UrlAnalyzer';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import ResultsTable from '@/app/components/ResultsTable';

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

    // The crawl data is already available in analysisData
    const crawlData = {
      sourceAnalysis: true,
      focusType: focusType,
      discoveredUrls:
        focusType === 'content'
          ? analysisData.categories.pages.map((p) => p.url)
          : Object.values(analysisData.categories)
              .flat()
              .map((item) => item.url),
      totalAnalyzed: analysisData.summary.totalUrls,
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {currentStep === 'analyze' && '🔍 URL Structure Analysis'}
              {currentStep === 'crawl' && '🚀 Smart Link Checking'}
              {currentStep === 'results' && '📊 Broken Link Results'}
            </h1>

            {/* Step Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm">
              <button
                onClick={resetToAnalyze}
                className={`px-3 py-1 rounded ${
                  currentStep === 'analyze'
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                1. Analyze
              </button>
              <span className="text-gray-300">→</span>
              <button
                onClick={() => analysisData && setCurrentStep('crawl')}
                disabled={!analysisData}
                className={`px-3 py-1 rounded ${
                  currentStep === 'crawl'
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : analysisData
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
              >
                2. Check Links
              </button>
              <span className="text-gray-300">→</span>
              <button
                onClick={() => crawlResults && setCurrentStep('results')}
                disabled={!crawlResults}
                className={`px-3 py-1 rounded ${
                  currentStep === 'results'
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : crawlResults
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
              >
                3. Results
              </button>
            </div>
          </div>
        </div>
      </div>

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
            {/* Analysis Summary (Collapsed) */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Analysis Summary</h3>
                  <p className="text-sm text-gray-600">
                    Found {analysisData.summary.totalUrls} URLs,{' '}
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

            {/* Smart Crawl Form */}
            <LargeCrawlForm
              onJobStarted={handleJobStarted}
              analyzedData={{
                sourceAnalysis: true,
                discoveredUrls: analysisData.categories.pages.map((p) => p.url),
                categories: analysisData.summary.categories,
                focusType: 'content',
                originalUrl: analysisData.originalUrl,
              }}
              isFromAnalyzer={true}
              onJobComplete={handleJobComplete}
              embedded={true} // New prop to indicate embedded mode
            />
          </div>
        )}

        {/* Step 3: Results */}
        {currentStep === 'results' && crawlResults && (
          <div className="space-y-6">
            {/* Quick Actions */}
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

            {/* Results Display */}
            <ResultsTable
              jobId={crawlJobId}
              brokenLinks={crawlResults.brokenLinks}
              pagination={crawlResults.pagination}
            />
          </div>
        )}
      </div>
    </div>
  );
}
