# 04 — Features & Improvements Roadmap

**Priority:** P2 (after the P0 security/auth and P1 architecture work)
**Goal:** A prioritized backlog of features and quality improvements, with enough detail
that each can be picked up as its own task. Grouped by theme; each item notes rough effort
(S/M/L) and what it depends on.

---

## A. Reliability & quality (do these first — they protect everything else)

| Item | Why | Effort | Depends on |
|------|-----|--------|-----------|
| **A1. Automated tests** | There are zero tests. The SSRF matrix (Doc 01 C4), URL normalization, error classification, and rate-limit logic are exactly the kind of pure functions that must not regress. | M | — |
| **A2. Error monitoring (Sentry)** | Today errors go to `console.*` and vanish. Background crawl failures are invisible. | S | — |
| **A3. Structured logging** | Replace the ~hundreds of emoji `console.log`s with a leveled logger (pino) that can be turned down in prod and correlated by `jobId`. | M | — |
| **A4. CI pipeline** | Lint + typecheck + tests on PR. `eslint.ignoreDuringBuilds` and TS errors are currently not gating anything. | S | A1 |

Start with **A1**: a Vitest/Jest setup plus unit tests for `securityUtils.isSafeUrl`
(feed it the Doc 01 C4 matrix), `urlUtils.normalizeUrl`, and `errorUtils.classifyError`.
These are fast wins and directly back the security work.

---

## B. Core product features

| Item | Description | Effort | Depends on |
|------|-------------|--------|-----------|
| **B1. Scheduled / recurring checks** | Let a user say "re-check this site weekly" and store history. Natural fit once the job queue (Doc 03 A1) exists — schedule = delayed/repeated enqueue. | M | Doc 03 A1 |
| **B2. Email / webhook alerts on new broken links** | The value of a link checker is being *told* when something breaks. On job completion, diff against the previous run for the same site and notify only on newly-broken links. | M | B1, DB history |
| **B3. Scan history & trends per site** | Persist runs and show a timeline (broken count over time, newly broken vs fixed). Requires a `sites` concept above one-off jobs. | M | B1 |
| **B4. First-class sitemap crawling** | `analyze/route.js` already falls back to `sitemap.xml` for JS-heavy sites. Promote it to a real input mode ("crawl from sitemap") and handle sitemap index files + `sitemap.xml.gz`. | S | — |
| **B5. JS-rendered site support (headless browser)** | The analyzer explicitly can't see SPA content (`createJavaScriptSiteResponse`). Add an optional Playwright-based fetch path for sites detected as JS-heavy. Heavy resource cost — must run in the worker with strict concurrency + the SSRF safe-fetch rules from Doc 01. | L | Doc 03 A1, Doc 01 C3 |
| **B6. Richer exports & shareable reports** | `json2csv` is already a dep. Offer CSV/JSON export of results and broken-link lists, plus a printable/PDF summary report per job. | S–M | — |
| **B7. Scan profiles / presets** | Save common settings (depth, external on/off, SEO on/off, ignore patterns) as named profiles so re-runs are one click. | S | — |
| **B8. Ignore / allow rules** | Let users exclude URL patterns (e.g. `/tag/*`, tracking params) — the analyzer already categorizes pagination/params and even recommends this; wire the recommendations into actual filters. | S | — |

---

## C. Crawler depth & correctness

| Item | Description | Effort |
|------|-------------|--------|
| **C1. Detect anchor/fragment & redirect-chain issues** | Report soft-404s (200 status but "not found" body), redirect chains, and mixed-content (http asset on https page). `_extractRelevantHeaders` already captures `location`. | M |
| **C2. Distinguish "broken" vs "blocked-by-target"** | Many sites return 403/429 to bots. Currently these count as broken. Flag them separately (the summary already tracks `blocked`) so reports aren't noisy. | S |
| **C3. Respect `nofollow` / meta robots** | For politeness and accuracy when following internal links. | S |
| **C4. Configurable identity** | `security.js` and several fetches hardcode `yourapp.com` / `Broken Link Checker Bot/1.0`. Drive User-Agent + contact from `CRAWLER_USER_AGENT` / `CRAWLER_CONTACT_EMAIL` (already in `.env.example`) everywhere. | S |

---

## D. UX & product polish

| Item | Description | Effort |
|------|-------------|--------|
| **D1. Live progress** | Status is polled (`/api/crawl/status/[jobId]`). Once there's a worker, consider SSE/websocket push, or at least adaptive polling. The dynamic status rate-limit scaling in `validation.js` exists precisely because polling is heavy — pushing removes that whole problem. | M |
| **D2. Result deep-links & filters in URL** | Make filtered result views shareable/bookmarkable. | S |
| **D3. Accessibility & mobile pass** | Standard audit of the results table and forms. | S |
| **D4. Empty/error states** | Clear messaging for JS-only sites, robots-blocked, rate-limited, and zero-broken-links outcomes. | S |

---

## E. Housekeeping & config hygiene

| Item | Description | Effort |
|------|-------------|--------|
| **E1. Replace placeholder domains/emails** | `yourapp.com`, `your-domain.com`, `support@yourapp.com`, `https://your-domain.com/docs/rate-limits` appear in `security.js`, `rateLimit.js`, `httpChecker.js`. Centralize app identity/config. | S |
| **E2. Real README** | The README is still the `create-next-app` boilerplate. Document setup, env vars, the Postgres migration, deploy, and the worker. | S |
| **E3. Retire dead code** | `SecureHttpChecker` (Doc 03 A7), rateLimit.js placeholders, unused imports. | S |
| **E4. Data retention controls** | `admin/cleanup` deletes >30-day data via a bearer-token cron. Make the window configurable and surface a "delete my scan" action in the UI. | S |
| **E5. `next.config.js` CSP cleanup** | After the Supabase→Postgres migration, drop `connect-src ... *.supabase.co` and the `NEXT_PUBLIC_SUPABASE_*` `env` block (your migration todos already cover this). Tighten `script-src` — it currently allows `'unsafe-inline' 'unsafe-eval'` plus CDN origins; verify those CDNs are actually used and remove if not. | S |

---

## F. Bigger bets (only if the product grows)

| Item | Description | Effort |
|------|-------------|--------|
| **F1. Real auth & multi-user** | If this stops being a single trusted group, replace Basic Auth (Doc 02) with session-based auth (e.g. Auth.js), per-user job ownership, and roles. | L |
| **F2. Public API + API keys** | Expose crawling as an authenticated API for automation/CI use ("fail my build if links break"). | M |
| **F3. Multi-region / horizontal scale** | Multiple workers, sharded queues. Only meaningful after F1/F2 and real traffic. | L |

---

## G. SEO analysis depth

The SEO analyzer (`seoDetector.js`) currently covers titles, descriptions, headings,
alt text, canonicals, and a 0–100 score. These items deepen it toward a "site health"
product — the strongest candidates for a paid tier alongside B1–B3.

| Item | Description | Effort | Depends on |
|------|-------------|--------|-----------|
| **G1. Duplicate title / meta description detection** | Titles and descriptions per page are already stored in the SEO analysis table; a GROUP BY surfaces sitewide duplicates. Query + UI only, no new crawling. | S | — |
| **G2. noindex / X-Robots-Tag findings** | Flag accidentally noindexed pages as a critical issue (distinct from C3, which is crawl *politeness*). Regex on the already-fetched HTML + one response header, in the existing `seoDetector` extraction pattern. | S | — |
| **G3. Open Graph / Twitter card checks** | Same regex approach as the existing meta extraction; flags pages that render broken previews when shared. | S | — |
| **G4. Orphan page detection** | Diff sitemap URLs against the crawled link graph: pages in the sitemap that nothing links to, and linked pages missing from the sitemap. | M | B4 |
| **G5. Internal link analysis** | Inlink counts per page, click depth from the homepage, anchor text; flag important pages that are buried or under-linked. The link graph is already built during the crawl. | M | — |
| **G6. Broken-link fix suggestions** | Fuzzy-match dead internal URLs against live URLs from the same crawl and suggest the likely replacement ("`/blog/old-post` is dead — did you mean `/blog/old-post-updated`?"). Turns findings into fixes; no competitor's free tier does this. | M | — |
| **G7. Core Web Vitals (PageSpeed Insights API)** | Google's PSI API is free; call it for key pages and show performance scores next to the SEO grade. No extra crawl cost. | S–M | — |

---

## Recommended sequencing

1. **A1–A4** (tests, monitoring, logging, CI) — in parallel with the P0/P1 work; they make
   everything else safe to change.
2. **B4, B6, B7, B8, C2, C4, E1–E5, G1–G3** — high-value, low-effort quick wins.
3. **B1 → B2 → B3** (scheduling → alerts → history) — the feature that turns a one-shot
   tool into something people rely on. Gated on the job queue from Doc 03 A1.
   **G4–G6** slot in here as the SEO differentiators for a paid tier.
4. **B5, D1, G7** — heavier bets (headless rendering, live progress, external APIs)
   once the worker exists.
5. **F*** — only if the audience/scale changes.
