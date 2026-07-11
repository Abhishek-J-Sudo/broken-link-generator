/**
 * Audit report derivation (docs/handoff/09-audit-report-spec.md).
 *
 * Pure functions: raw crawl output in, report model out. No React, no
 * fetching, no side effects — the report page calls buildReport() once and
 * renders the result. Every constant here is published in the report's
 * Methodology section; if you tune one, keep §Methodology copy in sync.
 */

// Same broken target on ≥ N distinct pages ⇒ it lives in a shared element
// (nav / footer / template) and one edit fixes every instance.
export const SHARED_SOURCE_THRESHOLD = 4;
// ≥ N broken links on one page ⇒ worth a page-cleanup task of its own.
const PAGE_CLUSTER_THRESHOLD = 3;
// ≥ N broken internal targets under one path prefix ⇒ a moved/renamed section.
const PATTERN_THRESHOLD = 3;
// ≥ N failing external links to one host ⇒ review that host once, not per link.
const HOST_THRESHOLD = 3;
// The results API counts links slower than this as "slow".
export const SLOW_MS = 5000;

// Severity weights for the Link Integrity score (doc 09 §5).
const CLASS_WEIGHTS = {
  internal: { '5xx': 4, '4xx': 2, timeout: 1.5, network: 1.5, blocked: 0.5, other: 1 },
  external: { '5xx': 0.5, '4xx': 0.5, timeout: 0.5, network: 0.5, blocked: 0.5, other: 0.5 },
};

// Sub-score blend for the overall health score (doc 09 §5).
const BLEND = { integrity: 0.7, response: 0.2, coverage: 0.1 };

export const CLASS_LABELS = {
  '4xx': 'Missing pages (4xx)',
  '5xx': 'Server errors (5xx)',
  timeout: 'Timeouts',
  network: 'SSL / network failures',
  blocked: 'Blocked by robots.txt',
  other: 'Other failures',
};

export const CLASS_SHORT = {
  '4xx': '4xx',
  '5xx': '5xx',
  timeout: 'Timeout',
  network: 'Net/SSL',
  blocked: 'Blocked',
  other: 'Other',
};

export const SEVERITY_ORDER = ['critical', 'major', 'minor'];

export function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function pathOf(url) {
  try {
    const u = new URL(url);
    return u.pathname === '/' && !u.search ? u.hostname : u.pathname + u.search;
  } catch {
    return url;
  }
}

/** Scheme-less display form: host + path, so external URLs keep their host. */
export function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname === '/' ? '' : u.pathname) + u.search;
  } catch {
    return url;
  }
}

/** Failure class of a broken finding: 4xx / 5xx / timeout / network / blocked / other. */
export function classifyFinding(link) {
  const type = link.error_type || '';
  if (type === 'timeout') return 'timeout';
  if (type === 'ssl_error' || type === 'dns_error' || type === 'connection_error')
    return 'network';
  if (type === 'robots_blocked' || type === 'security_blocked') return 'blocked';
  const code = link.http_status_code;
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code == null) return 'network';
  return 'other';
}

/**
 * Severity per finding (doc 09 §6). "Shared" targets (broken in a nav/footer/
 * template element) escalate because they hit every page that renders them.
 */
export function deriveSeverity(cls, isInternal, isShared) {
  if (cls === 'blocked') return 'minor';
  if (isInternal && cls === '5xx') return 'critical';
  if (isInternal && isShared) return 'critical';
  if (isInternal) return 'major';
  if (isShared) return 'major';
  return 'minor';
}

export function weightOf(cls, isInternal) {
  return CLASS_WEIGHTS[isInternal ? 'internal' : 'external'][cls] || 0.5;
}

/** One-line fix guidance per failure class, used in the appendix + priority blocks. */
export function actionForClass(cls, isInternal) {
  switch (cls) {
    case '5xx':
      return isInternal
        ? 'Investigate the server error — check application logs for this route.'
        : 'The external site is erroring; replace the link or wait it out.';
    case '4xx':
      return isInternal
        ? 'Restore the page or 301-redirect the URL to its replacement.'
        : 'The external page is gone — update or remove the reference.';
    case 'timeout':
      return isInternal
        ? 'The page responds too slowly — profile it or raise capacity.'
        : 'The external host is slow or unreachable; consider replacing the link.';
    case 'network':
      return 'Check DNS, TLS certificate, and connectivity for the target host.';
    case 'blocked':
      return 'The target forbids automated checks — verify it manually once.';
    default:
      return 'Verify the link manually and update or remove it.';
  }
}

function gradeOf(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function linkIntegrityScore(weightedBroken, totalChecked) {
  if (!totalChecked) return 100;
  return Math.round(100 * (1 - Math.min(1, weightedBroken / (totalChecked * 0.5))));
}

const EFFORT_RANK = { XS: 1, S: 2, M: 3, L: 4 };

/**
 * Build the full report model.
 *
 * @param {object} args
 * @param {object} args.job      status payload (/api/crawl/status) — stats, settings, timestamps
 * @param {object} args.summary  summary block from /api/results — totals, performance
 * @param {Array}  args.findings broken rows from /api/results (statusFilter=broken)
 */
export function buildReport({ job, summary, findings }) {
  const totalChecked = summary?.totalLinksChecked || 0;
  const totalDiscovered = job?.stats?.totalLinksDiscovered || totalChecked;
  const healthy = summary?.workingLinks || 0;

  // ── Normalize findings and detect shared-element targets ──────────────
  const bySources = new Map(); // target url -> Set(source pages)
  for (const f of findings) {
    if (!bySources.has(f.url)) bySources.set(f.url, new Set());
    bySources.get(f.url).add(f.source_url || 'Discovery');
  }
  const sharedTargets = new Set(
    [...bySources.entries()]
      .filter(([, sources]) => sources.size >= SHARED_SOURCE_THRESHOLD)
      .map(([url]) => url)
  );

  const items = findings.map((f) => {
    const cls = classifyFinding(f);
    const isInternal = !!f.is_internal;
    const isShared = sharedTargets.has(f.url);
    return {
      url: f.url,
      sourceUrl: f.source_url || 'Discovery',
      isInternal,
      statusCode: f.http_status_code,
      responseTime: f.response_time,
      errorType: f.error_type,
      errorMessage: f.error_message,
      linkText: f.link_text,
      cls,
      isShared,
      severity: deriveSeverity(cls, isInternal, isShared),
      weight: weightOf(cls, isInternal),
    };
  });

  const issues = items.length;
  const internalIssues = items.filter((i) => i.isInternal).length;
  const externalIssues = issues - internalIssues;

  // ── Category matrix (§6 findings by category) ─────────────────────────
  const categories = Object.keys(CLASS_LABELS)
    .map((cls) => {
      const rows = items.filter((i) => i.cls === cls);
      return {
        cls,
        label: CLASS_LABELS[cls],
        internal: rows.filter((i) => i.isInternal).length,
        external: rows.filter((i) => !i.isInternal).length,
        total: rows.length,
        example: rows[0]?.url || null,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // ── Severity blocks (§5 findings by priority) ─────────────────────────
  const bySeverity = SEVERITY_ORDER.map((severity) => {
    const rows = items.filter((i) => i.severity === severity);
    const groups = Object.keys(CLASS_LABELS)
      .map((cls) => {
        const inClass = rows.filter((i) => i.cls === cls);
        if (!inClass.length) return null;
        const internal = inClass.filter((i) => i.isInternal).length;
        return {
          cls,
          label: CLASS_LABELS[cls],
          count: inClass.length,
          internal,
          external: inClass.length - internal,
          example: inClass[0].url,
          action: actionForClass(cls, internal >= inClass.length - internal),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);
    return { severity, count: rows.length, groups };
  });

  // ── Affected pages (§7) ───────────────────────────────────────────────
  const pageMap = new Map();
  for (const item of items) {
    if (!pageMap.has(item.sourceUrl)) pageMap.set(item.sourceUrl, []);
    pageMap.get(item.sourceUrl).push(item);
  }
  const affectedPages = [...pageMap.entries()]
    .map(([page, rows]) => ({
      page,
      count: rows.length,
      worstSeverity: SEVERITY_ORDER.find((s) => rows.some((r) => r.severity === s)) || 'minor',
      classes: [...new Set(rows.map((r) => r.cls))],
    }))
    .sort((a, b) => b.count - a.count);

  // ── Scores (§5) ───────────────────────────────────────────────────────
  const weightedBroken = items.reduce((sum, i) => sum + i.weight, 0);
  const integrity = linkIntegrityScore(weightedBroken, totalChecked);
  const slowLinks = summary?.performance?.slowLinks || 0;
  const slowShare = totalChecked ? slowLinks / totalChecked : 0;
  const response = Math.round(100 * (1 - Math.min(1, slowShare / 0.25)));
  const coverage = totalDiscovered
    ? Math.min(100, Math.round((100 * totalChecked) / totalDiscovered))
    : 100;
  const overall = Math.round(
    integrity * BLEND.integrity + response * BLEND.response + coverage * BLEND.coverage
  );
  const score = { integrity, response, coverage, overall, grade: gradeOf(overall) };

  // ── Remediation tasks (§8) — each finding lands in exactly one task ────
  const claimed = new Set();
  const tasks = [];
  const claim = (rows) => rows.forEach((r) => claimed.add(r));
  const gainOf = (rows) => {
    const removed = rows.reduce((sum, r) => sum + r.weight, 0);
    const after = linkIntegrityScore(weightedBroken - removed, totalChecked);
    return Math.max(0, Math.round((after - integrity) * BLEND.integrity));
  };

  // 1 · shared-element groups — one edit fixes every instance
  for (const target of sharedTargets) {
    const rows = items.filter((i) => i.url === target && !claimed.has(i));
    if (!rows.length) continue;
    claim(rows);
    tasks.push({
      kind: 'shared',
      action: `Fix the shared link to ${shortUrl(target)}`,
      detail: `Broken on ${bySources.get(target).size} pages — it lives in a nav, footer, or template. One edit resolves all ${rows.length} instances.`,
      owner: rows[0].isInternal ? 'Dev / Web ops' : 'Content',
      effort: 'XS',
      instances: rows.length,
      impact: rows.reduce((s, r) => s + r.weight, 0),
      gain: gainOf(rows),
      search: target,
    });
  }

  // 2 · page clusters — clean up one page at a time
  for (const { page, count } of affectedPages) {
    const rows = pageMap.get(page).filter((i) => !claimed.has(i));
    if (rows.length < PAGE_CLUSTER_THRESHOLD || count < PAGE_CLUSTER_THRESHOLD) continue;
    claim(rows);
    tasks.push({
      kind: 'page',
      action: `Clean up broken links on ${pathOf(page)}`,
      detail: `${rows.length} broken links on this one page — fix them in a single editing pass.`,
      owner: 'Content / Editorial',
      effort: 'S',
      instances: rows.length,
      impact: rows.reduce((s, r) => s + r.weight, 0),
      gain: gainOf(rows),
      search: null,
    });
  }

  // 3 · target-pattern groups — a moved or renamed internal section
  const prefixMap = new Map();
  for (const item of items) {
    if (claimed.has(item) || !item.isInternal) continue;
    let prefix;
    try {
      prefix = new URL(item.url).pathname.split('/')[1] || '';
    } catch {
      continue;
    }
    if (!prefix) continue;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix).push(item);
  }
  for (const [prefix, rows] of prefixMap) {
    if (new Set(rows.map((r) => r.url)).size < PATTERN_THRESHOLD) continue;
    claim(rows);
    tasks.push({
      kind: 'pattern',
      action: `Restore or redirect the /${prefix}/ section`,
      detail: `${new Set(rows.map((r) => r.url)).size} broken URLs share this path — the section was likely moved or renamed. Add redirects from the old paths.`,
      owner: 'Dev / Web ops',
      effort: 'M',
      instances: rows.length,
      impact: rows.reduce((s, r) => s + r.weight, 0),
      gain: gainOf(rows),
      search: `/${prefix}/`,
    });
  }

  // 4 · external host groups — one failing host, one review
  const hostMap = new Map();
  for (const item of items) {
    if (claimed.has(item) || item.isInternal) continue;
    const host = hostnameOf(item.url);
    if (!hostMap.has(host)) hostMap.set(host, []);
    hostMap.get(host).push(item);
  }
  for (const [host, rows] of hostMap) {
    if (rows.length < HOST_THRESHOLD) continue;
    claim(rows);
    tasks.push({
      kind: 'host',
      action: `Review links to ${host}`,
      detail: `${rows.length} links to this host are failing — check whether the site moved, died, or blocks robots.`,
      owner: 'Content / Editorial',
      effort: 'S',
      instances: rows.length,
      impact: rows.reduce((s, r) => s + r.weight, 0),
      gain: gainOf(rows),
      search: host,
    });
  }

  // 5 · the remainder — isolated one-off fixes
  const residual = items.filter((i) => !claimed.has(i));
  if (residual.length) {
    tasks.push({
      kind: 'residual',
      action: `Fix the remaining ${residual.length} isolated broken link${
        residual.length === 1 ? '' : 's'
      }`,
      detail:
        'One-off failures with no shared cause — work through them in the evidence appendix.',
      owner: 'Content / Editorial',
      effort: residual.length > 10 ? 'M' : 'S',
      instances: residual.length,
      impact: residual.reduce((s, r) => s + r.weight, 0),
      gain: gainOf(residual),
      search: null,
    });
  }

  tasks.sort((a, b) => b.impact / EFFORT_RANK[b.effort] - a.impact / EFFORT_RANK[a.effort]);
  tasks.forEach((t, i) => {
    t.rank = i + 1;
  });

  const quickWins = tasks
    .filter((t) => (t.effort === 'XS' || t.effort === 'S') && t.kind !== 'residual')
    .slice(0, 6);

  // ── Key takeaways (§3) — plain-language, rule-generated ────────────────
  const takeaways = [];
  if (!issues) {
    takeaways.push(
      `All ${totalChecked.toLocaleString()} checked URLs are working — no broken links found.`
    );
  } else {
    const topShared = tasks.find((t) => t.kind === 'shared');
    if (topShared) {
      takeaways.push(
        `A single broken link in a shared element accounts for ${topShared.instances} of the ${issues} instances — one edit fixes ${Math.round(
          (100 * topShared.instances) / issues
        )}% of the problem.`
      );
    }
    const topPages = affectedPages.slice(0, 3);
    const topPagesCount = topPages.reduce((s, p) => s + p.count, 0);
    if (affectedPages.length > 3 && topPagesCount / issues >= 0.5) {
      takeaways.push(
        `${Math.round((100 * topPagesCount) / issues)}% of broken links come from just ${
          topPages.length
        } pages — fixing page by page pays off quickly.`
      );
    }
    if (internalIssues > externalIssues) {
      takeaways.push(
        `Most issues (${internalIssues} of ${issues}) are site-owned internal links — fully fixable without depending on third parties.`
      );
    } else if (externalIssues > internalIssues) {
      takeaways.push(
        `Most issues (${externalIssues} of ${issues}) are external references — lower priority than site-owned problems, but they erode trust.`
      );
    }
    const has5xx = items.some((i) => i.cls === '5xx' && i.isInternal);
    if (!has5xx) {
      takeaways.push(
        'No internal server errors (5xx) — the issues are missing pages, not infrastructure.'
      );
    } else {
      takeaways.push(
        `${items.filter((i) => i.cls === '5xx' && i.isInternal).length} internal server error${
          items.filter((i) => i.cls === '5xx' && i.isInternal).length === 1 ? '' : 's'
        } (5xx) need engineering attention first — they break pages outright.`
      );
    }
  }
  if (slowShare > 0.05) {
    takeaways.push(
      `${slowLinks} links respond slower than ${SLOW_MS / 1000}s — worth a performance look even where they technically work.`
    );
  }
  if (coverage < 95) {
    takeaways.push(
      `The audit covered ${coverage}% of discovered links${
        job?.status === 'stopped' ? ' before it was stopped' : ''
      } — treat the findings as a floor, not a ceiling.`
    );
  }

  // ── One-line verdict (§2) ─────────────────────────────────────────────
  const gradeWord =
    { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' }[score.grade] || 'Fair';
  const dominant = categories[0];
  const verdict = !issues
    ? `${gradeWord} link health (${score.overall}/100, grade ${score.grade}). All ${totalChecked.toLocaleString()} checked URLs resolve — keep the cadence and re-audit after the next content push.`
    : `${gradeWord} link health (${score.overall}/100, grade ${score.grade}). ${issues} link issue${
        issues === 1 ? '' : 's'
      }, mostly ${dominant.label.toLowerCase()}${
        internalIssues >= externalIssues ? ' on site-owned links' : ' in external references'
      } — ${
        tasks.length
          ? `the top ${Math.min(tasks.length, 3)} tasks resolve ${Math.round(
              (100 *
                tasks.slice(0, 3).reduce((s, t) => s + t.instances, 0)) /
                issues
            )}% of instances.`
          : 'see the remediation plan.'
      }`;

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalChecked,
      totalDiscovered,
      healthy,
      issues,
      internalIssues,
      externalIssues,
      affectedPages: affectedPages.length,
      pagesAnalyzed: summary?.pagesAnalyzed || 0,
      avgResponse: summary?.performance?.averageResponseTime || 0,
      slowLinks,
    },
    score,
    verdict,
    takeaways: takeaways.slice(0, 5),
    quickWins,
    bySeverity,
    categories,
    affectedPages,
    tasks,
    sharedTargets: [...sharedTargets],
  };
}
