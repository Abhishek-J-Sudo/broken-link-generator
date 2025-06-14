/**
 * Link extraction from HTML content
 * Uses Cheerio for server-side HTML parsing
 * OPTIMIZED: Enhanced for single-pass content page processing
 */

import * as cheerio from 'cheerio';
import { urlUtils, textUtils, contentPageUtils } from './utils.js';
import { securityUtils } from './security.js';

export class LinkExtractor {
  constructor(options = {}) {
    this.options = {
      includeExternal: false,
      maxLinksPerPage: 2000, // UPDATED: Higher limit for content pages
      followNofollow: false,
      // NEW: Content page specific options
      extractAllFromContent: true, // Extract ALL links from content pages
      classifyExtractedLinks: true, // Classify links during extraction
      prioritizeContentLinks: true, // Prioritize links likely to be content
      ...options,
    };
  }

  /**
   * ENHANCED: Extracts all links from HTML content with content page optimizations
   */
  extractLinks(html, baseUrl, currentDepth = 0) {
    try {
      const $ = cheerio.load(html);
      const links = [];
      const baseDomain = urlUtils.getDomain(baseUrl);

      // NEW: Enhanced link extraction for content pages
      const linkData = this._extractEnhancedLinks($, baseUrl, baseDomain, currentDepth);

      // EXISTING: Extract additional links (images, iframes, etc.)
      const additionalLinks = this._extractAdditionalLinks($, baseUrl, currentDepth);

      // NEW: Combine and optimize for content pages
      const allLinks = [...linkData.primaryLinks, ...additionalLinks];

      // NEW: Content page specific filtering and prioritization
      const optimizedLinks = this._optimizeForContentPages(allLinks, baseUrl);

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
      console.error('Error extracting links:', error);
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
  _extractEnhancedLinks($, baseUrl, baseDomain, currentDepth) {
    const primaryLinks = [];
    const processedUrls = new Set();

    // ENHANCED: Find all anchor tags with improved content detection
    $('a[href]').each((index, element) => {
      if (primaryLinks.length >= this.options.maxLinksPerPage) {
        return false; // Break out of loop
      }

      const $link = $(element);
      const href = $link.attr('href');

      if (!href || href.trim() === '') return;

      // Skip nofollow links if option is set
      if (!this.options.followNofollow && $link.attr('rel')?.includes('nofollow')) {
        return;
      }

      // Resolve relative URLs
      const absoluteUrl = urlUtils.resolveUrl(href, baseUrl);
      if (!absoluteUrl) return;

      // Normalize the URL
      const normalizedUrl = urlUtils.normalizeUrl(absoluteUrl);

      // Skip invalid URLs
      if (!urlUtils.isValidUrl(normalizedUrl)) return;

      // Avoid duplicates
      if (processedUrls.has(normalizedUrl)) return;
      processedUrls.add(normalizedUrl);

      // SECURITY: Validate URL safety before adding to results
      const validation = securityUtils.isSafeUrl(normalizedUrl);
      if (!validation.safe) {
        console.log(`🚫 BLOCKED during extraction: ${normalizedUrl} - ${validation.reason}`);
        return;
      }

      // Check if internal/external
      const isInternal = urlUtils.isInternalUrl(normalizedUrl, baseDomain);

      // Skip external links if not included
      if (!isInternal && !this.options.includeExternal) return;

      // NEW: Enhanced link analysis for content pages
      const linkAnalysis = this._analyzeLinkContext($link, normalizedUrl, baseUrl);

      // Extract comprehensive link information
      const linkInfo = {
        url: normalizedUrl,
        sourceUrl: baseUrl,
        linkText: textUtils.extractLinkText($link),
        isInternal,
        depth: currentDepth + 1,
        shouldCrawl: isInternal && urlUtils.shouldCrawlUrl(normalizedUrl),

        // NEW: Enhanced link metadata
        linkType: linkAnalysis.type, // 'content', 'navigation', 'resource', 'other'
        priority: linkAnalysis.priority, // 1-10 priority score
        context: linkAnalysis.context, // Where on page link was found
        attributes: this._extractLinkAttributes($link),

        // NEW: Content classification
        ...(this.options.classifyExtractedLinks && {
          targetPageType: contentPageUtils.classifyPageTypeByUrl(normalizedUrl),
          isLikelyContent: contentPageUtils.isContentPage(normalizedUrl),
        }),
      };

      primaryLinks.push(linkInfo);
    });

    return { primaryLinks };
  }

  /**
   * NEW: Analyzes link context to determine type and priority
   */
  _analyzeLinkContext($link, url, baseUrl) {
    let type = 'other';
    let priority = 5; // Default priority
    let context = 'body';

    try {
      // Analyze parent elements to understand context
      const parents = $link
        .parents()
        .map((i, el) => el.tagName.toLowerCase())
        .get();
      const linkText = textUtils.extractLinkText($link).toLowerCase();
      const classes = ($link.attr('class') || '').toLowerCase();

      // Determine context based on parent elements
      if (parents.includes('nav') || classes.includes('nav')) {
        context = 'navigation';
        type = 'navigation';
        priority = 6; // Navigation links are important for discovery
      } else if (parents.includes('header') || classes.includes('header')) {
        context = 'header';
        type = 'navigation';
        priority = 7;
      } else if (parents.includes('footer') || classes.includes('footer')) {
        context = 'footer';
        type = 'navigation';
        priority = 4; // Footer links are less important
      } else if (parents.includes('aside') || classes.includes('sidebar')) {
        context = 'sidebar';
        type = 'navigation';
        priority = 5;
      } else if (
        parents.includes('main') ||
        parents.includes('article') ||
        classes.includes('content')
      ) {
        context = 'main_content';
        type = 'content';
        priority = 8; // Content area links are high priority
      } else {
        context = 'body';
        type = 'content';
        priority = 7;
      }

      // Adjust priority based on link characteristics
      if (this.options.classifyExtractedLinks) {
        const targetType = contentPageUtils.classifyPageTypeByUrl(url);

        // Boost priority for likely content pages
        if (targetType === 'pages' || contentPageUtils.isContentPage(url)) {
          priority += 2;
        }

        // Reduce priority for admin, API, media
        if (['admin', 'api', 'media'].includes(targetType)) {
          priority -= 3;
          type = 'resource';
        }

        // Reduce priority for pagination
        if (targetType === 'pagination') {
          priority -= 2;
          type = 'navigation';
        }
      }

      // Boost priority for descriptive link text
      if (linkText && linkText.length > 10 && linkText.length < 100) {
        priority += 1;
      }

      // Reduce priority for generic link text
      const genericTexts = ['click here', 'read more', 'more', 'link', 'here'];
      if (genericTexts.some((generic) => linkText.includes(generic))) {
        priority -= 1;
      }

      // Clamp priority between 1-10
      priority = Math.max(1, Math.min(10, priority));
    } catch (error) {
      console.error('Error analyzing link context:', error);
    }

    return { type, priority, context };
  }

  /**
   * NEW: Optimizes link collection for content page processing
   */
  _optimizeForContentPages(allLinks, baseUrl) {
    if (!this.options.extractAllFromContent && !this.options.prioritizeContentLinks) {
      return allLinks; // Return unchanged if optimizations disabled
    }

    let optimizedLinks = [...allLinks];

    // Sort by priority if prioritization is enabled
    if (this.options.prioritizeContentLinks) {
      optimizedLinks.sort((a, b) => {
        // Primary sort: priority (higher first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }

        // Secondary sort: content links first
        if (a.linkType !== b.linkType) {
          const typeOrder = { content: 3, navigation: 2, resource: 1, other: 0 };
          return (typeOrder[b.linkType] || 0) - (typeOrder[a.linkType] || 0);
        }

        // Tertiary sort: internal links first
        if (a.isInternal !== b.isInternal) {
          return b.isInternal ? 1 : -1;
        }

        return 0;
      });
    }

    // Apply content page specific filtering
    if (this.options.extractAllFromContent) {
      // For content pages, we want to be more inclusive of links
      // Remove aggressive filtering that might exclude valuable links
      optimizedLinks = optimizedLinks.filter((link) => {
        // Keep all internal links
        if (link.isInternal) return true;

        // Keep external links if option enabled
        if (!link.isInternal && this.options.includeExternal) return true;

        return false;
      });
    }

    // Limit total links if needed
    if (optimizedLinks.length > this.options.maxLinksPerPage) {
      console.log(
        `🔧 Limiting ${optimizedLinks.length} links to ${this.options.maxLinksPerPage} for content page`
      );
      optimizedLinks = optimizedLinks.slice(0, this.options.maxLinksPerPage);
    }

    return optimizedLinks;
  }

  /**
   * EXISTING: Extracts additional links from other HTML elements
   * ENHANCED: Better security validation and content page optimization
   */
  _extractAdditionalLinks($, baseUrl, currentDepth) {
    const additionalLinks = [];
    const baseDomain = urlUtils.getDomain(baseUrl);

    // Images - with enhanced filtering for content pages
    $('img[src]').each((index, element) => {
      const src = $(element).attr('src');
      const absoluteUrl = urlUtils.resolveUrl(src, baseUrl);

      if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
        // SECURITY: Validate before adding
        const validation = securityUtils.isSafeUrl(absoluteUrl);
        if (!validation.safe) {
          console.log(`🚫 BLOCKED image during extraction: ${absoluteUrl} - ${validation.reason}`);
          return;
        }

        const isInternal = urlUtils.isInternalUrl(absoluteUrl, baseDomain);

        if (isInternal || this.options.includeExternal) {
          additionalLinks.push({
            url: urlUtils.normalizeUrl(absoluteUrl),
            sourceUrl: baseUrl,
            linkText: $(element).attr('alt') || 'Image',
            isInternal,
            depth: currentDepth + 1,
            shouldCrawl: false, // Don't crawl images
            type: 'image',
            linkType: 'resource', // NEW: Classify as resource
            priority: 3, // NEW: Lower priority for images
            context: 'image', // NEW: Context information
            attributes: {
              alt: $(element).attr('alt'),
              title: $(element).attr('title'),
            },
          });
        }
      }
    });

    // Iframes - WITH ENHANCED SECURITY VALIDATION
    $('iframe[src]').each((index, element) => {
      const src = $(element).attr('src');
      const absoluteUrl = urlUtils.resolveUrl(src, baseUrl);

      if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
        // SECURITY: Validate before adding
        const validation = securityUtils.isSafeUrl(absoluteUrl);
        if (!validation.safe) {
          console.log(`🚫 BLOCKED iframe during extraction: ${absoluteUrl} - ${validation.reason}`);
          return;
        }

        const isInternal = urlUtils.isInternalUrl(absoluteUrl, baseDomain);

        if (isInternal || this.options.includeExternal) {
          additionalLinks.push({
            url: urlUtils.normalizeUrl(absoluteUrl),
            sourceUrl: baseUrl,
            linkText: 'Embedded frame',
            isInternal,
            depth: currentDepth + 1,
            shouldCrawl: false,
            type: 'iframe',
            linkType: 'resource', // NEW: Classify as resource
            priority: 4, // NEW: Medium priority for iframes
            context: 'iframe', // NEW: Context information
            attributes: {
              title: $(element).attr('title'),
            },
          });
        }
      }
    });

    // Link tags (stylesheets, etc.) - WITH ENHANCED SECURITY VALIDATION
    $('link[href]').each((index, element) => {
      const href = $(element).attr('href');
      const absoluteUrl = urlUtils.resolveUrl(href, baseUrl);

      if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
        // SECURITY: Validate before adding
        const validation = securityUtils.isSafeUrl(absoluteUrl);
        if (!validation.safe) {
          console.log(
            `🚫 BLOCKED link resource during extraction: ${absoluteUrl} - ${validation.reason}`
          );
          return;
        }

        const isInternal = urlUtils.isInternalUrl(absoluteUrl, baseDomain);

        if (isInternal || this.options.includeExternal) {
          additionalLinks.push({
            url: urlUtils.normalizeUrl(absoluteUrl),
            sourceUrl: baseUrl,
            linkText: `${$(element).attr('rel')} resource`,
            isInternal,
            depth: currentDepth + 1,
            shouldCrawl: false,
            type: 'resource',
            linkType: 'resource', // NEW: Classify as resource
            priority: 2, // NEW: Low priority for resources
            context: 'head', // NEW: Context information
            attributes: {
              rel: $(element).attr('rel'),
              type: $(element).attr('type'),
            },
          });
        }
      }
    });

    return additionalLinks;
  }

  /**
   * EXISTING: Extracts metadata about the page - ENHANCED
   */
  _extractPageInfo($, baseUrl) {
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('p').first().text().trim().substring(0, 200) ||
      '';

    const canonicalUrl = $('link[rel="canonical"]').attr('href');
    const resolvedCanonical = canonicalUrl ? urlUtils.resolveUrl(canonicalUrl, baseUrl) : baseUrl;

    // NEW: Enhanced page analysis
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

      // NEW: Enhanced page metadata for content page analysis
      analysis: pageAnalysis,
      contentQuality: this._calculatePageContentQuality($, pageAnalysis),
    };
  }

  /**
   * NEW: Calculates content quality score for the page
   */
  _calculatePageContentQuality($, analysis) {
    if (!this.options.classifyExtractedLinks) {
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

    // Reasonable link density
    const linkDensity = analysis.wordCount > 0 ? analysis.linkCount / analysis.wordCount : 0;
    if (linkDensity > 0.01 && linkDensity < 0.05) score += 0.1; // Good link density
    if (linkDensity > 0.1) score -= 0.2; // Too many links (likely spam)

    return Math.max(0, Math.min(1, score));
  }

  /**
   * EXISTING: Extracts relevant attributes from link elements - NO CHANGES
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
   * EXISTING: Filters links based on crawl settings and rules - ENHANCED
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

    // NEW: Apply content prioritization if enabled
    if (prioritizeContent && this.options.prioritizeContentLinks) {
      // Sort by priority and limit to high-quality links
      filteredLinks.sort((a, b) => (b.priority || 5) - (a.priority || 5));

      // Prefer content and navigation links
      const prioritizedLinks = filteredLinks.filter((link) =>
        ['content', 'navigation'].includes(link.linkType)
      );

      // Add other links if we don't have enough
      const otherLinks = filteredLinks.filter(
        (link) => !['content', 'navigation'].includes(link.linkType)
      );

      filteredLinks = [...prioritizedLinks, ...otherLinks];
    }

    return filteredLinks;
  }

  /**
   * EXISTING: Groups links by domain for batch processing - NO CHANGES
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
   * NEW: Groups links by type for content page processing
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
   * NEW: Gets summary statistics for extracted links
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
