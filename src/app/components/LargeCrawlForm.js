'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SecurityNotice from '@/app/components/SecurityNotice';
import Link from 'next/link';

export default function LargeCrawlForm({ onJobStarted }) {
  const [formData, setFormData] = useState({
    url: '',
    maxDepth: 3,
    includeExternal: false,
    enableSEO: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();

  // Stop crawl state
  const [isStoppingCrawl, setIsStoppingCrawl] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);

  const estimateSize = () => {
    const depth = parseInt(formData.maxDepth);
    if (depth <= 2)
      return {
        size: 'Small',
        pages: '< 100 pages',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      };
    if (depth <= 3)
      return {
        size: 'Medium',
        pages: '100-500 pages',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      };
    if (depth <= 4)
      return {
        size: 'Large',
        pages: '500-1500 pages',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
      };
    return {
      size: 'Very Large',
      pages: '1500+ pages',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    };
  };

  const getEstimatedTime = () => {
    const depth = parseInt(formData.maxDepth);

    // Adjust time estimate if SEO is enabled
    if (formData.enableSEO) {
      const seoTime = {
        1: '3-8 minutes',
        2: '8-25 minutes',
        3: '25-70 minutes',
        4: '70-180 minutes',
        5: '90-240 minutes',
      };
      return seoTime[depth] || '90-240 minutes';
    }

    // Default times without SEO
    if (depth <= 2) return '2-10 minutes';
    if (depth <= 3) return '10-30 minutes';
    if (depth <= 4) return '30-90 minutes';
    return '60-120 minutes';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setCurrentPhase('Starting traditional crawl...');

    try {
      // Validate URL
      new URL(formData.url);

      setCurrentPhase('Initializing crawl job...');

      const requestBody = {
        url: formData.url,
        settings: {
          maxDepth: parseInt(formData.maxDepth),
          includeExternal: formData.includeExternal,
          timeout: 10000,
          enableSEO: formData.enableSEO,
        },
      };

      const response = await fetch('/api/crawl/start', {
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

      console.log('Traditional crawl started:', result);

      setCurrentPhase('Crawl started successfully! Redirecting to results...');

      if (onJobStarted) {
        onJobStarted(result);
      }
      setCurrentJobId(result.jobId);
      // Redirect to results page
      router.push(`/results/${result.jobId}`);
    } catch (error) {
      console.error('Error starting crawl:', error);
      setError(error.message);
      setCurrentPhase('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleStopTraditionalCrawl = async () => {
    if (!currentJobId) return;

    setIsStoppingCrawl(true);
    setShowStopConfirm(false);

    try {
      setCurrentPhase('Stopping crawl...');

      const response = await fetch('/api/crawl/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId }),
      });

      const result = await response.json();

      if (response.ok) {
        setCurrentPhase('Crawl stopped. Redirecting to partial results...');
        setTimeout(() => {
          router.push(`/results/${currentJobId}`);
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to stop crawl');
      }
    } catch (err) {
      setError(`Failed to stop crawl: ${err.message}`);
      setCurrentPhase('');
    } finally {
      setIsStoppingCrawl(false);
    }
  };

  const estimate = estimateSize();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Broken Link Checker
            </h1>
          </div>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Discover and analyze your website's link health with our intelligent crawler. For large
            sites or advanced analysis, try our{' '}
            <Link href="/analyze" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Smart Analyzer
            </Link>{' '}
            instead.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {/* URL Input */}
            <div className="mb-8">
              <label htmlFor="url" className="block text-sm font-semibold text-slate-700 mb-3">
                Website URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                    />
                  </svg>
                </div>
                <input
                  type="url"
                  id="url"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  required
                  className="w-full pl-12 pr-4 py-4 text-gray-500 text-lg border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <p className="mt-2 text-sm text-slate-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Enter the complete URL including protocol (http:// or https://)
              </p>
            </div>

            {/* Advanced Options Toggle */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>
            </div>

            {showAdvanced && (
              <>
                {/* Crawl Depth */}
                <div className="mb-8">
                  <label
                    htmlFor="maxDepth"
                    className="block text-sm font-semibold text-slate-700 mb-3"
                  >
                    Crawl Depth
                  </label>
                  <select
                    id="maxDepth"
                    name="maxDepth"
                    value={formData.maxDepth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
                  >
                    <option value={1}>1 - Homepage only</option>
                    <option value={2}>2 - One level deep</option>
                    <option value={3}>3 - Two levels deep (recommended)</option>
                    <option value={4}>4 - Three levels deep (large sites)</option>
                    <option value={5}>5 - Four levels deep (very large)</option>
                  </select>

                  {/* Estimate Card */}
                  <div
                    className={`mt-4 p-4 rounded-xl border ${estimate.bgColor} border-slate-200`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-5 h-5 ${estimate.color}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <div>
                          <span className={`font-semibold ${estimate.color}`}>
                            {estimate.size} crawl
                          </span>
                          <span className="text-slate-600 ml-2">({estimate.pages})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-medium">{getEstimatedTime()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* External Links */}
                  <div className="flex items-start space-x-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    <input
                      id="includeExternal"
                      name="includeExternal"
                      type="checkbox"
                      checked={formData.includeExternal}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="includeExternal"
                        className="text-sm font-medium text-slate-700 cursor-pointer"
                      >
                        Check external links
                      </label>
                      <p className="text-sm text-slate-500 mt-1">
                        Also verify links pointing to other websites (increases scan time)
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>

                  {/* SEO Analysis */}
                  <div className="flex items-start space-x-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    <input
                      id="enableSEO"
                      name="enableSEO"
                      type="checkbox"
                      checked={formData.enableSEO}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="enableSEO"
                        className="text-sm font-medium text-slate-700 cursor-pointer"
                      >
                        Enable SEO analysis
                      </label>
                      <p className="text-sm text-slate-500 mt-1">
                        Analyze page titles, meta descriptions, and more
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-amber-500 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                </div>
              </>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
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

            {/* Loading State */}
            {isLoading && currentPhase && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                    <span className="text-sm text-blue-800">{currentPhase}</span>
                  </div>

                  {/* Stop Button - only show after job is created */}
                  {currentJobId &&
                    !currentPhase.includes('Stopping') &&
                    !currentPhase.includes('stopped') && (
                      <button
                        onClick={() => setShowStopConfirm(true)}
                        disabled={isStoppingCrawl}
                        className={`px-3 py-1 text-sm rounded-md ${
                          isStoppingCrawl
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        {isStoppingCrawl ? '⏳ Stopping...' : '🛑 Stop'}
                      </button>
                    )}
                </div>
              </div>
            )}

            {/* How it Works */}
            <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Pro Tips
              </h3>
              <div className="grid md:grid-cols-2 gap-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Start with depth 2-3 for faster results</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Check Advance options to Enable SEO</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Use Smart Analyzer for sites with 100+ pages</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Large site mode handles 1000+ pages automatically</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Check external links for complete audits</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12,8 16,12 12,16 8,12" />
                  </svg>
                  <span>Results include source page content</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading || !formData.url}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  isLoading || !formData.url
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-lg hover:shadow-xl'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {currentPhase || 'Processing...'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    Start Traditional Link Check
                  </>
                )}
              </button>
            </div>

            {/* Alternative Option */}
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <div className="text-center">
                <p className="text-purple-800 font-medium mb-2">
                  Need even more powerful analysis for large sites?
                </p>
                <Link
                  href="/analyze"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Try Smart Analyzer
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Stop Confirmation Dialog */}
        {showStopConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🛑 Stop Traditional Crawl?
              </h3>
              <p className="text-gray-600 mb-6">
                Stop the current crawl? You'll be redirected to see partial results for any links
                that have already been found and checked.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleStopTraditionalCrawl}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Yes, Stop Crawl
                </button>
                <button
                  onClick={() => setShowStopConfirm(false)}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Continue Crawling
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <SecurityNotice />
        {/* <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div className="text-sm text-slate-600">
              <p className="font-medium mb-1">Privacy & Security</p>
              <p>
                We only check public URLs and don't store any personal data. All scans are performed
                from our secure servers and results are automatically deleted after 30 days.
              </p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
