'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SecurityNotice from '@/app/components/SecurityNotice';
import Link from 'next/link';

export default function LargeCrawlForm({
  onJobStarted,
  analyzedData = null,
  isFromAnalyzer = false,
}) {
  const [formData, setFormData] = useState({
    url: '',
    maxDepth: 3,
    includeExternal: false,
    useAnalyzedData: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const router = useRouter();

  // EXISTING useEffect - NO CHANGES
  useEffect(() => {
    if (isFromAnalyzer && analyzedData) {
      setFormData((prev) => ({
        ...prev,
        url: analyzedData.originalUrl || '',
        useAnalyzedData: true,
        maxDepth: analyzedData.focusType === 'content' ? 2 : 3,
      }));
    }
  }, [isFromAnalyzer, analyzedData]);

  // UPDATED: Enhanced size estimation with content page support
  const estimateSize = () => {
    if (formData.useAnalyzedData && analyzedData) {
      // NEW: Support both old and new data structures
      let urlCount = 0;

      // New format: contentPages array
      if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
        urlCount = analyzedData.contentPages.length;
      }
      // Old format: discoveredUrls array (fallback)
      else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
        urlCount = analyzedData.discoveredUrls.length;
      }

      if (urlCount < 50) return `Small (${urlCount} content pages from analysis)`;
      if (urlCount < 200) return `Medium (${urlCount} content pages from analysis)`;
      if (urlCount < 500) return `Large (${urlCount} content pages from analysis)`;
      return `Very Large (${urlCount} content pages from analysis)`;
    }

    const depth = parseInt(formData.maxDepth);
    if (depth <= 2) return 'Small (< 100 pages)';
    if (depth <= 3) return 'Medium (100-500 pages)';
    if (depth <= 4) return 'Large (500-1500 pages)';
    return 'Very Large (1500+ pages)';
  };

  // UPDATED: Enhanced large mode detection
  const shouldUseLargeMode = () => {
    if (formData.useAnalyzedData && analyzedData) {
      // NEW: Check content pages count
      let contentPageCount = 0;

      if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
        contentPageCount = analyzedData.contentPages.length;
      } else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
        contentPageCount = analyzedData.discoveredUrls.length;
      }

      return contentPageCount > 200;
    }
    return false;
  };

  // EXISTING handleSubmit function with UPDATED data preparation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setCurrentPhase('Starting...');

    try {
      new URL(formData.url);

      const endpoint = shouldUseLargeMode() ? '/api/crawl/large' : '/api/crawl/start';

      setCurrentPhase(
        formData.useAnalyzedData
          ? 'Using discovered content pages for smart crawling...'
          : 'Starting crawl...'
      );

      const requestBody = {
        url: formData.url,
        settings: {
          maxDepth: parseInt(formData.maxDepth),
          includeExternal: formData.includeExternal,
          timeout: shouldUseLargeMode() ? 8000 : 10000,
        },
        action: 'start',
      };

      // UPDATED: Handle both new and old analyzed data formats
      if (formData.useAnalyzedData && analyzedData) {
        // NEW: Support content pages format
        if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
          requestBody.analyzedData = {
            contentPages: analyzedData.contentPages,
            focusType: 'content',
            sourceAnalysis: true,
            totalPagesFound:
              analyzedData.summary?.totalPagesFound || analyzedData.contentPages.length,
            filteredOut: analyzedData.summary?.filteredOut || 0,
          };

          // Convert content pages to preAnalyzedUrls format for crawl start
          requestBody.preAnalyzedUrls = analyzedData.contentPages.map((page) => ({
            url: page.url,
            sourceUrl: page.sourceUrl || formData.url,
            category: 'content',
            title: page.title,
            score: page.score,
          }));

          setCurrentPhase(
            `Processing ${analyzedData.contentPages.length} discovered content pages...`
          );
        }
        // OLD: Fallback to legacy format
        else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
          requestBody.analyzedData = {
            discoveredUrls: analyzedData.discoveredUrls,
            focusType: analyzedData.focusType || 'content',
            categories: analyzedData.categories,
            sourceAnalysis: true,
          };

          requestBody.preAnalyzedUrls = analyzedData.discoveredUrls;

          setCurrentPhase(`Processing ${analyzedData.discoveredUrls.length} pre-analyzed URLs...`);
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start crawl');
      }

      console.log('Crawl started:', result);

      if (onJobStarted) {
        onJobStarted(result);
      }

      if (shouldUseLargeMode() && result.status === 'discovering') {
        setCurrentPhase('Discovery complete! Starting link checks...');

        setTimeout(async () => {
          try {
            const continueResponse = await fetch('/api/crawl/large', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jobId: result.jobId,
                action: 'continue',
              }),
            });

            if (continueResponse.ok) {
              router.push(`/results/${result.jobId}`);
            }
          } catch (error) {
            console.error('Error continuing crawl:', error);
            router.push(`/results/${result.jobId}`);
          }
        }, 2000);
      } else {
        router.push(`/results/${result.jobId}`);
      }
    } catch (error) {
      console.error('Error starting crawl:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
      setCurrentPhase('');
    }
  };

  // EXISTING handleInputChange - NO CHANGES
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="mb-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🔗 Broken Link Checker</h2>
          <p className="text-gray-600">
            Enter a URL to start checking for broken links. For large sites or advanced analysis,
            try our{' '}
            <Link href="/analyze" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Smart Analyzer
            </Link>{' '}
            instead.
            {isFromAnalyzer
              ? 'Ready to check the content pages discovered by the analyzer for broken links.'
              : 'Optimized for both small and large websites. Can handle 1000+ pages efficiently.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* EXISTING URL input - NO CHANGES */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Website URL *
          </label>
          <input
            type="url"
            id="url"
            name="url"
            value={formData.url}
            onChange={handleInputChange}
            placeholder="https://example.com"
            required
            disabled={isFromAnalyzer}
            className={`w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              isFromAnalyzer ? 'bg-gray-100' : ''
            }`}
          />
          {isFromAnalyzer && (
            <p className="mt-1 text-sm text-gray-500">URL pre-filled from analyzer results</p>
          )}
        </div>

        {/* UPDATED: Smart analyzer data section */}
        {isFromAnalyzer && analyzedData && (
          <div className="border-t pt-6">
            <div className="flex items-center">
              <input
                id="useAnalyzedData"
                name="useAnalyzedData"
                type="checkbox"
                checked={formData.useAnalyzedData}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="useAnalyzedData" className="ml-2 block text-sm text-gray-700">
                <strong>
                  Use discovered content pages ({/* UPDATED: Support both data formats */}
                  {analyzedData.contentPages?.length ||
                    analyzedData.discoveredUrls?.length ||
                    0}{' '}
                  pages)
                </strong>
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Skip discovery phase and directly check the content pages found by the smart analyzer.
              This is much faster and more focused on meaningful content.
            </p>

            {formData.useAnalyzedData && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-medium text-blue-900">What will be checked:</h4>

                {/* NEW: Display content pages info */}
                {analyzedData.contentPages && Array.isArray(analyzedData.contentPages) ? (
                  <div className="text-sm text-blue-700 mt-1 space-y-1">
                    <div>• {analyzedData.contentPages.length} high-quality content pages</div>
                    {analyzedData.summary?.filteredOut > 0 && (
                      <div>• {analyzedData.summary.filteredOut} non-content pages filtered out</div>
                    )}
                    {analyzedData.discoveryStats?.averageContentScore && (
                      <div>
                        • Average content quality:{' '}
                        {(analyzedData.discoveryStats.averageContentScore * 100).toFixed(0)}%
                      </div>
                    )}
                    <div className="mt-2 text-xs text-blue-600">
                      <strong>Smart Focus:</strong> Only checking pages identified as meaningful
                      content, skipping pagination, admin pages, and other non-content URLs.
                    </div>
                  </div>
                ) : (
                  /* FALLBACK: Legacy format display */
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    {Object.entries(analyzedData.categories || {})
                      .filter(([, count]) => count > 0)
                      .map(([category, count]) => (
                        <li key={category}>
                          • {count} {category.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* EXISTING traditional crawl settings - NO CHANGES */}
        {!formData.useAnalyzedData && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Crawl Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Depth
                </label>
                <select
                  id="maxDepth"
                  name="maxDepth"
                  value={formData.maxDepth}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 - Homepage only</option>
                  <option value={2}>2 - One level deep</option>
                  <option value={3}>3 - Two levels deep (recommended)</option>
                  <option value={4}>4 - Three levels deep (large sites)</option>
                  <option value={5}>5 - Four levels deep (very large)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">Estimated size: {estimateSize()}</p>
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex items-center">
                  <input
                    id="includeExternal"
                    name="includeExternal"
                    type="checkbox"
                    checked={formData.includeExternal}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeExternal" className="ml-2 block text-sm text-gray-700">
                    Check external links
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Also check links pointing to other websites
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UPDATED: Smart crawl mode info */}
        {formData.useAnalyzedData && analyzedData && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
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
                <h3 className="text-sm font-medium text-green-800">Single-Pass Smart Crawl Mode</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Using content pages discovered by smart analyzer:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Skip URL discovery phase entirely</li>
                    <li>
                      Process only the {/* UPDATED: Support both formats */}
                      {analyzedData.contentPages?.length ||
                        analyzedData.discoveredUrls?.length ||
                        0}{' '}
                      content pages already found
                    </li>
                    <li>Extract and check ALL links from each content page</li>
                    <li>Much faster than traditional crawling</li>
                    <li>Focus on high-quality content only</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXISTING error display - NO CHANGES */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
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
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* EXISTING loading state - NO CHANGES */}
        {isLoading && currentPhase && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600"
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
              <span className="text-sm text-blue-800">{currentPhase}</span>
            </div>
          </div>
        )}

        {/* EXISTING submit button - NO CHANGES */}
        <div>
          <button
            type="submit"
            disabled={isLoading || !formData.url}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isLoading || !formData.url
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (
              <>
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
                {currentPhase || 'Processing...'}
              </>
            ) : (
              `Start ${formData.useAnalyzedData ? 'Smart ' : ''}Link Check`
            )}
          </button>
        </div>
      </form>

      {/* EXISTING back link - NO CHANGES */}
      {!isFromAnalyzer && (
        <div className="mt-6 mb-5 text-center">
          <a href="/analyze" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Want to analyze URL structure first?
          </a>
        </div>
      )}

      {/* EXISTING security notice - NO CHANGES */}
      <SecurityNotice variant="compact" />
    </div>
  );
}
