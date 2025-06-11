'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LargeCrawlForm({
  onJobStarted,
  analyzedData = null,
  isFromAnalyzer = false,
}) {
  const [formData, setFormData] = useState({
    url: '',
    maxDepth: 3,
    includeExternal: false,
    useLargeMode: false,
    useAnalyzedData: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const router = useRouter();

  // Pre-populate form if coming from analyzer
  useEffect(() => {
    if (isFromAnalyzer && analyzedData) {
      setFormData((prev) => ({
        ...prev,
        url: analyzedData.originalUrl || '',
        useAnalyzedData: true,
        maxDepth: analyzedData.focusType === 'content' ? 2 : 3,
        useLargeMode: (analyzedData.discoveredUrls?.length || 0) > 200,
      }));
    }
  }, [isFromAnalyzer, analyzedData]);

  const estimateSize = () => {
    if (formData.useAnalyzedData && analyzedData) {
      const urlCount = analyzedData.discoveredUrls?.length || 0;
      if (urlCount < 50) return `Small (${urlCount} URLs from analysis)`;
      if (urlCount < 200) return `Medium (${urlCount} URLs from analysis)`;
      if (urlCount < 500) return `Large (${urlCount} URLs from analysis)`;
      return `Very Large (${urlCount} URLs from analysis)`;
    }

    const depth = parseInt(formData.maxDepth);
    if (depth <= 2) return 'Small (< 100 pages)';
    if (depth <= 3) return 'Medium (100-500 pages)';
    if (depth <= 4) return 'Large (500-1500 pages)';
    return 'Very Large (1500+ pages)';
  };

  const shouldUseLargeMode = () => {
    if (formData.useAnalyzedData && analyzedData) {
      return (analyzedData.discoveredUrls?.length || 0) > 200 || formData.useLargeMode;
    }
    return parseInt(formData.maxDepth) >= 4 || formData.useLargeMode;
  };

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
          ? 'Using analyzed data for smart crawling...'
          : shouldUseLargeMode()
          ? 'Discovering all links...'
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

      if (formData.useAnalyzedData && analyzedData) {
        requestBody.analyzedData = {
          discoveredUrls: analyzedData.discoveredUrls,
          focusType: analyzedData.focusType,
          categories: analyzedData.categories,
          sourceAnalysis: true,
        };

        setCurrentPhase(
          `Processing ${analyzedData.discoveredUrls?.length || 0} pre-analyzed URLs...`
        );
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        {/* <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isFromAnalyzer ? '🎯 Smart Broken Link Checker' : '🔗 Broken Link Checker'}
        </h1> */}
        <p className="text-gray-600">
          {isFromAnalyzer
            ? 'Ready to check the URLs discovered by the analyzer for broken links.'
            : 'Optimized for both small and large websites. Can handle 1000+ pages efficiently.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  Use pre-analyzed URLs ({analyzedData.discoveredUrls?.length || 0} URLs)
                </strong>
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Skip discovery phase and directly check the URLs found by the analyzer. This is much
              faster and more focused.
            </p>

            {formData.useAnalyzedData && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-medium text-blue-900">What will be checked:</h4>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  {Object.entries(analyzedData.categories || {})
                    .filter(([, count]) => count > 0)
                    .map(([category, count]) => (
                      <li key={category}>
                        • {count} {category.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

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

            <div className="mt-4">
              <div className="flex items-center">
                <input
                  id="useLargeMode"
                  name="useLargeMode"
                  type="checkbox"
                  checked={formData.useLargeMode || shouldUseLargeMode()}
                  onChange={handleInputChange}
                  disabled={shouldUseLargeMode()}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="useLargeMode" className="ml-2 block text-sm text-gray-700">
                  Large site mode (1000+ pages)
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {shouldUseLargeMode()
                  ? 'Automatically enabled - Uses optimized processing for large sites'
                  : 'Enable for sites with many pages to avoid timeouts'}
              </p>
            </div>
          </div>
        )}

        {shouldUseLargeMode() && !formData.useAnalyzedData && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Large Site Mode</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>This mode processes large sites in two phases:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Phase 1: Discover all links quickly</li>
                    <li>Phase 2: Check each link for broken status</li>
                    <li>Can handle 1000+ pages without timeout issues</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <h3 className="text-sm font-medium text-green-800">Smart Crawl Mode</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Using pre-analyzed data for faster, focused checking:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Skip URL discovery phase entirely</li>
                    <li>
                      Check only the {analyzedData.discoveredUrls?.length || 0} URLs already found
                    </li>
                    <li>
                      Focus on{' '}
                      {analyzedData.focusType === 'content'
                        ? 'content pages'
                        : 'all discovered URLs'}
                    </li>
                    <li>Much faster than traditional crawling</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

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
              `Start ${
                formData.useAnalyzedData ? 'Smart ' : shouldUseLargeMode() ? 'Large Site ' : ''
              }Link Check`
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Expected Performance</h3>
        <div className="text-xs text-gray-600 space-y-1">
          {formData.useAnalyzedData && analyzedData ? (
            <>
              <div>• Smart mode: {analyzedData.discoveredUrls?.length || 0} pre-analyzed URLs</div>
              <div>
                • Estimated time: {Math.ceil((analyzedData.discoveredUrls?.length || 0) / 10)} -{' '}
                {Math.ceil((analyzedData.discoveredUrls?.length || 0) / 5)} minutes
              </div>
              <div>
                • Focus:{' '}
                {analyzedData.focusType === 'content'
                  ? 'Content pages only'
                  : 'All discovered URLs'}
              </div>
              <div>• No discovery phase needed - direct link checking</div>
            </>
          ) : (
            <>
              <div>• Small sites (depth 1-2): 2-10 minutes</div>
              <div>• Medium sites (depth 3): 10-30 minutes</div>
              <div>• Large sites (depth 4-5): 30-90 minutes</div>
              <div>• Your 1300-page site: Approximately 45-75 minutes</div>
            </>
          )}
        </div>
      </div>

      {!isFromAnalyzer && (
        <div className="mt-6 text-center">
          <a href="/analyze" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Want to analyze URL structure first?
          </a>
        </div>
      )}
    </div>
  );
}
