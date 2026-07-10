'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SecurityNotice from '@/app/components/SecurityNotice';
import Link from 'next/link';
import { getCsrfToken } from '@/lib/csrf-client';

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
    if (depth <= 2) return { size: 'Small', pages: '< 100 pages', color: 'text-success' };
    if (depth <= 3) return { size: 'Medium', pages: '100–500 pages', color: 'text-info' };
    if (depth <= 4) return { size: 'Large', pages: '500–1500 pages', color: 'text-warning' };
    return { size: 'Very Large', pages: '1500+ pages', color: 'text-danger' };
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
    setCurrentPhase('Starting crawl...');

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
          'X-CSRF-Token': await getCsrfToken(),
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start crawl');
      }

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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': await getCsrfToken(),
        },
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
    <div>
      <form onSubmit={handleSubmit}>
        {/* URL input */}
        <div className="mb-6">
          <label htmlFor="url" className="block text-sm font-medium text-text mb-2">
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
            className="w-full rounded-md border border-border bg-bg px-4 py-3.5 font-mono text-sm text-text placeholder:text-text-subtle focus:border-action focus:outline-none transition-colors"
          />
          <p className="mt-2 text-xs text-text-muted">
            Enter the complete URL, including http:// or https://
          </p>
        </div>

        {/* Advanced options toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-6 text-sm font-medium text-action hover:text-action-hover transition-colors"
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced options
        </button>

        {showAdvanced && (
          <div className="mb-8 border-t border-border pt-6">
            {/* Crawl depth */}
            <div className="mb-6">
              <label htmlFor="maxDepth" className="block text-sm font-medium text-text mb-2">
                Crawl depth
              </label>
              <select
                id="maxDepth"
                name="maxDepth"
                value={formData.maxDepth}
                onChange={handleInputChange}
                className="w-full rounded-md border border-border bg-bg px-4 py-3 text-sm text-text focus:border-action focus:outline-none"
              >
                <option value={1}>1 — Homepage only</option>
                <option value={2}>2 — One level deep</option>
                <option value={3}>3 — Two levels deep (recommended)</option>
                <option value={4}>4 — Three levels deep (large sites)</option>
                <option value={5}>5 — Four levels deep (very large)</option>
              </select>

              {/* Estimate readout: label ……… value */}
              <div className="mt-3 flex items-baseline gap-2 font-mono text-xs">
                <span className="shrink-0">
                  <span className={`font-medium ${estimate.color}`}>{estimate.size} crawl</span>
                  <span className="text-text-muted"> · {estimate.pages}</span>
                </span>
                <span
                  className="flex-1 border-b border-dotted border-border-strong"
                  aria-hidden="true"
                />
                <span className="shrink-0 text-text-muted">est. {getEstimatedTime()}</span>
              </div>
            </div>

            {/* Options */}
            <div className="grid gap-4 md:grid-cols-2">
              <label
                htmlFor="includeExternal"
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 hover:border-border-strong transition-colors"
              >
                <input
                  id="includeExternal"
                  name="includeExternal"
                  type="checkbox"
                  checked={formData.includeExternal}
                  onChange={handleInputChange}
                  className="mt-0.5 h-4 w-4 accent-action"
                />
                <span>
                  <span className="block text-sm font-medium text-text">Check external links</span>
                  <span className="mt-1 block text-xs text-text-muted">
                    Also verify links pointing to other websites (increases scan time)
                  </span>
                </span>
              </label>

              <label
                htmlFor="enableSEO"
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 hover:border-border-strong transition-colors"
              >
                <input
                  id="enableSEO"
                  name="enableSEO"
                  type="checkbox"
                  checked={formData.enableSEO}
                  onChange={handleInputChange}
                  className="mt-0.5 h-4 w-4 accent-action"
                />
                <span>
                  <span className="block text-sm font-medium text-text">Enable SEO analysis</span>
                  <span className="mt-1 block text-xs text-text-muted">
                    Analyze page titles, meta descriptions, and more
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-md border border-danger/40 bg-danger-subtle p-4">
            <p className="text-sm font-medium text-danger">Error</p>
            <p className="mt-1 text-sm text-text-muted">{error}</p>
          </div>
        )}

        {/* Loading / progress */}
        {isLoading && currentPhase && (
          <div className="mb-6 flex items-center justify-between rounded-md border border-info/40 bg-info-subtle p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-info border-t-transparent"></div>
              <span className="text-sm text-text">{currentPhase}</span>
            </div>
            {currentJobId &&
              !currentPhase.includes('Stopping') &&
              !currentPhase.includes('stopped') && (
                <button
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  disabled={isStoppingCrawl}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    isStoppingCrawl
                      ? 'cursor-not-allowed bg-surface-subtle text-text-subtle'
                      : 'bg-danger text-white hover:opacity-90'
                  }`}
                >
                  {isStoppingCrawl ? 'Stopping…' : 'Stop'}
                </button>
              )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !formData.url}
          className={`w-full rounded-md px-6 py-3.5 font-medium transition-colors ${
            isLoading || !formData.url
              ? 'cursor-not-allowed bg-surface-subtle text-text-subtle'
              : 'bg-action text-text-on-action hover:bg-action-hover'
          }`}
        >
          {isLoading ? currentPhase || 'Processing…' : 'Run Quick Check'}
        </button>

        {/* Full Audit cross-link */}
        <p className="mt-4 text-sm text-text-muted">
          Large site, or want the SEO review?{' '}
          <Link
            href="/analyze"
            className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 hover:text-action transition-colors"
          >
            Run a Full Audit instead
          </Link>
        </p>
      </form>

      {/* Stop confirmation dialog */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-surface p-6">
            <h3 className="font-display text-2xl text-text mb-3">Stop this crawl?</h3>
            <p className="mb-6 text-sm text-text-muted">
              You&rsquo;ll be redirected to partial results for any links that have already been
              found and checked.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStopTraditionalCrawl}
                className="flex-1 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Yes, stop crawl
              </button>
              <button
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-subtle transition-colors"
              >
                Continue crawling
              </button>
            </div>
          </div>
        </div>
      )}

      <SecurityNotice />
    </div>
  );
}
