# 06 - UX, IA & Audit Reporting Redesign

**Priority:** P2
**Goal:** Reframe SeoScrub from a crawler utility into a clear website-audit product with a
more opinionated landing page, simpler user flow, and a manager-ready results experience.

---

## 1. Why this doc exists

The product already does useful work:

- it can analyze a site before crawling
- it can run multiple crawl modes
- it can classify broken/working links
- it can optionally add SEO context
- it can export raw result data

But the current experience still feels like "tool output" more than an "audit report".
That gap shows up in three places:

1. **Landing page positioning**
   The homepage introduces both "Basic Checker" and "Smart Analyzer" as parallel choices too
   early, which makes the product feel more complex than it is.
2. **User flow**
   The flow is logically correct, but the product language is internal/tool-oriented instead
   of user-oriented.
3. **Results presentation**
   The current results page is data-rich, but it leads with controls and table views instead
   of executive summary, findings, and recommended action.

This doc defines a clearer information architecture and page-by-page wireframe so the app
feels like a polished audit workflow rather than a crawl console.

---

## 2. Current state

### Existing page structure

Primary pages:

- `/` - landing page and direct crawl entry
- `/analyze` - smart analysis workflow
- `/results/[jobId]` - crawl progress and results
- `/documentation`
- `/changelog`

Primary components involved:

- [`src/app/page.js`](../../src/app/page.js)
- [`src/app/components/Header.js`](../../src/app/components/Header.js)
- [`src/app/components/HomeHeroSection.js`](../../src/app/components/HomeHeroSection.js)
- [`src/app/components/HomeSidebar.js`](../../src/app/components/HomeSidebar.js)
- [`src/app/components/HomeFeaturesSection.js`](../../src/app/components/HomeFeaturesSection.js)
- [`src/app/components/LargeCrawlForm.js`](../../src/app/components/LargeCrawlForm.js)
- [`src/app/analyze/page.js`](../../src/app/analyze/page.js)
- [`src/app/components/UrlAnalyzer.js`](../../src/app/components/UrlAnalyzer.js)
- [`src/app/results/[jobId]/page.js`](../../src/app/results/[jobId]/page.js)
- [`src/app/components/ResultsTable.js`](../../src/app/components/ResultsTable.js)

### Current user flow

#### Flow A - landing page to basic crawl

1. User lands on `/`
2. User sees hero plus homepage form
3. User enters URL in the basic crawler form
4. User optionally opens advanced settings
5. User starts the crawl
6. User is redirected to `/results/[jobId]`
7. User sees progress or final results

#### Flow B - landing page to smart analyzer

1. User lands on `/`
2. User clicks the Smart Analyzer CTA
3. User goes to `/analyze`
4. User analyzes site structure first
5. User reviews discovered categories and recommendations
6. User chooses a crawl mode
7. User starts crawl
8. User is redirected to `/results/[jobId]`
9. User sees progress or final results

### Main UX problems

#### A. The homepage asks for a product decision too early

Users currently have to decide between:

- "Basic Checker"
- "Smart Analyzer"

Those labels describe implementation style, not user intent.

#### B. The product language is internally consistent, but not externally intuitive

Terms like these are accurate but not ideal as primary UX labels:

- Smart Analyzer
- Basic Checker
- Discovered Links Mode
- Content Pages Mode

They work as secondary explanations, but not as the first language a manager, marketer, or
content owner should see.

#### C. The results page is table-first instead of report-first

The current results page provides:

- status badge
- export buttons
- metric cards
- view toggles
- large data table

That is good for an operator, but weak for:

- a manager who wants a summary
- a marketer who wants priorities
- a stakeholder who wants a shareable audit view

---

## 3. Product direction

### Positioning decision

SeoScrub should present itself as a **website audit tool** first and a **crawl engine**
second.

The UI should answer these questions in order:

1. What does this tool help me accomplish?
2. What kind of output will I get?
3. What should I do next?
4. Where are the detailed findings if I need them?

### Recommended naming model

Use intent-first labels in the UI:

| Current term | Recommended primary label | Notes |
|--------------|---------------------------|-------|
| Smart Analyzer | Full Audit | Keep "Smart Analyzer" only as internal/helper wording if needed |
| Basic Checker | Quick Check | Better matches user expectation |
| Results | Audit Report | Report-first framing |
| Broken Links | Issues Requiring Attention | Clearer for non-technical readers |
| Working Links | Healthy Links | More report-friendly |
| Pages view | Affected Pages / Pages Reviewed | Depends on underlying dataset |

Do not remove the technical detail entirely. Just move it into helper copy, tooltips, or
advanced sections.

---

## 4. Proposed information architecture

### Primary navigation

Recommended top-level nav:

- Product
- How It Works
- Documentation
- Start Audit

If keeping docs and changelog visible matters, a simple version is:

- Start Audit
- Quick Check
- Documentation
- GitHub

### Core page model

#### 1. Landing page

Purpose:

- explain the value
- set expectations
- show the output
- guide users into the recommended flow

Primary CTA:

- `Start Audit`

Secondary CTA:

- `Quick Check`

#### 2. Audit setup page

Purpose:

- collect the URL
- help the user choose audit depth
- explain expected runtime and output

This can be an evolved version of the current `/analyze` page or a new unified setup page.

#### 3. Audit progress page

Purpose:

- reassure the user that work is happening
- surface useful early metrics
- reduce anxiety during longer runs

#### 4. Audit report page

Purpose:

- communicate outcome
- prioritize issues
- provide evidence
- support export/share/print workflows

---

## 5. Proposed user flow

### Recommended default flow

1. User lands on homepage
2. User clicks `Start Audit`
3. User enters website URL
4. User chooses:
   - `Full Audit (Recommended)`
   - `Quick Check`
5. User confirms options
6. User sees progress page
7. User lands on audit report
8. User exports data or starts another audit

### Simplified user decision model

The UI should avoid making users translate product terminology into behavior.

Instead of:

- Should I use Smart Analyzer?
- Should I use Basic Checker?
- Which crawl mode should I pick?

The user should see:

- I want a full audit
- I want a faster quick check
- I want more thorough vs faster results

### Flow-specific guidance

#### Full Audit

Best for:

- medium to large sites
- stakeholder-ready reporting
- more complete site understanding
- optional SEO review

#### Quick Check

Best for:

- smaller sites
- quick validation
- a fast first pass
- technical users who already know what they want

---

## 6. Landing page wireframe

### Section 1 - Header

Contents:

- SeoScrub logo
- concise product nav
- strong CTA button

Recommendation:

- make the rightmost action `Start Audit`
- reduce competing nav emphasis

### Section 2 - Hero

Goal:

- clearly explain the product and the main outcome

Recommended content:

- Headline: `Website Link Audits That Teams Can Actually Use`
- Supporting line: find broken links, review site health, and get a clean audit report you can share
- CTA row:
  - `Start Audit`
  - `Quick Check`
- Trust row:
  - internal/external links
  - SEO checks
  - exportable reports

### Section 3 - Output preview

This is missing today and should be added.

Show:

- a stylized mock of the audit report
- summary cards
- prioritized findings
- sample issue table

Rationale:

Users should immediately understand what they will receive, not just what the crawler does.

### Section 4 - How it works

Three-step strip:

1. Scan site
2. Prioritize issues
3. Share report

This makes the product feel outcome-driven instead of feature-driven.

### Section 5 - Choose your mode

A simplified comparison block:

- Full Audit
- Quick Check

Do not force the technical distinction too early.

### Section 6 - Who it is for

Suggested audiences:

- SEO teams
- content managers
- marketing teams
- web operations

### Section 7 - FAQ / methodology

Suggested questions:

- what counts as a broken link?
- do you check external links?
- how long does a scan take?
- do you include SEO checks?

### Section 8 - Closing CTA

End the page with:

- `Start Your First Audit`

---

## 7. Audit setup page wireframe

### Purpose

The setup page should feel like a guided start to an audit, not just a form.

### Recommended layout

#### Left/main column

- page title
- website URL field
- audit type selector
- advanced options
- primary submit button

#### Right/supporting column or inline summary

- estimated site size
- estimated runtime
- what the output includes
- recommended path

### Core fields

- Website URL
- Audit Type
  - Full Audit (Recommended)
  - Quick Check
- Crawl depth
- Check external links
- Enable SEO analysis

### Copy guidance

Prefer:

- `Start Audit`
- `Estimated scan time`
- `Recommended for larger sites`

Avoid overusing:

- traditional crawl
- discovered links mode
- content pages mode

Those can remain as lower-level implementation details once the user has chosen the higher
level path.

---

## 8. Progress page wireframe

### Purpose

The progress page should reduce uncertainty and make the wait feel useful.

### Recommended sections

#### A. Audit header

- site/domain
- audit start time
- status badge

#### B. Main progress block

- large progress bar
- current phase
- estimated time remaining

#### C. Live stats

- pages scanned
- links checked
- broken links found so far
- healthy links found so far

#### D. Activity log

Use short, readable status updates.

Example tone:

- `Scanning internal pages`
- `Checking discovered links`
- `Analyzing SEO signals`

#### E. Early findings preview

Show lightweight insight while the scan runs:

- top issue type so far
- top affected page so far
- external vs internal issue ratio

This is optional but valuable for long-running scans.

---

## 9. Audit report page wireframe

### Report structure

The report page should read from summary to detail.

#### Section 1 - Report header

Include:

- `Website Link Audit Report`
- audited domain
- audit timestamp
- overall status
- export / print actions

#### Section 2 - Executive summary

Show the numbers a manager cares about first:

- total links checked
- healthy links
- issues requiring attention
- average response time
- SEO score, if enabled
- overall health grade

#### Section 3 - Key takeaways

Add 2-4 short plain-language summary lines.

Examples:

- Most issues are internal 404s
- A small number of pages account for most broken links
- External link failures are present but lower priority than site-owned issues

This section is essential to making the report feel human-readable.

#### Section 4 - Findings by priority

Organize issues into:

- Critical
- Major
- Minor

Each priority block should answer:

- what is the issue?
- why does it matter?
- how many instances exist?
- what should happen next?

#### Section 5 - Affected pages

List the pages driving the most issues.

This is more actionable than just listing broken targets because a content manager or editor
often fixes issues page-by-page.

#### Section 6 - Issue breakdown

Group by:

- 404
- 500
- timeout
- SSL
- blocked
- internal vs external

#### Section 7 - Detailed findings

Keep the existing table concept here, but reposition it as the evidence appendix.

Suggested columns:

- priority
- source page
- broken URL
- issue type
- HTTP code
- response time
- recommended action

#### Section 8 - Methodology / appendix

Show:

- crawl mode used
- depth
- external links on/off
- SEO on/off
- pages scanned
- links checked

This makes the report easier to trust and easier to share.

---

## 10. Severity model

The current app already has detailed error/status data, but the report needs a simpler
severity language.

### Proposed severity mapping

#### Critical

- internal links returning 5xx
- internal links returning 404 on high-value pages
- widespread navigation/footer failures
- failures affecting core user journeys

#### Major

- repeated internal 404s on lower-priority pages
- large number of broken external references
- severe SEO issues on important pages
- consistently slow responses above defined threshold

#### Minor

- isolated external failures
- low-volume warnings
- minor metadata or content-structure issues

### Important note

The severity system does not need to be perfect in v1. It needs to be understandable and
consistent.

---

## 11. Content and tone guidance

### Tone goal

The product should sound:

- clear
- competent
- calm
- actionable

It should not sound:

- overly technical by default
- alarmist
- like raw logs pasted into a UI

### Copy principles

1. Lead with outcomes, not implementation details
2. Use plain language first, technical language second
3. Write labels for managers and operators, not just developers
4. Prefer "what to do next" over "what happened internally"

### Example label changes

| Current style | Better user-facing wording |
|---------------|----------------------------|
| Smart Analyzer | Full Audit |
| Basic Checker | Quick Check |
| Broken Links | Issues Requiring Attention |
| Working Links | Healthy Links |
| Results | Audit Report |
| Check discovered links directly | Fast mode using discovered links |
| Crawl content pages | Thorough mode scanning page-by-page |

---

## 12. Visual direction

### Current visual state

The existing UI is clean and usable, but it still reads like a generic dashboard and uses
default-ish typography and familiar blue-gradient SaaS patterns.

### Recommended design direction

Aim for:

- a polished audit-report feel
- stronger visual hierarchy
- fewer competing surfaces
- more intentional sectioning
- typography that feels editorial enough for reports

### Visual principles

1. Summary before controls
2. Findings before tables
3. Use color for meaning, not decoration
4. Make the report printable and presentation-friendly
5. Reduce "debug console" energy in the results UI

---

## 13. Implementation mapping to current code

### Landing page

Current files:

- [`src/app/page.js`](../../src/app/page.js)
- [`src/app/components/HomeHeroSection.js`](../../src/app/components/HomeHeroSection.js)
- [`src/app/components/HomeSidebar.js`](../../src/app/components/HomeSidebar.js)
- [`src/app/components/HomeFeaturesSection.js`](../../src/app/components/HomeFeaturesSection.js)
- [`src/app/components/Header.js`](../../src/app/components/Header.js)

Recommended changes:

- simplify homepage messaging around `Start Audit` and `Quick Check`
- add an output/report preview section
- reduce emphasis on internal product terminology
- make the comparison block more decision-light

### Audit setup / analyzer flow

Current files:

- [`src/app/analyze/page.js`](../../src/app/analyze/page.js)
- [`src/app/components/UrlAnalyzer.js`](../../src/app/components/UrlAnalyzer.js)
- [`src/app/components/LargeCrawlForm.js`](../../src/app/components/LargeCrawlForm.js)

Recommended changes:

- align labels between basic and smart flows
- guide the user with high-level choices first
- keep technical mode distinctions secondary

### Results / report flow

Current files:

- [`src/app/results/[jobId]/page.js`](../../src/app/results/[jobId]/page.js)
- [`src/app/components/ResultsTable.js`](../../src/app/components/ResultsTable.js)

Recommended changes:

- add a new executive-summary section at the top
- add a key-takeaways block
- add findings-by-priority blocks
- reposition the table as "Detailed Findings"
- preserve exports, but add report-style framing

### Global styling

Current file:

- [`src/app/globals.css`](../../src/app/globals.css)

Recommended changes:

- improve typography choices
- introduce reusable layout/report tokens
- support a more polished summary/report visual system

---

## 14. Suggested implementation phases

### Phase 1 - content and IA cleanup

- rename key user-facing labels
- simplify header and hero CTAs
- align language across landing, setup, and results

### Phase 2 - landing page redesign

- new hero framing
- output preview block
- simplified mode comparison
- stronger closing CTA

### Phase 3 - audit report redesign

- executive summary
- key takeaways
- findings by priority
- affected pages section
- detailed findings appendix

### Phase 4 - visual polish

- typography
- spacing
- hierarchy
- print/share readiness

---

## 15. Acceptance criteria

This redesign is successful when:

### IA / product clarity

- a new user can understand the difference between the main flows without learning internal
  product vocabulary
- the landing page leads users toward a recommended path instead of presenting two equally
  confusing choices

### Flow quality

- the setup flow explains what the user will get and how long it may take
- the progress experience feels informative, not opaque

### Report quality

- the results page can be understood by a non-technical manager in under a minute
- the top of the page answers:
  - how bad is it?
  - where is the problem?
  - what should we do next?
- the detailed table still exists for operational use

### Consistency

- labels are consistent across homepage, setup, progress, and results
- the visual hierarchy makes summary content feel more important than filters or raw data

---

## 16. Recommended next build tasks

Once this doc is approved, the next implementation tasks should be:

1. Create a landing-page redesign pass
2. Create a results-page report-first redesign pass
3. Introduce reusable report summary components
4. Add severity derivation helpers for summary messaging
5. Add a print/share-ready report header and export framing

This sequence keeps the work incremental while still moving the product toward the intended
audit-first experience.
