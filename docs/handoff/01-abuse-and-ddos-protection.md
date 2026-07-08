# 01 — Abuse, Bot & DDoS Protection

**Priority:** P0
**Goal:** Make the crawler safe to expose on the public internet.

## Implementation status (as of 2026-07-08)

| Item | Status | Notes |
|------|--------|-------|
| C1 — Trusted client IP | ✅ Done | `src/lib/clientIp.js`; `TRUST_PROXY=true` env required in Coolify |
| C2 — Shared rate-limit store | ⬜ Pending | Redis available via `REDIS_URL`; A1 blocker is gone — ready to implement |
| C3 — SSRF: validate every redirect hop | ✅ Done | `src/lib/safeFetch.js`: `redirect:'manual'`, per-hop URL+DNS validation |
| C4 — IPv6 / encoding gaps in isSafeUrl | ✅ Done | `isPrivateAddress()` in `security.js`: ULA, link-local, IPv4-mapped, CGNAT, 0.0.0.0/8; WHATWG bracket stripping; DNS pre-flight in safeFetch |
| C5 — Response size + content-type caps | ✅ Done | safeFetch streams + caps at 5 MB; link-only checks use `readBody:false` |
| C6 — Per-target-domain politeness gate | ⬜ Pending | Needs shared store (depends on C2) |
| C7 — Edge / Cloudflare WAF | ⬜ Pending | Deployment task |
| C8 — Secret defaults + info leaks | ✅ Done | CSRF fails closed in prod; health no longer leaks `error.message`; `timingSafeEqual` on cleanup token; middleware username logs removed |
| C9 — CORS consistency | ✅ Done | `src/lib/cors.js`; all 8 OPTIONS handlers use `corsOrigin` |

**Next:** C2 — shared rate-limit store. Redis is running (A1 added it). Replace the in-memory
`EnhancedRateLimitStore` in `src/lib/validation.js` with a Redis sliding-window, and migrate
the middleware brute-force `Map` in `middleware.ts` to the same store.

---

## Threat model

| # | Threat | Direction | Current state |
|---|--------|-----------|---------------|
| T1 | Volumetric flood of `/api/crawl` / `/api/analyze` to exhaust CPU/DB | inbound | In-memory rate limit only; bypassable |
| T2 | Rate-limit bypass by spoofing `x-forwarded-for` | inbound | IP taken from raw header, no trusted proxy |
| T3 | SSRF to cloud metadata / internal services via redirects or DNS rebinding | outbound | Only initial URL validated; redirects followed |
| T4 | Memory exhaustion by pointing crawler at a huge/slow response | outbound | Whole body read into memory, no size cap |
| T5 | Using us as an amplifier/DoS against a third-party site | outbound | Per-domain limits defined but not enforced globally |
| T6 | Automated bots/scrapers hitting the UI and endpoints | inbound | None beyond rate limit |
| T7 | Secrets weakly defaulted / info leak via errors | inbound | `CSRF_SECRET` default; health leaks errors |

---

## Current state (what exists today)

- `src/lib/validation.js` — `EnhancedRateLimitStore`, an **in-memory** `Map` keyed by IP
  with progressive blocking. Good logic, but:
  - State lives in a single process. It resets on every deploy/restart and is **not
    shared** if Coolify runs more than one replica.
  - `crawl/start/route.js:42` reads `request.headers.get('x-forwarded-for') || 'unknown'`
    **without** `.split(',')[0]` — so the whole header string is the key and rotating it
    yields unlimited fresh buckets. Other routes split it but still trust it blindly.
- `src/lib/rateLimit.js` — a `withRateLimit` middleware wrapper + a lot of **placeholder**
  functions (`bypassRateLimit`, `getIPAnalytics`, `updateRateLimitConfig`) that return
  static objects and do nothing. Routes don't actually use the wrapper; they call
  `validateAdvancedRateLimit` inline. Pick one path (see Doc 03).
- `src/lib/security.js` — `securityUtils.isSafeUrl()` blocks localhost, RFC-1918 ranges,
  and a few metadata hostnames. `SecureHttpChecker` and `HttpChecker` follow redirects
  (`maxRedirects: 3`) and re-validate **nothing** on the redirect target.
- `next.config.js` — solid security headers + HSTS + restricted CORS in prod. But every
  route's own `OPTIONS` handler hardcodes `Access-Control-Allow-Origin: '*'`, contradicting it.

---

## Changes to implement

### C1 — Trust the proxy correctly, then rate-limit on a real IP (T1, T2)

The app sits behind Coolify's proxy (Traefik). Client IP must come from a **trusted**
forwarding header, and we must not accept it from arbitrary clients.

1. Introduce a single source of truth for client IP. Create `src/lib/clientIp.js`:
   ```js
   // Only trust forwarding headers when we know we're behind our own proxy.
   // TRUSTED_PROXY=true is set in the deployment env; locally it's false.
   const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

   export function getClientIp(request) {
     if (TRUST_PROXY) {
       const xff = request.headers.get('x-forwarded-for');
       if (xff) return xff.split(',')[0].trim();          // left-most = original client
       const real = request.headers.get('x-real-ip');
       if (real) return real.trim();
     }
     // Fallback: the connecting socket IP exposed by Next on the request.
     return request.headers.get('x-real-ip')?.trim() || 'unknown';
   }
   ```
2. Replace every ad-hoc IP extraction (`crawl/start:42`, `analyze:21`, `security/events:15`,
   `rateLimit.js:13` and `:216`) with `getClientIp(request)`. This kills the
   `crawl/start` bypass where the unsplit header was the key.
3. Configure Traefik/Coolify to **overwrite** (not append) `X-Forwarded-For` with the real
   peer IP so a client-supplied value can't survive. Document this in `.env.example`
   (`TRUST_PROXY=true`) and in the deploy notes.

**Acceptance:** From two machines, sending `X-Forwarded-For: 1.2.3.4` to `/api/analyze`
does not let you exceed the analyze limit — the block follows the real IP.

### C2 — Move rate-limit + abuse state out of process memory (T1)

In-memory state is the core weakness. Because the DB is moving to Postgres, back the
limiter with a shared store.

- **Preferred:** add **Redis** (Coolify one-click) and implement a token-bucket / sliding
  window with atomic `INCR` + `EXPIRE`. Reuse the existing endpoint configs
  (`BASE_RATE_LIMITS` in `validation.js`) as the tunables.
- **If no Redis:** a Postgres table `rate_limit_hits (ip, endpoint, ts)` with a
  windowed `COUNT(*)` works for this app's volume and gets you cross-replica correctness
  for free once the pg module lands. Add an index on `(ip, endpoint, ts)` and a periodic
  `DELETE` of rows older than the largest window.

Keep the current progressive-penalty semantics (repeat offenders blocked longer). Delete
the dead placeholder functions in `rateLimit.js` rather than porting them.

**Acceptance:** rate-limit counters survive a container restart; two replicas share one
budget.

### C3 — Harden SSRF: validate every hop, not just the first (T3)

This is the highest-severity outbound issue. Today `isSafeUrl()` runs once on the input,
then `axios`/`fetch` follow up to 3 redirects to wherever they point — including
`http://169.254.169.254/latest/meta-data/` on the cloud host.

Implement a **safe fetch** wrapper used by *all* outbound requests (`httpChecker.js`,
`security.js#checkRobotsTxt`, `analyze/route.js#fetchPageWithTimeout`,
`crawl/start` inline `fetch`es):

1. Set `maxRedirects: 0` (axios) / `redirect: 'manual'` (fetch). Handle redirects
   yourself: on a 3xx, read `location`, resolve it, run `isSafeUrl()` on the target, and
   only then follow — up to a small cap (e.g. 3). This closes redirect-based SSRF.
2. **Resolve DNS and validate the resolved IP**, not just the hostname string. A public
   name like `rebind.evil.com` can resolve to `127.0.0.1` / `169.254.169.254`. Use
   `dns.lookup({ all: true })`, run every returned address through the private-range
   check, and pin the connection to a validated IP (or re-check just before connect).
3. Extend `isPrivateIP()` to cover the gaps below (C4).

### C4 — Close the IP-encoding and IPv6 gaps in `isSafeUrl` (T3)

`src/lib/security.js#isPrivateIP` only matches dotted-decimal IPv4 via regex, so these
**bypass** it today:

- Decimal/octal/hex IPs: `http://2130706433/`, `http://0177.0.0.1/`, `http://0x7f.1/`
  all mean `127.0.0.1`.
- IPv6: only `::1` is blocked. Missing `fc00::/7` (ULA), `fe80::/10` (link-local),
  `::ffff:127.0.0.1` (IPv4-mapped), and `[::1]` in bracketed form.
- `0.0.0.0/8` and CGNAT `100.64.0.0/10`.

Fix by normalizing to a canonical address before checking. Prefer parsing with Node's
`net.isIP` / the `ipaddr.js` library (already transitively common) rather than hand-rolled
regex. Validate the **post-DNS** address from C3 with the same function.

**Acceptance (C3+C4):** all of these return blocked, both as direct input and as a redirect
target:
```
http://169.254.169.254/            http://127.0.0.1/
http://2130706433/                 http://0x7f000001/
http://[::1]/                      http://[fd00::1]/
http://localhost.my-real-domain (resolving to 10.x)  → blocked after DNS
```
Add these as unit tests (see Doc 04 — testing).

### C5 — Cap request time, response size, and content type (T4, T5)

- Add `maxContentLength` and `maxBodyLength` to `axiosConfig` in `httpChecker.js`
  (e.g. 5 MB) so a giant body can't OOM the worker. For the analyzer's `fetch`, stream and
  abort once a byte budget is exceeded instead of `await response.text()` unconditionally.
- Before reading a body for link/SEO extraction, check `content-type` is HTML (the
  analyzer already does this at `analyze/route.js:765`; apply the same guard in
  `crawl/start` content-page fetches).
- Enforce a hard per-job ceiling on total outbound requests and wall-clock time; today
  `maxPages`/`maxDepth` are validated but the content-pages mode allows `maxLinksPerPage:
  2000` × pages with no global cap.

### C6 — Enforce per-target-domain politeness globally (T5)

`securityUtils.getDomainRateLimit()` exists but nothing enforces it across concurrent
jobs. Add a shared (Redis/Postgres) per-destination-host concurrency + delay gate so we
never become an amplifier hammering one third-party site, regardless of how many of our
jobs target it. Respect `crawl-delay` from robots.txt (parsed already) here.

### C7 — Edge / infrastructure protection (T1, T6) — deployment, not code

Rate limiting in Node is a backstop, not a DDoS defense. Put the app behind a CDN/WAF:

- **Cloudflare (free tier is enough):** proxy the Coolify domain, enable "Under Attack"
  mode capability, bot fight mode, and a rate-limiting rule on `/api/*`. This absorbs
  volumetric floods before they reach the origin and gives us `cf-connecting-ip`
  (already referenced in `rateLimit.js`) as a trustworthy client IP.
- Restrict the origin firewall so the app only accepts traffic from Cloudflare IPs.
- Document this in the deploy runbook. It pairs with Basic Auth (Doc 02): Cloudflare for
  volume, Basic Auth for access.

### C8 — Fix secret defaults and info leaks (T7)

- `src/app/api/csrf-token/route.js:12` — remove the `|| 'default-dev-secret-...'` fallback.
  Fail closed: throw at startup if `CSRF_SECRET` is unset in production.
- `src/app/api/health/route.js` — do not return `error.message`/DB errors to the client in
  production; return a generic `unhealthy` and log details server-side. Consider requiring
  auth or a shared token for the detailed variant (it's under `/api`, so Basic Auth won't
  cover it — see Doc 02 C4).
- `src/app/api/admin/cleanup/route.js:18` — replace `authHeader !== expectedToken` with a
  constant-time compare (`crypto.timingSafeEqual`) to avoid token timing leaks.
- Remove the credential-adjacent `console.log`s (`middleware.ts:10`, `:47` logs the
  username) before production.

### C9 — Reconcile CORS (T2)

Every route's `OPTIONS` handler returns `Access-Control-Allow-Origin: '*'`, undoing the
restricted CORS set in `next.config.js`. Centralize CORS: have one helper return the same
`ALLOWED_ORIGIN`-based headers and use it in all `OPTIONS` handlers, or drop the per-route
handlers and let `next.config.js` own it.

---

## Suggested implementation order

1. **C1 + C8 + C9** — small, high-value, no new infra. (½ day)
2. **C3 + C4 + C5** — the SSRF/DoS core; add tests. (1–2 days)
3. **C2 + C6** — needs Redis or the pg module; do after the DB migration lands. (1–2 days)
4. **C7** — deployment/infra task, can run in parallel. (½ day)

## Definition of done

- [ ] Spoofed `X-Forwarded-For` cannot bypass rate limits (C1).
- [ ] Rate-limit state survives restart / is shared across replicas (C2).
- [ ] SSRF test matrix in C4 all blocked, including as redirect targets and via DNS (C3/C4).
- [ ] Outbound requests capped in size, time, and total count per job (C5/C6).
- [ ] No hardcoded secret fallback; health/cleanup don't leak details; constant-time token compare (C8).
- [ ] CORS behavior is consistent between `next.config.js` and route `OPTIONS` (C9).
- [ ] Edge WAF/rate-limiting documented and enabled in the deploy runbook (C7).
