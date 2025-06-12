/**
 * Link extraction from HTML content
 * Uses Cheerio for server-side HTML parsing
 */

import * as cheerio from 'cheerio';
import { urlUtils, textUtils } from './utils.js';
import { securityUtils } from './security.js'; // Import security

export class LinkExtractor {
  constructor(options = {}) {
    this.options = {
      includeExternal: false,
      maxLinksPerPage: 1000,
      followNofollow: false,
      ...options,
    };
  }

  /**
   * Extracts all links from HTML content
   */
  extractLinks(html, baseUrl, currentDepth = 0) {
    try {
      const $ = cheerio.load(html);
      const links = [];
      const baseDomain = urlUtils.getDomain(baseUrl);

      // Find all anchor tags with href attributes
      $('a[href]').each((index, element) => {
        if (links.length >= this.options.maxLinksPerPage) {
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

        // SECURITY: Validate URL safety before adding to results
        const validation = securityUtils.isSafeUrl(normalizedUrl);
        if (!validation.safe) {
          console.log(`🚫 BLOCKED during extraction: ${normalizedUrl} - ${validation.reason}`);
          return; // Skip unsafe URLs
        }

        // Check if internal/external
        const isInternal = urlUtils.isInternalUrl(normalizedUrl, baseDomain);

        // Skip external links if not included
        if (!isInternal && !this.options.includeExternal) return;

        // Extract link information
        const linkInfo = {
          url: normalizedUrl,
          sourceUrl: baseUrl,
          linkText: textUtils.extractLinkText($link),
          isInternal,
          depth: currentDepth + 1,
          shouldCrawl: isInternal && urlUtils.shouldCrawlUrl(normalizedUrl),
          attributes: this._extractLinkAttributes($link),
        };

        // Avoid duplicates
        if (!links.some((link) => link.url === linkInfo.url)) {
          links.push(linkInfo);
        }
      });

      // Also extract links from other sources
      const additionalLinks = this._extractAdditionalLinks($, baseUrl, currentDepth);

      return {
        links: [...links, ...additionalLinks],
        pageInfo: this._extractPageInfo($, baseUrl),
        stats: {
          totalAnchors: $('a[href]').length,
          internalLinks: links.filter((l) => l.isInternal).length,
          externalLinks: links.filter((l) => !l.isInternal).length,
          crawlableLinks: links.filter((l) => l.shouldCrawl).length,
        },
      };
    } catch (error) {
      console.error('Error extracting links:', error);
      return {
        links: [],
        pageInfo: { title: 'Error parsing page', description: '' },
        stats: { totalAnchors: 0, internalLinks: 0, externalLinks: 0, crawlableLinks: 0 },
        error: error.message,
      };
    }
  }

  /**
   * Extracts additional links from other HTML elements
   */
  _extractAdditionalLinks($, baseUrl, currentDepth) {
    const additionalLinks = [];
    const baseDomain = urlUtils.getDomain(baseUrl);

    // Images
    $('img[src]').each((index, element) => {
      const src = $(element).attr('src');
      const absoluteUrl = urlUtils.resolveUrl(src, baseUrl);

      if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
        // SECURITY: Validate before adding
        const validation = securityUtils.isSafeUrl(absoluteUrl);
        if (!validation.safe) {
          console.log(`🚫 BLOCKED image during extraction: ${absoluteUrl} - ${validation.reason}`);
          return; // Skip unsafe URLs
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
            attributes: {
              alt: $(element).attr('alt'),
              title: $(element).attr('title'),
            },
          });
        }
      }
    });

    // Iframes - WITH SECURITY VALIDATION
    $('iframe[src]').each((index, element) => {
      const src = $(element).attr('src');
      const absoluteUrl = urlUtils.resolveUrl(src, baseUrl);

      if (absoluteUrl && urlUtils.isValidUrl(absoluteUrl)) {
        // SECURITY: Validate before adding
        const validation = securityUtils.isSafeUrl(absoluteUrl);
        if (!validation.safe) {
          console.log(`🚫 BLOCKED iframe during extraction: ${absoluteUrl} - ${validation.reason}`);
          return; // Skip unsafe URLs
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
            attributes: {
              title: $(element).attr('title'),
            },
          });
        }
      }
    });

    // Link tags (stylesheets, etc.) - WITH SECURITY VALIDATION
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
          return; // Skip unsafe URLs
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
   * Extracts metadata about the page
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

    return {
      title: textUtils.cleanText(title, 100),
      description: textUtils.cleanText(description, 200),
      canonicalUrl: resolvedCanonical,
      language: $('html').attr('lang') || 'en',
      hasRobotsMeta: $('meta[name="robots"]').length > 0,
      robotsContent: $('meta[name="robots"]').attr('content') || '',
    };
  }

  /**
   * Extracts relevant attributes from link elements
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
   * Filters links based on crawl settings and rules
   */
  filterLinksForCrawling(links, settings = {}) {
    const maxDepth = settings.maxDepth || 3;
    const includeExternal = settings.includeExternal || false;

    return links.filter((link) => {
      // Check depth limit
      if (link.depth > maxDepth) return false;

      // Check internal/external setting
      if (!link.isInternal && !includeExternal) return false;

      // Check if link should be crawled
      if (!link.shouldCrawl) return false;

      // Additional custom filters can be added here
      return true;
    });
  }

  /**
   * Groups links by domain for batch processing
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
}

// Export a default instance for convenience
export const linkExtractor = new LinkExtractor();

// Export the class for custom configurations
export default LinkExtractor;
