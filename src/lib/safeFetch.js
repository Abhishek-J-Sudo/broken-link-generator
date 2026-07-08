/**
 * C3: Safe HTTP fetch wrapper.
 *
 * Every outbound request (initial URL + every redirect hop) is validated:
 *   1. URL structure check via securityUtils.isSafeUrl
 *   2. DNS resolution — all returned IPs checked against private ranges
 *   3. Response body capped at maxBodyBytes (C5)
 *
 * TOCTOU note: DNS is resolved before the TCP connect. A sufficiently short
 * DNS TTL could allow rebinding between the check and the connection. Full
 * mitigation requires connecting to the pinned resolved IP, which is not
 * implemented here. For our threat model this is acceptable defence-in-depth.
 *
 * Server-side only — uses Node.js `dns` and `net` modules.
 */

import { lookup as dnsLookup } from 'dns/promises';
import net from 'net';
import { securityUtils } from './security.js';

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch a URL with SSRF protection and response-size cap.
 *
 * @param {string} url
 * @param {object} opts
 * @param {string}   [opts.method='GET']
 * @param {object}   [opts.headers={}]
 * @param {number}   [opts.timeout=15000]   ms timeout per hop
 * @param {number}   [opts.maxRedirects=5]
 * @param {boolean}  [opts.readBody=false]  whether to buffer the response body
 * @param {number}   [opts.maxBodyBytes]    body size cap (default 5 MB)
 * @param {AbortSignal} [opts.signal]       optional external abort signal
 * @returns {Promise<{ok, status, statusText, headers, url, redirectCount, text}>}
 */
export async function safeFetch(url, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    timeout = DEFAULT_TIMEOUT_MS,
    maxRedirects = MAX_REDIRECTS,
    readBody = false,
    maxBodyBytes = MAX_BODY_BYTES,
    signal: externalSignal,
  } = opts;

  let currentUrl = url;
  let redirectCount = 0;
  let currentMethod = method;

  for (;;) {
    // 1. Structural SSRF check
    const safety = securityUtils.isSafeUrl(currentUrl);
    if (!safety.safe) {
      const err = new Error(`SSRF blocked: ${safety.reason}`);
      err.code = 'SSRF_BLOCKED';
      throw err;
    }

    // 2. DNS check — only for hostnames, not bare IP literals.
    // WHATWG URL .hostname wraps IPv6 in brackets ("[::1]") — strip them.
    const rawHost = new URL(currentUrl).hostname;
    const hostname = rawHost.startsWith('[') ? rawHost.slice(1, -1) : rawHost;
    if (net.isIP(hostname) === 0) {
      await assertSafeDns(hostname);
    }

    // 3. Timed fetch with no auto-redirect
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeout);

    let response;
    try {
      const signals = externalSignal
        ? AbortSignal.any([controller.signal, externalSignal])
        : controller.signal;

      response = await fetch(currentUrl, {
        method: currentMethod,
        headers,
        redirect: 'manual',
        signal: signals,
      });
    } finally {
      clearTimeout(timer);
    }

    // 4. Follow redirects with per-hop validation
    if (response.status >= 300 && response.status < 400) {
      await drainBody(response);

      if (redirectCount >= maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }

      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect response missing Location header');

      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      currentMethod = 'GET'; // POST→GET on redirect (RFC 7231)
      continue;
    }

    // 5. Buffer body up to the cap (or drain + discard)
    let bodyText = null;
    if (readBody && currentMethod !== 'HEAD') {
      bodyText = await readCappedBody(response, maxBodyBytes);
    } else {
      await drainBody(response);
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: currentUrl,
      redirectCount,
      text: () => Promise.resolve(bodyText ?? ''),
    };
  }
}

/**
 * Resolve hostname and throw if any returned address is private.
 */
async function assertSafeDns(hostname) {
  let addresses;
  try {
    addresses = await dnsLookup(hostname, { all: true });
  } catch (err) {
    const e = new Error(`DNS resolution failed for ${hostname}: ${err.message}`);
    e.code = 'SSRF_DNS_FAILED';
    throw e;
  }
  for (const { address } of addresses) {
    if (securityUtils.isPrivateAddress(address)) {
      const e = new Error(
        `SSRF blocked: ${hostname} resolved to private address ${address}`
      );
      e.code = 'SSRF_BLOCKED';
      throw e;
    }
  }
}

async function drainBody(response) {
  try {
    if (response.body) await response.body.cancel();
  } catch { /* ignore */ }
}

async function readCappedBody(response, maxBytes) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        throw new Error(`Response body exceeded ${maxBytes} byte limit`);
      }
      chunks.push(value);
    }
  } catch (err) {
    reader.cancel().catch(() => {});
    throw err;
  }

  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}
