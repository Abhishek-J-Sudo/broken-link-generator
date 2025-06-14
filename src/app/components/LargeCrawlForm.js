/**
 * LargeCrawlForm Component - Enhanced for Smart Analyzer Content Pages
 * MERGED: Main branch working form + Smart analyzer content page support
 */

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
  // MAIN BRANCH STATE - PRESERVED EXACTLY
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

  // MAIN BRANCH: Pre-populate form if coming from analyzer - ENHANCED
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

  // ENHANCED: Size estimation with content page support
  const estimateSize = () => {
    if (formData.useAnalyzedData && analyzedData) {
      let pageCount = 0;
      let description = '';

      // NEW: Handle content discovery format
      if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
        pageCount = analyzedData.contentPages.length;
        description = 'content pages from smart discovery';
      }
      // FALLBACK: Handle legacy format
      else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
        pageCount = analyzedData.discoveredUrls.length;
        description = 'URLs from analysis';
      }

      if (pageCount < 50) return `Small (${pageCount} ${description})`;
      if (pageCount < 200) return `Medium (${pageCount} ${description})`;
      if (pageCount < 500) return `Large (${pageCount} ${description})`;
      return `Very Large (${pageCount} ${description})`;
    }

    // EXISTING: Traditional crawl size estimation - PRESERVED
    const depth = parseInt(formData.maxDepth);
    if (depth <= 2) return 'Small (< 100 pages)';
    if (depth <= 3) return 'Medium (100-500 pages)';
    if (depth <= 4) return 'Large (500-1500 pages)';
    return 'Very Large (1500+ pages)';
  };

  // ENHANCED: Large mode detection with content page support
  const shouldUseLargeMode = () => {
    if (formData.useAnalyzedData && analyzedData) {
      let pageCount = 0;

      // NEW: Check content pages count
      if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
        pageCount = analyzedData.contentPages.length;
      }
      // FALLBACK: Check legacy discovered URLs
      else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
        pageCount = analyzedData.discoveredUrls.length;
      }

      return pageCount > 200;
    }
    return false; // Traditional crawl uses standard endpoint
  };

  // MAIN BRANCH: Input handling - PRESERVED EXACTLY
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ENHANCED: Submit handling with updated data preparation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setCurrentPhase('Starting...');

    try {
      // EXISTING: URL validation - NO CHANGES
      new URL(formData.url);

      const endpoint = shouldUseLargeMode() ? '/api/crawl/large' : '/api/crawl/start';

      // ENHANCED: Phase messaging for content pages
      setCurrentPhase(
        formData.useAnalyzedData
          ? 'Using discovered content pages for efficient crawling...'
          : 'Starting traditional crawl with discovery...'
      );

      // ENHANCED: Request body preparation
      const requestBody = {
        url: formData.url,
        settings: {
          maxDepth: parseInt(formData.maxDepth),
          includeExternal: formData.includeExternal,
          timeout: shouldUseLargeMode() ? 8000 : 10000,
        },
      };

      // ENHANCED: Add analyzed data if using smart mode
      if (formData.useAnalyzedData && analyzedData) {
        let preAnalyzedUrls = [];

        // NEW: Handle content discovery format
        if (analyzedData.contentPages && Array.isArray(analyzedData.contentPages)) {
          preAnalyzedUrls = analyzedData.contentPages.map((page) => ({
            url: page.url,
            sourceUrl: page.sourceUrl || analyzedData.originalUrl,
            type: 'content',
            isContent: true,
          }));
        }
        // FALLBACK: Handle legacy format
        else if (analyzedData.discoveredUrls && Array.isArray(analyzedData.discoveredUrls)) {
          preAnalyzedUrls = analyzedData.discoveredUrls;
        }

        requestBody.preAnalyzedUrls = preAnalyzedUrls;
        console.log(`🎯 FORM: Prepared ${preAnalyzedUrls.length} pre-analyzed URLs for crawl`);
      }

      // EXISTING: API call - NO CHANGES
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start crawl');
      }

      // EXISTING: Success handling - NO CHANGES
      onJobStarted?.(result);
      setCurrentPhase('Crawl started successfully');

      setTimeout(() => {
        router.push(`/results/${result.jobId}`);
      }, 1000);
    } catch (error) {
      console.error('Form submission error:', error);
      setError(error.message);
      setCurrentPhase('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isFromAnalyzer ? '🚀 Start Link Checking' : '🔗 Comprehensive Link Checker'}
        </h2>

        {/* ENHANCED: Info section with smart analyzer context */}
        {isFromAnalyzer && analyzedData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              📊 Using Smart Analysis Results
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              {/* NEW: Content discovery messaging */}
              {analyzedData.contentPages ? (
                <>
                  <p>
                    • Found <strong>{analyzedData.contentPages.length} content pages</strong> during
                    discovery
                  </p>
                  <p>
                    • Filtered out{' '}
                    <strong>{analyzedData.summary?.filteredOut || 0} non-content pages</strong>{' '}
                    (pagination, admin, etc.)
                  </p>
                  <p>
                    • Ready for <strong>single-pass smart crawling</strong> - visit each content
                    page once, extract all its links, then check status
                  </p>
                </>
              ) : (
                /* FALLBACK: Legacy messaging */
                <>
                  <p>
                    • Found <strong>{analyzedData.discoveredUrls?.length || 0} URLs</strong> during
                    analysis
                  </p>
                  <p>
                    • Optimized for{' '}
                    <strong>
                      {analyzedData.focusType === 'content'
                        ? 'content pages only'
                        : 'all discovered URLs'}
                    </strong>
                  </p>
                  <p>• Ready for direct link checking without discovery phase</p>
                </>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* MAIN BRANCH: URL input - PRESERVED */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleInputChange}
              placeholder="https://example.com"
              required
              disabled={isLoading}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                isLoading ? 'bg-gray-100' : ''
              }`}
            />
            {isFromAnalyzer && (
              <p className="mt-1 text-sm text-gray-500">URL pre-filled from analyzer results</p>
            )}
          </div>

          {/* ENHANCED: Smart analyzer data section */}
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
                    Use discovered content pages ({/* ENHANCED: Support both data formats */}
                    {analyzedData.contentPages?.length ||
                      analyzedData.discoveredUrls?.length ||
                      0}{' '}
                    pages)
                  </strong>
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Skip discovery phase and use the content pages found by smart analyzer. This is much
                faster and focuses on pages that actually contain links.
              </p>

              {formData.useAnalyzedData && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900">What will be checked:</h4>

                  {/* NEW: Enhanced display for content pages */}
                  {analyzedData.contentPages && Array.isArray(analyzedData.contentPages) ? (
                    <div className="text-sm text-blue-700 mt-1 space-y-1">
                      <div>
                        •{' '}
                        <strong>
                          {analyzedData.contentPages.length} high-quality content pages
                        </strong>{' '}
                        will be visited
                      </div>
                      <div>
                        • <strong>All links found within these pages</strong> will be extracted and
                        checked
                      </div>
                      {analyzedData.summary?.filteredOut > 0 && (
                        <div>
                          • {analyzedData.summary.filteredOut} non-content pages automatically
                          excluded
                        </div>
                      )}
                      <div className="mt-2 text-xs text-blue-600">
                        <strong>Single-Pass Approach:</strong> Visit each content page once →
                        Extract all its links → Check status of all extracted links
                      </div>
                    </div>
                  ) : (
                    /* FALLBACK: Legacy display */
                    <div className="text-sm text-blue-700 mt-1 space-y-1">
                      <div>• {analyzedData.discoveredUrls?.length || 0} pre-analyzed URLs</div>
                      <div>• Direct HTTP status checking (no additional discovery needed)</div>
                      <div>
                        • Focus:{' '}
                        {analyzedData.focusType === 'content'
                          ? 'Content pages only'
                          : 'All discovered URLs'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MAIN BRANCH: Traditional crawl settings - PRESERVED */}
          {!formData.useAnalyzedData && (
            <>
              <div>
                <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-2">
                  Crawl Depth: {formData.maxDepth}
                </label>
                <input
                  type="range"
                  id="maxDepth"
                  name="maxDepth"
                  min="1"
                  max="5"
                  value={formData.maxDepth}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Shallow (1)</span>
                  <span>Balanced (3)</span>
                  <span>Deep (5)</span>
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="includeExternal"
                    checked={formData.includeExternal}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include external links (links to other domains)
                  </span>
                </label>
              </div>
            </>
          )}

          {/* ENHANCED: Estimation display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Crawl Estimation</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div>
                Size: <strong>{estimateSize()}</strong>
              </div>
              {formData.useAnalyzedData && analyzedData ? (
                <>
                  {analyzedData.contentPages ? (
                    <>
                      <div>
                        Approach: <strong>Single-pass smart crawl</strong>
                      </div>
                      <div>
                        Time estimate:{' '}
                        <strong>
                          {Math.ceil((analyzedData.contentPages.length || 0) / 8)} -{' '}
                          {Math.ceil((analyzedData.contentPages.length || 0) / 4)} minutes
                        </strong>
                      </div>
                      <div>
                        Efficiency: <strong>High</strong> (content-focused, no redundant crawling)
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        Approach: <strong>Direct URL checking</strong>
                      </div>
                      <div>
                        Time estimate:{' '}
                        <strong>
                          {Math.ceil((analyzedData.discoveredUrls?.length || 0) / 10)} -{' '}
                          {Math.ceil((analyzedData.discoveredUrls?.length || 0) / 5)} minutes
                        </strong>
                      </div>
                      <div>
                        Efficiency: <strong>High</strong> (no discovery phase)
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div>
                    Approach: <strong>Traditional discovery crawl</strong>
                  </div>
                  <div>
                    Time estimate: <strong>Depends on site size and structure</strong>
                  </div>
                  <div>
                    Efficiency: <strong>Thorough</strong> (discovers all accessible pages)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* MAIN BRANCH: Error display - PRESERVED */}
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
                  <h3 className="text-sm font-medium text-red-800">Error starting crawl</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* MAIN BRANCH: Submit button - ENHANCED */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading
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
                `🚀 Start ${formData.useAnalyzedData ? 'Smart ' : ''}Link Check`
              )}
            </button>
          </div>
        </form>

        {/* ENHANCED: Smart mode confirmation */}
        {formData.useAnalyzedData && analyzedData && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
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
                <h3 className="text-sm font-medium text-green-800">Smart Crawl Mode Active</h3>
                <div className="mt-2 text-sm text-green-700">
                  {analyzedData.contentPages ? (
                    <div>
                      <p>Using single-pass smart crawl approach:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>
                          Visit {analyzedData.contentPages.length} content pages identified by smart
                          analyzer
                        </li>
                        <li>Extract ALL links from each content page during visit</li>
                        <li>Check HTTP status of all extracted links</li>
                        <li>No redundant crawling or double-visits</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p>Using pre-analyzed data for faster checking:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Skip URL discovery phase entirely</li>
                        <li>
                          Check only the {analyzedData.discoveredUrls?.length || 0} URLs already
                          found
                        </li>
                        <li>
                          Focus on{' '}
                          {analyzedData.focusType === 'content'
                            ? 'content pages only'
                            : 'all discovered URLs'}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN BRANCH: Back link - PRESERVED */}
        {!isFromAnalyzer && (
          <div className="mt-6 text-center">
            <Link href="/analyze" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              ← Want to analyze URL structure first?
            </Link>
          </div>
        )}
      </div>

      {/* MAIN BRANCH: Security notice - PRESERVED */}
      <div className="mt-6">
        <SecurityNotice variant="compact" />
      </div>
    </div>
  );
}
