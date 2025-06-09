/**
 * Main crawler orchestrator
 * Coordinates link discovery, HTTP checking, and progress tracking
 */

import axios from 'axios';
import { LinkExtractor } from './linkExtractor.js';
import { HttpChecker } from './httpChecker.js';
import { urlUtils, batchUtils, validateUtils } from './utils.js';
import { db } from './supabase.js';

export class WebCrawler {
  constructor(options = {}) {
    this.options = {
      maxDepth: 3,
      includeExternal: false,
      timeout: 10000,
      maxConcurrent: 5,
      batchSize: 50,
      delayBetweenRequests: 100,
      maxPagesPerDomain: 1000,
      respectRobots: true,
      ...options,
    };

    this.linkExtractor = new LinkExtractor({
      includeExternal: this.options.includeExternal,
      maxLinksPerPage: 1000,
    });

    this.httpChecker = new HttpChecker({
      timeout: this.options.timeout,
      maxConcurrent: this.options.maxConcurrent,
      userAgent: 'Broken Link Checker Bot/1.0',
    });

    // Crawler state
    this.jobId = null;
    this.visitedUrls = new Set();
    this.pendingUrls = new Map(); // url -> {depth, sourceUrl}
    this.brokenLinks = [];
    this.stats = {
      pagesVisited: 0,
      linksFound: 0,
      brokenLinksFound: 0,
      startTime: null,
      endTime: null,
    };
  }

  /**
   * Starts a new crawl job
   */
  async startCrawl(startUrl, settings = {}) {
    try {
      // Validate inputs
      if (!urlUtils.isValidUrl(startUrl)) {
        throw new Error('Invalid start URL provided');
      }

      const validationResult = validateUtils.validateCrawlSettings(settings);
      if (!validationResult.isValid) {
        throw new Error(`Invalid settings: ${validationResult.errors.join(', ')}`);
      }

      // Merge settings with defaults
      this.options = { ...this.options, ...settings };

      // Create database job
      const job = await db.createJob(startUrl, this.options);
      this.jobId = job.id;

      // Initialize crawler state
      this._resetState();
      this.stats.startTime = new Date();

      // Add starting URL to pending queue
      this.pendingUrls.set(urlUtils.normalizeUrl(startUrl), {
        depth: 0,
        sourceUrl: null,
      });

      console.log(`Started crawl job ${this.jobId} for ${startUrl}`);

      // Start the crawling process
      await this._processCrawlQueue();

      return {
        jobId: this.jobId,
        status: 'started',
        message: 'Crawl job initiated successfully',
      };
    } catch (error) {
      console.error('Error starting crawl:', error);

      if (this.jobId) {
        await db.updateJobStatus(this.jobId, 'failed', error.message);
      }

      throw error;
    }
  }

  /**
   * Processes the crawl queue in batches
   */
  async _processCrawlQueue() {
    try {
      await db.updateJobStatus(this.jobId, 'running');

      while (this.pendingUrls.size > 0) {
        // Get next batch of URLs to process
        const batchUrls = this._getNextBatch();

        if (batchUrls.length === 0) break;

        console.log(`Processing batch of ${batchUrls.length} URLs`);

        // Process batch concurrently
        await this._processBatch(batchUrls);

        // Update progress
        await this._updateProgress();

        // Small delay between batches to be respectful
        await batchUtils.delay(this.options.delayBetweenRequests);
      }

      // Crawling complete
      await this._completeCrawl();
    } catch (error) {
      console.error('Error during crawl process:', error);
      await db.updateJobStatus(this.jobId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Gets the next batch of URLs to process
   */
  _getNextBatch() {
    const batch = [];
    const iterator = this.pendingUrls.entries();

    for (let i = 0; i < this.options.batchSize && batch.length < this.options.batchSize; i++) {
      const next = iterator.next();
      if (next.done) break;

      const [url, metadata] = next.value;
      batch.push({ url, ...metadata });
      this.pendingUrls.delete(url);
    }

    return batch;
  }

  /**
   * Processes a batch of URLs
   */
  async _processBatch(batchUrls) {
    const results = await Promise.allSettled(batchUrls.map((urlData) => this._processUrl(urlData)));

    // Handle any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to process ${batchUrls[index].url}:`, result.reason);
      }
    });
  }

  /**
   * Processes a single URL - crawls for links and checks status
   */
  async _processUrl(urlData) {
    const { url, depth, sourceUrl } = urlData;

    try {
      // Mark as visited
      this.visitedUrls.add(url);
      this.stats.pagesVisited++;

      // Check if URL is working and get content if it's a page to crawl
      const shouldCrawlForLinks =
        depth < this.options.maxDepth &&
        urlUtils.isInternalUrl(url, this.options.baseDomain || url);

      let pageContent = null;
      let httpResult = null;

      if (shouldCrawlForLinks) {
        // Get full page content for link extraction
        httpResult = await this._fetchPageContent(url);
        pageContent = httpResult.content;
      } else {
        // Just check if URL is working
        httpResult = await this.httpChecker.quickCheck(url);
      }

      // Record if link is broken
      if (!httpResult.isWorking) {
        const brokenLink = {
          url,
          sourceUrl,
          statusCode: httpResult.statusCode,
          errorType: httpResult.errorType,
          linkText: urlData.linkText || 'No text',
        };

        this.brokenLinks.push(brokenLink);
        this.stats.brokenLinksFound++;

        // Save to database
        await db.addBrokenLink(this.jobId, brokenLink);
      }

      // Extract links if we have page content
      if (pageContent && shouldCrawlForLinks) {
        await this._extractAndQueueLinks(url, pageContent, depth);
      }

      // Update discovered link status
      await this._updateDiscoveredLinkStatus(url, 'checked');
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);

      // Record as broken due to processing error
      const brokenLink = {
        url,
        sourceUrl,
        statusCode: null,
        errorType: 'other',
        linkText: urlData.linkText || 'No text',
      };

      await db.addBrokenLink(this.jobId, brokenLink);
      await this._updateDiscoveredLinkStatus(url, 'checked');
    }
  }

  /**
   * Fetches page content for link extraction
   */
  async _fetchPageContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Broken Link Checker Bot/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        validateStatus: () => true,
      });

      return {
        isWorking: response.status >= 200 && response.status < 400,
        statusCode: response.status,
        content: response.data,
        contentType: response.headers['content-type'] || '',
      };
    } catch (error) {
      return {
        isWorking: false,
        statusCode: null,
        content: null,
        errorType: 'connection_error',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Extracts links from page content and adds them to the queue
   */
  async _extractAndQueueLinks(pageUrl, content, currentDepth) {
    try {
      const extractionResult = this.linkExtractor.extractLinks(content, pageUrl, currentDepth);
      const { links } = extractionResult;

      this.stats.linksFound += links.length;

      // Filter links based on crawl settings
      const filteredLinks = this.linkExtractor.filterLinksForCrawling(links, this.options);

      // Add new links to database and queue
      if (filteredLinks.length > 0) {
        await db.addDiscoveredLinks(this.jobId, filteredLinks);

        // Add to pending queue if not already visited
        filteredLinks.forEach((link) => {
          if (!this.visitedUrls.has(link.url) && !this.pendingUrls.has(link.url)) {
            this.pendingUrls.set(link.url, {
              depth: link.depth,
              sourceUrl: pageUrl,
              linkText: link.linkText,
            });
          }
        });
      }

      console.log(
        `Extracted ${links.length} links from ${pageUrl}, ${filteredLinks.length} added to queue`
      );
    } catch (error) {
      console.error(`Error extracting links from ${pageUrl}:`, error);
    }
  }

  /**
   * Updates progress in the database
   */
  async _updateProgress() {
    const totalDiscovered = this.visitedUrls.size + this.pendingUrls.size;
    const completed = this.visitedUrls.size;

    await db.updateJobProgress(this.jobId, completed, totalDiscovered);
  }

  /**
   * Updates the status of a discovered link
   */
  async _updateDiscoveredLinkStatus(url, status) {
    // This would need a database function to update by URL
    // For now, we'll skip this optimization
  }

  /**
   * Completes the crawl job
   */
  async _completeCrawl() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime - this.stats.startTime;

    console.log(`Crawl completed in ${duration}ms`);
    console.log(`Pages visited: ${this.stats.pagesVisited}`);
    console.log(`Links found: ${this.stats.linksFound}`);
    console.log(`Broken links: ${this.stats.brokenLinksFound}`);

    await db.updateJobStatus(this.jobId, 'completed');

    return {
      jobId: this.jobId,
      status: 'completed',
      stats: this.stats,
      brokenLinksCount: this.stats.brokenLinksFound,
    };
  }

  /**
   * Resets crawler state for new job
   */
  _resetState() {
    this.visitedUrls.clear();
    this.pendingUrls.clear();
    this.brokenLinks = [];
    this.stats = {
      pagesVisited: 0,
      linksFound: 0,
      brokenLinksFound: 0,
      startTime: null,
      endTime: null,
    };
  }

  /**
   * Gets current crawl status
   */
  async getStatus() {
    if (!this.jobId) return null;

    const job = await db.getJob(this.jobId);
    return {
      ...job,
      stats: this.stats,
      queueSize: this.pendingUrls.size,
      visitedCount: this.visitedUrls.size,
    };
  }

  /**
   * Stops the current crawl
   */
  async stopCrawl() {
    if (this.jobId) {
      await db.updateJobStatus(this.jobId, 'failed', 'Crawl stopped by user');
      this._resetState();
    }
  }
}

// Export default instance
export const webCrawler = new WebCrawler();

// Export class for custom instances
export default WebCrawler;
