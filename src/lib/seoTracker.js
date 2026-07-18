/**
 * SEO Fix Tracker model — the single source of truth for turning a completed
 * audit's SEO analysis into an ordered, trackable work list.
 *
 * The fix-list page (on-screen board) and the CSV export both build their rows
 * from buildSeoTrackerRows() so they always agree. buildSeoFixList() already
 * knows every check; here we flatten it to one row per (issue × affected page),
 * drop the unscored "notice" observations, and attach:
 *   - issueId: human reference shown in the UI/CSV (SEO-001, SEO-002, …)
 *   - key:     stable persistence key (checkId::url) the team's edits hang off,
 *              so a saved Status/Owner stays attached even if ordering changes.
 */

import { buildSeoFixList } from './seoChecks.js';

// Team-editable fields (everything else on a row is derived from the audit).
export const TRACKER_FIELDS = [
  'priority',
  'status',
  'owner',
  'targetDate',
  'fixedDate',
  'validationStatus',
  'notes',
  'evidence',
];

// Dropdown options. '' is the unset/default choice for the pick-lists.
export const PRIORITY_OPTIONS = ['', 'High', 'Medium', 'Low'];
export const STATUS_OPTIONS = ['To-do', 'Doing', 'Done'];
export const VALIDATION_OPTIONS = ['', 'Not checked', 'Passed', 'Failed'];

// A brand-new row starts here until the team edits it.
export const TRACKER_DEFAULTS = {
  priority: '',
  status: 'To-do',
  owner: '',
  targetDate: '',
  fixedDate: '',
  validationStatus: '',
  notes: '',
  evidence: '',
};

// Length caps enforced on save (keeps a public endpoint from bloating the row).
export const FIELD_MAXLEN = {
  priority: 20,
  status: 20,
  owner: 120,
  targetDate: 20,
  fixedDate: 20,
  validationStatus: 20,
  notes: 2000,
  evidence: 2000,
};

/**
 * Flatten an audit's SEO pages into ordered tracker rows.
 * Real issues only — unscored "notice" checks are excluded from the work list.
 */
export function buildSeoTrackerRows(pages = []) {
  const fixList = buildSeoFixList(pages);
  const rows = [];
  let n = 0;
  for (const cat of fixList.categories) {
    for (const check of cat.checks) {
      if (check.status !== 'fail' || check.severity === 'notice') continue;
      for (const a of check.affected) {
        n += 1;
        rows.push({
          issueId: `SEO-${String(n).padStart(3, '0')}`,
          key: `${check.id}::${a.url}`,
          severity: check.severity,
          category: cat.label,
          issue: check.label,
          url: a.url,
          value: a.value,
          hint: check.hint,
        });
      }
    }
  }
  return rows;
}

/** Merge a stored tracker map onto a row's key, filling defaults. */
export function trackerStateFor(key, stored) {
  return { ...TRACKER_DEFAULTS, ...(stored?.[key] || {}) };
}
