'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CrawlForm({ onJobStarted }) {
  const [formData, setFormData] = useState({
    url: '',
    maxDepth: 3,
    includeExternal: false,
    timeout: 10000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate URL format on client side
      new URL(formData.url);

      const response = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formData.url,
          settings: {
            maxDepth: parseInt(formData.maxDepth),
            includeExternal: formData.includeExternal,
            timeout: parseInt(formData.timeout),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start crawl');
      }

      console.log('Crawl started:', result);

      // Call callback if provided
      if (onJobStarted) {
        onJobStarted(result);
      }

      // Redirect to results page
      router.push(`/results/${result.jobId}`);
    } catch (error) {
      console.error('Error starting crawl:', error);
      setError(error.message);
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Broken Link Checker</h1>
        <p className="text-gray-600">
          Enter a website URL to scan for broken links. We'll crawl through the pages and check all
          links for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL Input */}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter the full URL including http:// or https://
          </p>
        </div>

        {/* Advanced Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Crawl Settings</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Max Depth */}
            <div>
              <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-2">
                Max Depth
              </label>
              <select
                id="maxDepth"
                name="maxDepth"
                value={formData.maxDepth}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1 - Homepage only</option>
                <option value={2}>2 - One level deep</option>
                <option value={3}>3 - Two levels deep (recommended)</option>
                <option value={4}>4 - Three levels deep</option>
                <option value={5}>5 - Four levels deep</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">How deep to crawl into the website</p>
            </div>

            {/* Timeout */}
            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-2">
                Timeout (ms)
              </label>
              <select
                id="timeout"
                name="timeout"
                value={formData.timeout}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds (recommended)</option>
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">How long to wait for each page to load</p>
            </div>
          </div>

          {/* Include External Links */}
          <div className="mt-4">
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
              Also check links that point to other websites (may take longer)
            </p>
          </div>
        </div>

        {/* Error Display */}
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

        {/* Submit Button */}
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
                Starting crawl...
              </>
            ) : (
              'Start Link Check'
            )}
          </button>
        </div>
      </form>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
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
            <h3 className="text-sm font-medium text-blue-800">How it works</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>We'll crawl your website starting from the URL you provide</li>
                <li>Every link found will be checked for accessibility</li>
                <li>You'll get a detailed report of any broken links</li>
                <li>Results include error types and source pages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
