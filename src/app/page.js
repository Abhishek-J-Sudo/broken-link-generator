// Enhanced HomePage component to handle analyzed data
// Add this to your main page.js (homepage)

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';

export default function HomePage() {
  const [analyzedData, setAnalyzedData] = useState(null);
  const [isFromAnalyzer, setIsFromAnalyzer] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we came from the analyzer
    const source = searchParams.get('source');
    const analyzed = searchParams.get('analyzed');
    const url = searchParams.get('url');
    const focus = searchParams.get('focus');

    if (source === 'analyzer' && analyzed === 'true') {
      setIsFromAnalyzer(true);

      // Try to get the analyzed data from sessionStorage
      try {
        const storedData = sessionStorage.getItem('analyzedCrawlData');
        if (storedData) {
          const data = JSON.parse(storedData);
          setAnalyzedData(data);

          // Clear the stored data
          sessionStorage.removeItem('analyzedCrawlData');

          console.log('📊 Received analyzed data:', data);
        }
      } catch (error) {
        console.error('Error loading analyzed data:', error);
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">🔗 Broken Link Checker</h1>
            <p className="text-xl text-gray-600 mb-8">
              Find and fix broken links on your website with our intelligent crawler
            </p>

            {/* Show analyzer integration message */}
            {isFromAnalyzer && analyzedData && (
              <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-green-600"
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
                  </div>
                  <div className="ml-3 text-left">
                    <h3 className="text-lg font-medium text-green-800">🎯 Smart Crawl Ready!</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        <strong>Using analyzed data from URL Analyzer:</strong>
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>
                          <strong>{analyzedData.discoveredUrls?.length || 0} URLs</strong> ready for
                          checking
                        </li>
                        <li>
                          Focus:{' '}
                          <strong>
                            {analyzedData.focusType === 'content'
                              ? 'Content Pages Only'
                              : 'All URLs'}
                          </strong>
                        </li>
                        <li>
                          Categories:{' '}
                          {Object.entries(analyzedData.categories || {})
                            .filter(([, count]) => count > 0)
                            .map(([cat, count]) => `${count} ${cat}`)
                            .join(', ')}
                        </li>
                      </ul>

                      {analyzedData.recommendations && analyzedData.recommendations.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium">Analyzer Recommendations:</p>
                          <ul className="list-disc list-inside mt-1">
                            {analyzedData.recommendations.slice(0, 2).map((rec, i) => (
                              <li key={i}>{rec.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pass analyzed data to the form */}
        <LargeCrawlForm
          onJobStarted={(result) => {
            console.log('Job started:', result);
          }}
          analyzedData={analyzedData}
          isFromAnalyzer={isFromAnalyzer}
        />

        {/* URL Analyzer Link */}
        {!isFromAnalyzer && (
          <div className="mt-12 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                🔍 Want to analyze your site structure first?
              </h3>
              <p className="text-blue-700 mb-4">
                Use our URL Analyzer to understand your website's structure and get recommendations
                before running a full broken link check.
              </p>
              <a
                href="/analyze"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
                Analyze URL Structure First
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
