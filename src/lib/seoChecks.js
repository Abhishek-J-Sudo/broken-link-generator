/**
 * Issue-centric SEO check derivation for the fix-list report.
 *
 * Pure functions: seo_analysis rows (as served by the share/results APIs) in,
 * check groups out. Every deduction in seoDetector.calculateSEOScore() appears
 * here as a named check with the same trigger condition, so the fix list
 * always reconciles with the stored per-page scores. Unscored observations
 * (Twitter card, missing date signals) are marked severity 'notice'.
 *
 * evaluate(page) contract:
 *   null / undefined  → pass
 *   'na'              → not measured for this page (missing signal data,
 *                        superseded by a stronger failure, or not applicable)
 *   string            → fail; the string is the measured value shown to the team
 */

export const SEO_SEVERITY_ORDER = ['critical', 'major', 'warning', 'minor', 'notice'];

const altCoverage = (p) =>
  p.total_images > 0
    ? Math.round(((p.total_images - p.missing_alt) / p.total_images) * 100)
    : 100;

const sig = (p) => p.signals || {};

export const SEO_CHECK_CATEGORIES = [
  {
    key: 'meta',
    label: 'Meta & canonical',
    checks: [
      {
        id: 'missing-title',
        label: 'Missing page title',
        severity: 'critical',
        hint: 'Write a unique, descriptive <title> of 50–60 characters.',
        evaluate: (p) => (!p.title_text ? 'no <title> found' : null),
      },
      {
        id: 'title-too-long',
        label: 'Title too long (>60 chars)',
        severity: 'warning',
        hint: 'Google truncates titles past ~60 characters — trim to the essential phrase.',
        evaluate: (p) =>
          !p.title_text ? 'na' : p.title_length > 60 ? `${p.title_length} chars` : null,
      },
      {
        id: 'title-too-short',
        label: 'Title too short (<50 chars)',
        severity: 'warning',
        hint: 'Short titles waste SERP space — expand toward 50–60 characters with real keywords.',
        evaluate: (p) =>
          !p.title_text
            ? 'na'
            : p.title_length <= 60 && p.title_length < 50
              ? `${p.title_length} chars`
              : null,
      },
      {
        id: 'missing-description',
        label: 'Missing meta description',
        severity: 'major',
        hint: 'Add a meta description of 150–160 characters — it is your SERP sales copy.',
        evaluate: (p) => (!p.meta_description ? 'no meta description' : null),
      },
      {
        id: 'description-too-long',
        label: 'Meta description too long (>160 chars)',
        severity: 'warning',
        hint: 'Trim to ~155 characters so it is not cut off in results.',
        evaluate: (p) =>
          !p.meta_description
            ? 'na'
            : p.description_length > 160
              ? `${p.description_length} chars`
              : null,
      },
      {
        id: 'description-too-short',
        label: 'Meta description too short (<150 chars)',
        severity: 'minor',
        hint: 'Use the full 150–160 character budget to earn the click.',
        evaluate: (p) =>
          !p.meta_description
            ? 'na'
            : p.description_length <= 160 && p.description_length < 150
              ? `${p.description_length} chars`
              : null,
      },
      {
        id: 'missing-canonical',
        label: 'Missing canonical URL',
        severity: 'minor',
        hint: 'Add <link rel="canonical"> so duplicate URLs consolidate ranking signals.',
        evaluate: (p) => (!p.canonical_url ? 'not declared' : null),
      },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    checks: [
      {
        id: 'low-word-count',
        label: 'Low content word count (<200 words)',
        severity: 'warning',
        hint: 'Thin pages rarely rank — expand the copy or merge the page into a stronger one.',
        evaluate: (p) =>
          p.word_count < 200 ? `${p.word_count} words in first 50KB` : null,
      },
      {
        id: 'images-missing-alt',
        label: 'Images missing alt text (<80% coverage)',
        severity: 'warning',
        hint: 'Add alt attributes — empty alt="" is fine for decorative images.',
        evaluate: (p) =>
          p.total_images > 0
            ? altCoverage(p) < 80
              ? `${p.missing_alt} of ${p.total_images} images without alt`
              : null
            : 'na',
      },
      {
        id: 'slow-page',
        label: 'Slow page response (>3s)',
        severity: 'warning',
        hint: 'Profile the page or its hosting — slow responses hurt crawl budget and users.',
        evaluate: (p) =>
          p.response_time == null
            ? 'na'
            : p.response_time > 3000
              ? `${(p.response_time / 1000).toFixed(1)} s`
              : null,
      },
    ],
  },
  {
    key: 'structure',
    label: 'Structure & fundamentals',
    checks: [
      {
        id: 'missing-h1',
        label: 'Missing H1 tag',
        severity: 'major',
        hint: 'Give the page one clear H1 that states its topic.',
        evaluate: (p) => (p.h1_count === 0 ? 'no H1 found' : null),
      },
      {
        id: 'skipped-heading-level',
        label: 'Skipped heading level in outline',
        severity: 'warning',
        hint: 'Keep heading levels sequential (H2 before H4) so the document outline parses.',
        evaluate: (p) =>
          sig(p).headings ? sig(p).headings.skippedLevels || null : 'na',
      },
      {
        id: 'headings-before-h1',
        label: 'Headings appear before the first H1',
        severity: 'minor',
        hint: 'Move the H1 to the top of the heading outline.',
        evaluate: (p) =>
          !sig(p).headings
            ? 'na'
            : p.h1_count > 0 && sig(p).headings.headingsBeforeH1
              ? `outline starts at ${sig(p).headings.firstHeading}`
              : null,
      },
      {
        id: 'invalid-structured-data',
        label: 'JSON-LD block fails to parse',
        severity: 'warning',
        hint: 'Validate the JSON-LD (search.google.com/test/rich-results) and fix the syntax.',
        evaluate: (p) =>
          !sig(p).structuredData
            ? 'na'
            : sig(p).structuredData.invalidBlocks > 0
              ? `${sig(p).structuredData.invalidBlocks} unparseable block(s)`
              : null,
      },
      {
        id: 'no-structured-data',
        label: 'No structured data (JSON-LD)',
        severity: 'minor',
        hint: 'Add Organization/Article/Product JSON-LD to become eligible for rich results.',
        evaluate: (p) =>
          !sig(p).structuredData
            ? 'na'
            : !sig(p).structuredData.hasStructuredData &&
                sig(p).structuredData.invalidBlocks === 0
              ? 'none found'
              : null,
      },
      {
        id: 'missing-lang',
        label: 'Missing lang attribute on <html>',
        severity: 'minor',
        hint: 'Set <html lang="…"> so search engines and screen readers know the language.',
        evaluate: (p) =>
          !sig(p).fundamentals ? 'na' : !sig(p).fundamentals.htmlLang ? 'not set' : null,
      },
      {
        id: 'missing-viewport',
        label: 'Missing viewport meta tag',
        severity: 'warning',
        hint: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
        evaluate: (p) =>
          !sig(p).fundamentals ? 'na' : !sig(p).fundamentals.hasViewport ? 'not set' : null,
      },
      {
        id: 'url-quality',
        label: 'URL quality (length / underscores)',
        severity: 'minor',
        hint: 'Prefer short hyphenated URLs; fix at the next restructure, not with redirects alone.',
        evaluate: (p) => {
          const f = sig(p).fundamentals;
          if (!f) return 'na';
          const problems = [];
          if (f.urlTooLong) problems.push(`${f.urlLength} chars`);
          if (f.urlHasUnderscores) problems.push('underscores');
          return problems.length ? problems.join(', ') : null;
        },
      },
      {
        id: 'not-https',
        label: 'Not served over HTTPS',
        severity: 'major',
        hint: 'Serve every page over HTTPS and 301 the HTTP version.',
        evaluate: (p) => (p.url?.startsWith('https://') ? null : 'http:// URL'),
      },
    ],
  },
  {
    key: 'indexability',
    label: 'Indexability',
    checks: [
      {
        id: 'noindexed',
        label: 'Page is noindexed',
        severity: 'critical',
        hint: 'Remove the noindex directive unless the page is deliberately hidden from search.',
        evaluate: (p) =>
          !sig(p).robots
            ? 'na'
            : sig(p).robots.noindex
              ? `via ${sig(p).robots.noindexSource}`
              : null,
      },
      {
        id: 'robots-blocked',
        label: 'Blocked by robots.txt',
        severity: 'critical',
        hint: 'Remove or narrow the Disallow rule — blocked pages cannot be crawled at all.',
        evaluate: (p) =>
          !sig(p).robotsTxt || sig(p).robotsTxt.checked === false
            ? 'na'
            : sig(p).robotsTxt.disallowed
              ? `rule "${sig(p).robotsTxt.matchedRule}"`
              : null,
      },
    ],
  },
  {
    key: 'social',
    label: 'Social preview',
    checks: [
      {
        id: 'no-open-graph',
        label: 'No Open Graph tags',
        severity: 'minor',
        hint: 'Add og:title, og:description and og:image so shared links render real previews.',
        evaluate: (p) =>
          !sig(p).social ? 'na' : !sig(p).social.hasOpenGraph ? 'no og: tags' : null,
      },
      {
        id: 'incomplete-open-graph',
        label: 'Incomplete Open Graph tags',
        severity: 'minor',
        hint: 'Complete the missing og: properties for full link previews.',
        evaluate: (p) =>
          !sig(p).social
            ? 'na'
            : sig(p).social.hasOpenGraph && sig(p).social.missingOpenGraph?.length > 0
              ? `missing ${sig(p).social.missingOpenGraph.join(', ')}`
              : null,
      },
      {
        id: 'no-twitter-card',
        label: 'No Twitter/X card (not scored)',
        severity: 'notice',
        hint: 'Add twitter:card (summary_large_image) for richer shares on X.',
        evaluate: (p) =>
          !sig(p).social ? 'na' : !sig(p).social.hasTwitterCard ? 'no twitter:card' : null,
      },
    ],
  },
  {
    key: 'freshness',
    label: 'Freshness',
    checks: [
      {
        id: 'stale-content',
        label: 'Content not updated in over 12 months',
        severity: 'minor',
        hint: 'Review, update, and bump the modified date — or archive the page.',
        evaluate: (p) =>
          !sig(p).freshness
            ? 'na'
            : sig(p).freshness.isStale
              ? `~${sig(p).freshness.ageMonths} months since last signal`
              : null,
      },
      {
        id: 'no-date-signals',
        label: 'No date signals found (not scored)',
        severity: 'notice',
        hint: 'Expose article:published_time / dateModified so freshness can be assessed.',
        evaluate: (p) =>
          !sig(p).freshness
            ? 'na'
            : sig(p).freshness.ageMonths == null
              ? 'no published/modified dates'
              : null,
      },
    ],
  },
];

const severityRank = (s) => {
  const i = SEO_SEVERITY_ORDER.indexOf(s);
  return i === -1 ? SEO_SEVERITY_ORDER.length : i;
};

/**
 * Run every check against every page.
 *
 * Returns { categories, totals }:
 *   categories[].checks[] — { id, label, severity, hint, affected: [{url, value}],
 *                             passCount, naCount, status: 'fail'|'pass'|'na' }
 *   Failed checks are ordered severity-first within their category.
 *   totals — { issues (scored fails), notices, pagesWithIssues, pagesMeasured }
 */
export function buildSeoFixList(pages = []) {
  const pagesWithIssues = new Set();
  const pageIssueCounts = new Map(); // url -> scored fail count (current rules)
  let issues = 0;
  let notices = 0;

  const categories = SEO_CHECK_CATEGORIES.map((cat) => {
    const checks = cat.checks.map((check) => {
      const affected = [];
      let naCount = 0;
      for (const page of pages) {
        const result = check.evaluate(page);
        if (result === 'na') naCount++;
        else if (typeof result === 'string') affected.push({ url: page.url, value: result });
      }
      if (affected.length > 0) {
        if (check.severity === 'notice') notices += affected.length;
        else {
          issues += affected.length;
          affected.forEach((a) => {
            pagesWithIssues.add(a.url);
            pageIssueCounts.set(a.url, (pageIssueCounts.get(a.url) || 0) + 1);
          });
        }
      }
      return {
        id: check.id,
        label: check.label,
        severity: check.severity,
        hint: check.hint,
        affected,
        naCount,
        passCount: pages.length - affected.length - naCount,
        status: affected.length > 0 ? 'fail' : naCount === pages.length ? 'na' : 'pass',
      };
    });

    checks.sort((a, b) => {
      if (a.status !== b.status) {
        const order = { fail: 0, pass: 1, na: 2 };
        return order[a.status] - order[b.status];
      }
      if (a.status === 'fail' && a.severity !== b.severity)
        return severityRank(a.severity) - severityRank(b.severity);
      return 0;
    });

    return { key: cat.key, label: cat.label, checks };
  });

  return {
    categories,
    pageIssueCounts,
    totals: {
      issues,
      notices,
      pagesWithIssues: pagesWithIssues.size,
      pagesMeasured: pages.length,
    },
  };
}
