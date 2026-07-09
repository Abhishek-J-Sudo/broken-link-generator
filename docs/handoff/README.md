# SeoScrub — Hardening & Improvement Handoff

These docs are implementation specs written to be handed to another engineer (or an
LLM like Opus/Sonnet) to execute. Each doc is self-contained: it states the current
state, the problem, the specific changes with file references, and acceptance
criteria.

Read them in order — later docs assume the auth and abuse-protection work is landing.

| # | Doc | Scope | Priority |
|---|-----|-------|----------|
| 01 | [Abuse, Bot & DDoS Protection](./01-abuse-and-ddos-protection.md) | Rate limiting, SSRF, request/response limits, edge protection | **P0** |
| 02 | [Access Control / Basic Auth](./02-basic-auth.md) | Make the private app actually private (incl. API routes) | **P0** |
| 03 | [Architecture Review](./03-architecture-review.md) | Job queue, service layer, dedup of crawl routes | **P1** |
| 04 | [Features & Improvements](./04-features-and-improvements.md) | Roadmap: scheduling, alerts, exports, JS rendering, tests, SEO depth | **P2** |
| 05 | [Monetization & Competitive Landscape](./05-monetization.md) | Strategy: freemium model, pricing, competitors (no code) | **P3** |

## Context the implementer must know

- **Stack:** Next.js 15 (App Router, `output: 'standalone'`), React 19, deployed via
  Docker on Coolify. Worker process (`worker/index.ts`) runs as a separate container
  powered by BullMQ + Redis. Crawl jobs are enqueued via the API and processed by the worker.
- **DB:** Supabase migration is **complete** — app uses plain Postgres via `src/lib/pg.js`.
  `src/lib/supabase.js` is now a thin facade over it; keep using `db.*` helpers.
  Do not add new Supabase client dependencies.
- **Auth:** The whole app (pages + API) is gated by Basic Auth in `middleware.ts`.
  `/api/health` is public; `/api/admin/cleanup` uses its own `CLEANUP_SECRET_TOKEN`.
- **Outbound HTTP:** All crawler/checker fetches go through `src/lib/safeFetch.js`
  (SSRF-safe wrapper with per-hop redirect validation, DNS check, 5 MB body cap).
  Do not add new raw `fetch()`/axios calls without going through safeFetch.
- **Single-tenant / private:** internal tool for a small trusted group.
  Prefer simple, robust solutions over heavyweight multi-tenant systems.

## Severity summary (why these docs exist)

| Finding | Where | Doc | Status |
|---------|-------|-----|--------|
| Basic Auth **skips every `/api/*` route** — crawl/analyze are unauthenticated | `middleware.ts` matcher | 02 | ✅ Fixed — matcher covers `/api/*`; direct 401; constant-time compare; brute-force backoff; production fail-safe |
| Rate limiting is in-memory only → resets on deploy, not shared across replicas | `src/lib/validation.js` | 01 C2 | ✅ Fixed — `src/lib/redisRateLimit.js`: Lua sliding-window + progressive penalty; `validateAdvancedRateLimit` / `validateStatusRateLimit` now async; brute-force counter stays in-memory (Edge runtime can't use ioredis) |
| Client IP is read from spoofable `x-forwarded-for` with no trusted-proxy check | all routes + `rateLimit.js` | 01 C1 | ✅ Fixed — `src/lib/clientIp.js` |
| SSRF checks run only on the *initial* URL; redirects are followed unvalidated | `src/lib/security.js`, `httpChecker.js` | 01 C3 | ✅ Fixed — `safeFetch.js`: redirect:'manual', per-hop DNS+IP validation |
| SSRF host allowlist misses DNS-rebind, IPv6, and octal/hex/decimal IP encodings | `src/lib/security.js` | 01 C4 | ✅ Fixed — `isPrivateAddress()` covers IPv6 (ULA/link-local/mapped), CGNAT, 0.0.0.0/8; WHATWG bracket stripping; DNS pre-flight |
| No response-size cap; full bodies read into memory (`response.data` / `.text()`) | `httpChecker.js`, `analyze/route.js` | 01 C5 | ✅ Fixed — `safeFetch.js` streams and caps at 5 MB; link-only checks use `readBody:false` |
| `CSRF_SECRET` guard was a top-level throw — crashed the `next build` Docker step | `src/app/api/csrf-token/route.js` | 01 C8 | ✅ Fixed — guard moved inside handler; `export const dynamic = 'force-dynamic'` added |
| CSRF protection layer was entirely non-functional — cookie never set, server never validated token, frontend never sent it | `csrf-token/route.js`, all POST routes, all frontend components | 01 C8 | ✅ Fixed — `src/lib/csrf.js` shared instance; token endpoint now sets `_csrfSecret` cookie via holder pattern; `crawl/start`, `crawl/stop`, `analyze` all validate; `CrawlForm`, `LargeCrawlForm`, `UrlAnalyzer`, `results/[jobId]` all send `X-CSRF-Token`; `src/lib/csrf-client.js` caches token client-side |
| 2 critical + 6 high npm vulnerabilities (incl. Next.js middleware bypass that would let an attacker skip Basic Auth) | `package.json` | 01 | ✅ Fixed — `npm audit fix` + `next@15.5.20`; down to 4 moderate (transitive postcss inside Next.js, not fixable by us) |
| Health endpoint leaks raw error/DB messages, unauthenticated | `src/app/api/health/route.js` | 01 C8 | ✅ Fixed — error.message no longer returned |
| Background jobs are fire-and-forget promises → lost on restart, stuck "running" | `crawl/start/route.js` | 03 A1 | ✅ Fixed — BullMQ queue + `worker/index.ts`; reaper + heartbeat |
| ~1,100-line route file mixes HTTP handling + crawl orchestration; 3 near-dup crawl routes | `crawl/{start,large,chunk}` | 03 A2/A3 | ✅ Fixed — `src/lib/crawler/` service layer extracted; route now 130 lines; `crawl/large` and `crawl/chunk` deleted |

## Progress log

| Date | Branch | What landed |
|------|--------|-------------|
| 2026-07-08 | `phase2-a7-security-cleanup` | A7 dead code + bug fixes; C1 clientIp; C8 secrets/leaks/timing; C9 CORS centralised |
| 2026-07-08 | `phase2-a2-service-layer` | A2 crawler service layer extracted; 3 checkLinksStatus variants merged |
| 2026-07-08 | main (no branch — fix next time) | A1 BullMQ job queue + worker + heartbeat/reaper; docker-compose.yml; Dockerfile.worker |
| 2026-07-08 | `phase2-doc02-basic-auth` | Doc 02 all items: matcher fix (C1), direct 401 (C2), timing-safe compare (C3), no cred logging + weak-password startup throw (C4), in-memory brute-force backoff (C5), production fail-safe (C6) |
| 2026-07-08 | `phase2-doc02-basic-auth` | C3/C4/C5: `safeFetch.js` (redirect validation + DNS pre-flight + 5 MB cap); `security.js` `isPrivateAddress()` (IPv6, CGNAT, encodings); axios removed from httpChecker |
| 2026-07-08 | `phase2-doc02-basic-auth` | C2: `src/lib/redisRateLimit.js` (Lua sliding-window + brute-force scripts); `validateAdvancedRateLimit`/`validateStatusRateLimit` now async Redis-backed; dead placeholder functions removed from `rateLimit.js`; brute-force in middleware stays in-memory (Next.js 15 stable Edge runtime blocks ioredis) |
| 2026-07-08 | `phase2-a3-consolidate-crawl-routes` | A3: `crawl/large` and `crawl/chunk` deleted — both frontend forms already called `/api/crawl/start`; single security-validated+queued entry point. Also landed: A4 dead `withRateLimit` HOF deleted; A6 raw `db.supabase.*` calls replaced with proper `db.*` methods |
| 2026-07-09 | `phase2-docker-csrf-fix` | **Docker Step 2 PASSED.** Built `blc-web` and `blc-worker` images; both ran on compose network; full crawl end-to-end succeeded. Bug fixed: `CSRF_SECRET` top-level throw crashed `next build` — moved guard inside handler, added `force-dynamic` |
| 2026-07-09 | `phase2-b1-csrf-and-deps` | **CSRF fully wired.** Cookie propagation fixed (holder pattern); `src/lib/csrf.js` shared instance; all 3 POST routes validate token; all 4 frontend components send `X-CSRF-Token`; `src/lib/csrf-client.js` caches token. **Deps patched:** 14 vulns → 4 moderate; `next@15.5.20` fixes critical middleware bypass (GHSA-267c-6grr-h53f) |

## What to pick up next (new chat)

All P0 security items, architecture cleanups (A1–A4, A6–A7), and pre-deploy validation
(Docker Steps 1 & 2) are complete. The app is ready for production deployment.

**Deployment path (in order):**

1. **Step 3 — VPS + Coolify wiring** — provision a server, point Coolify at this repo,
   create two services (`Dockerfile` for the web app, `Dockerfile.worker` for the worker).
   Set all env vars from `.env.local` with production values (real `DATABASE_URL`,
   `REDIS_URL`, strong `CSRF_SECRET`, correct `ALLOWED_ORIGIN`, `TRUST_PROXY=true`).
2. **Step 4 — Smoke-test on the live URL** — trigger a crawl, confirm results, check `/api/health`.
3. **Step 5 — Private access only** — keep `ENABLE_BASIC_AUTH=true`; optionally put behind
   a VPN or Coolify's built-in IP allowlist before sharing with anyone outside the team.

**Lower-priority backlog (non-blocking):**

| Item | What | Priority |
|------|------|----------|
| C6 — Per-domain politeness | Throttle outbound requests per target domain | Low — single-tenant, unlikely to hammer anything |
| C7 — WAF / edge protection | Cloudflare in front of Coolify | Only needed if the app becomes public-facing |
| A5 — TypeScript | Incremental `.js` → `.ts` in `src/lib/` | Nice-to-have, no urgency |
| Doc 04 — Features | Scheduling, alerts, exports, JS rendering | New feature work |
| Doc 05 — Monetization | Strategy, pricing, competitors | Separate decision entirely |
