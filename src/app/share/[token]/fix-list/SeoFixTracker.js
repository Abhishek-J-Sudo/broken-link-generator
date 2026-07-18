'use client';

/**
 * The SEO Fix Tracker — the on-screen work board on /share/[token]/fix-list.
 *
 * One row per issue (built by buildSeoTrackerRows). Grey/derived columns come
 * from the audit and are read-only; the white columns (Priority, Status, Owner,
 * Target/Fixed dates, Validation, Notes, Evidence) are the team's to edit and
 * save straight to the shared report. Presentational only — the parent owns the
 * edit state and persistence; here we just render cells and bubble up changes.
 */

import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  VALIDATION_OPTIONS,
  TRACKER_DEFAULTS,
} from '@/lib/seoTracker';

const SEV_TONE = {
  critical: 'text-danger',
  major: 'text-danger',
  warning: 'text-warning',
  minor: 'text-text-muted',
};

const STATUS_TONE = {
  'To-do': 'text-text-muted',
  Doing: 'text-warning',
  Done: 'text-success',
};

const th = 'font-mono text-[10px] uppercase tracking-[0.14em] font-normal text-text-subtle px-2 py-2 text-left align-bottom whitespace-nowrap';
const tdBase = 'px-2 py-2 align-top border-t border-border';
const inputCls =
  'w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-text focus:border-action focus:outline-none';

export default function SeoFixTracker({ rows, state, onChange }) {
  const valueOf = (key, field) => (state?.[key]?.[field] ?? TRACKER_DEFAULTS[field]) || '';

  const Select = ({ row, field, options }) => (
    <select
      value={valueOf(row.key, field)}
      onChange={(e) => onChange(row.key, field, e.target.value, true)}
      className={`${inputCls} ${field === 'status' ? STATUS_TONE[valueOf(row.key, field)] || '' : ''}`}
    >
      {options.map((o) => (
        <option key={o || '—'} value={o}>
          {o || '—'}
        </option>
      ))}
    </select>
  );

  const TextCell = ({ row, field, placeholder, type = 'text' }) => (
    <input
      type={type}
      value={valueOf(row.key, field)}
      placeholder={placeholder}
      onChange={(e) => onChange(row.key, field, e.target.value, type === 'date')}
      className={inputCls}
    />
  );

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full border-collapse text-xs" style={{ minWidth: 1580 }}>
        <thead>
          <tr className="bg-surface-subtle">
            <th className={th} style={{ minWidth: 78 }}>Issue ID</th>
            <th className={th} style={{ minWidth: 96 }}>Priority</th>
            <th className={th} style={{ minWidth: 104 }}>Status</th>
            <th className={th} style={{ minWidth: 130 }}>Owner</th>
            <th className={th} style={{ minWidth: 80 }}>Severity</th>
            <th className={th} style={{ minWidth: 150 }}>Category</th>
            <th className={th} style={{ minWidth: 190 }}>Issue</th>
            <th className={th} style={{ minWidth: 230 }}>Full Page URL</th>
            <th className={th} style={{ minWidth: 170 }}>Measured Value</th>
            <th className={th} style={{ minWidth: 260 }}>Recommended Fix</th>
            <th className={th} style={{ minWidth: 140 }}>Target Date</th>
            <th className={th} style={{ minWidth: 140 }}>Fixed Date</th>
            <th className={th} style={{ minWidth: 120 }}>Validation</th>
            <th className={th} style={{ minWidth: 200 }}>Notes</th>
            <th className={th} style={{ minWidth: 200 }}>Evidence</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-surface-subtle">
              {/* derived / read-only */}
              <td className={`${tdBase} font-mono text-[11px] text-text-subtle whitespace-nowrap`}>
                {row.issueId}
              </td>
              {/* editable */}
              <td className={tdBase}>
                <Select row={row} field="priority" options={PRIORITY_OPTIONS} />
              </td>
              <td className={tdBase}>
                <Select row={row} field="status" options={STATUS_OPTIONS} />
              </td>
              <td className={tdBase}>
                <TextCell row={row} field="owner" placeholder="—" />
              </td>
              {/* derived / read-only */}
              <td className={`${tdBase} font-mono text-[11px] uppercase ${SEV_TONE[row.severity] || 'text-text-muted'}`}>
                {row.severity}
              </td>
              <td className={`${tdBase} text-text-muted`}>{row.category}</td>
              <td className={`${tdBase} text-text`}>{row.issue}</td>
              <td className={tdBase}>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-[11px] text-text-muted hover:text-action"
                >
                  {row.url}
                </a>
              </td>
              <td className={`${tdBase} font-mono text-[11px] text-text`}>{row.value}</td>
              <td className={`${tdBase} leading-relaxed text-text-subtle`}>{row.hint}</td>
              {/* editable */}
              <td className={tdBase}>
                <TextCell row={row} field="targetDate" type="date" />
              </td>
              <td className={tdBase}>
                <TextCell row={row} field="fixedDate" type="date" />
              </td>
              <td className={tdBase}>
                <Select row={row} field="validationStatus" options={VALIDATION_OPTIONS} />
              </td>
              <td className={tdBase}>
                <TextCell row={row} field="notes" placeholder="—" />
              </td>
              <td className={tdBase}>
                <TextCell row={row} field="evidence" placeholder="link / screenshot" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
