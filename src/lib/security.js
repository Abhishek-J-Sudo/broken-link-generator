// Enhanced security utilities for safe crawling
import net from 'net';

export const securityUtils = {
  /**
   * Validates URL structure and blocks obviously private/internal targets.
   * This is a synchronous fast-path check; callers should also use safeFetch
   * which performs DNS resolution and per-hop redirect validation.
   */
  isSafeUrl(url) {
    try {
      const urlObj = new URL(url);

      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { safe: false, reason: 'Invalid protocol' };
      }

      // URL parser normalises decimal/hex/octal IPv4 to dotted-decimal.
      // For IPv6, .hostname keeps the brackets: "[::1]" — strip them.
      const rawHost = urlObj.hostname.toLowerCase();
      const hostname = rawHost.startsWith('[') ? rawHost.slice(1, -1) : rawHost;

      // Block well-known internal hostnames
      const blockedNames = ['localhost', 'metadata.google.internal', 'metadata.azure.com'];
      if (blockedNames.includes(hostname)) {
        return { safe: false, reason: 'Blocked hostname' };
      }

      if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
        return { safe: false, reason: 'Internal domain access blocked' };
      }

      // If the host is already an IP literal, validate it directly.
      // Hostnames are validated at DNS-resolution time inside safeFetch.
      if (net.isIP(hostname) !== 0) {
        if (this.isPrivateAddress(hostname)) {
          return { safe: false, reason: 'Private network access blocked' };
        }
      } else if (this.isPrivateIP(hostname)) {
        // Legacy regex path — handles any dotted-decimal that slipped through
        return { safe: false, reason: 'Private network access blocked' };
      }

      return { safe: true };
    } catch {
      return { safe: false, reason: 'Invalid URL format' };
    }
  },

  /**
   * Checks whether a resolved IP address string (IPv4 or IPv6) is in a
   * private, loopback, link-local, or otherwise reserved range.
   * Accepts both bare form ("::1") and WHATWG-bracketed form ("[::1]").
   * Used by safeFetch after DNS resolution.
   */
  isPrivateAddress(addr) {
    // WHATWG URL .hostname wraps IPv6 in brackets — strip them
    const a = addr.startsWith('[') ? addr.slice(1, -1) : addr;
    const v = net.isIP(a);
    if (v === 4) return this._isPrivateIPv4(a);
    if (v === 6) return this._isPrivateIPv6(a);
    return false;
  },

  _isPrivateIPv4(addr) {
    const p = addr.split('.').map(Number);
    return (
      p[0] === 0 ||                                              // 0.0.0.0/8
      p[0] === 10 ||                                             // 10.0.0.0/8
      p[0] === 127 ||                                            // 127.0.0.0/8 loopback
      (p[0] === 100 && (p[1] & 0xc0) === 64) ||                 // 100.64.0.0/10 CGNAT
      (p[0] === 169 && p[1] === 254) ||                          // 169.254.0.0/16 link-local
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||             // 172.16.0.0/12
      (p[0] === 192 && p[1] === 0 && p[2] === 0) ||             // 192.0.0.0/24 IETF protocol
      (p[0] === 192 && p[1] === 168) ||                          // 192.168.0.0/16
      (p[0] === 198 && p[1] >= 18 && p[1] <= 19) ||             // 198.18.0.0/15 benchmarking
      p[0] === 255                                                // 255.x.x.x broadcast/reserved
    );
  },

  _isPrivateIPv6(addr) {
    const a = addr.toLowerCase();
    if (a === '::1' || a === '::') return true;                  // loopback / unspecified
    if (a.startsWith('::ffff:')) {                               // IPv4-mapped ::ffff:x.x.x.x
      const rest = a.slice(7);
      if (net.isIPv4(rest)) return this._isPrivateIPv4(rest);
      // Hex-group form: ::ffff:7f00:0001 → 127.0.0.1
      const v4 = this._ipv6HexToIPv4(rest);
      if (v4) return this._isPrivateIPv4(v4);
    }
    if (/^f[cd]/i.test(a)) return true;                          // fc00::/7 ULA
    if (/^fe[89ab]/i.test(a)) return true;                       // fe80::/10 link-local
    return false;
  },

  // "7f00:0001" or "7f00:1"  →  "127.0.0.1"
  _ipv6HexToIPv4(hexStr) {
    const parts = hexStr.split(':');
    if (parts.length !== 2) return null;
    const hi = parseInt(parts[0], 16);
    const lo = parseInt(parts[1], 16);
    if (isNaN(hi) || isNaN(lo)) return null;
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  },

  /**
   * Legacy: checks dotted-decimal IPv4 against RFC-1918 + link-local.
   * Kept for callers that haven't migrated to isPrivateAddress yet.
   */
  isPrivateIP(hostname) {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
    const parts = hostname.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    );
  },

  /**
   * Rate limiting configuration per domain
   */
  getDomainRateLimit(hostname) {
    const strictDomains = ['github.com', 'stackoverflow.com', 'reddit.com'];
    if (strictDomains.some((domain) => hostname.includes(domain))) {
      return { maxConcurrent: 2, delayBetweenRequests: 1000, maxRequestsPerMinute: 30 };
    }
    return { maxConcurrent: 5, delayBetweenRequests: 200, maxRequestsPerMinute: 60 };
  },

  /**
   * Enhanced headers for respectful crawling
   */
  getCrawlHeaders(userContact = 'support@yourapp.com') {
    return {
      'User-Agent': `SeoScrub Bot/1.0 (+https://seoscrub.in/bot; ${userContact})`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      From: userContact,
      Purpose: 'link-validation',
    };
  },

  /**
   * Check robots.txt before crawling. Uses safeFetch so redirects are validated.
   */
  async checkRobotsTxt(baseUrl) {
    try {
      const { safeFetch } = await import('./safeFetch.js');
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await safeFetch(robotsUrl, {
        headers: this.getCrawlHeaders(),
        timeout: 5000,
        readBody: true,
        maxBodyBytes: 512 * 1024, // 512 KB is more than enough for robots.txt
      });
      if (response.ok) {
        return this.parseRobotsTxt(await response.text());
      }
    } catch {
      // If robots.txt is not accessible, assume crawling is allowed
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
      crawlDelay: Math.max(crawlDelay, 1000),
      disallowedPaths,
    };
  },
};
