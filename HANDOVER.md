# Handover — Running log

---

## 2026-07-11 - Audit Report results page refresh

### Branch: `phase2-ui-restructure`

The `/results/[jobId]` experience has been reworked from a table-first crawl output into the
Audit Report flow described in `docs/handoff/06-ux-ia-and-reporting.md` and
`docs/handoff/09-audit-report-spec.md`.

- **`src/app/results/[jobId]/page.js`** rebuilt as the report shell:
  - live queued/running progress view remains in place
  - completed/stopped crawls render verdict, health score, key takeaways, quick wins,
    priority findings, affected pages, remediation plan, detailed evidence, methodology,
    and reserved SEO categories
  - stop-crawl confirmation, CSV/JSON export, SEO summary loading, and appendix deep links
    are preserved in the new layout
- **`src/lib/auditReport.js`** added as a pure derivation layer:
  - health score, grading, severity classification, shared-target detection, grouping,
    quick wins, top pages, remediation tasks, and report takeaways
  - scoring constants are mirrored in the page's Methodology copy
- **`src/app/components/EvidenceTable.js`** added as the appendix table:
  - tokenized/square visual treatment
  - broken/all/working views, search, error-type filtering, pagination, row expansion,
    severity and action guidance
- **Deleted:** old `src/app/components/ResultsTable.js` and `src/app/components/ToolTip.js`.

### Validation

- `npx eslint "src/app/results/[jobId]/page.js" src/app/components/EvidenceTable.js src/lib/auditReport.js`
  completed cleanly.
- Local dev server returned `200` for a real completed audit report page.
- A real crawl was queued through the API and completed:
  `46872c36-7b98-4dee-92f4-c890127b609e`, `33/33`, `3` broken links.

### Notes / follow-up

- `next-env.d.ts` is intentionally still tracked. It is a Next.js generated type shim;
  do not delete or gitignore it. Incidental local changes to it should be left out of
  feature commits unless Next itself requires the change.
- User is going to review the new audit report UI and split observed issues into
  next-update polish versus actual bugs.
- Some handoff docs still mention `ResultsTable` as the old implementation/component name;
  those references are historical/spec context unless we choose to refresh the docs.

---
## 2026-07-11 - Audit Report follow-up fixes

### Branch: `phase2-ui-restructure`

Follow-up commits after the first audit-report rebuild:

- **`8e37d0d` - Clarify link health and SEO page reporting**
  - Main grade is now explicitly a **link-health grade**, not a full-site SEO grade.
  - Summary labels separate checked URLs, healthy links, link issues, SEO pages, and SEO average.
  - `statusFilter=pages` now returns actual `seo_analysis` rows instead of internal checked
    URLs/assets from `discovered_links`.
  - Evidence appendix tabs now distinguish `All checked URLs`, `Healthy links`, and `SEO pages`.
  - Error-type dropdown disables when there are no broken-link error categories.
- **`7793efd` - Fix SEO appendix row keys and expansion layout**
  - SEO page API rows include IDs, and `EvidenceTable` has a stable fallback key.
  - Fixes the React "Each child in a list should have a unique key" warning.
  - Expanded SEO rows now lay out URL, title, meta, structure, image alt counts, and issue
    messages more clearly.
- **`b2971fb` - Add environment URL exposure signals to audit reports**
  - Report scans all checked URLs and source pages for environment/internal markers:
    `prod`, `preprod`, `staging`, `uat`, `dev`, `qa`, `test`, `localhost`, `.internal`, `.local`.
  - These are surfaced as **Env signals** and an **Exposure Review** section, separately from
    broken-link issues because exposed environment URLs may still return `200`.
  - The report pages through all checked URLs so larger audits do not miss exposure signals after
    the first API page.

### Product clarification

- Current scope remains **Link-Health Audit first** per `docs/handoff/09-audit-report-spec.md`.
- SEO is currently a measured snapshot for analyzed HTML pages, with deeper SEO audit work still
  mapped in `docs/handoff/04-features-and-improvements.md` section G.
- Environment/internal URL exposure is a report signal, not part of the link-health grade.

### Validation

- Focused ESLint passed for the touched report files.
- Local report page returned `200` for job `59749e40-11a0-4d7f-bbb2-9138b962fd5e`.
- Local DB search for the previously mentioned prod/internal exposure did not find that old URL in
  current stored jobs; only image filenames containing `product` were present and all returned `200`.

---
## 2026-07-08 — C3/C4/C5: SSRF hardening

### Branch: `phase2-doc02-basic-auth` (continued)

- **`src/lib/safeFetch.js`** (new) — safe HTTP wrapper for all outbound requests:
  - `redirect:'manual'`; validates each hop's URL + DNS before following
  - DNS resolution pre-flight: all returned IPs checked via `isPrivateAddress`
  - Response body capped at 5 MB via streaming reader (configurable)
  - Used by: httpChecker, analyze route (page + sitemap fetch), contentPages crawler, traditional crawler, checkRobotsTxt
  - TOCTOU gap documented inline: TCP connection pinning to resolved IP not implemented
- **`src/lib/security.js`** — IP check overhaul:
  - New `isPrivateAddress(addr)` covers: RFC-1918, loopback (127/8, ::1), link-local (169.254/16, fe80::/10), ULA (fc00::/7), CGNAT (100.64/10), 0.0.0.0/8, IPv4-mapped IPv6 (::ffff:x)
  - WHATWG URL `.hostname` wraps IPv6 in brackets (`[::1]`) — stripped before `net.isIP()` check in both `isSafeUrl` and `safeFetch`
  - Decimal/hex/octal IPv4 encoding (2130706433, 0x7f000001) normalised by WHATWG URL parser; caught by `isPrivateAddress`
- **`src/lib/httpChecker.js`** — axios replaced with safeFetch throughout; link-only checks pass `readBody:false` to avoid buffering
- 17/17 SSRF test cases verified inline

---

## 2026-07-08 — Doc 02: Basic Auth gating /api/* routes

### Branch: `phase2-doc02-basic-auth`
All six items from [docs/handoff/02-basic-auth.md](docs/handoff/02-basic-auth.md) implemented.

- **C1:** Matcher changed from `(?!api|...)` to `(?!_next/static|_next/image|favicon.ico|...)` — `/api/*` is now covered. `PUBLIC_PATHS=['/api/health']` and `TOKEN_AUTH_PATHS=['/api/admin/cleanup']` bypass inside the function (not in the matcher).
- **C2:** 401 returned directly from middleware. `/api/basicauth/route.js` deleted.
- **C3:** Constant-time comparison via `crypto.subtle.digest('SHA-256', ...)` — works in Edge and Node runtimes, no timing side-channel.
- **C4:** All credential logging removed. Module-level throw in production if password is `change-me` or < 12 chars.
- **C5:** In-memory brute-force backoff — 10 failures per IP in 5 min → 429 for 5 min. TODO: upgrade to Redis when C2 (shared rate-limit store) lands.
- **C6:** Fail-safe — production with missing/disabled auth defaults-deny instead of allowing all traffic.

### Remaining work (priority order)
See `docs/handoff/` for full specs. Critical path:
1. ~~**Doc 02** — Basic Auth on `/api/*` routes~~ ✅ Done (2026-07-08)
2. **C3/C4/C5** — SSRF hardening (redirect-hop validation, IPv6/encoding gaps, response-size cap).
3. **C2** — shared rate-limit store — Redis is now available (use `REDIS_URL`). Also unblocks migrating the in-memory brute-force counter in middleware to Redis.
4. **A3** — consolidate 3 crawl endpoints into one (after A1).

---

## 2026-07-08 — Phase 0 validation + Phase 2 A7/A2 + Security C1/C8/C9

### Phase 0 — Verified complete
- Local Postgres 16 container (`seoscrub-postgres`, port 5433) confirmed running with schema applied.
- 3 completed crawl jobs in DB including a real 58-page crawl of a live site.
- Docker image (`broken-link-generator:local`) builds clean and container health check passes (`database.connected: true`).
- **VPS + Coolify wiring not yet done** — build is verified; deploy when ready.

### Merged: A7 + C1/C8/C9 (`phase2-a7-security-cleanup`)
- **A7:** Deleted unused `SecureHttpChecker` class (had `ReferenceError` on `startTime`; never imported). Guarded `updateJobProgress` against divide-by-zero when `totalLinksExtracted` is 0. Removed dead `batchSize=20` variable shadowed by inner declaration in traditional crawl.
- **C1:** Created `src/lib/clientIp.js` — single trusted-IP source; only reads `x-forwarded-for` when `TRUST_PROXY=true` (must set this in Coolify behind Traefik). Replaced raw unsplit header reads across all routes.
- **C8:** `CSRF_SECRET` now throws at startup in production instead of falling back to a weak default. Health endpoint no longer leaks `error.message`. Admin cleanup token compare uses `crypto.timingSafeEqual`. Middleware debug logs (including username logging per-request) removed.
- **C9:** Created `src/lib/cors.js` — returns `ALLOWED_ORIGIN` in production, `*` in dev. All 8 OPTIONS handlers updated.

### Merged: A2 — Crawler service layer (`phase2-a2-service-layer`)
- Created `src/lib/crawler/` with `index.js`, `linkCheck.js`, and `modes/` (contentPages, discoveredLinks, originalSmart, traditional).
- The three near-identical `checkLinksStatus*` variants merged into one parameterised `checkLinks()` in `linkCheck.js` (`preInserted`, `trackProgress`, `completeJob`, `enableStopCheck`).
- Latent bug fixed: stop-by-user detection now applies inside the inner check loop for traditional crawls too (previously only at the outer loop level, so stopping a traditional SEO crawl was slow).
- `crawl/start/route.js` reduced from 1,110 → 130 lines. Pure HTTP handler: validate → security → create job → fire-and-forget → 201.
- Dead `seoDetector` import removed.

### Remaining work (priority order)
See `docs/handoff/` for full specs. Critical path:
1. ~~**A1** — job queue + worker + heartbeat/reaper~~ ✅ Done (2026-07-08)
2. ~~**Doc 02** — Basic Auth on `/api/*` routes~~ ✅ Done (2026-07-08)
3. ~~**C3/C4/C5** — SSRF hardening~~ ✅ Done (2026-07-08)
4. **C2** — shared rate-limit store — Redis is now available (use `REDIS_URL`). Also upgrades the in-memory brute-force counter in middleware.
5. **A3** — consolidate 3 crawl endpoints into one (after A1). ← unblocked

---

## 2026-07-08 — A1: BullMQ job queue + worker + heartbeat/reaper

### What landed (`phase2-a1-job-queue`, merged to main)
- **`src/lib/queue/`** — IORedis singleton + BullMQ Queue; `enqueueCrawl()` called from API route.
- **`worker/index.ts`** — standalone long-running process; reaps stale jobs on boot (`running` + `heartbeat_at > 5min` → `failed`); BullMQ concurrency cap (`WORKER_CONCURRENCY`, default 3); SIGTERM/SIGINT graceful shutdown.
- **`crawler/linkCheck.js`** — `db.updateHeartbeat(jobId)` each batch.
- **`crawl/start/route.js`** — fire-and-forget removed; `await enqueueCrawl()`; initial status `'queued'`.
- **`crawl/stop/route.js`** — accepts `queued` as well as `running`.
- **`supabase.js`** — `db.updateHeartbeat()`, `db.reapStaleJobs()`, `updateJobStatus('completed')` clears `error_message`.
- **`database/init.sql`** — `heartbeat_at TIMESTAMPTZ` column added.
- **`docker-compose.yml`** — local dev infra: Postgres on 5433, Redis on 6380.
- **`Dockerfile.worker`** — separate worker container (tsx + src/lib + tsconfig).
- **`bullmq`, `ioredis`, `tsx`** added to dependencies.
- Smoke-tested: `queued→running→completed`, heartbeat populated, reaper fires on restart, stop works on both queued and running jobs.

### Local dev (after this change)
```
docker compose up -d            # Postgres on 5433, Redis on 6380
npm run db:init                 # one-time schema apply (adds heartbeat_at)
npm run worker:dev              # worker process (tsx --watch)
npm run dev                     # Next.js web server
```

### Coolify deploy notes
- Add a Redis service (Coolify one-click Redis).
- Set `REDIS_URL` to the internal Redis connection string on both the web and worker services.
- Worker service: set "Dockerfile path" to `Dockerfile.worker` in Coolify.

---

## 2026-07-07 — Coolify migration & Supabase → plain Postgres

**Date:** 2026-07-07
**Branch:** `migrate/supabase-to-postgres`
**App version:** 0.9.0

---

## TL;DR

The app was prepared to move off Railway/Vercel onto a self-hosted **Coolify** VPS,
and its database was migrated from **Supabase → plain PostgreSQL**. All changes were
validated against a real Postgres 16 container (16/16 data-layer tests, a clean
production build, and an end-to-end health check). It is ready to deploy; the only
remaining work is provisioning the Postgres service on Coolify and setting env vars.

---

## Architecture (important context)

This is **one single Next.js 15 app**, not a separate frontend + backend.

- UI (`'use client'` React components) and the API (`src/app/api/**`) live in the
  same codebase and deploy as **one unit**.
- History: the whole app ran on **Vercel** → then **Railway** → now targeting **Coolify**.
  There was never a split "frontend on Vercel, backend on Railway" setup.
- **Nothing stays on Vercel.** Coolify (a persistent Node server) is actually a better
  fit than Vercel here, because the chunked-crawl design (`api/crawl/chunk`, `api/crawl/large`)
  exists to dodge serverless function timeouts that don't apply on a long-running server.

The database was Supabase, which is hosted Postgres + a REST layer (PostgREST). The app
used it purely as a database (no Supabase auth / realtime / storage), and **all DB access
is server-side** — the browser never talked to the DB directly. That made the swap to
plain Postgres cleanly contained to the data layer.

---

## What was done

### 1. Database: Supabase → plain PostgreSQL
- **Removed** `@supabase/supabase-js`; **added** `pg`.
- New **`src/lib/pg.js`** — a lazy-initialized `pg` connection pool plus a small
  compatibility layer that implements exactly the query-builder subset the app uses
  (`from/select/insert/update/upsert/delete/eq/gt/gte/lt/lte/in/ilike/is/or/order/range/limit/single`,
  `count:'exact'`). This kept `db.*` helpers and every inline route query working with
  only import swaps — no route logic was rewritten.
- **`src/lib/supabase.js`** is now a thin facade over `pg.js` (kept its filename and the
  `supabase` / `db` exports so route imports didn't change).
- **`src/app/api/admin/cleanup/route.js`** now uses the shared client instead of
  `createClient(...)`.
- **`database/init.sql`** — consolidated, idempotent, plain-Postgres schema
  (replaces `schema.sql` + migrations 001–004). Notable deliberate changes:
  - `status` / `error_type` columns are **`TEXT`**, not enums. The app writes
    `status = 'ready_for_checking'`, which was never in the original `crawl_status`
    enum — a latent bug that `TEXT` avoids.
  - `seo_job_summary` is a **plain `VIEW`** (always current; no refresh trigger).
  - No RLS / GRANT statements (single app role owns everything).
- **`scripts/init-db.mjs`** + **`npm run db:init`** applies `database/init.sql`.

### 2. Coolify deploy readiness
- **`Dockerfile`** — multi-stage standalone build (node:20-alpine, non-root, binds
  `0.0.0.0:3000`). Because the DB is now server-only via `DATABASE_URL`, the build needs
  **no `NEXT_PUBLIC_*` build args** — the usual Coolify build-time-variable gotcha is gone.
- **`.dockerignore`**, **`.env.example`** (documents every env var), **`output: 'standalone'`**
  added to `next.config.js`.
- **`next.config.js`** cleanup: dropped Supabase env exposure and the `*.supabase.co` CSP
  entry; removed dead Next-13 keys (`swcMinify`, Pages-Router `api` block); CORS origin is
  now driven by the `ALLOWED_ORIGIN` env var instead of a hardcoded domain.
- **`package.json`** `start` is now `next start` (honors `PORT`, cross-platform).

### 3. Bug fix found along the way
- `src/app/api/health/route.js` referenced an undefined `packageJson` — the health
  endpoint would always crash. Now uses `APP_VERSION`. (Confirmed working: returns
  `{"status":"healthy", "version":"0.9.0"}`.)

---

## Validation performed (against real Postgres 16 in Docker)

- ✅ `database/init.sql` applies cleanly.
- ✅ **16/16** data-layer assertions pass: insert + jsonb settings, `getJob`, the
  `ready_for_checking` TEXT status, progress percentage, upsert `ON CONFLICT DO NOTHING`
  dedupe, `count:'exact'` window count, `.or()` parsing, `.ilike()`, `count(*)` health
  shape, broken-link insert, SEO insert + summary **view** + fallback summary, `.lt()`,
  `.in()`, and `delete().in()` row counts.
- ✅ `npm run build` succeeds.
- ✅ End-to-end: real server against the test DB → `GET /api/health` returns healthy with
  `database.connected: true`.

Test container and the throwaway smoke script were removed afterward.

---

## What's next (deployment runbook)

1. **Provision Postgres on Coolify** — one-click Postgres service. Note its **internal**
   connection string (service name as host).
2. **Create the app** in Coolify → **Build Pack = Dockerfile**, **Ports Exposes = 3000**,
   **Healthcheck path = `/api/health`**.
3. **Set env vars** on the app (see `.env.example`):
   - `DATABASE_URL` = the Coolify **internal** string, e.g.
     `postgres://user:pass@blc-db:5432/blc`
   - `DATABASE_SSL=false` (internal Postgres); `true` only for external/managed DBs.
   - `ALLOWED_ORIGIN` and `DEPLOYMENT_URL` = your Coolify domain.
   - `PORT=3000`, plus the security tokens (`CSRF_SECRET`, `CLEANUP_SECRET_TOKEN`) and
     basic-auth creds. **Set a strong `BASIC_AUTH_PASSWORD`** (current local value is weak).
4. **Initialize the schema once:** `npm run db:init`
   (or `psql "$DATABASE_URL" -f database/init.sql`).
5. **Deploy.** Verify `GET /api/health` is healthy.
6. **Cleanup cron** — the GitHub Actions job (`.github/workflows/database-cleanup.yml`)
   is host-independent; just repoint the `CLEANUP_ENDPOINT_URL` secret to the new domain.
   (Optional: move it to a Coolify scheduled task.)

### Local development
- Add a real `DATABASE_URL` to `.env.local` (already scaffolded with a localhost
  placeholder) pointing at a local Postgres, then `npm run db:init` and `npm run dev`.
  Without it, the first query throws `Missing environment variable: DATABASE_URL`.

---

## Known caveats / possible follow-ups

- **Use the Dockerfile build pack, not Nixpacks.** With `output: 'standalone'`,
  `next start` warns and won't serve correctly. The Dockerfile runs the correct
  `node server.js`. If you ever switch to Nixpacks, set the start command to
  `node .next/standalone/server.js`.
- **The pg compatibility layer is intentionally minimal** — it covers exactly the query
  shapes used today (all tested). New Supabase-style queries with unimplemented operators
  would need adding to `src/lib/pg.js`. It is not a full PostgREST clone.
- **Dead code retained:** several `db.*` helpers are unused (`getEnhancedResults`,
  `getBrokenLinks`, `getSEOAnalysis`, `getRecentJobs`, etc.). `getEnhancedResults` still
  contains a Supabase nested-embed query that the shim does not support — harmless because
  it's never called, but delete these if you want a cleaner data layer.
- **Old schema files** (`database/schema.sql`, `database/migrations/*`) are superseded by
  `database/init.sql`. Kept for reference; can be removed.
- Optional niceties not done: a `docker-compose.yml` (app + Postgres) for full local-stack
  testing, and a "Deploy on Coolify" section in the README.

---

## File reference

| File | Status |
|---|---|
| `src/lib/pg.js` | **new** — pg pool + query-builder compatibility layer |
| `src/lib/supabase.js` | rewritten as facade over `pg.js` |
| `src/app/api/admin/cleanup/route.js` | uses shared client |
| `src/app/api/health/route.js` | `packageJson` bug fixed |
| `database/init.sql` | **new** — consolidated plain-Postgres schema |
| `scripts/init-db.mjs` | **new** — `npm run db:init` |
| `Dockerfile`, `.dockerignore`, `.env.example` | **new** — Coolify deploy |
| `next.config.js` | standalone output, CSP/env cleanup, `ALLOWED_ORIGIN` |
| `package.json` | `-@supabase/supabase-js`, `+pg`, `start`/`db:init` scripts |
