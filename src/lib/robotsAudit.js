// src/lib/robotsAudit.js - robots.txt audit for SEO reporting (doc 04 G15)
//
// Distinct from securityUtils.checkRobotsTxt (crawl *politeness* for our own bot):
// this module answers "would Google be allowed to crawl this page?" so the report
// can flag pages that are invisible to search regardless of their on-page SEO.
// Rules are fetched once per crawl job and matched per checked URL.

import { safeFetch } from './safeFetch.js';

// Googlebot ignores generic groups when a specific one exists, so we audit
// against the 'googlebot' group if present, falling back to '*'.
const AUDIT_AGENTS = ['googlebot', '*'];

/**
 * Fetch and parse robots.txt for the site a crawl job targets.
 * Returns null when the audit cannot run (bad URL, network failure) —
 * callers treat null as "no robots signal", never as an error.
 */
export async function loadRobotsRules(siteUrl) {
  let origin;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return null;
  }

  try {
    const res = await safeFetch(`${origin}/robots.txt`, {
      timeout: 8000,
      maxRedirects: 2,
      readBody: true,
    });

    // Google treats 4xx as "no restrictions"; 5xx/unreachable as unknown.
    if (res.status >= 500) return null;
    if (res.status !== 200) return { origin, hasRobotsTxt: false, groups: {} };

    const text = await res.text();
    return { origin, hasRobotsTxt: true, groups: parseRobotsGroups(text || '') };
  } catch {
    return null;
  }
}

/**
 * Parse robots.txt into { agentName: [{ type: 'allow'|'disallow', path }] }.
 * A group is one or more consecutive user-agent lines followed by rules;
 * repeated groups for the same agent are merged.
 */
export function parseRobotsGroups(text) {
  const groups = {};
  let currentAgents = [];
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      if (lastLineWasAgent) {
        currentAgents.push(agent);
      } else {
        currentAgents = [agent];
      }
      lastLineWasAgent = true;
      for (const a of currentAgents) {
        if (!groups[a]) groups[a] = [];
      }
    } else if (field === 'allow' || field === 'disallow') {
      lastLineWasAgent = false;
      // An empty Disallow means "allow everything" — no rule to record.
      if (!value) continue;
      for (const a of currentAgents) {
        if (!groups[a]) groups[a] = [];
        groups[a].push({ type: field, path: value });
      }
    } else {
      // sitemap, crawl-delay, etc. end the user-agent run but not the group
      lastLineWasAgent = false;
    }
  }

  return groups;
}

/**
 * Check one URL against loaded rules.
 * Returns { checked, agent, disallowed, matchedRule } or null when the
 * rules don't apply (different origin, no rules loaded).
 */
export function evaluateRobots(rules, url) {
  if (!rules || !rules.groups) return null;

  let target;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  if (target.origin !== rules.origin) return null;

  if (!rules.hasRobotsTxt) {
    return { checked: true, agent: null, disallowed: false, matchedRule: null };
  }

  const agent = AUDIT_AGENTS.find((a) => rules.groups[a]);
  if (!agent) {
    return { checked: true, agent: null, disallowed: false, matchedRule: null };
  }

  const path = target.pathname + target.search;

  // Google semantics: longest matching rule wins; allow wins length ties.
  let best = null;
  for (const rule of rules.groups[agent]) {
    if (!patternMatches(rule.path, path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.type === 'allow' && best.type === 'disallow')
    ) {
      best = rule;
    }
  }

  const disallowed = best?.type === 'disallow';
  return {
    checked: true,
    agent,
    disallowed,
    matchedRule: disallowed ? best.path : null,
  };
}

/**
 * robots.txt pattern match: '*' wildcard, '$' end anchor, prefix match otherwise.
 */
function patternMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}
