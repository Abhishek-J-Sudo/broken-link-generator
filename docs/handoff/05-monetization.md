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

## Session decisions — July 2026

These conclusions were reached after reviewing competitor data, unit economics, and
agency usage patterns. They supersede the provisional ranges in the sections below.

### Pricing confirmed

| Tier | Audits/month | Price | Target |
|------|-------------|-------|--------|
| **Free** | 3 | $0 | Solo user evaluating |
| **Starter** | 15 | $9/mo | Small agency (5–10 clients, monthly spot-checks) |
| **Pro** | Unlimited | $15/mo | Larger agency or active reseller |

**Why 3 free audits:** enough to evaluate the full product (AI narrative included —
they must see it to want it), not enough to rely on week to week.
**Why the $9 middle tier:** data shows small agencies run 10–15 audits/month.
Serving that use case at $9 avoids forcing them to $15 for headroom they don't need,
and makes the upsell a small ask when they grow.
**Why $15 not higher:** SEOdiag (closest direct competitor, also AI-powered) charges
$29/mo. Undercutting on price while matching or beating on report quality is the
primary acquisition wedge.

### Unit economics (at $25/mo fixed infra)

| Users | Revenue | Infra | AI cost | Profit |
|-------|---------|-------|---------|--------|
| 2 | $30 | $25 | ~$0.05 | $4.95 |
| 10 | $150 | $25 | ~$0.25 | $124.75 |
| 50 | $750 | $25 | ~$1.25 | $723.75 |

Break-even is 2 paying users. AI costs (DeepSeek narrative call ~$0.000189/audit)
are negligible at realistic usage volumes. Infra is the only fixed cost.

### Abuse mitigation

Multi-account abuse on free tier is a real risk. Mitigation: require Google or GitHub
OAuth on signup (no throwaway emails). This is sufficient at this scale — do not
over-engineer rate limiting until there is evidence of actual abuse.

### AI narrative as differentiator

The large platforms (Ahrefs, Semrush) have AI but it is focused on keyword and
content suggestions, not written audit narrative summaries. Cheap dedicated tools
($0–$5) have no AI at all. The written narrative is a genuine differentiator in the
$9–$15 bracket and is also a direct sales hook for agencies: it produces a
client-ready summary they can forward without editing.

### The product's real pitch

> "The audit is the feature. The report is the product."

Screaming Frog exports a spreadsheet. SEOdiag generates a PDF. If this tool produces
a polished, shareable report an agency can send to a client and look competent — that
is the reason someone pays $12–$15/mo, not the feature list.

---

## Recommendation

**Freemium, not fully paid.** A hard paywall is not viable — several established
competitors give one-off scans away free (Ahrefs' free checker, Dead Link Checker,
Broken Link Scan). The free tier *is* the marketing: free tools attract search
rankings and backlinks, which is the standard acquisition loop for SEO tooling.

The strongest argument **for** charging: crawling costs real money per scan (the code
already throttles concurrency/batch size for hosting-budget reasons), so a free-only
app scales costs with zero revenue. A paid tier doubles as cost control.

### Proposed tiers (original — superseded by session decisions above)

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

| Tool | Pricing | AI? | Notes |
|------|---------|-----|-------|
| **SEOdiag** | ~$29/mo | Yes (Claude AI) | Closest direct competitor — AI narrative + PDF reports |
| Dead Link Checker | Free; $9.95–$79.90/mo monitoring | No | No-frills, dedicated |
| Dr. Link Check | Free up to 1,500 links; $10–$159/mo | No | Cloud, email reports |
| SecurityBot | $5/mo | No | Built for indie hackers |
| SE Ranking | $52/mo | Partial | All-in-one budget SEO suite |
| Broken Link Scan | Free on-demand; paid monitoring | No | Newer entrant |
| Screaming Frog | Free up to 500 URLs; £199/yr | No | Desktop, deepest technical crawl |
| Ahrefs / Semrush | $99–$140/mo | Yes (keywords/content only) | Full suites; AI not audit-narrative focused |
| Broken Link Checker (WP plugin) | ~$1.50/mo | No | WordPress-only |

**Key finding:** there is a clear pricing gap between $5 (no AI) and $29 (AI but
expensive). The $9–$15 bracket with AI narrative and a polished shareable report is
unoccupied. SEOdiag is the only comparable product and they are priced above the gap.

**On competitor AI:** Ahrefs and Semrush shipped AI in 2024–2025 but it targets
keyword suggestions and content scoring — not written audit summaries. The cheap
dedicated tools have no AI at all. This is not as crowded as assumed.

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
