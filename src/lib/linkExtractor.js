/**
 * Enhanced Link Extractor - Optimized for Smart Analyzer Content Pages
 * MERGED: Main branch working extractor + Smart analyzer optimizations
 */

import * as cheerio from 'cheerio';
import { urlUtils, textUtils } from './utils.js';
import { securityUtils } from './security.js';

export class LinkExtractor {
  constructor(options = {}) {
    this.options = {
      includeExternal: false,
      maxLinksPerPage: 1000, // ENHANCED: Configurable limit
      includeImages: false,
      includeScripts: false,
      includeStyles: false,
      classifyLinks: true, // NEW: Enable link classification
      prioritizeContentLinks: true, // NEW: Prioritize content over navigation
      extractMetadata: true, // NEW: Extract additional metadata
      respectNoFollow: true,
      ...options,
    };
  }

  /**
   * ENHANCED: Main extraction method with content page optimization
   * Extracts ALL links from HTML with content page specific optimizations
   */
  async extractLinksFromHtml(html, baseUrl, options = {}) {
    try {
      if (!html || typeof html !== 'string') {
        throw new Error('Invalid HTML content provided');
      }

      if (!urlUtils.isValidUrl(baseUrl)) {
        throw new Error('Invalid base URL provided');
      }

      // Merge options with defaults
      const extractionOptions = { ...this.options, ...options };
      const baseDomain = urlUtils.getDomain(baseUrl);
      const currentDepth = options.currentDepth || 1;

      // Load HTML with cheerio
      const $ = cheerio.load(html, {
        normalizeWhitespace: true,
        xmlMode: false,
        decodeEntities: true,
      });

      console.log(
        `🔗 EXTRACTOR: Processing ${$('a[href]').length} anchor tags from ${baseUrl.substring(
          0,
          50
        )}...`
      );

      // ENHANCED: Extract links with classification and prioritization
      const extractionResult = this._extractEnhancedLinks(
        $,
        baseUrl,
        baseDomain,
        currentDepth,
        extractionOptions
      );

      // NEW: Additional extraction for comprehensive coverage
      const additionalLinks = this._extractAdditionalLinks(
        $,
        baseUrl,
        currentDepth,
        extractionOptions
      );

      // ENHANCED: Combine and optimize for content pages
      const allLinks = [...extractionResult.primaryLinks, ...additionalLinks];

      // NEW: Content page specific filtering and prioritization
      const optimizedLinks = this._optimizeForContentPages(allLinks, baseUrl, extractionOptions);

      console.log(
        `✅ EXTRACTOR: Extracted ${optimizedLinks.length} links (${
          optimizedLinks.filter((l) => l.isInternal).length
        } internal, ${optimizedLinks.filter((l) => l.linkType === 'content').length} content)`
      );

      return {
        links: optimizedLinks,
        pageInfo: this._extractPageInfo($, baseUrl),
        stats: {
          totalAnchors: $('a[href]').length,
          internalLinks: optimizedLinks.filter((l) => l.isInternal).length,
          externalLinks: optimizedLinks.filter((l) => !l.isInternal).length,
          crawlableLinks: optimizedLinks.filter((l) => l.shouldCrawl).length,
          // NEW: Content page specific stats
          contentLinks: optimizedLinks.filter((l) => l.linkType === 'content').length,
          navigationLinks: optimizedLinks.filter((l) => l.linkType === 'navigation').length,
          resourceLinks: optimizedLinks.filter((l) => l.linkType === 'resource').length,
        },
      };
    } catch (error) {
      console.error('❌ EXTRACTOR: Error extracting links:', error);
      return {
        links: [],
        pageInfo: { title: 'Error parsing page', description: '' },
        stats: {
          totalAnchors: 0,
          internalLinks: 0,
          externalLinks: 0,
          crawlableLinks: 0,
          contentLinks: 0,
          navigationLinks: 0,
          resourceLinks: 0,
        },
        error: error.message,
      };
    }
  }

  /**
   * NEW: Enhanced link extraction with content page focus
   */
  _extractEnhancedLinks($, baseUrl, baseDomain, currentDepth, options) {
    const primaryLinks = [];
    const processedUrls = new Set();
    let linksProcessed = 0;

    // ENHANCED: Find all anchor tags with improved content detection
    $('a[href]').each((index, element) => {
      if (linksProcessed >= options.maxLinksPerPage) {
        return false; // Break out of loop when limit reached
      }

      const $link = $(element);
      const href = $link.attr('href');

      if (!href || href.trim() === '') return;

      try {
        // Skip common non-content links
        if (this._shouldSkipLink(href, $link)) return;

        // Resolve to absolute URL
        const absoluteUrl = urlUtils.resolveUrl(href, baseUrl);
        if (!absoluteUrl || !urlUtils.isValidUrl(absoluteUrl)) return;

        const normalizedUrl = urlUtils.normalizeUrl(absoluteUrl);

        // Avoid duplicates
        if (processedUrls.has(normalizedUrl)) return;
        processedUrls.add(normalizedUrl);

        // Check if internal
        const isInternal = urlUtils.isInternalUrl(normalizedUrl, baseUrl);

        // Skip external links if not included
        if (!isInternal && !options.includeExternal) return;

        // NEW: Extract comprehensive link information
        const linkInfo = {
          url: normalizedUrl,
          sourceUrl: baseUrl,
          linkText: textUtils.extractLinkText($link),
          isInternal,
          depth: currentDepth + 1,
          shouldCrawl: isInternal && urlUtils.shouldCrawlUrl(normalizedUrl),

          // NEW: Enhanced metadata
          attributes: this._extractLinkAttributes($link),
          context: this._extractLinkContext($, $link),
          linkType: this._classifyLink($link, normalizedUrl, $),
          priority: this._calculateLinkPriority($link, normalizedUrl, $),

          // Additional metadata for content analysis
          inContentArea: this._isInContentArea($, $link),
          hasContentKeywords: this._hasContentKeywords($link.text()),
          linkPosition: index,
        };

        primaryLinks.push(linkInfo);
        linksProcessed++;
      } catch (error) {
        console.warn(`⚠️ EXTRACTOR: Error processing link ${href}:`, error.message);
      }
    });

    return { primaryLinks };
  }

  /**
   * NEW: Extract additional links from other HTML elements
   */
  _extractAdditionalLinks($, baseUrl, currentDepth, options) {
    const additionalLinks = [];

    // Only extract additional links if specifically requested
    if (!options.includeImages && !options.includeScripts && !options.includeStyles) {
      return additionalLinks;
    }

    // Images (if requested)
    if (options.includeImages) {
      $('img[src]').each((index, element) => {
        const src = $(element).attr('src');
        const absoluteUrl = urlUtils.resolveUrl(src, baseUrl);

        if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
          // Security validation
          const validation = securityUtils.isSafeUrl(absoluteUrl);
          if (!validation.safe) return;

          additionalLinks.push({
            url: absoluteUrl,
            sourceUrl: baseUrl,
            linkText: $(element).attr('alt') || 'Image',
            isInternal: urlUtils.isInternalUrl(absoluteUrl, baseUrl),
            depth: currentDepth + 1,
            shouldCrawl: false,
            linkType: 'resource',
            resourceType: 'image',
            priority: 2,
          });
        }
      });
    }

    return additionalLinks.slice(0, 50); // Limit additional links
  }

  /**
   * NEW: Optimize extracted links for content page processing
   */
  _optimizeForContentPages(allLinks, baseUrl, options) {
    if (!options.prioritizeContentLinks) {
      return allLinks.slice(0, options.maxLinksPerPage);
    }

    // Sort by priority (higher priority first) and type
    const sortedLinks = allLinks.sort((a, b) => {
      // First priority: link type (content > navigation > resource > other)
      const typeOrder = { content: 4, navigation: 3, resource: 2, other: 1 };
      const typeA = typeOrder[a.linkType] || 1;
      const typeB = typeOrder[b.linkType] || 1;

      if (typeA !== typeB) return typeB - typeA;

      // Second priority: calculated priority score
      return (b.priority || 5) - (a.priority || 5);
    });

    // Take the top links up to the limit
    let filteredLinks = sortedLinks.slice(0, options.maxLinksPerPage);

    // NEW: Ensure we keep high-priority content links
    if (options.classifyLinks) {
      const contentLinks = filteredLinks.filter(
        (link) => link.linkType === 'content' && link.priority >= 7
      );
      const otherLinks = filteredLinks
        .filter((link) => !['content'].includes(link.linkType) || link.priority < 7)
        .slice(0, options.maxLinksPerPage - contentLinks.length);

      filteredLinks = [...contentLinks, ...otherLinks];
    }

    return filteredLinks;
  }

  /**
   * NEW: Classify link type for content page processing
   */
  _classifyLink($link, url, $) {
    const linkText = $link.text().trim().toLowerCase();
    const linkClass = ($link.attr('class') || '').toLowerCase();
    const linkParent = $link.parent();
    const parentClass = (linkParent.attr('class') || '').toLowerCase();

    // Content links (high priority for content pages)
    if (this._isContentLink(linkText, linkClass, parentClass, url)) {
      return 'content';
    }

    // Navigation links
    if (this._isNavigationLink(linkText, linkClass, parentClass, $link, $)) {
      return 'navigation';
    }

    // Resource links (downloads, media, etc.)
    if (this._isResourceLink(url, linkText)) {
      return 'resource';
    }

    return 'other';
  }

  /**
   * NEW: Calculate link priority for content page processing
   */
  _calculateLinkPriority($link, url, $) {
    let priority = 5; // Base priority

    const linkText = $link.text().trim();
    const linkClass = ($link.attr('class') || '').toLowerCase();

    // Higher priority for content area links
    if (this._isInContentArea($, $link)) priority += 2;

    // Higher priority for descriptive link text
    if (linkText.length > 10 && linkText.length < 100) priority += 1;

    // Higher priority for content keywords
    if (this._hasContentKeywords(linkText)) priority += 2;

    // Lower priority for common navigation
    if (this._isCommonNavigation(linkText)) priority -= 2;

    // Lower priority for footer/header links
    if (this._isInNavigationArea($, $link)) priority -= 1;

    // Higher priority for article/post links
    if (linkClass.includes('post') || linkClass.includes('article')) priority += 2;

    return Math.max(1, Math.min(10, priority)); // Clamp between 1-10
  }

  /**
   * NEW: Determine if link is in main content area
   */
  _isInContentArea($, $link) {
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '#content',
    ];

    return contentSelectors.some((selector) => $link.closest(selector).length > 0);
  }

  /**
   * NEW: Check if link text contains content keywords
   */
  _hasContentKeywords(text) {
    const contentKeywords = [
      'read more',
      'continue reading',
      'full article',
      'learn more',
      'view details',
      'see more',
      'explore',
      'discover',
      'guide',
      'tutorial',
      'how to',
      'tips',
      'review',
      'analysis',
    ];

    const lowerText = text.toLowerCase();
    return contentKeywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * NEW: Check if this is a content link
   */
  _isContentLink(linkText, linkClass, parentClass, url) {
    // URL patterns that indicate content
    const contentPatterns = [
      /\/blog\//,
      /\/article\//,
      /\/post\//,
      /\/news\//,
      /\/guide\//,
      /\/tutorial\//,
      /\/review\//,
    ];

    if (contentPatterns.some((pattern) => pattern.test(url))) {
      return true;
    }

    // Class patterns
    const contentClasses = ['post-link', 'article-link', 'content-link', 'entry-link'];
    if (contentClasses.some((cls) => linkClass.includes(cls) || parentClass.includes(cls))) {
      return true;
    }

    // Link text patterns (substantial text usually indicates content)
    if (linkText.length > 15 && !this._isCommonNavigation(linkText)) {
      return true;
    }

    return false;
  }

  /**
   * NEW: Check if this is a navigation link
   */
  _isNavigationLink(linkText, linkClass, parentClass, $link, $) {
    // Check if in navigation area
    if (this._isInNavigationArea($, $link)) return true;

    // Common navigation classes
    const navClasses = ['nav', 'menu', 'navigation', 'navbar', 'breadcrumb'];
    if (navClasses.some((cls) => linkClass.includes(cls) || parentClass.includes(cls))) {
      return true;
    }

    // Common navigation text
    if (this._isCommonNavigation(linkText)) return true;

    return false;
  }

  /**
   * NEW: Check if this is a resource link
   */
  _isResourceLink(url, linkText) {
    // File extensions
    const resourceExtensions = ['.pdf', '.doc', '.zip', '.jpg', '.png', '.mp4'];
    if (resourceExtensions.some((ext) => url.toLowerCase().includes(ext))) {
      return true;
    }

    // Download keywords
    const downloadKeywords = ['download', 'pdf', 'file', 'document'];
    const lowerText = linkText.toLowerCase();
    if (downloadKeywords.some((keyword) => lowerText.includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * NEW: Check if link is in navigation area
   */
  _isInNavigationArea($, $link) {
    const navSelectors = [
      'nav',
      'header',
      'footer',
      '.navigation',
      '.navbar',
      '.menu',
      '.breadcrumb',
      '.sidebar',
    ];

    return navSelectors.some((selector) => $link.closest(selector).length > 0);
  }

  /**
   * NEW: Check if text is common navigation
   */
  _isCommonNavigation(text) {
    const navTerms = [
      'home',
      'about',
      'contact',
      'services',
      'products',
      'blog',
      'news',
      'events',
      'careers',
      'privacy',
      'terms',
      'help',
      'support',
      'login',
      'register',
      'search',
      'menu',
      'next',
      'previous',
      'back',
      'more',
      'all',
      'categories',
      'tags',
    ];

    const lowerText = text.toLowerCase().trim();
    return navTerms.includes(lowerText) || lowerText.length < 4;
  }

  /**
   * NEW: Should skip this link entirely
   */
  _shouldSkipLink(href, $link) {
    // Skip javascript, mailto, tel, etc.
    if (
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#')
    ) {
      return true;
    }

    // Skip if nofollow and we respect it
    if (this.options.respectNoFollow && ($link.attr('rel') || '').includes('nofollow')) {
      return true;
    }

    return false;
  }

  /**
   * NEW: Extract link context information
   */
  _extractLinkContext($, $link) {
    const parent = $link.parent();
    const surrounding = $link.closest('p, div, li, td').text().trim();

    return {
      parentTag: parent.prop('tagName')?.toLowerCase(),
      parentClass: parent.attr('class'),
      surroundingText: surrounding.substring(0, 200),
      inList: $link.closest('ul, ol').length > 0,
      inTable: $link.closest('table').length > 0,
    };
  }

  /**
   * ENHANCED: Extract page information with content analysis
   */
  _extractPageInfo($, baseUrl) {
    const title = $('title').first().text() || '';
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    const canonicalUrl = $('link[rel="canonical"]').attr('href');
    const resolvedCanonical = canonicalUrl ? urlUtils.resolveUrl(canonicalUrl, baseUrl) : baseUrl;

    // NEW: Enhanced page analysis for content quality
    const pageAnalysis = {
      wordCount: $('body').text().replace(/\s+/g, ' ').trim().split(' ').length,
      paragraphCount: $('p').length,
      headingCount: $('h1, h2, h3, h4, h5, h6').length,
      linkCount: $('a[href]').length,
      imageCount: $('img[src]').length,
      hasNavigation: $('nav').length > 0,
      hasMainContent: $('main, article, .content').length > 0,
      hasSchemaMarkup: $.html().includes('schema.org'),
    };

    return {
      title: textUtils.cleanText(title, 100),
      description: textUtils.cleanText(description, 200),
      canonicalUrl: resolvedCanonical,
      language: $('html').attr('lang') || 'en',
      hasRobotsMeta: $('meta[name="robots"]').length > 0,
      robotsContent: $('meta[name="robots"]').attr('content') || '',

      // NEW: Enhanced page metadata for content analysis
      analysis: pageAnalysis,
      contentQuality: this._calculatePageContentQuality($, pageAnalysis),
    };
  }

  /**
   * NEW: Calculate content quality score for the page
   */
  _calculatePageContentQuality($, analysis) {
    if (!this.options.extractMetadata) {
      return null;
    }

    let score = 0.5; // Start neutral

    // Content structure indicators
    if (analysis.wordCount > 300) score += 0.1;
    if (analysis.wordCount > 1000) score += 0.1;
    if (analysis.paragraphCount > 3) score += 0.1;
    if (analysis.headingCount > 1) score += 0.1;
    if (analysis.hasMainContent) score += 0.15;
    if (analysis.hasSchemaMarkup) score += 0.1;

    // Reasonable link density (not too many, not too few)
    const linkDensity = analysis.wordCount > 0 ? analysis.linkCount / analysis.wordCount : 0;
    if (linkDensity > 0.01 && linkDensity < 0.1) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * MAIN BRANCH: Extract link attributes - PRESERVED
   */
  _extractLinkAttributes($link) {
    return {
      rel: $link.attr('rel'),
      target: $link.attr('target'),
      title: $link.attr('title'),
      'aria-label': $link.attr('aria-label'),
      class: $link.attr('class'),
      id: $link.attr('id'),
    };
  }

  /**
   * MAIN BRANCH: Filter links for crawling - ENHANCED
   */
  filterLinksForCrawling(links, settings = {}) {
    const maxDepth = settings.maxDepth || 3;
    const includeExternal = settings.includeExternal || false;
    const prioritizeContent = settings.prioritizeContent || false;

    let filteredLinks = links.filter((link) => {
      // Check depth limit
      if (link.depth > maxDepth) return false;

      // Check internal/external setting
      if (!link.isInternal && !includeExternal) return false;

      // Check if link should be crawled
      if (!link.shouldCrawl) return false;

      return true;
    });

    // NEW: Prioritize content links if requested
    if (prioritizeContent) {
      const contentLinks = filteredLinks.filter((link) =>
        ['content', 'navigation'].includes(link.linkType)
      );
      const otherLinks = filteredLinks.filter(
        (link) => !['content', 'navigation'].includes(link.linkType)
      );

      filteredLinks = [...contentLinks, ...otherLinks];
    }

    return filteredLinks;
  }

  /**
   * MAIN BRANCH: Group links by domain - PRESERVED
   */
  groupLinksByDomain(links) {
    const groups = {};

    links.forEach((link) => {
      const domain = urlUtils.getDomain(link.url);
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(link);
    });

    return groups;
  }

  /**
   * NEW: Group links by type for content page processing
   */
  groupLinksByType(links) {
    const groups = {
      content: [],
      navigation: [],
      resource: [],
      other: [],
    };

    links.forEach((link) => {
      const type = link.linkType || 'other';
      if (groups[type]) {
        groups[type].push(link);
      } else {
        groups.other.push(link);
      }
    });

    return groups;
  }

  /**
   * NEW: Get summary statistics for extracted links
   */
  getLinkSummary(links) {
    const summary = {
      total: links.length,
      internal: links.filter((l) => l.isInternal).length,
      external: links.filter((l) => !l.isInternal).length,
      byType: {},
      byPriority: {},
      averagePriority: 0,
    };

    // Group by type
    links.forEach((link) => {
      const type = link.linkType || 'other';
      summary.byType[type] = (summary.byType[type] || 0) + 1;

      const priority = link.priority || 5;
      summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;
    });

    // Calculate average priority
    const totalPriority = links.reduce((sum, link) => sum + (link.priority || 5), 0);
    summary.averagePriority = links.length > 0 ? (totalPriority / links.length).toFixed(1) : 0;

    return summary;
  }
}

// Export a default instance for convenience
export const linkExtractor = new LinkExtractor();

// Export the class for custom configurations
export default LinkExtractor;
