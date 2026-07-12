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
| **B5. JS-rendered site support (headless browser)** | The analyzer explicitly can't see SPA content (`createJavaScriptSiteResponse`). Add an optional Playwright path for JS-heavy **Full Audits**: normal HTML crawl → sitemap fallback → selectively render capped pages and extract rendered DOM links into the existing checker. Run Chromium in an isolated worker/container with fresh contexts, no credentials/cookies/downloads/form actions, strict page/time/concurrency limits, and network egress controls that block private IPs, Docker services, and cloud-metadata endpoints. Validate every navigation/redirect and never bypass logins, CAPTCHAs, or bot controls. | L | Doc 03 A1, Doc 01 C3 |
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
| **C4. Configurable identity** | `security.js` and several fetches hardcode `seoscrub.in` / `SeoScrub Bot/1.0`. Drive User-Agent + contact from `CRAWLER_USER_AGENT` / `CRAWLER_CONTACT_EMAIL` (already in `.env.example`) everywhere. | S |
| **C5. Smarter fetch strategy when SEO is enabled** | `checkUrlWithSEO` switches *every* request to GET when SEO is on — full bodies of external links, PDFs, and images get downloaded, then discarded by the content-type/URL filters. Use HEAD first and GET only for internal `text/html` pages. Also make `seoDetector.isContentPage()` check the domain, not just the path, so external pages aren't SEO-analyzed at all. Removes the need to throttle concurrency/batch sizes when SEO is enabled. | S–M |
| **C6. Eliminate the traditional-crawl double fetch** | `processTraditionalCrawlBackground` fetches each internal page twice: once via `checkUrlsWithSEO` (status + SEO), then again for link extraction. Reuse the first response body for extraction — halves requests on discovery crawls. Falls out naturally from the Doc 03 A2 refactor if the link-check step returns page content. | S |

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

## H. AI-powered insights ✅ (partially done)

The USP build adds AI interpretation on top of the raw crawl data so the report reads like
an expert wrote it, not a template engine.

| Item | Status | Description |
|------|--------|-------------|
| **H1. Post-audit narrative** | ✅ Done | After crawl completes, one DeepSeek V4 Flash call generates `headline` + findings (finding / why / action) + numbered priority actions. Cached in `crawl_jobs.ai_narrative`; results page swaps in AI content over the static verdict/takeaways. `src/lib/deepseekNarrative.js`, `src/app/api/ai/narrative/[jobId]/route.js`. |
| **H2. Deeper SEO pipeline** | Next | Per-page SEO signals (see §G) feed the narrative so it can say things like "your blog archive has thin content AND broken links — fix or noindex that section." G0 (extraction fix) must land first. |
| **H3. Shareable client reports** | Planned | Read-only signed URL per audit (see B6). Agencies send the AI-enriched report directly to clients without sharing login credentials. |

Cost: ~$0.000189/completed audit for the narrative call (cached — repeat views free).
See HANDOVER 2026-07-12 entry for the full cost table and validation notes.

---

## G. SEO analysis depth

The SEO analyzer (`seoDetector.js`) currently covers titles, descriptions, headings,
alt text, canonicals, and a 0–100 score. These items deepen it toward a "site health"
product — the strongest candidates for a paid tier alongside B1–B3. **G0 is the
exception: it's a correctness fix, not a feature, and gates G2/G3/G8–G14** (which
would otherwise build more extraction on a fragile foundation).

| Item | Description | Effort | Depends on |
|------|-------------|--------|-----------|
| **G0. Fix the extraction layer** | The regex extraction in `seoDetector.js` has correctness bugs: meta tags written as `<meta content="..." name="description">` report as "missing" (attribute-order dependency — also affects keywords and canonical); multi-line `<title>` doesn't match (`.` doesn't cross newlines); inline SVG `<title>` elements false-positive as the page title; `estimateWordCount` strips tags but not `<script>`/`<style>` *contents*, so JS/CSS counts as words and the "low word count" deduction fires ~randomly on script-heavy pages. Replace the regexes with a tolerant parser (e.g. `node-html-parser`) over the existing 50KB slice — cheap enough for the memory budget. While there: drop the dated multiple-H1 penalty (fine in HTML5, per current Google guidance) and the image `title`-attribute check (no SEO relevance), and label content metrics (headings, word count, images) as "first 50KB" since they ignore everything past the truncation point. | S–M | — |
| **G1. Duplicate title / meta description detection** | Titles and descriptions per page are already stored in the SEO analysis table; a GROUP BY surfaces sitewide duplicates. Query + UI only, no new crawling. | S | — |
| **G2. noindex / X-Robots-Tag findings** | Flag accidentally noindexed pages as a critical issue (distinct from C3, which is crawl *politeness*). Extract from the already-fetched HTML + one response header. | S | G0 |
| **G3. Open Graph / Twitter card checks** | Same extraction pattern as the existing meta checks; flags pages that render broken previews when shared. | S | G0 |
| **G4. Orphan page detection** | Diff sitemap URLs against the crawled link graph: pages in the sitemap that nothing links to, and linked pages missing from the sitemap. | M | B4 |
| **G5. Internal link analysis** | Inlink counts per page, click depth from the homepage, anchor text; flag important pages that are buried or under-linked. The link graph is already built during the crawl. | M | — |
| **G6. Broken-link fix suggestions** | Fuzzy-match dead internal URLs against live URLs from the same crawl and suggest the likely replacement ("`/blog/old-post` is dead — did you mean `/blog/old-post-updated`?"). Turns findings into fixes; no competitor's free tier does this. | M | — |
| **G7. Core Web Vitals (PageSpeed Insights API)** | Google's PSI API is free; call it for key pages and show performance scores next to the SEO grade. No extra crawl cost. | S–M | — |
| **G8. Structured data / Schema.org detection** | Find `<script type="application/ld+json">` blocks in the already-fetched HTML, parse the JSON, and report which `@type` values are present (e.g. `Article`, `Product`, `BreadcrumbList`, `FAQPage`). Flag pages with no structured data as a minor issue. Managers care because schema is what drives Google rich results (star ratings, FAQs, product prices in SERPs) and errors surface in Search Console escalations. Detection is simpler than the existing meta extraction — a single regex find + `JSON.parse`. | S | G0 |
| **G9. Heading hierarchy / outline** | Change heading output from raw counts to an ordered outline (e.g. `H1 → H2 → H2 → H3`) and flag structural problems: skipped levels (H1 directly to H3 with no H2), H2 appearing before any H1, no headings at all. This is what SEO extensions (Detailed SEO, SEO Minion) show and what a content editor acts on — raw counts are less useful. Drop the existing multiple-H1 penalty as part of G0; this replaces it with something meaningful. | S | G0 |
| **G10. Page fundamentals: lang, viewport, URL** | Three lightweight checks on data already in the response: (1) `<html lang="...">` — missing or empty is a minor SEO and accessibility issue; (2) `<meta name="viewport">` — absence flags the page as potentially non-mobile-friendly, and Google uses mobile-first indexing; (3) URL length and slug quality — flag URLs over ~100 chars or containing underscores (Google prefers hyphens). All three are single-regex extractions. These are standard checks in every SEO Chrome extension. | S | G0 |
| **G11. Fix character-limit thresholds** | Current thresholds are too lenient: title "too short" fires at <30 chars (should be <50 — Google's SERP display starts truncating below ~50); description "too short" fires at <120 chars (should be <150 — the accepted minimum for meaningful descriptions). Update the scoring deductions and issue messages to match current industry guidance. No new extraction needed — just constant changes in `calculateSEOScore`. | XS | — |
| **G12. SERP preview** | Render a pixel-accurate mock of how the page's title and meta description will appear in a Google search result, including truncation at the correct character/pixel boundary. Every major SEO extension (SEO Minion, Ahrefs toolbar, Detailed SEO) includes this because it's the most tangible output for non-technical stakeholders — managers can see exactly what a searcher sees without opening Google. Implement as a UI component in the results view; no new crawling needed since title and description are already stored. | S | G0, G11 |
| **G13. hreflang detection and validation** | Extract all `<link rel="alternate" hreflang="...">` tags from the fetched HTML. Check: (1) are hreflang tags present at all; (2) do return tags exist (every hreflang page must link back to all others — missing return tags are a common misconfiguration Google ignores the whole set for); (3) are the language/region codes valid BCP-47 values. Flag at critical level if hreflang is present but return tags are missing — this silently breaks international targeting. Only relevant when hreflang tags are detected, so it won't add noise to single-language sites. | S–M | G0 |
| **G14. Published / modified date extraction** | Extract content freshness signals already present in the HTML: `article:published_time` and `article:modified_time` Open Graph tags, `datePublished` and `dateModified` from JSON-LD schema (falls out of G8), and the HTTP `Last-Modified` response header (already captured). Surface these per page and flag content that hasn't been updated in over 12 months as a minor issue — Google treats freshness as a ranking signal for news, blog, and product pages. Low extraction cost since the data comes from sources already being parsed. | S | G0, G8 |
| **G15. robots.txt page-level check** | Fetch and parse the site's `robots.txt` once per crawl job, then check each crawled URL against the `Disallow` rules for `*` and `Googlebot` user agents. Flag any page that matches a disallow rule as a critical issue — these pages are invisible to Google regardless of how good their on-page SEO is. Distinct from C3 (which is about the crawler respecting nofollow for politeness) and G2 (which checks the meta robots tag in HTML). A page can have a perfect SEO score and still be blocked at the robots.txt level. | S–M | — |

---

## Recommended sequencing

1. **A1–A4** (tests, monitoring, logging, CI) — in parallel with the P0/P1 work; they make
   everything else safe to change.
2. **B4, B6, B7, B8, C2, C4–C6, E1–E5, G0–G3, G8–G15** — high-value, low-effort quick wins.
   Do **G0 before G2/G3/G8–G14** — it fixes extraction bugs the later items would inherit. G11 (threshold fixes) and G15 (robots.txt check) can go in any time alongside G0 since they don't depend on the new parser.
3. **B1 → B2 → B3** (scheduling → alerts → history) — the feature that turns a one-shot
   tool into something people rely on. Gated on the job queue from Doc 03 A1.
   **G4–G6** slot in here as the SEO differentiators for a paid tier.
4. **B5, D1, G7** — heavier bets (headless rendering, live progress, external APIs)
   once the worker exists.
5. **F*** — only if the audience/scale changes.
