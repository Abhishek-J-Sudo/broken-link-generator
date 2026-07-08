# Broken Link Checker — Hardening & Improvement Handoff

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
  Docker on Coolify. Crawling happens in Next API route handlers as fire-and-forget
  background promises.
- **DB migration in progress:** the app is being migrated **off Supabase onto a
  self-hosted Postgres** accessed via `DATABASE_URL` (a `pg`-based `src/lib/db` module
  replacing `src/lib/supabase.js`). Do not add new hard dependencies on Supabase
  client APIs. Where these docs say "persist to the DB," target the new `pg` module.
  The Supabase-specific CSP `connect-src` and `NEXT_PUBLIC_SUPABASE_*` env are being
  removed as part of that migration.
- **Single-tenant / private:** this is an internal tool for a small trusted group,
  not a public multi-tenant SaaS. Prefer simple, robust solutions (Basic Auth, a
  single shared worker) over heavyweight identity/multi-tenant systems.

## Severity summary (why these docs exist)

| Finding | Where | Doc | Status |
|---------|-------|-----|--------|
| Basic Auth **skips every `/api/*` route** — crawl/analyze are unauthenticated | `middleware.ts` matcher | 02 | ⬜ Pending |
| Rate limiting is in-memory only → resets on deploy, not shared across replicas | `src/lib/validation.js` | 01 C2 | ⬜ Pending |
| Client IP is read from spoofable `x-forwarded-for` with no trusted-proxy check | all routes + `rateLimit.js` | 01 C1 | ✅ Fixed — `src/lib/clientIp.js` |
| SSRF checks run only on the *initial* URL; redirects are followed unvalidated | `src/lib/security.js`, `httpChecker.js` | 01 C3 | ⬜ Pending |
| SSRF host allowlist misses DNS-rebind, IPv6, and octal/hex/decimal IP encodings | `src/lib/security.js` | 01 C4 | ⬜ Pending |
| No response-size cap; full bodies read into memory (`response.data` / `.text()`) | `httpChecker.js`, `analyze/route.js` | 01 C5 | ⬜ Pending |
| `CSRF_SECRET` falls back to a hardcoded default | `src/app/api/csrf-token/route.js` | 01 C8 | ✅ Fixed — fails closed in production |
| Health endpoint leaks raw error/DB messages, unauthenticated | `src/app/api/health/route.js` | 01 C8 | ✅ Fixed — error.message no longer returned |
| Background jobs are fire-and-forget promises → lost on restart, stuck "running" | `crawl/start/route.js` | 03 A1 | ⬜ Pending — next major item |
| ~1,100-line route file mixes HTTP handling + crawl orchestration; 3 near-dup crawl routes | `crawl/{start,large,chunk}` | 03 A2 | ✅ Fixed — `src/lib/crawler/` service layer extracted; route now 130 lines |

## Progress log

| Date | Branch | What landed |
|------|--------|-------------|
| 2026-07-08 | `phase2-a7-security-cleanup` | A7 dead code + bug fixes; C1 clientIp; C8 secrets/leaks/timing; C9 CORS centralised |
| 2026-07-08 | `phase2-a2-service-layer` | A2 crawler service layer extracted; 3 checkLinksStatus variants merged |
