# 05 — Monetization & Competitive Landscape

**Priority:** P3 (strategy input — informs sequencing of Doc 04, requires no code by itself)
**Goal:** Record the pricing/business-model analysis (researched July 2026) so feature
sequencing decisions in Doc 04 can be made against it.

> **Important:** this doc contradicts the current product assumption. The README and
> Docs 01–03 treat the app as a **private, single-tenant internal tool** (Basic Auth,
> one trusted group). Charging money means becoming a public multi-tenant SaaS, which
> pulls in Doc 04 **F1** (real auth, per-user ownership), **F2** (API keys), and a
> billing integration. Going paid is a product pivot decision, not a feature.

---

## Recommendation

**Freemium, not fully paid.** A hard paywall is not viable — several established
competitors give one-off scans away free (Ahrefs' free checker, Dead Link Checker,
Broken Link Scan). The free tier *is* the marketing: free tools attract search
rankings and backlinks, which is the standard acquisition loop for SEO tooling.

The strongest argument **for** charging: crawling costs real money per scan (the code
already throttles concurrency/batch size for hosting-budget reasons), so a free-only
app scales costs with zero revenue. A paid tier doubles as cost control.

### Proposed tiers

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | One-off scans, page/link cap (~500 pages), basic SEO scores |
| **Paid** | ~$10–15/mo (undercuts Dr. Link Check) | Scheduled monitoring + email alerts (Doc 04 B1–B2), larger crawls, multiple sites, crawl history/trends (B3), CSV/API access (B6, F2), SEO differentiators (G4–G6) |

The paywall placement mirrors where Dead Link Checker and Dr. Link Check draw theirs:
**one-off scans are a commodity; people pay for recurring monitoring, limits, and
multi-site support.**

---

## Competitive landscape (July 2026)

Three tiers of competitor:

| Tool | Pricing | Positioning |
|------|---------|-------------|
| Dead Link Checker | Free scans; $9.95–$79.90/mo for automated monitoring | Dedicated, no-frills — closest analogue |
| Dr. Link Check | Free up to 1,500 links; $10–$159/mo | Dedicated, cloud, email reports |
| Broken Link Scan | Free on-demand scans; paid monitoring | Newer dedicated entrant |
| Screaming Frog | Free up to 500 URLs; £199/yr | Desktop crawler; pro standard |
| Ahrefs / Semrush | $99–$140/mo | Full SEO suites; link checking is one feature |
| Broken Link Checker (WP plugin) | ~$1.50/mo | WordPress-only |

Differentiation opportunities no dedicated competitor offers in a free/cheap tier:
broken-link **fix suggestions** (Doc 04 G6), **orphan page detection** (G4), and
combined link + SEO-health scoring in one report.

### Sources

- [Dr. Link Check pricing](https://www.drlinkcheck.com/pricing)
- [Dead Link Checker subscription plans](https://www.deadlinkchecker.com/automatic-broken-link-check.asp)
- [SecurityBot: automated link checker comparison](https://securitybot.dev/blog/best-automated-link-checker-tools)
- [Broken Link Scan: 2026 checker comparison](https://brokenlinkscan.com/blog/best-broken-link-checkers-2026/)
- [Software Testing Help: top 10 broken link checkers](https://www.softwaretestinghelp.com/broken-link-checker/)
- [Ahrefs broken link checker alternatives](https://bulkurlchecker.com/compare/ahrefs-broken-link-checker)

---

## Dependencies if/when this is pursued

1. **Doc 04 F1** — real auth & multi-user (replaces Basic Auth; per-user job ownership).
2. **Doc 04 B1–B3** — scheduling, alerts, history: the core of what the paid tier sells.
3. **Billing** — Stripe (or similar) subscription integration; usage metering against
   page/link caps (the crawler already counts pages per job).
4. **Doc 01 items become P0-blocking** — a public app cannot ship with the current
   rate-limiting and SSRF gaps.
5. **Site SEO basics** — meta description, OG tags, `robots.ts`, `sitemap.ts` in the
   app itself (currently missing from `src/app/layout.tsx`), since organic search is
   the acquisition channel this model depends on.
