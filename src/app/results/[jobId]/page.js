// src/app/results/[jobId]/page.js - Enhanced version with card UI + modern features
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ResultsTable from '@/app/components/ResultsTable';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { jobId } = params;

  const [job, setJob] = useState(null);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    errorType: 'all',
    search: '',
  });

  //isExporting with separate states:
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);

  // Card-based view state
  const [selectedView, setSelectedView] = useState('broken');
  const [allLinksData, setAllLinksData] = useState(null);
  const [workingLinksData, setWorkingLinksData] = useState(null);
  const [pagesData, setPagesData] = useState(null);

  //stop crawl
  const [isStoppingCrawl, setIsStoppingCrawl] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  //seo summary
  const [seoSummary, setSeoSummary] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/crawl/status/${jobId}`);
        const statusData = await response.json();

        if (response.ok) {
          setJob(statusData);

          // If job is completed, load initial results
          if (statusData.status === 'completed') {
            await loadResults();
            await loadSeoSummary();
          }
        } else {
          console.error('Status fetch error:', statusData);
          setError(statusData.error || 'Failed to get job status');
        }
      } catch (err) {
        console.error('Status poll error:', err);
        setError('Failed to connect to server');
      }
    };

    // Initial load
    pollStatus();

    // Set up polling interval for running jobs
    const interval = setInterval(() => {
      if (job?.status === 'running' || !job) {
        pollStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const loadResults = async (page = 1, filterOptions = filters, view = selectedView) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '1000',
      });

      // Apply modern filtering based on view type
      if (view === 'working') {
        params.append('statusFilter', 'working');
      } else if (view === 'broken') {
        params.append('statusFilter', 'broken');
      } else if (view === 'all') {
        params.append('statusFilter', 'all');
      } else if (view === 'pages') {
        params.append('statusFilter', 'pages');
      }

      // Add filter parameters
      if (filterOptions.statusCode) {
        params.append('statusCode', filterOptions.statusCode);
      }

      if (filterOptions.errorType && filterOptions.errorType !== 'all') {
        params.append('errorType', filterOptions.errorType);
      }

      if (filterOptions.search) {
        params.append('search', filterOptions.search);
      }

      if (filterOptions.seoScore && filterOptions.seoScore !== 'all') {
        params.append('seoScore', filterOptions.seoScore);
      }

      console.log(`Loading results for job ${jobId} with params:`, params.toString());

      const response = await fetch(`/api/results/${jobId}?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Results fetch error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load results`);
      }

      const data = await response.json();
      console.log('Results loaded:', data);

      // Store data based on view type
      switch (view) {
        case 'all':
          setAllLinksData(data);
          break;
        case 'working':
          setWorkingLinksData(data);
          break;
        case 'pages':
          setPagesData(data);
          break;
        default: // 'broken'
          setResults(data);
      }

      setCurrentPage(page);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Load results error:', err);
      setError(err.message || 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  // Load SEO summary data
  const loadSeoSummary = async () => {
    if (!jobId) return;

    setSeoLoading(true);
    try {
      const response = await fetch(`/api/seo/summary/${jobId}`);
      if (response.ok) {
        const seoData = await response.json();
        setSeoSummary(seoData);
      }
    } catch (error) {
      console.error('Failed to load SEO summary:', error);
    } finally {
      setSeoLoading(false);
    }
  };

  const handleCardClick = async (viewType) => {
    if (selectedView === viewType) return; // Already selected

    setSelectedView(viewType);
    setIsLoading(true);

    // Check if we already have this data
    const existingData = {
      broken: results,
      all: allLinksData,
      working: workingLinksData,
      pages: pagesData,
    }[viewType];

    if (!existingData) {
      await loadResults(1, filters, viewType);
    } else {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);

    // Update the pagination in the current data
    const currentData = getCurrentData();
    if (currentData && currentData.pagination) {
      const updatedData = {
        ...currentData,
        pagination: {
          ...currentData.pagination,
          currentPage: newPage,
        },
      };

      // Update the correct state based on selectedView
      switch (selectedView) {
        case 'all':
          setAllLinksData(updatedData);
          break;
        case 'working':
          setWorkingLinksData(updatedData);
          break;
        case 'pages':
          setPagesData(updatedData);
          break;
        default: // 'broken'
          setResults(updatedData);
      }
    }
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    loadResults(1, newFilters, selectedView);
  };

  const exportToCSV = async () => {
    const currentData = getCurrentData();
    if (!currentData || !currentData.links) return;

    setIsExportingCSV(true);
    try {
      // Get ALL results for export (not just current page)
      const exportParams = new URLSearchParams({
        page: '1',
        limit: '10000', // Large number to get all results
      });

      // Apply current view and filters to export
      if (selectedView === 'working') {
        exportParams.append('statusFilter', 'working');
      } else if (selectedView === 'broken') {
        exportParams.append('statusFilter', 'broken');
      } else if (selectedView === 'all') {
        exportParams.append('statusFilter', 'all');
      } else if (selectedView === 'pages') {
        exportParams.append('statusFilter', 'pages');
      }

      if (filters.statusCode) {
        exportParams.append('statusCode', filters.statusCode);
      }

      if (filters.errorType && filters.errorType !== 'all') {
        exportParams.append('errorType', filters.errorType);
      }

      if (filters.search) {
        exportParams.append('search', filters.search);
      }

      if (filters.seoScore && filters.seoScore !== 'all') {
        exportParams.append('seoScore', filters.seoScore);
      }

      const response = await fetch(`/api/results/${jobId}?${exportParams}`);
      const allData = await response.json();

      if (response.ok) {
        // Helper function to validate actual URLs
        const isValidActualUrl = (url) => {
          if (!url || typeof url !== 'string') return false;
          if (url.includes('javascript:')) return false;
          if (url.includes('mailto:')) return false;
          if (url.includes('tel:')) return false;
          if (url.startsWith('#')) return false;
          if (url.includes('{{') || url.includes('}}')) return false;
          if (url.includes('<%') || url.includes('%>')) return false;
          // Filter out Next.js image optimization URLs
          if (url.includes('/_next/image?')) return false;

          // Filter out direct asset URLs (images, CSS, JS, fonts, etc.)
          if (
            url.match(
              /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|eot|pdf|zip|xml|txt)(\?|$)/i
            )
          )
            return false;

          try {
            const urlObj = new URL(url);
            return urlObj.protocol.startsWith('http') && urlObj.hostname.includes('.');
          } catch {
            return false;
          }
        };

        // Sort data: High issues first, then low scores to high scores, then no score data
        const sortedLinks = [...allData.links].sort((a, b) => {
          // Get SEO issues count (prioritize high issues)
          const aIssues = a.seo_issues_count || 0;
          const bIssues = b.seo_issues_count || 0;

          // Get SEO scores (handle null/undefined)
          const aScore = a.seo_score;
          const bScore = b.seo_score;

          // Helper to check if score exists
          const hasScore = (score) => score !== null && score !== undefined && !isNaN(score);

          // 1. First priority: High issues count (descending)
          if (aIssues !== bIssues) {
            return bIssues - aIssues; // Higher issues first
          }

          // 2. Second priority: Handle scores
          const aHasScore = hasScore(aScore);
          const bHasScore = hasScore(bScore);

          // If both have scores, sort by lowest score first
          if (aHasScore && bHasScore) {
            return aScore - bScore; // Lower scores first
          }

          // If only one has a score, prioritize the one with score
          if (aHasScore && !bHasScore) return -1;
          if (!aHasScore && bHasScore) return 1;

          // 3. Third priority: For items with no scores, sort by working status
          // Broken links first, then working links
          if (a.is_working !== b.is_working) {
            return a.is_working ? 1 : -1; // Broken (false) first
          }

          // 4. Final fallback: Sort by URL alphabetically
          return (a.url || '').localeCompare(b.url || '');
        });

        // Enhanced CSV headers - organized logically per requirements
        const csvHeaders = [
          // Basic URL Information
          'URL',
          'URL Type',
          'Internal/External',
          'Status',
          'HTTP Code',

          // SEO Score & Grade
          'SEO Score',
          'SEO Grade',
          'SEO Issues Count',

          // Page Content (SEO)
          'Page Title',
          'Title Length',
          'Meta Description',
          'Description Length',
          'Word Count',
          'Content Length',

          // Heading Structure (SEO)
          'H1 Count',
          'H2 Count',
          'H3 Count',
          'Has H1',

          // Images (SEO)
          'Total Images',
          'Missing Alt',
          'Alt Coverage %',

          // Technical (SEO)
          'Is HTTPS',
          'Canonical URL',
          'Status Code (SEO)',
          'SEO Issues',

          // Source & Performance
          'Source Page',
          'Response Time (ms)',
        ];

        const csvRows = sortedLinks.map((link) => [
          // Basic URL Information
          link.url || '',
          isValidActualUrl(link.url) ? 'Valid URL' : 'Non-URL',
          link.is_internal ? 'Internal' : 'External',
          // Fix status text encoding issues
          (link.status_label || 'Unknown').replace(/[^\x00-\x7F]/g, ''), // Remove non-ASCII characters
          link.http_status_code || 'N/A',

          // SEO Score & Grade
          link.seo_score || 'N/A',
          link.seo_grade || 'N/A',
          link.seo_issues_count || 0,

          // Page Content (SEO) - Fix title and description length calculation
          link.seo_title?.text || link.title_text || 'N/A',
          link.seo_title?.text
            ? link.seo_title.text.length
            : link.title_text
            ? link.title_text.length
            : 'N/A',
          link.seo_metaDescription?.text || link.meta_description || 'N/A',
          link.seo_metaDescription?.text
            ? link.seo_metaDescription.text.length
            : link.meta_description
            ? link.meta_description.length
            : 'N/A',
          link.seo_content?.word_count || link.word_count || 'N/A',
          link.seo_content?.content_length || link.content_length || 'N/A',

          // Heading Structure (SEO)
          link.seo_headings?.h1_count || link.h1_count || 'N/A',
          link.seo_headings?.h2_count || link.h2_count || 'N/A',
          link.seo_headings?.h3_count || link.h3_count || 'N/A',
          link.seo_headings?.hasNoH1 ? 'No' : 'Yes',

          // Images (SEO)
          link.seo_images?.total_images || link.total_images || 'N/A',
          link.seo_images?.missing_alt || link.missing_alt || 'N/A',
          link.seo_images?.alt_coverage || link.alt_coverage || 'N/A',

          // Technical (SEO)
          link.seo_technical?.isHttps || link.is_https ? 'Yes' : 'No',
          link.seo_technical?.canonical_url || link.canonical_url || 'N/A',
          link.seo_technical?.status_code || link.status_code || 'N/A',
          link.seo_issues && Array.isArray(link.seo_issues)
            ? link.seo_issues.map((issue) => `${issue.type}: ${issue.message}`).join('; ')
            : 'N/A',

          // Source & Performance
          link.source_url || 'Discovery',
          link.response_time || 'N/A',
        ]);

        // Add UTF-8 BOM for better Excel compatibility with Arabic text
        const BOM = '\uFEFF';
        const csvContent =
          BOM +
          [
            csvHeaders.join(','),
            ...csvRows.map((row) =>
              row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')
            ),
          ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute(
            'download',
            `${selectedView}-links-comprehensive-${new URL(job.url).hostname}-${
              new Date().toISOString().split('T')[0]
            }.csv`
          );
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        throw new Error('Failed to fetch all results for export');
      }
    } catch (err) {
      setError('Failed to export data');
      console.error('Export error:', err);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const exportToJSON = async () => {
    const currentData = getCurrentData();
    if (!currentData) return;

    setIsExportingJSON(true);
    try {
      // Get ALL results for export
      const exportParams = new URLSearchParams({
        page: '1',
        limit: '10000',
      });

      // Apply current view and filters
      if (selectedView === 'working') {
        exportParams.append('statusFilter', 'working');
      } else if (selectedView === 'broken') {
        exportParams.append('statusFilter', 'broken');
      } else if (selectedView === 'all') {
        exportParams.append('statusFilter', 'all');
      } else if (selectedView === 'pages') {
        exportParams.append('statusFilter', 'pages');
      }

      if (filters.statusCode) {
        exportParams.append('statusCode', filters.statusCode);
      }

      if (filters.errorType && filters.errorType !== 'all') {
        exportParams.append('errorType', filters.errorType);
      }

      if (filters.search) {
        exportParams.append('search', filters.search);
      }

      const response = await fetch(`/api/results/${jobId}?${exportParams}`);
      const allData = await response.json();

      if (response.ok) {
        // Helper function to validate actual URLs
        const isValidActualUrl = (url) => {
          if (!url || typeof url !== 'string') return false;
          if (url.includes('javascript:')) return false;
          if (url.includes('mailto:')) return false;
          if (url.includes('tel:')) return false;
          if (url.startsWith('#')) return false;
          if (url.includes('{{') || url.includes('}}')) return false;
          if (url.includes('<%') || url.includes('%>')) return false;
          // Filter out Next.js image optimization URLs
          if (url.includes('/_next/image?')) return false;

          // Filter out direct asset URLs (images, CSS, JS, fonts, etc.)
          if (
            url.match(
              /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|eot|pdf|zip|xml|txt)(\?|$)/i
            )
          )
            return false;

          try {
            const urlObj = new URL(url);
            return urlObj.protocol.startsWith('http') && urlObj.hostname.includes('.');
          } catch {
            return false;
          }
        };

        // Sort data: High issues first, then low scores to high scores, then no score data
        const sortedLinks = [...allData.links].sort((a, b) => {
          // Get SEO issues count (prioritize high issues)
          const aIssues = a.seo_issues_count || 0;
          const bIssues = b.seo_issues_count || 0;

          // Get SEO scores (handle null/undefined)
          const aScore = a.seo_score;
          const bScore = b.seo_score;

          // Helper to check if score exists
          const hasScore = (score) => score !== null && score !== undefined && !isNaN(score);

          // 1. First priority: High issues count (descending)
          if (aIssues !== bIssues) {
            return bIssues - aIssues; // Higher issues first
          }

          // 2. Second priority: Handle scores
          const aHasScore = hasScore(aScore);
          const bHasScore = hasScore(bScore);

          // If both have scores, sort by lowest score first
          if (aHasScore && bHasScore) {
            return aScore - bScore; // Lower scores first
          }

          // If only one has a score, prioritize the one with score
          if (aHasScore && !bHasScore) return -1;
          if (!aHasScore && bHasScore) return 1;

          // 3. Third priority: For items with no scores, sort by working status
          // Broken links first, then working links
          if (a.is_working !== b.is_working) {
            return a.is_working ? 1 : -1; // Broken (false) first
          }

          // 4. Final fallback: Sort by URL alphabetically
          return (a.url || '').localeCompare(b.url || '');
        });

        // Create comprehensive JSON export with HTTP status data
        const exportData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            website: job.url,
            jobId: jobId,
            view: selectedView,
            totalLinksExported: allData.summary?.totalLinksChecked || 0,
            appliedFilters: filters,
          },
          jobDetails: {
            url: job.url,
            status: job.status,
            createdAt: job.timestamps?.createdAt,
            completedAt: job.timestamps?.completedAt,
            duration: job.timestamps?.elapsedTime,
            settings: job.settings,
          },
          statistics: {
            totalLinksChecked: allData.summary?.totalLinksChecked || 0,
            workingLinks: allData.summary?.workingLinks || 0,
            brokenLinks: allData.summary?.brokenLinks || 0,
            successRate: allData.summary?.successRate || 0,
            performance: allData.summary?.performance || {},
            statusCodes: allData.summary?.statusCodes || {},
            errorTypes: allData.summary?.errorTypes || {},
          },
          links: sortedLinks.map((link) => ({
            // Basic URL Information
            url: link.url,
            urlType: isValidActualUrl(link.url) ? 'Valid URL' : 'Non-URL',
            isInternal: link.is_internal,
            httpStatusCode: link.http_status_code,
            responseTime: link.response_time,
            isWorking: link.is_working,
            statusLabel: (link.status_label || 'Unknown').replace(/[^\x00-\x7F]/g, ''),

            // SEO Data
            seoScore: link.seo_score,
            seoGrade: link.seo_grade,
            seoIssuesCount: link.seo_issues_count || 0,
            seoIssues: link.seo_issues,

            // Page Content
            pageTitle: link.seo_title?.text || link.title_text,
            titleLength: link.seo_title?.text
              ? link.seo_title.text.length
              : link.title_text
              ? link.title_text.length
              : null,
            metaDescription: link.seo_metaDescription?.text || link.meta_description,
            descriptionLength: link.seo_metaDescription?.text
              ? link.seo_metaDescription.text.length
              : link.meta_description
              ? link.meta_description.length
              : null,
            wordCount: link.seo_content?.word_count || link.word_count,
            contentLength: link.seo_content?.content_length || link.content_length,

            // Heading Structure
            h1Count: link.seo_headings?.h1_count || link.h1_count,
            h2Count: link.seo_headings?.h2_count || link.h2_count,
            h3Count: link.seo_headings?.h3_count || link.h3_count,
            hasH1: link.seo_headings?.hasNoH1 ? false : true,

            // Images
            totalImages: link.seo_images?.total_images || link.total_images,
            missingAlt: link.seo_images?.missing_alt || link.missing_alt,
            altCoverage: link.seo_images?.alt_coverage || link.alt_coverage,

            // Technical
            isHttps: link.seo_technical?.isHttps || link.is_https,
            canonicalUrl: link.seo_technical?.canonical_url || link.canonical_url,

            // Source & Performance
            sourceUrl: link.source_url,

            // Legacy fields (for compatibility)
            errorMessage: link.error_message,
            linkText: link.link_text,
            errorType: link.error_type,
            depth: link.depth,
            checkedAt: link.checked_at,
          })),
          summary: allData.summary,
        };

        // Download JSON file
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `${selectedView}-links-report-${new URL(job.url).hostname}-${
            new Date().toISOString().split('T')[0]
          }.json`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to fetch all results for export');
      }
    } catch (err) {
      setError('Failed to export JSON data');
      console.error('JSON export error:', err);
    } finally {
      setIsExportingJSON(false);
    }
  };

  // ADD THIS NEW FUNCTION HERE:
  const handleStopCrawl = async () => {
    if (!jobId) return;

    setIsStoppingCrawl(true);
    setShowStopConfirm(false);

    try {
      const response = await fetch('/api/crawl/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobId }),
      });

      const result = await response.json();

      if (response.ok) {
        setError('');
        // Force refresh job status
        window.location.reload();
      } else {
        throw new Error(result.error || 'Failed to stop crawl');
      }
    } catch (err) {
      setError(`Failed to stop crawl: ${err.message}`);
    } finally {
      setIsStoppingCrawl(false);
    }
  };

  const getCurrentData = () => {
    const data = {
      broken: results,
      all: allLinksData,
      working: workingLinksData,
      pages: pagesData,
    }[selectedView];

    // DEBUG: Log what we're returning
    // console.log('🔍 getCurrentData Debug:', {
    //   selectedView,
    //   data,
    //   hasLinks: data?.links ? 'YES' : 'NO',
    //   linksType: typeof data?.links,
    //   linksIsArray: Array.isArray(data?.links),
    //   linksLength: data?.links?.length,
    //   firstItem: data?.links?.[0],
    // });

    return data;
  };

  const getProgressPercentage = () => {
    if (!job?.progress) return 0;
    return job.progress.percentage || 0;
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError('');
                setIsLoading(true);
                loadResults();
              }}
              className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="block w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <Header />
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Link Check Results
              </h1>
              <p className="text-slate-600 break-all mt-2">{job?.url}</p>
              <div
                onClick={() => router.push('/analyze?restore=true')}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer py-2 transition-colors duration-200 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Analysis
              </div>
            </div>

            {/* Status Badge & Export Actions */}
            <div className="text-right">
              <div className="flex items-center space-x-3 mb-2">
                {/* Stop Button - only show when running */}
                {job?.status === 'running' && (
                  <button
                    onClick={() => setShowStopConfirm(true)}
                    disabled={isStoppingCrawl}
                    className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                      isStoppingCrawl
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                    }`}
                  >
                    {isStoppingCrawl ? '⏳ Stopping...' : '🛑 Stop Crawl'}
                  </button>
                )}
                {/* Export Buttons - only show when completed */}
                {job?.status === 'completed' && getCurrentData() && (
                  <div className="flex space-x-2">
                    <button
                      onClick={exportToCSV}
                      disabled={isExportingCSV}
                      className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                        isExportingCSV
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                      }`}
                    >
                      {isExportingCSV ? '⏳' : '📊'} Export CSV
                    </button>
                    <button
                      onClick={exportToJSON}
                      disabled={isExportingJSON}
                      className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                        isExportingJSON
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                      }`}
                    >
                      {isExportingJSON ? '⏳' : '📁'} Export JSON
                    </button>
                  </div>
                )}

                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                    job?.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : job?.status === 'running'
                      ? 'bg-blue-100 text-blue-800'
                      : job?.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {job?.status}
                </span>
              </div>
              {job?.timestamps?.elapsedTime && (
                <p className="text-sm text-slate-500">
                  {formatDuration(job.timestamps.elapsedTime)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stop Confirmation Dialog */}
        {showStopConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-slate-800 mb-4">🛑 Stop Crawl Confirmation</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to stop this crawl? You'll be able to see partial results for
                links that have already been checked.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={handleStopCrawl}
                  className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl hover:bg-red-700 font-medium transition-colors"
                >
                  Yes, Stop Crawl
                </button>
                <button
                  onClick={() => setShowStopConfirm(false)}
                  className="flex-1 bg-slate-600 text-white px-4 py-3 rounded-xl hover:bg-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {job?.status === 'running' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-blue-600"
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
                Scan in Progress
              </h2>
              <span className="text-slate-600 font-medium">
                {job.progress?.current || 0} / {job.progress?.total || 0} links checked
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-4 mb-4">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>

            <p className="text-slate-600">
              {getProgressPercentage()}% complete
              {job.progress?.estimatedTimeRemaining && (
                <>
                  {' '}
                  · About {Math.round(job.progress.estimatedTimeRemaining / 60)} minutes remaining
                </>
              )}
            </p>
          </div>
        )}

        {/* SEO Summary Cards */}
        {job?.status === 'completed' && seoSummary && job?.settings?.enableSEO && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* SEO Score Card */}
            <div className="bg-white rounded-xl shadow-2xs p-4 text-center border border-slate-200">
              <div
                className={`text-2xl font-bold mb-1 ${
                  seoSummary.avg_score >= 80
                    ? 'text-green-600'
                    : seoSummary.avg_score >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {Math.round(seoSummary.avg_score || 0)}/100
              </div>
              <div className="text-slate-600 font-medium text-sm">Average SEO Score</div>
              <div
                className={`text-xs mt-1 font-bold ${
                  seoSummary.avg_score >= 80
                    ? 'text-green-600'
                    : seoSummary.avg_score >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                Grade:{' '}
                {seoSummary.avg_score >= 90
                  ? 'A'
                  : seoSummary.avg_score >= 80
                  ? 'B'
                  : seoSummary.avg_score >= 70
                  ? 'C'
                  : seoSummary.avg_score >= 60
                  ? 'D'
                  : 'F'}
              </div>
            </div>

            {/* Pages Analyzed */}
            <div className="bg-white rounded-xl shadow-2xs p-4 text-center border border-slate-200">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {seoSummary.total_pages || 0}
              </div>
              <div className="text-slate-600 font-medium text-sm">Pages Analyzed</div>
              <div className="text-xs text-blue-600 mt-1 font-bold">SEO Data Available</div>
            </div>

            {/* SEO Issues */}
            <div className="bg-white rounded-xl shadow-2xs p-4 text-center border border-slate-200">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {seoSummary.total_issues || 0}
              </div>
              <div className="text-slate-600 font-medium text-sm">SEO Issues Found</div>
              <div className="text-xs text-orange-600 mt-1 font-bold">Need Attention</div>
            </div>

            {/* Performance */}
            <div className="bg-white rounded-xl shadow-2xs p-4 text-center border border-slate-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {Math.round(seoSummary.avg_response_time || 0)}ms
              </div>
              <div className="text-slate-600 font-medium text-sm">Avg Response Time</div>
              <div
                className={`text-xs mt-1 font-bold ${
                  (seoSummary.avg_response_time || 0) < 1000
                    ? 'text-green-600'
                    : (seoSummary.avg_response_time || 0) < 3000
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {(seoSummary.avg_response_time || 0) < 1000
                  ? 'Fast'
                  : (seoSummary.avg_response_time || 0) < 3000
                  ? 'Moderate'
                  : 'Slow'}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Stats Cards with Modern Data */}
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => handleCardClick('all')}
              className={`bg-white rounded-xl shadow-lg p-4 text-center transition-all hover:shadow-xl transform hover:scale-105 ${
                selectedView === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {job.stats?.totalLinksDiscovered || 0}
              </div>
              <div className="text-slate-600 font-medium text-sm">All Unique Links</div>
              {selectedView === 'all' && (
                <div className="text-xs text-blue-600 mt-1 font-bold">● Active</div>
              )}
            </button>

            <button
              onClick={() => handleCardClick('working')}
              className={`bg-white rounded-xl shadow-lg p-4 text-center transition-all hover:shadow-xl transform hover:scale-105 ${
                selectedView === 'working' ? 'ring-2 ring-green-500 bg-green-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-green-600 mb-1">
                {(job.stats?.totalLinksDiscovered || 0) - (job.stats?.brokenLinksFound || 0)}
              </div>
              <div className="text-slate-600 font-medium text-sm">Working Links</div>
              {selectedView === 'working' && (
                <div className="text-xs text-green-600 mt-1 font-bold">● Active</div>
              )}
            </button>

            <button
              onClick={() => handleCardClick('broken')}
              className={`bg-white rounded-xl shadow-lg p-4 text-center transition-all hover:shadow-xl transform hover:scale-105 ${
                selectedView === 'broken' ? 'ring-2 ring-red-500 bg-red-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-red-600 mb-1">
                {job.stats?.brokenLinksFound || 0}
              </div>
              <div className="text-slate-600 font-medium text-sm">Broken Links</div>
              {selectedView === 'broken' && (
                <div className="text-xs text-red-600 mt-1 font-bold">● Active</div>
              )}
            </button>

            <button
              onClick={() => handleCardClick('pages')}
              className={`bg-white rounded-xl shadow-lg p-4 text-center transition-all hover:shadow-xl transform hover:scale-105 ${
                selectedView === 'pages' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
              }`}
            >
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {results?.summary?.internalPagesCount || 0}
              </div>
              <div className="text-slate-600 font-medium text-sm">
                {job?.crawlMode === 'discovered_links' ? 'Pages Scanned' : 'Links Checked'}
              </div>
              {selectedView === 'pages' && (
                <div className="text-xs text-purple-600 mt-1 font-bold">● Active</div>
              )}
            </button>
          </div>
        )}

        {/* Export Success Message */}
        {isExportingCSV ||
          (isExportingJSON && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-blue-800 font-medium">Preparing export file...</span>
              </div>
            </div>
          ))}

        {/* Enhanced Results Table with HTTP Status Support */}
        {job?.status === 'completed' && getCurrentData()?.links && (
          <ResultsTable
            jobId={jobId}
            links={getCurrentData().links}
            selectedView={selectedView}
            pagination={getCurrentData().pagination}
            onPageChange={handlePageChange}
            onFilter={handleFilter}
            job={job}
          />
        )}

        {/* Completed - Show results summary */}
        {job?.status === 'completed' && results && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center mb-8">
            <svg
              className={`w-20 h-20 mx-auto mb-6 ${
                results.summary?.brokenLinks === 0 ? 'text-green-500' : 'text-yellow-500'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {results.summary?.brokenLinks === 0 ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              )}
            </svg>

            <h3 className="text-2xl font-bold text-slate-800 mb-4">
              {results.summary?.brokenLinks === 0
                ? '🎉 Excellent! No Broken Links Found'
                : `⚠️ Found ${results.summary?.brokenLinks} Broken Links`}
            </h3>

            <p className="text-slate-600 mb-6">
              {results.summary?.brokenLinks === 0
                ? `All ${
                    job.stats?.totalLinksDiscovered || 0
                  } links on your website are working perfectly.`
                : `${results.summary?.brokenLinks} out of ${
                    job.stats?.totalLinksDiscovered || 0
                  } links need attention. Review the details below.`}
            </p>

            <div className="flex justify-center space-x-4">
              <button
                onClick={exportToCSV}
                disabled={isExportingCSV}
                className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium transition-all shadow-lg"
              >
                📊 Export CSV
              </button>
              <button
                onClick={exportToJSON}
                disabled={isExportingJSON}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-medium transition-all shadow-lg"
              >
                📁 Export JSON
              </button>
              <button
                onClick={() => router.push('/analyze')}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-medium transition-all shadow-lg"
              >
                🔍 Analyze Another Site
              </button>
            </div>
          </div>
        )}

        {/* Pending/Running State */}
        {job?.status === 'running' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="animate-pulse">
              <div className="text-6xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Scanning Your Website</h3>
              <p className="text-slate-600 text-lg">
                We're checking each link for broken status and measuring response times. This page
                will update automatically when complete.
              </p>
            </div>
          </div>
        )}

        {/* Failed State */}
        {job?.status === 'failed' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <svg
              className="w-20 h-20 text-red-500 mx-auto mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Scan Failed</h3>
            <p className="text-slate-600 mb-6 text-lg">
              {job.errorMessage || 'The scan encountered an error and could not be completed.'}
            </p>
            <button
              onClick={() => router.push('/analyze')}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-medium transition-all shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Security notice */}
      <SecurityNotice variant="compact" />
      {/* Footer */}
      <Footer />
    </div>
  );
}
