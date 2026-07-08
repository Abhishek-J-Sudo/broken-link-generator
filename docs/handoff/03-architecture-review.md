# 03 — Architecture Review

**Priority:** P1
**Goal:** Assess whether the current structure is right and, where it isn't, give a
concrete reorganization plan.

## Implementation status (as of 2026-07-08)

| Item | Status | Notes |
|------|--------|-------|
| A1 — Job queue + worker + heartbeat/reaper | ✅ Done | BullMQ + Redis. `src/lib/queue/`, `worker/index.ts`. Reaper on boot, heartbeat per batch, concurrency cap, graceful shutdown. Smoke-tested. |
| A2 — Extract service layer | ✅ Done | `src/lib/crawler/` — index, linkCheck, 4 mode files. `crawl/start/route.js` 1110 → 130 lines. 3 `checkLinksStatus*` variants merged into one parameterised `checkLinks()`. Stop-detection bug in traditional crawl also fixed. |
| A3 — Consolidate 3 crawl endpoints | ⬜ Pending | A1 done — now unblocked. |
| A4 — One rate-limit path | ⬜ Pending | |
| A5 — TypeScript consistency | ⬜ Pending | Incremental; low priority |
| A6 — Keep DB boundary clean | ⬜ In progress | One raw `db.supabase.from(...)` call remains in `linkCheck.js` (the `preInserted` UPDATE path); needs a proper `db.updateDiscoveredLinkStatus()` method |
| A7 — Correctness bugs | ✅ Done | `SecureHttpChecker` deleted (was unused, had `ReferenceError` on `startTime`); divide-by-zero in `updateJobProgress` guarded |

**Next:** C3/C4/C5 (SSRF hardening) or Doc 02 (Basic Auth on `/api/*`). A3 (consolidate crawl endpoints) is now unblocked but lower priority than security.

---

## Verdict up front

The layering (Next App Router UI + API routes + `src/lib/*` helpers + Postgres) is a
reasonable shape for this app — **don't rewrite it.** But four things need to change:

1. **Background jobs are fire-and-forget promises** inside request handlers. This is the
   real architectural risk. (A1 — must fix)
2. **Route handlers contain the business logic.** `crawl/start/route.js` is ~1,100 lines
   of orchestration. Extract a service layer. (A2)
3. **Three overlapping crawl endpoints** (`start`, `large`, `chunk`) with duplicated
   logic and inconsistent validation/security. Consolidate. (A3)
4. **Two competing rate-limit code paths** and lots of dead code. Pick one. (A4)

Plus smaller cleanups (A5–A7).

---

## A1 — Background jobs must not be fire-and-forget *(highest impact)*

### Problem

`crawl/start/route.js` returns `201` immediately, then runs
`processSmartCrawlBackground(...)` / `processTraditionalCrawlBackground(...)` as an
un-awaited promise inside the serverless-style handler:

```js
processSmartCrawlBackground(jobId, ...).catch((e) => console.error(e));
return NextResponse.json({ jobId, status: 'started' }, { status: 201 });
```

Consequences:

- In `output: 'standalone'` on Coolify, the Node process can be recycled (deploy, OOM,
  crash, idle scale-down) at any moment. Any in-flight job is **silently lost** and its
  DB row is stuck at `status: 'running'` forever. Nothing resumes it.
- No ret/retry, no visibility, no backpressure. Ten concurrent large crawls all run in the
  web process and compete with request handling for CPU/event-loop.
- The "stop" feature works by polling the job row mid-loop (`crawl/start:571`) — clever,
  but it only works while the original process is alive.
- Rate-limit and dedup state that lives in that same process (Doc 01) is coupled to it.

### Direction

Separate **accepting** a job from **running** it. Introduce a job queue + a worker.

- **Enqueue** in the API route: validate, security-check, create the `crawl_jobs` row
  (`status: 'queued'`), push a job message, return `201`. Route handlers become thin.
- **Worker** consumes the queue and runs the crawl. Options, cheapest first:
  - **BullMQ + Redis** — battle-tested, gives retries, concurrency caps, delayed jobs,
    and a dashboard. Pairs with the Redis you may already add in Doc 01 C2. Run the worker
    as a **second process/container** (same image, different `CMD`), so crawling never
    competes with the web tier and a web redeploy doesn't kill jobs.
  - **Postgres-backed queue** (e.g. `graphile-worker` or `pg-boss`) — no Redis needed,
    aligns with the Postgres migration, gives you `SELECT ... FOR UPDATE SKIP LOCKED`
    semantics and retries. Good fit if you want one datastore.
- On worker boot, **reap stale jobs**: mark any `running` row with no recent heartbeat as
  `failed` (or requeue). Add a `heartbeat_at` column the worker updates each batch so the UI
  and the reaper can tell live jobs from dead ones.
- Enforce a **global concurrency cap** (e.g. N simultaneous crawls) at the worker, and the
  per-destination politeness gate from Doc 01 C6.

### Acceptance

- Killing/redeploying the web container mid-crawl does not lose the job — the worker keeps
  going (separate process) or the job is requeued and resumes.
- No job stays `running` after its worker dies; the reaper transitions it within one
  heartbeat interval.
- Web request latency is unaffected by a large crawl in progress.

> If a full queue is too much right now, the **minimum** intermediate step is: (a) add the
> `heartbeat_at` column + a startup reaper so stuck jobs get cleaned up, and (b) move the
> worker loop into a separate long-running process. But plan for the queue.

---

## A2 — Extract a service layer from the route handlers

### Problem

Route files mix four concerns: HTTP parsing, auth/rate-limit/security checks, crawl
orchestration, and DB writes. `crawl/start/route.js` alone defines
`processSmartCrawlBackground`, `processContentPagesMode`, `processDiscoveredLinksMode`,
`processOriginalSmartMode`, `checkLinksStatus`, `processTraditionalCrawlBackground`,
`checkLinksStatusForTraditional`, `checkLinksStatusLightweight`. That's the whole engine
living in an HTTP handler, which makes it untestable and impossible to reuse from a worker.

### Direction

Introduce `src/lib/crawler/` (or `src/services/`) and move the orchestration there:

```
src/lib/crawler/
  index.js            # runCrawl(jobId, opts) — single entry the worker calls
  modes/
    contentPages.js   # processContentPagesMode
    discoveredLinks.js
    traditional.js
  linkCheck.js        # checkLinksStatus / lightweight / withSEO glue
  progress.js         # heartbeat + progress updates
```

Route handlers then do only: validate → security → enqueue. The worker calls
`runCrawl()`. `src/lib/db` owns all persistence (already mostly true via the `db` object —
keep that boundary; see A6). This is a **move, not a rewrite** — the functions already
exist and are self-contained enough to lift.

One exception to "move, not rewrite": the three `checkLinksStatus*` variants are
near-copies that differ only in batch size, concurrency, and SEO handling, and they have
already drifted — the stop-by-user check runs inside `checkLinksStatus`'s batch loop but
not inside `checkLinksStatusForTraditional`, so stopping a traditional SEO crawl takes
effect more slowly. Merge them into one parameterized function in `linkCheck.js` while
lifting them.

### Acceptance

- No route file exceeds ~150 lines.
- `runCrawl()` can be invoked from a test/worker with no `Request` object.
- One link-check implementation; batch size, concurrency, and SEO are parameters,
  not copies.

---

## A3 — Consolidate the three crawl endpoints

`crawl/start`, `crawl/large`, and `crawl/chunk` overlap heavily and have **inconsistent
security**: `crawl/large/route.js` does *not* call `validateAdvancedRateLimit`,
`isSafeUrl`, or robots checks that `crawl/start` does — so it's a softer target for the
SSRF/abuse issues in Doc 01. Duplicated crawl logic also means fixes have to be made three
times.

### Direction

- Pick **one** public "start a crawl" endpoint. Fold "large" and "chunk" into it as a
  `mode`/`strategy` parameter (the code already branches on `crawlMode`).
- Everything routes through the same validation + security + enqueue path from A1/A2, so
  security is applied uniformly and once.
- Delete the dead endpoints after migrating the two frontend forms
  (`LargeCrawlForm.js`, `CrawlForm.js`) to the unified one.

### Acceptance

- One crawl-start route; `large`/`chunk` removed. Every crawl entry runs identical
  security/validation. No behavior regression in the two forms.

---

## A4 — One rate-limiting path; delete dead code

There are two implementations: `src/lib/rateLimit.js` (`withRateLimit` HOF + `rateLimiters`
map) and inline `validateAdvancedRateLimit(...)` calls in each route. Routes use the inline
form; the HOF wrapper is unused. `rateLimit.js` also has placeholder functions
(`bypassRateLimit`, `getIPAnalytics`, `updateRateLimitConfig`, `resetRateLimitForIP`) that
return static objects and do nothing.

### Direction

- Keep the **middleware/wrapper** approach (`withRateLimit`) as the single path once it's
  backed by the shared store (Doc 01 C2), or keep the inline calls — but not both. The
  wrapper is cleaner because it also sets response headers consistently.
- Delete the placeholder functions. Keep only what's wired up.

---

## A5 — TypeScript consistency

The project is a TS project (`layout.tsx`, `middleware.ts`, `tsconfig`, `zod`) but all
routes and libs are `.js` with no types. `eslint.ignoreDuringBuilds: true` and
`typescript` errors aren't gating builds. Recommendation: incrementally convert `src/lib/*`
to `.ts` (start with the new `crawler/` and `db` modules) and turn on type-checking in CI
(not necessarily in the Docker build). Not urgent, but it's cheap insurance on a codebase
this size and prevents the `startTime`-used-before-defined class of bug (see A7).

---

## A6 — Keep the DB boundary clean during the Postgres migration

The in-progress migration (per your todos) replaces `src/lib/supabase.js` with a
`pg`-based module exposing the **same `db.*` interface**. That's the right call — keep
`db` as the single persistence boundary so callers don't change. Two things to watch:

- Several routes reach through `db.supabase.from(...)` directly (e.g.
  `crawl/start:606`, `health/route.js:15`). After the migration there is no `.supabase`;
  give the new module explicit methods (`db.updateDiscoveredLinkStatus(...)`,
  `db.ping()`) and replace those inline queries so nothing depends on the underlying
  driver. Your todo list already flags this ("Refactor inline db.supabase.* usages").
- `admin/cleanup/route.js` and `securityLogger.js` construct their **own** Supabase
  clients instead of importing `db`/`supabaseAdmin`. Route them through the single module
  too, so connection config and pooling live in one place.

---

## A7 — Correctness bugs found during review (fix while refactoring)

- `src/lib/security.js#SecureHttpChecker.checkUrl` references `startTime` in the success
  return (`response_time: Date.now() - startTime`) but **never declares `startTime`** —
  it's a `ReferenceError` the moment that path runs. (The main `HttpChecker` does declare
  it.) Either fix or delete `SecureHttpChecker` — it appears unused; the app uses
  `HttpChecker` from `httpChecker.js`. Confirm and remove to avoid confusion.
- Progress denominators can divide by zero / thrash: content-pages mode calls
  `updateJobProgress(jobId, 0, totalLinksExtracted)` where `totalLinksExtracted` may be 0.
- `crawl/large/route.js` imports `NextRequest` and several utils it doesn't use, and lacks
  the security guards A3 addresses.

---

## Target structure (after A1–A4)

```
src/
  app/
    api/
      crawl/route.js        # POST: validate + secure + enqueue (thin)
      crawl/status/[jobId]  # read
      crawl/stop/route.js   # signal stop (sets flag the worker reads)
      analyze/route.js      # thin
      results/[jobId]       # read
      ...
  lib/
    db/                     # pg module, single persistence boundary
    crawler/                # runCrawl() engine (from A2)
    queue/                  # BullMQ or pg-boss setup + job definitions
    security/               # isSafeUrl, safeFetch (Doc 01), headers
    rateLimit/              # one implementation, shared store
    clientIp.js
worker/
  index.js                  # long-running worker: consume queue → runCrawl()
```

## Suggested order

1. A7 quick fixes (delete dead `SecureHttpChecker`, obvious bugs). (½ day)
2. A6 during the Postgres migration you're already doing.
3. A2 extract service layer (pure move). (1 day)
4. A1 queue + worker + heartbeat/reaper. (2–3 days) ← the big one
5. A3 consolidate crawl routes on top of the new path. (1 day)
6. A4 rate-limit cleanup. (½ day)
7. A5 TS incrementally, ongoing.
