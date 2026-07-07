# Handover — Coolify migration & Supabase → plain Postgres

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
