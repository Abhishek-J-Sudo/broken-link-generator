# Handover — Running log

---

## 2026-07-15 — Report format redesign: client report / fix-list split

### Branch: `phase2-shareable-reports` (continued — this closes the ⚠ OPEN item below)

Product decision (discussed with user): the share report was one document serving two
audiences, which made it "too technical / too busy". Split into **two documents on one
token** (three-surface model: `/results/[jobId]` stays the internal operator console):

- **`/share/[token]` — client health report.** The brief for the site owner: grade +
  grade-word, AI headline verdict, 3–4 headline stats (URLs checked / broken / % working /
  pages hidden from search), AI findings as prose (finding + why, no mono arrows), "what
  gets fixed first" (AI priorityActions, fallback derived tasks), search-visibility tiles,
  plain-language footer. No URL tables, no jargon, no CSVs. Prints 1–2 pages.
- **`/share/[token]/fix-list` — SEO team work order** (new page). Work summary with anchor
  links; **broken links as real tables grouped by failure type** (columns: Broken URL /
  Status / Found on / Link text, plus internal-external + shared-element + critical
  markers, rows link out, 200-row cap per class with CSV pointer); **on-page SEO grouped
  by check type** (Meta & canonical, Content, Structure & fundamentals, Indexability,
  Social preview, Freshness) — each check shows severity, fix hint, and failing pages
  with measured values; passing checks confirmed in one line; unmeasurable ones marked
  "not measured". Pages-measured score table on top. Exposure review table moved here.
  Both CSV exports moved here. Cross-links with the client page in the screen toolbar.

### New/changed files

- **`src/lib/seoChecks.js`** (new) — issue-centric check registry + `buildSeoFixList()`.
  Pure; mirrors `seoDetector.calculateSEOScore()` trigger-for-trigger so the fix list
  reconciles with stored per-page scores. Unscored observations (Twitter card, missing
  date signals) carry severity `notice`. Null `signals` (pre-G-batch audits) → "na".
- **`src/app/share/useSharedReport.js`** (new) — shared hook (payload fetch + forced
  light theme) + microLabel/reportDate/csvDownload + error/loading screens.
- **`src/app/share/[token]/page.js`** — rewritten as the client brief (above).
- **`src/app/share/[token]/fix-list/page.js`** (new) — the work order (above).
- **`src/app/api/share/view/[token]/route.js`** — seoPages SELECT now includes
  `response_time` (slow-page check); **bug fix:** findings filter changed from
  `is_working = false` to `is_working IS NOT TRUE` — legacy rows store NULL for
  DNS/connection failures and were silently missing from share findings (internal
  results API already treated NULL as broken).
- Middleware needed no change — `/share/` is prefix-matched public.

### Validation

- ESLint clean on all five files.
- Real-payload derivation check (temp node script, removed): fresh audit
  (yourrighttoknow.com, 8 pages) reconciles **exactly** — 56 derived scored issues =
  56 stored; all six categories fire correctly (noindex/robots pass, stale page −42
  months, JSON-LD parse failures, heading skips). Legacy job (textfiles.com, 24 pages,
  pre-G0 scoring) shows expected snapshot drift (147 current-rules vs 145 stored) and
  all signal checks correctly "not measured"; its 3 NULL-is_working findings appear
  after the filter fix (DNS failures with source page + link text).
- All four page variants (both tokens × summary/fix-list) render 200 unauthenticated;
  `/results/*` still 401. Scratch token revoked, temp scripts deleted.

### Notes

- Fix-list "Issues" column and totals use **current-rules derived counts**
  (`pageIssueCounts`), not the stored issues snapshot, so the document always agrees
  with its own breakdown; legacy jobs may differ from stored `issues_count`.
- The `EvidenceTable` on the internal results page could adopt `seoChecks.js` later for
  the same check-type grouping — not done, not asked.
- Still open before merge: user review of the two new documents. Then: trends (B1–B3),
  Core Web Vitals (G7) as next manager-facing content; §G batch 2 (G1/G12/G13).

---

## 2026-07-15 — Shareable client reports (USP item 3)

### Branch: `phase2-shareable-reports` (off main; batch-1 was merged+pushed to main first, user-approved)

The product bar this serves (user-stated): *scan → report ready → send straight to the
client or SEO team → team instantly works on it.* Before this, the report only existed
behind Basic Auth with no export of SEO data at all.

### What shipped

- **Read-only share link per audit** — `crawl_jobs.share_token` (32-char base64url via
  `crypto.randomBytes`, unique partial index, idempotent ALTERs applied via db:init).
  - `POST/DELETE /api/share/manage/[jobId]` (behind Basic Auth + CSRF): create (reuses
    existing token so the link is stable) / revoke. Only `completed`/`stopped` jobs.
  - `GET /api/share/view/[token]` (public): ONE composite payload — job (no id leaked,
    token is the only handle), summary (same shape `buildReport()` expects), findings,
    checked links (cap 5000), seoSummary incl. indexability, seoPages incl. signals,
    cached narrative (never triggers a DeepSeek call). Rate-limited (`results` bucket),
    `X-Robots-Tag: noindex`, token format validated before DB hit.
  - **Middleware:** new prefix allow-list `['/share/', '/api/share/view/']` — everything
    else stays behind Basic Auth (verified 401s after the change).
- **`/share/[token]` page** — print-first client report document (forces light theme):
  masthead, link-health verdict + KPI leaders, AI SEO expert summary, remediation plan,
  findings by priority, SEO snapshot (on-page + indexability tiles + per-page issue
  list + noindex/robots flags), exposure review, methodology footer. Toolbar
  (`print:hidden`): Print/Save-as-PDF (`window.print`), Findings CSV, SEO fix list CSV —
  all generated client-side from the payload. Reuses `buildReport()` — zero duplicated
  derivation logic.
- **Results page:** "Share report" button (creates link + copies to clipboard, click
  again to revoke) and a new **"SEO fix list"** CSV export (page URL, score/grade, title,
  issues, noindex, robots-blocked, OG, structured data, lang, viewport, staleness) — the
  working document for an SEO team. Old CSV/JSON exports unchanged.

### Validation

- ESLint clean on all 5 touched/new files.
- E2E on the user's real audit: share created (`/share/yCFjj8NZ…`), public payload 200
  **without credentials** (48 checked, 8 SEO pages, narrative present, no job id in
  payload), share page 200; `/results/*` and `/api/results/*` still 401 unauthenticated.
- Revoke flow: view 200 → DELETE → view 404 (tested on a scratch job).

### Product notes

- Share links survive forever until revoked; `shared_at` records when sharing began.
- PDF = browser print of the share page (deliberate: no server-side PDF dependency).
- Not done (future): custom branding/white-label, expiring links, share analytics.

### ⚠ OPEN — report format redesign (user feedback, 2026-07-15)

User reviewed the share report format and wants clearer separation before this merges:
a real **broken-links table** (URL / source page / status / link text — not category
summaries), and a **per-page SEO report grouped by check type** (meta, content,
structure, indexability, social, freshness) with per-check results, like mainstream
audit tools. Current page condenses to summaries and pushes detail to CSVs. To be
redesigned in a dedicated session BEFORE merging `phase2-shareable-reports`. Trends
(B1–B3) and Core Web Vitals (G7) noted as the next manager-facing content gaps.

### Pipeline (updated)

1. ~~AI narrative layer~~ ✅ — SEO-aware since 2026-07-15
2. **Deeper SEO pipeline** — G0/G11 + batch 1 done; batch 2 remaining:
   G1 duplicate titles/descriptions, G12 SERP preview, G13 hreflang.
3. ~~Shareable client reports~~ ✅ Done (2026-07-15) — core flow; branding/expiry later.

Deploy (VPS + Coolify) is now the biggest unblocked item — runbook in the 2026-07-07 entry.

---

## 2026-07-15 — §G batch 1: deeper SEO signals (G2/G3/G8/G9/G10/G14/G15)

### Branch: `phase2-g-batch1-signals` (flat, off main)

**Workflow note (user-directed):** the old branch stack was fast-forwarded into `main`
(27 commits, no divergence) and pushed. From now on: one FLAT branch off `main` per
feature batch, merged when validated — no stacking. Existing branches were NOT deleted.

Seven new per-page signal families, all extracted from the same 50KB slice/response the
crawler already has (zero extra requests except one robots.txt fetch per job):

- **G2 indexability** — meta robots + `X-Robots-Tag` header; noindex → critical issue (−15).
- **G3 social preview** — OG (title/description/image/type) + Twitter card tags, either
  `property=` or `name=` attribute; none → minor (−3), partial → minor (−2).
- **G8 structured data** — JSON-LD blocks parsed (incl. `@graph`, type arrays); `@type`
  list reported; none → minor (−2), unparseable block → warning (−3).
- **G9 heading outline** — ordered H1–H6 outline (capped 40); skipped level (H2→H4) →
  warning (−4); headings before first H1 → minor (−3). This is the meaningful replacement
  for the multiple-H1 penalty dropped in G0.
- **G10 fundamentals** — `<html lang>` (−2), viewport meta (−5), URL >100 chars /
  underscores (−2).
- **G14 freshness** — `article:published_time`/`modified_time`, JSON-LD dates (from G8),
  `Last-Modified` header (weakest, fallback only); >12 months stale → minor (−2).
- **G15 robots.txt audit** — **new `src/lib/robotsAudit.js`**: fetched once per job in
  `checkLinks()` (via safeFetch), parsed per Google REP semantics (group merge, specific
  `googlebot` group *replaces* `*`, longest-match wins, allow wins ties, `*`/`$` wildcards,
  4xx = no restrictions, 5xx/unreachable = audit skipped). Same-origin URLs only.
  Disallowed page → critical issue (−15). Distinct from `securityUtils.checkRobotsTxt`
  (our bot's politeness).

### Plumbing

- `seoDetector.analyzePage(html, url, status, time, context)` — new optional 5th param:
  `context.headers` (`x-robots-tag`, `last-modified`) + `context.robotsTxt` (evaluated match).
- `httpChecker.checkUrlWithSEO/checkUrlsWithSEO` accept `robotsRules`, build the context;
  `x-robots-tag` added to `_extractRelevantHeaders`.
- `crawler/linkCheck.js` loads robots rules once per job when SEO is on.
- **DB:** `seo_analysis.signals JSONB` (CREATE TABLE + idempotent ALTER in `init.sql`;
  applied locally via `npm run db:init`). Written by `addSEOAnalysis`, served by the
  results API as `seo_signals` on both page rows and link rows.
- **UI:** `EvidenceTable` expanded SEO rows get a "Deeper signals" section — indexability,
  social preview, structured data types, heading outline, fundamentals, freshness.
- Drive-by: removed dead `brokenLinksFound` counter in `linkCheck.js` (blocked ESLint).

### Validation

- 46/46 fixture checks (temp script, removed): every signal family positive + negative,
  REP matcher semantics (wildcards, anchors, group preference, cross-origin null), scoring
  integration, signals shape. Note: two initial "failures" were wrong test expectations —
  a `googlebot` group correctly makes `*` rules inapplicable.
- ESLint clean on all 7 touched files.
- E2E on real infra (job `26197940-0d43-4319-9ccb-5574742b75a8`, example.com, SEO on):
  score 65 → 60 exactly per new deductions (no OG −3, no JSON-LD −2); robots.txt fetched
  and checked; `lang`/viewport correctly detected present (not flagged); Last-Modified
  freshness 0 months; full signals JSONB round-tripped DB → API. Results page `200`.

### Batch wrap-up (same day, same branch)

- **Indexability tile is live** — the SEO Snapshot cell that said "Not yet measured"
  now shows real data: `calculateSEOSummary` returns an `indexability` rollup
  (measured/noindexed/robots-blocked/hidden/indexable) computed from per-page signals;
  tile renders N/N in danger red when pages are hidden from search. Performance and
  Security cells remain reserved.
- **AI narrative now reads the SEO signals** — `buildCondensed` gained a 5th query;
  `condenseSeo()` sends a compact rollup (avg/range, noindexed, robots-blocked,
  missing-OG, no-structured-data, stale counts, top 5 recurring issues, 3 worst pages).
  System prompt updated: audit expert covering link health + on-page SEO; noindex/robots
  called out as most severe. `seo: null` (SEO-off audits) → link-health-only narrative.
- **Section renamed** — "AI Analysis" → **"AI SEO Expert Summary"** (user request; earned
  now that the narrative actually covers SEO). Static fallback label stays "Key Takeaways".
- Finding/action length caps 200→350 chars (SEO-dense actions were truncating mid-word).
- Validated on the user's real audit (yourrighttoknow.com, 8 SEO pages): indexability 8/8,
  regenerated narrative correctly blends link health (48/48 healthy) with SEO findings
  (missing descriptions/OG/canonicals, stale page, lang attribute, worst page 42/100);
  usage ~444 in / ~571 out tokens (~$0.0002). Stale cached narratives were cleared for
  that job so the label matches the content.

### Pipeline (updated)

USP build — in order:

1. ~~AI narrative layer~~ ✅ (2026-07-12) — now SEO-aware (2026-07-15)
2. **Deeper SEO pipeline** — in progress:
   - ~~G0 + G11 extraction/threshold fixes~~ ✅ (2026-07-15)
   - ~~Batch 1: G2/G3/G8/G9/G10/G14/G15 signals + indexability tile + AI wiring~~ ✅ (2026-07-15)
   - Next — batch 2 (presentation/query layer): G1 duplicate titles/descriptions,
     G12 SERP preview, G13 hreflang validation.
3. **Shareable client reports** — read-only signed URL per audit (doc 04 B6).

Deploy (VPS + Coolify) still deferred to last — runbook in the 2026-07-07 entry.

---

## 2026-07-15 — G0 + G11: SEO extraction layer fixed (phase 1 of deeper SEO pipeline)

### Branch: `phase2-g0-seo-extraction`

G0 is the correctness fix that gates G2/G3/G8–G14 (doc 04 §G). All regex extraction in
`seoDetector.js` replaced with cheerio (already a dependency via `linkExtractor.js`) over
the same 50KB slice. Output shape is unchanged, so `addSEOAnalysis`, the results API, and
the UI needed no data-layer changes.

### Bugs fixed (G0)

- **Attribute-order dependency** — `<meta content="…" name="description">` reported as
  "missing"; same bug affected keywords and canonical. Now matched by attribute name,
  case-insensitive, order-independent.
- **Multi-line `<title>`** — regex `.` didn't cross newlines; now parsed, whitespace collapsed.
- **Inline SVG `<title>`** — false-positived as the page title; now excluded via ancestor check.
- **Word count counted code** — `<script>`/`<style>` contents survived tag-stripping, so the
  "low word count" deduction fired ~randomly on script-heavy pages. Now strips
  script/style/noscript/template and counts visible body text only.
- **Dropped:** multiple-H1 penalty (fine in HTML5 per current Google guidance; flag still
  recorded in data, no deduction) and the image `title`-attribute check (no SEO relevance,
  was never persisted).

### Threshold fixes (G11)

- Title "too short" now fires at <50 chars (was <30).
- Meta description "too short" now fires at <150 chars (was <120, and previously the flag
  was computed but never deducted — now −5, type minor).
- Content metrics labeled "first 50KB" in the evidence UI (`EvidenceTable` detail labels),
  the SEO snapshot lead-in, and the low-word-count issue message.

### Validation

- 18/18 fixture checks passed (temp script, removed): reversed-attr meta/canonical/keywords,
  multi-line title, SVG title exclusion, script/style word-count exclusion, `alt=""` counted
  as present, multiple-H1 non-penalty, both G11 thresholds, output-shape compatibility.
- ESLint clean on all touched files.
- E2E on real infra: queued an SEO-enabled crawl of `example.com` through the API
  (job `dd781bbb-5f3e-4ff8-98fd-000d3af96cc2`), worker processed it, stored analysis
  exactly as predicted: score 65/D = −5 title short (14 chars) −15 no description
  −10 low word count −5 no canonical; word count 17 **visible** words (old code would
  have counted example.com's inline CSS as words).
- Results page `200` on the running dev server after all edits.

### Gotcha (local dev)

`npm run worker` / `worker:dev` does **not** load `.env.local` — it needs `DATABASE_URL` /
`REDIS_URL` in the shell environment or it dies at startup on the reaper query.

### Pipeline (updated)

USP build — in order:

1. ~~**AI narrative layer**~~ ✅ Done (2026-07-12)
2. **Deeper SEO pipeline** — in progress:
   - ~~G0 extraction fix + G11 thresholds~~ ✅ Done (2026-07-15) — unblocks G2/G3/G8–G14
   - Next: G2 (noindex/X-Robots-Tag), G3 (OG/Twitter cards), G8 (structured data),
     G9 (heading outline), G10 (lang/viewport/URL), then G12 (SERP preview),
     G13 (hreflang), G14 (freshness dates), G15 (robots.txt page-level check).
3. **Shareable client reports** — read-only signed URL per audit (doc 04 B6).

Deploy (VPS + Coolify) deferred to last stage — runbook in the 2026-07-07 entry below.

---

## 2026-07-12 — AI narrative layer (item 1 of USP build)

### Branch: `phase2-ui-restructure`

Post-audit AI analysis: after a crawl completes, one DeepSeek V4 Flash call synthesises
the report into a plain-English `headline`, 2–4 `findings` (finding / why it matters /
what to do), and a numbered `priorityActions` list. This replaces the static
template-string `verdict` and rule-matched `takeaways` that were in `buildReport()`.

### What changed

- **`database/init.sql`** — `ai_narrative JSONB` column added to `crawl_jobs`; idempotent
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` so existing installs apply with one SQL line or
  a re-run of `npm run db:init`.
- **`src/lib/deepseekNarrative.js`** (new) — bounded DeepSeek call: condensed report data
  in, structured JSON out (`headline` / `findings[]` / `priorityActions[]`); 1000-token
  output cap, 20 s timeout, `thinking: disabled`, JSON validation, returns `null` on any
  failure so callers fall back to static content.
- **`src/app/api/ai/narrative/[jobId]/route.js`** (new) — `GET` endpoint: returns cached
  `ai_narrative` from the DB row immediately (no API cost on repeat views); if absent,
  runs 4 parallel DB queries to build a condensed summary (stats, error-type breakdown
  joined to `discovered_links.is_internal`, top affected pages, shared targets), calls
  DeepSeek, stores result, returns it. Returns `204` for non-completed jobs or on any
  failure — the results page always has static content to fall back to.
- **`src/app/results/[jobId]/page.js`** — new `aiNarrative` state; `useEffect` fires once
  `report` is non-null, calls the narrative endpoint, swaps in AI content on success.
  Verdict `<blockquote>` prefers `aiNarrative.headline`. Takeaways section relabels to
  "AI Analysis" and renders findings + numbered priority actions when AI content is
  available; falls back to static takeaways silently.

### Cost (DeepSeek V4 Flash, derived from prior validated run)

| Call | Avg tokens | Avg cost |
|---|---|---|
| Scope estimate (existing, at analyze time) | ~237 in / 172 out | ~$0.000064 |
| Narrative (new, at first report view) | ~700 in / 500 out | ~$0.000189 |
| **Total per completed audit** | | **~$0.000253** |

Narrative result is cached in DB — every subsequent view is free.
At 10 000 audits: ~$2.53 total AI cost.

### Bug caught during verification

`useEffect([jobId, report])` was placed before `const report = useMemo(…)` in the
function body — TDZ error during Next.js SSR pass → `HTTP 500` on every results page.
Fixed by moving the effect below the `useMemo`. Confirmed `HTTP 200` after fix.

### Validation

- `GET /api/ai/narrative/<completed-job>` → `HTTP 200`, correct JSON narrative
- Second call to same job → `HTTP 200` from DB cache (JSONB key order differs, content identical)
- Job with 1 broken link → narrative correctly identified SSL failure + slow link
- Non-completed (failed) job → `HTTP 204` (correct)
- Unknown UUID → `HTTP 204` (semantic gap: should be 404, no user impact)
- Unauthenticated → `HTTP 401` (middleware blocks correctly)
- Results page `GET /results/<jobId>` → `HTTP 200` after TDZ fix
- ESLint clean on all touched files

### Pipeline (updated)

USP build — in order:

1. ~~**AI narrative layer**~~ ✅ Done (2026-07-12)
2. **Deeper SEO pipeline** — per-page signals (Core Web Vitals, structured data, canonical
   issues, redirect chains) so the audit has real SEO teeth. See doc 04 §G for the full
   backlog; G0 (fix extraction layer) gates most of the rest.
3. **Shareable client reports** — read-only signed URL per audit so agencies can send the
   report directly to clients (see doc 04 B6).

Deploy (VPS + Coolify) deferred to last stage — runbook in the 2026-07-07 entry below.

---

## 2026-07-11 - Smart Analyzer AI + pipeline correction

### Branch: `phase2-ui-restructure`

The Smart Analyzer scope estimate now uses **DeepSeek V4 Flash** when
`DEEPSEEK_API_KEY` is configured.

- **`src/lib/deepseekRecommendations.js`** — one bounded request per successful HTML
  scope estimate: aggregate category counts + up to 10 truncated URL patterns, 500 output-token
  cap, 15-second timeout, non-thinking mode, JSON validation, and deterministic-rule fallback on
  missing key, provider error, timeout, or invalid output.
- **`src/app/api/analyze/route.js`** — includes recommendation source/model/usage metadata in the
  estimate summary; existing behavior is unchanged when no API key is configured.
- **`src/app/analyze/page.js`** — surfaces 2–5 returned recommendations as `AI Scope Notes`
  alongside the estimate; rule-based fallback renders as `Scope Notes`.
- **`.env.example`** documents `DEEPSEEK_API_KEY` (never commit a real key).

### Real-run validation

- `yourrighttoknow.com/ae/en`: 7 sampled pages, 23 URLs; DeepSeek returned 3 recommendations.
  Usage: 237 input tokens (128 cache hit) + 172 output tokens, approximately `$0.000064`.
- V4 Flash needs `thinking: { type: 'disabled' }` for this small JSON task; default thinking mode
  can exhaust the output budget and return empty JSON.
- A JavaScript-rendered site (`mubadalacapital.ae`) correctly used the existing sitemap/rule fallback
  and made no AI call.

### Pipeline (current)

1. **Deploy** — provision VPS + Coolify (runbook in the 2026-07-07 entry below).
2. **Future: JS-rendered site support** — Playwright headless rendering is now scoped as Doc 04 B5;
   it is a separate isolated-worker/security project, not part of the current deploy.
3. Deeper SEO audit pipeline (Doc 04 §G) — later; unlocks an SEO letter grade.

**Correction:** Track A is closed (including the audit-progress redesign). A3 crawl-endpoint
consolidation was already completed earlier; the prior "next task" line below was stale.

---

## 2026-07-11 - Grading separation (link-health vs SEO) + pipeline reset

### Branch: `phase2-ui-restructure`

User reviewed the new audit report UI: approved, with one structural item — the report mixed
two score systems (link-health grade next to an "SEO avg" tile read as a contradiction:
grade A beside 61/100). Product decision agreed (from a Codex discussion):

- **SeoScrub = link-health checker first; SEO is an optional module, not part of the grade.**
- One report shell, separate modules: link-health verdict keeps the letter grade; SEO gets a
  numeric per-page snapshot — **deliberately no site-level SEO letter grade** until the deeper
  SEO pipeline (doc 04 §G) exists.
- The Quick Check / Full Link Audit / SEO Snapshot tiering maps onto existing crawl modes —
  naming + report modularity only, no crawler rework needed (SEO already only parses internal
  HTML content pages; external links are status-checked only).

### What changed

- **`src/app/results/[jobId]/page.js`**
  - Executive summary grid is now link-health only: `SEO pages` / `SEO avg` tiles removed;
    rebalanced to 8 tiles × 4 cols with a new `Slow links` tile (response-health evidence).
  - SEO section rebuilt as **"SEO Snapshot — Measured separately."**: lead-in states the
    population (per analyzed HTML page, N pages) and that it never feeds the link-health
    grade; On-Page cell shows page average, min–max range, pages · issues, and points to the
    evidence appendix. Reserved category cells unchanged.
- **`src/lib/supabase.js`** — `calculateSEOSummary()` now returns `min_score` / `max_score`
  (served by `/api/seo/summary/[jobId]`; the `seo_job_summary` view already had them).

### Validation

- ESLint clean on both touched files.
- `/api/seo/summary/59749e40-…` returns the new fields (`min_score: 55, max_score: 75`) —
  note this job: avg 64 but 7 of 8 pages grade D/F, exactly why the range is shown.
- Report page returns `200` on the running dev server.

### Pipeline (updated, priority order)

Track A — design/IA restructure — **one surface left**:

1. **Audit progress view** (doc 06 core page model #3) — the queued/running view was carried
   into the new report shell but never got its own typeset-audit pass. ← **NEXT TASK**

Track A closes after that; everything else is features/improvements/fixes:

2. **A3** — consolidate the 3 crawl endpoints into one.
3. **Smart Analyzer AI** — replace rule-based `generateRecommendations()` with DeepSeek
   (decided, not started).
4. **Deploy** — provision VPS + Coolify (runbook in the 2026-07-07 entry below).
5. Deeper SEO audit pipeline (doc 04 §G) — later; unlocks an SEO letter grade.

C2 note: the Redis rate-limit store is effectively done (`src/lib/redisRateLimit.js`, atomic
Lua sliding window, wired via `validation.js`); only the Basic Auth brute-force counter in
`middleware.ts` stays in-memory, blocked on Next's experimental `nodeMiddleware`.

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
