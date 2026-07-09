# 09 - Audit & SEO Report Specification

**Priority:** P2
**Goal:** Define the audit report as a **professional, hand-off-able deliverable** — not a data dump.
It must serve a manager/client (is it healthy? what's the business impact?), an SEO/site lead
(what's the priority?), and an implementer (what exactly do I fix, and where?) — from one report.

**Scope decision (locked):**
- **A — Link-Health Audit now**, built on the data the crawler *already* produces, with the IA
  designed so SEO categories slot in later without a redesign.
- **Both audiences** — usable internally *and* exportable as a clean, white-labelable client PDF.

Expands [06 §9](./06-ux-ia-and-reporting.md) (which remains the wireframe skeleton). Uses tokens +
components from [08](./08-design-tokens-and-theming.md). Severity model refined from 06 §10.

---

## 1. Data reality — what we can report on today

Grounding the spec in real output (`src/lib/crawler/*`). **Nothing here is aspirational.**

### Available now (per finding)

| Field | Source | Notes |
|---|---|---|
| `sourcePage` | crawler | The page the link appears on — enables page-centric + template grouping |
| `targetUrl` | crawler | The link being checked |
| `statusCode` | `httpChecker` | HTTP status (or null on network failure) |
| `responseTime` | `httpChecker` | ms — enables slow-response findings |
| `isInternal` | `urlUtils.isInternalUrl` | internal vs external split |
| `category` | crawler modes | `pages` / `external` |
| `errorType` / `code` | `errorHandler` | e.g. `ROBOTS_BLOCKED`, timeout, network |

### Derivable now (compute in a summary/service layer)

Broken-by-status-class (4xx / 5xx / timeout / SSL-network / blocked), internal-vs-external splits,
affected-pages rollup (group by `sourcePage`), **template/pattern rollup** (same `targetUrl` across
many pages ⇒ shared nav/footer), slow-response outliers, and the health score (§5).

### NOT available yet (future SEO extraction — see §12 matrix)

Meta titles/descriptions, H1/heading structure, alt text, canonical/indexability, robots/noindex,
Core Web Vitals/performance, HTTPS/mixed-content, redirect chains, word count, SEO score.
**The report IA reserves labelled placeholders for these; they render as "not yet measured" until
the backend produces them.**

---

## 2. Audience model — one report, three stopping points

| Reader | Wants | Reads sections | Stops at |
|---|---|---|---|
| **Manager / client** | Is it healthy? Impact? Trend? | Cover, Executive Summary, Key Takeaways, Quick Wins | ~ page 1 |
| **SEO / site lead** | Where's the priority? What's the plan? | Findings by Priority, by Category, Affected Pages | mid |
| **Implementer (dev/content)** | Exactly what to fix, where, how | Remediation Plan, Detailed Findings, Methodology | end |

**Design rule:** each section is tagged with its primary reader. Never force a manager to scroll a
raw table to learn the verdict, and never make an implementer reverse-engineer tasks from a chart.

---

## 3. Report information architecture (section order)

```
1.  Report header / cover        [manager]   domain, date, scope, overall grade, export/share
2.  Executive summary            [manager]   health score + sub-scores, headline KPIs, 1-line verdict
3.  Key takeaways                [manager]   3–5 plain-language auto statements
4.  Quick wins                   [manager/lead]  top high-impact / low-effort fixes — "start here"
5.  Findings by priority         [lead]      Critical / Major / Minor groups
6.  Findings by category         [lead]      4xx, 5xx, timeout, SSL/network, blocked · internal/external
7.  Affected pages               [lead]      pages ranked by issue count (page-centric fixing)
8.  Remediation plan             [impl]      the hand-off checklist: task · owner · effort · impact
9.  Detailed findings (appendix) [impl]      full filterable/sortable evidence table
10. Methodology & scope          [impl]      mode, depth, counts, definitions, timestamp
11. SEO categories (reserved)    [—]         On-Page / Indexability / Performance / Security — "not yet measured"
```

---

## 4. Section-by-section spec

### 1 · Report header / cover
- **Print/client mode:** a real cover page — logo, "Website Link Audit Report", audited domain,
  date, overall grade badge (A–F), prepared-for/prepared-by (white-label fields).
- **App mode:** compact header — domain, timestamp, overall status chip, `Export PDF` / `Share` / `Re-run`.
- Data: domain, audit start/finish, scope summary (mode, pages, links), grade.

### 2 · Executive summary  *(the verdict, above the fold)*
- **Overall grade** (A–F) + **Health Score** (0–100) with the sub-scores (§5) as small dials/bars.
- **Headline KPIs** (real data): Links checked · Healthy · Issues · Affected pages · Avg response ·
  (Broken internal vs external).
- **One-line verdict**, auto-generated: e.g. *"Good overall health (Score 82/B). 48 issues, mostly
  internal 404s concentrated in 6 templates — fixable in a short sprint."*
- Tokens: `--color-surface`, status colors for KPI deltas, `--color-success/warning/danger`.

### 3 · Key takeaways  *(2–5 plain-language lines, auto-derived)*
Rules that generate them from the data, e.g.:
- concentration: *"70% of broken links come from 4 pages/templates."*
- internal-vs-external: *"Most issues are site-owned (internal), not third-party."*
- severity skew: *"No server errors (5xx); issues are missing pages (404s)."*
Keep to plain English — this is what makes the report human-readable.

### 4 · Quick wins  *(the single most valuable section for busy readers)*
The top 3–6 fixes ranked by **impact ÷ effort** (§7). Each shows: what to do, instances resolved,
effort tag, expected score gain. Example: *"Fix 1 footer link → resolves 40 broken instances across
38 pages · Effort: XS · +6 health."*

### 5 · Findings by priority
Critical / Major / Minor blocks (§6 severity). Each block answers, in order: **what · why it matters
· how many instances · what to do next**. Collapsible; counts on the header.

### 6 · Findings by category
Grouped by failure class — `4xx (404)`, `5xx`, `timeout`, `SSL/network`, `blocked (robots)` — each
split internal vs external, with counts and a representative example. This is the "shape of the
problem" view.

### 7 · Affected pages
Table of pages ranked by issue count: page URL · # issues · worst severity · types. Because teams
fix **page by page**, this is often more actionable than a flat link list.

### 8 · Remediation plan  *(the deliverable you hand a team)*
An ordered checklist of **tasks**, not raw findings — see §8 for the grouping model. Columns:
`# · Task (action-grouped) · Owner · Effort · Impact · Instances · Evidence →`. Exportable as its
own view. This section is what turns the report into "start fixing today."

### 9 · Detailed findings (appendix)
The full evidence table — filterable/sortable, one row per finding. Columns in §9-table below.
Positioned as evidence, not the lead.

### 10 · Methodology & scope
Crawl mode, depth, external on/off, pages scanned, links checked, date, and **definitions**
("what counts as broken", "how the score is computed"). Builds trust and makes the report shareable.

### 11 · SEO categories (reserved)
Labelled, greyed placeholders: **On-Page**, **Indexability**, **Performance**, **Security** — each
showing "Not yet measured — enable SEO analysis". Wiring these later is additive (§12).

---

## 5. Health scoring model  *(transparent, or it's worthless)*

**Overall Health Score (0–100) → Grade:** A ≥ 90 · B 80–89 · C 70–79 · D 60–69 · F < 60.

Composed of sub-scores (only link-based ones are active now; SEO ones are reserved):

| Sub-score | Active now? | Basis |
|---|---|---|
| **Link Integrity** | ✅ | broken links, weighted by severity (below) |
| **Response Health** | ✅ | share of links slower than threshold (e.g. > 2000 ms) |
| **Coverage confidence** | ✅ | pages crawled vs discovered (audit completeness signal) |
| On-Page SEO | ⏳ reserved | titles/meta/H1/alt when extracted |
| Indexability | ⏳ reserved | robots/noindex/canonical |
| Performance | ⏳ reserved | Core Web Vitals |
| Security | ⏳ reserved | HTTPS/mixed content |

**Link Integrity (worked, tunable weights):** start at 100, deduct a weighted broken ratio.

```
severityWeight: internal 5xx = 4 · internal 404 = 2 · timeout = 1.5 · external broken = 0.5 · blocked = 0.5
weightedBroken = Σ(count_type × weight_type)
LinkIntegrity  = round( 100 × (1 − min(1, weightedBroken / (totalLinks × 0.5))) )
```

*Example:* 1000 links, 20 internal-404 + 4 external-broken → weightedBroken = 20×2 + 4×0.5 = 42;
`42 / (1000×0.5)=0.084` → LinkIntegrity ≈ **92**. Overall blends the active sub-scores (weighted,
e.g. Integrity 70% / Response 20% / Coverage 10%). **Publish the formula in §10** so it's credible.
Constants are tunable — the point is it's explainable, not magic.

---

## 6. Severity model (refined from 06 §10)

| Severity | Definition | Examples |
|---|---|---|
| **Critical** | breaks core journeys / server-side | internal 5xx; internal 404 on high-value pages (home, pricing, nav/footer templates) |
| **Major** | widespread but not journey-breaking | repeated internal 404s on secondary pages; many broken externals; consistent timeouts |
| **Minor** | isolated / low-impact | one-off external 404; slow-but-working links; robots-blocked externals |

High-value pages: derive from crawl depth (shallow = more important) + link-in count until real
page-value signals exist. v1 needs to be *understandable and consistent*, not perfect.

---

## 7. Prioritization — impact × effort (drives Quick Wins & plan order)

**Impact** = instances × severity weight × page-value (more instances, worse severity, on more
important pages = higher). **Effort** = how many *distinct edits* the fix needs:

| Effort | Meaning |
|---|---|
| **XS** | one shared edit (nav/footer/template) fixes many instances |
| **S** | a handful of pages/links |
| **M** | many individual pages |
| **L** | structural / needs dev + content coordination |

**Quick Wins** = high impact **and** XS–S effort. **Remediation plan order** = sort by
impact ÷ effort descending. This is the difference between "here are 48 problems" and "do these 6
things first."

---

## 8. Action-grouping model  *(raw findings → tasks)*

Never hand a team 48 rows. Roll findings up into **tasks**:

1. **Shared-element group** — the *same* `targetUrl` broken across many `sourcePage`s ⇒ it's in
   nav/footer/a template. One task, N instances. (Highest-leverage; usually the top Quick Win.)
2. **Page group** — many broken links on one `sourcePage` ⇒ "clean up links on /blog/old-post".
3. **Target-pattern group** — broken targets sharing a path prefix ⇒ a moved/renamed section.
4. **Type group** — all timeouts to one host ⇒ one infra/host task.

Each task carries: action verb + object, **owner** (below), effort, impact, instance count, and a
link to its evidence rows.

**Owner mapping (default, editable):**

| Finding pattern | Owner |
|---|---|
| internal 404/5xx, redirects, timeouts (own infra) | **Dev / Web ops** |
| broken external references in content | **Content / Editorial** |
| high-value-page issues, prioritization calls | **SEO lead** |

---

## 9. Detailed findings table (appendix)

Columns: `Priority · Source page · Broken URL · Type (4xx/5xx/timeout/SSL/blocked) · HTTP code ·
Response time · Internal/External · Recommended action`. Features: filter by
priority/type/internal-external, sort, search, and **CSV export** (already supported) alongside PDF.

---

## 10. Export & client deliverable

- **PDF/print stylesheet** — a document layout (cover → summary → plan → appendix), not a screenshot
  of the dashboard. Page breaks between major sections; tables repeat headers.
- **White-label fields** — logo, prepared-for, prepared-by, accent color (already a token — §08).
  Client mode hides internal-only chrome.
- **Share** — link to a read-only report view (respects the app's Basic Auth for now).
- **Print theme** — force the light token set for print regardless of app theme.

---

## 11. Component / token mapping (ties to doc 08)

| Report element | Component | Key tokens |
|---|---|---|
| Grade badge / score dial | `ScoreBadge`, `ScoreDial` | `--color-success/warning/danger`, `--color-surface` |
| KPI stat | `StatCard` | `--color-surface`, `--color-text(-muted)`, status for deltas |
| Takeaway / verdict | `Callout` | `--color-surface-subtle`, `--color-text` |
| Quick win / task row | `TaskRow` | severity + `--color-action-primary`, effort/impact chips |
| Priority / category block | `FindingGroup` (collapsible) | `--color-border`, status subtles |
| Findings table | `ResultsTable` (rework) | `--color-surface(-subtle)`, `--color-border`, status for cells only |
| Severity / type chip | `Badge` | `--color-{danger,warning,info,success}` + `-subtle` |

---

## 12. Data availability matrix — grow into full SEO (Scope B later)

| Report capability | Data source | Status |
|---|---|---|
| Broken links, status, response time | crawler (now) | ✅ available |
| Affected pages, template grouping | derive from `sourcePage`/`targetUrl` | ✅ derivable |
| Health score (link-based) | §5 | ✅ buildable now |
| Titles / meta / H1 / alt | **new**: parse crawled HTML (already fetched) | ⏳ needs extractor |
| Indexability (robots/noindex/canonical) | **new**: parse `<head>` + robots.txt | ⏳ needs extractor |
| Performance / Core Web Vitals | **new**: PSI/Lighthouse integration | ⏳ needs integration |
| Security (HTTPS/mixed content) | **new**: scheme + resource scan | ⏳ needs extractor |
| SEO recommendations | replace fake `generateRecommendations()` w/ DeepSeek | ⏳ planned |

**Growth path:** the HTML is *already fetched* during crawl (`safeFetch` with `readBody`) — most
on-page SEO signals (titles, meta, H1, canonical) are a parse away, no extra requests. That makes
Scope B mostly a parsing + storage task on top of this report's reserved sections.

---

## 13. Acceptance criteria

- A manager understands health, impact, and top actions from **page 1 alone** (grade + summary +
  takeaways + quick wins).
- An implementer can start fixing from the **Remediation Plan** without reading the raw table —
  every task has action, owner, effort, and instance count.
- Findings are **grouped into tasks**, not listed one-per-broken-link.
- The **health score is explained** (formula in Methodology), not a bare number.
- The report **exports to a clean, white-labelable PDF** that reads as a document.
- **Quick Wins** surfaces genuine high-impact/low-effort items (validated against a real crawl).
- SEO category placeholders render gracefully as "not yet measured" and require **no redesign** to
  populate later.
- Every surface uses tokens (§08) and renders in light + dark (app) / forced-light (print).
