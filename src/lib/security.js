// Enhanced security utilities for safe crawling
// Add this to src/lib/security.js

export const securityUtils = {
  /**
   * Validates if a URL is safe to crawl (prevents SSRF attacks)
   */
  isSafeUrl(url) {
    try {
      const urlObj = new URL(url);

      // Only allow HTTP/HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { safe: false, reason: 'Invalid protocol' };
      }

      // Block localhost and internal networks
      const hostname = urlObj.hostname.toLowerCase();

      // Block localhost variations
      const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];

      if (localhostPatterns.includes(hostname)) {
        return { safe: false, reason: 'Localhost access blocked' };
      }

      // Block private IP ranges
      if (this.isPrivateIP(hostname)) {
        return { safe: false, reason: 'Private network access blocked' };
      }

      // Block metadata services (cloud providers)
      const metadataServices = [
        '169.254.169.254', // AWS/Azure/GCP metadata
        'metadata.google.internal',
        'metadata.azure.com',
      ];

      if (metadataServices.includes(hostname)) {
        return { safe: false, reason: 'Metadata service access blocked' };
      }

      // Additional domain-based restrictions
      if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
        return { safe: false, reason: 'Internal domain access blocked' };
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, reason: 'Invalid URL format' };
    }
  },

  /**
   * Checks if an IP address is in private ranges
   */
  isPrivateIP(hostname) {
    // Skip if not an IP address
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return false;
    }

    const parts = hostname.split('.').map(Number);

    // RFC 1918 private ranges
    return (
      // 10.0.0.0/8
      parts[0] === 10 ||
      // 172.16.0.0/12
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      // 192.168.0.0/16
      (parts[0] === 192 && parts[1] === 168) ||
      // 169.254.0.0/16 (link-local)
      (parts[0] === 169 && parts[1] === 254)
    );
  },

  /**
   * Rate limiting configuration per domain
   */
  getDomainRateLimit(hostname) {
    // More aggressive rate limiting for certain domains
    const strictDomains = ['github.com', 'stackoverflow.com', 'reddit.com'];

    if (strictDomains.some((domain) => hostname.includes(domain))) {
      return {
        maxConcurrent: 2,
        delayBetweenRequests: 1000,
        maxRequestsPerMinute: 30,
      };
    }

    return {
      maxConcurrent: 5,
      delayBetweenRequests: 200,
      maxRequestsPerMinute: 60,
    };
  },

  /**
   * Enhanced headers for respectful crawling
   */
  getCrawlHeaders(userContact = 'support@yourapp.com') {
    return {
      'User-Agent': `Broken Link Checker Bot/1.0 (+https://yourapp.com/bot-info; ${userContact})`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      // Identify as a link checker, not a scraper
      From: userContact,
      Purpose: 'link-validation',
    };
  },

  /**
   * Check robots.txt before crawling
   */
  async checkRobotsTxt(baseUrl) {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await fetch(robotsUrl, {
        timeout: 5000,
        headers: this.getCrawlHeaders(),
      });

      if (response.ok) {
        const robotsText = await response.text();
        return this.parseRobotsTxt(robotsText);
      }
    } catch (error) {
      // If robots.txt is not accessible, assume crawling is allowed
      console.log('Could not fetch robots.txt, proceeding with crawl');
    }

    return { allowed: true, crawlDelay: 1000 };
  },

  /**
   * Basic robots.txt parser
   */
  parseRobotsTxt(robotsText) {
    const lines = robotsText.split('\n');
    let userAgentSection = false;
    let crawlDelay = 1000;
    let disallowedPaths = [];

    for (const line of lines) {
      const cleanLine = line.split('#')[0].trim().toLowerCase();

      if (cleanLine.startsWith('user-agent:')) {
        const agent = cleanLine.split(':')[1].trim();
        userAgentSection = agent === '*' || agent.includes('bot');
      }

      if (userAgentSection) {
        if (cleanLine.startsWith('disallow:')) {
          const path = cleanLine.split(':')[1].trim();
          if (path === '/') {
            return { allowed: false, reason: 'Robots.txt disallows all crawling' };
          }
          disallowedPaths.push(path);
        }

        if (cleanLine.startsWith('crawl-delay:')) {
          crawlDelay = parseInt(cleanLine.split(':')[1].trim()) * 1000;
        }
      }
    }

    return {
      allowed: true,
      crawlDelay: Math.max(crawlDelay, 1000), // Minimum 1 second
      disallowedPaths,
    };
  },
};

// Enhanced HTTP checker with security
export class SecureHttpChecker {
  constructor(options = {}) {
    this.options = {
      timeout: 10000,
      maxRedirects: 3, // Reduced for security
      maxConcurrent: 3, // More conservative
      retryAttempts: 1,
      respectRobots: true,
      ...options,
    };
  }

  async checkUrl(url, sourceUrl = null) {
    // Security validation
    const validation = securityUtils.isSafeUrl(url);
    if (!validation.safe) {
      return {
        url,
        sourceUrl,
        is_working: false,
        error_message: `Blocked: ${validation.reason}`,
        statusCode: null,
        blocked: true,
      };
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD first for efficiency
        timeout: this.options.timeout,
        headers: securityUtils.getCrawlHeaders(),
        redirect: 'follow',
        signal: AbortSignal.timeout(this.options.timeout),
      });

      return {
        url,
        sourceUrl,
        is_working: response.status >= 200 && response.status < 400,
        http_status_code: response.status,
        response_time: Date.now() - startTime,
        checked_at: new Date().toISOString(),
        error_message: null,
      };
    } catch (error) {
      return {
        url,
        sourceUrl,
        is_working: false,
        http_status_code: null,
        error_message: error.message,
        checked_at: new Date().toISOString(),
        response_time: Date.now() - startTime,
      };
    }
  }
}
