# 08 - Design Tokens & Theming (Light / Dark)

**Priority:** P2
**Goal:** Rebuild SeoScrub's visual layer on a **token-based theming system** so color, type,
spacing, radius, and elevation are defined **once** as semantic tokens and consumed everywhere.
Support **light and dark** mode from day one. This doc is the design + IA + structure context to
build against so the restructure is smooth and consistent.

> **The one rule that motivates this doc:** if someone says *"change the CTA color"* tomorrow,
> you edit **one token** (`--color-action-primary`) and every CTA on every page, in both themes,
> updates. You never touch individual pages or components. That is the entire point of tokens.

Supersedes the ad-hoc color usage in [07 - UI Design System](./07-ui-design-system.md) (that doc
stays valid for brand intent, typography feel, and component behavior; **this** doc governs how
those values are actually stored and consumed). IA is inherited from
[06 - UX, IA & Reporting](./06-ux-ia-and-reporting.md) and restated concretely in §9.

---

## 1. Principles

1. **Single source of truth.** A color/spacing/radius value is declared in exactly one place.
2. **Components never hardcode.** No raw hex, no `bg-[#16A34A]`, no `text-[#0F172A]` in JSX.
   Components reference **semantic tokens** only.
3. **Semantic, not literal.** Tokens are named by *role* (`surface`, `action-primary`, `danger`),
   not by *value* (`green`, `navy`). Roles survive a rebrand; value-names don't.
4. **Theme is a data attribute.** Light/dark is switched by `data-theme` on `<html>`; every token
   has a light value and a dark value. Components are theme-agnostic — they just read the token.
5. **Tailwind stays for layout, not color.** Spacing, flex/grid, sizing = Tailwind utilities.
   Color/surface/border/elevation = tokens (surfaced through Tailwind utilities that point at the
   tokens — see §7). No custom *theme* logic lives in Tailwind arbitrary values.

---

## 2. Token architecture (3 tiers)

```
Tier 1  PRIMITIVES        raw palette, theme-agnostic      --green-600: #16A34A
   │    (never used directly in components)
   ▼
Tier 2  SEMANTIC / ALIAS  role-based, THEME-AWARE          --color-action-primary: var(--green-600)
   │    (this is what components consume)                  (dark: var(--green-500))
   ▼
Tier 3  COMPONENT         per-component knobs (optional)   --btn-primary-bg: var(--color-action-primary)
        (only for complex/variant-heavy components)
```

**Rules**

- Components import **Tier 2** (or Tier 3) only. **Never Tier 1**, never literals.
- Tier 2 is the only tier that changes between light and dark.
- Tier 3 exists only when a component has enough internal states to warrant its own knobs
  (buttons, badges). Simple elements read Tier 2 directly.
- Changing a **brand value** = edit a Tier 1 primitive. Changing a **role** (what green means for
  actions) = edit a Tier 2 mapping. Changing **one component** = edit its Tier 3 tokens.

---

## 3. Naming convention

```
--color-<role>[-<variant>][-<state>]
```

- `role`: `bg`, `surface`, `surface-raised`, `border`, `text`, `text-muted`, `action-primary`,
  `action-secondary`, `accent`, `success`, `warning`, `danger`, `info`, `focus`
- `variant`: `subtle`, `strong`, `inverse`, `on-action` (text/icon color that sits *on* a filled action)
- `state`: `hover`, `active`, `disabled`

Examples: `--color-action-primary`, `--color-action-primary-hover`, `--color-text-muted`,
`--color-danger-subtle`, `--color-border-strong`.

Non-color scales use their own prefixes: `--radius-*`, `--space-*`, `--shadow-*`, `--font-*`,
`--text-*` (size), `--leading-*`, `--z-*`, `--dur-*` (motion).

---

## 4. Primitives (Tier 1) — from `public/design`

Raw palette lifted from the approved brand kit
(`public/design/ChatGPT Image ... (2).png`). These are **theme-agnostic** and never referenced by
components directly.

```css
/* Brand green */
--green-50:  #F0FDF4;
--green-100: #DCFCE7;
--green-500: #22C55E;   /* success-soft / dark-mode action */
--green-600: #16A34A;   /* PRIMARY BRAND — CTAs, active states */
--green-700: #15803D;
--emerald-600: #059669; /* hover/pressed green */
--emerald-700: #047857;

/* Navy / slate neutrals */
--white:     #FFFFFF;
--slate-50:  #F8FAFC;   /* page bg (light) */
--slate-100: #F1F5F9;   /* soft panel (light) */
--slate-200: #E5E7EB;   /* border (light) */
--slate-300: #CBD5E1;
--slate-400: #94A3B8;
--slate-500: #64748B;   /* secondary text (light) */
--slate-700: #334155;
--slate-800: #1E293B;   /* raised surface (dark) */
--slate-900: #0F172A;   /* primary text (light) / surface (dark) */
--navy-950:  #0B1220;   /* page bg (dark) */

/* Status */
--red-400:   #F87171;   --red-500:  #EF4444;
--amber-400: #FBBF24;   --amber-500:#F59E0B;
--blue-400:  #60A5FA;   --blue-600: #2563EB;
```

---

## 5. Semantic tokens (Tier 2) — light + dark

This is the contract components code against. Every row has a light and a dark value.

### Surfaces & structure

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `--slate-50` | `--navy-950` | Page background |
| `--color-surface` | `--white` | `--slate-900` | Cards, panels, header |
| `--color-surface-raised` | `--white` | `--slate-800` | Elevated/popover/modal |
| `--color-surface-subtle` | `--slate-100` | `#172033` | Muted inset panels, table headers |
| `--color-border` | `--slate-200` | `#243044` | Default borders/dividers |
| `--color-border-strong` | `--slate-300` | `--slate-700` | Emphasized borders, inputs |

### Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-text` | `--slate-900` | `--slate-50` | Primary text, headings |
| `--color-text-muted` | `--slate-500` | `--slate-400` | Secondary text, metadata |
| `--color-text-subtle` | `--slate-400` | `--slate-500` | Placeholders, captions |
| `--color-text-inverse` | `--white` | `--slate-900` | Text on inverted surfaces |
| `--color-text-on-action` | `--white` | `--slate-900` | Text/icon on a filled action button |

### Brand / actions

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-action-primary` | `--green-600` | `--green-500` | **The CTA color.** Primary buttons, active tab |
| `--color-action-primary-hover` | `--emerald-600` | `--green-600` | Hover/pressed |
| `--color-action-primary-active` | `--emerald-700` | `--emerald-600` | Active/pressed-deep |
| `--color-action-primary-subtle` | `--green-50` | `rgba(34,197,94,0.14)` | Subtle green bg (disabled CTA, tint) |
| `--color-accent` | `--green-600` | `--green-500` | Highlighted words, links, focus brand |

### Status (feedback)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-success` | `--green-600` | `--green-500` | Healthy links, positive delta |
| `--color-success-subtle` | `--green-50` | `rgba(34,197,94,0.14)` | Success badge bg |
| `--color-warning` | `--amber-500` | `--amber-400` | Warnings, moderate risk |
| `--color-warning-subtle` | `#FEF3C7` | `rgba(251,191,36,0.14)` | Warning badge bg |
| `--color-danger` | `--red-500` | `--red-400` | Broken links, errors |
| `--color-danger-subtle` | `#FEE2E2` | `rgba(248,113,113,0.14)` | Error badge bg |
| `--color-info` | `--blue-600` | `--blue-400` | Informational accents |
| `--color-info-subtle` | `#DBEAFE` | `rgba(96,165,250,0.14)` | Info badge bg |
| `--color-focus` | `--green-600` | `--green-500` | Focus rings |

---

## 6. Non-color tokens

Inherited from doc 07 §7–8; formalized here so they're tokenized too (theme-independent).

```css
/* Radius */
--radius-sm: 8px;   --radius-md: 12px;  --radius-lg: 16px;  --radius-xl: 24px;  --radius-full: 9999px;

/* Spacing (8px base) */
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 40px; --space-8: 48px; --space-9: 64px;

/* Typography — Inter */
--font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
--text-xs: 12px; --text-sm: 14px; --text-base: 16px; --text-lg: 18px;
--text-xl: 20px; --text-2xl: 24px; --text-3xl: 30px; --text-4xl: 36px; --text-5xl: 48px;
--leading-tight: 1.15; --leading-snug: 1.35; --leading-normal: 1.55;
--weight-regular: 400; --weight-medium: 500; --weight-semibold: 600; --weight-bold: 700; --weight-black: 800;

/* Elevation — shadows are theme-aware (darker/softer in dark mode) */
--shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
--shadow-md: 0 6px 16px rgba(15,23,42,0.08);
--shadow-lg: 0 14px 30px rgba(15,23,42,0.10);
/* dark overrides use rgba(0,0,0,0.4+) — see §5 pattern */

/* Motion */
--dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);

/* Z-index */
--z-header: 50; --z-dropdown: 100; --z-modal: 1000; --z-toast: 1100;
```

---

## 7. Implementation in this repo

### 7.1 `globals.css` structure

Replace the current minimal file with layered tokens. Tailwind v4's `@theme inline` is the bridge:
it emits utilities that point at `var(--…)`, so `bg-surface` / `text-action` **auto-swap** when
`data-theme` changes at runtime.

```css
@import 'tailwindcss';

/* Tier 1 — primitives (theme-agnostic) */
:root {
  --green-600: #16A34A; --green-500: #22C55E; /* …all primitives from §4… */
}

/* Tier 2 — semantic, LIGHT (default) */
:root {
  --color-bg: var(--slate-50);
  --color-surface: var(--white);
  --color-text: var(--slate-900);
  --color-action-primary: var(--green-600);
  --color-action-primary-hover: var(--emerald-600);
  /* …every semantic token, light value… */
  --shadow-md: 0 6px 16px rgba(15,23,42,0.08);
}

/* Tier 2 — semantic, DARK overrides */
[data-theme='dark'] {
  --color-bg: var(--navy-950);
  --color-surface: var(--slate-900);
  --color-text: var(--slate-50);
  --color-action-primary: var(--green-500);
  --color-action-primary-hover: var(--green-600);
  /* …every semantic token, dark value… */
  --shadow-md: 0 6px 16px rgba(0,0,0,0.45);
}

/* System default when the user hasn't chosen (no data-theme set) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* same overrides as [data-theme='dark'] */ }
}

/* Bridge tokens → Tailwind utilities (inline = keep the var(), don't resolve at build) */
@theme inline {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-surface-raised: var(--color-surface-raised);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
  --color-action: var(--color-action-primary);
  --color-action-hover: var(--color-action-primary-hover);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-danger: var(--color-danger);
  --color-info: var(--color-info);
  --radius-md: var(--radius-md);
  --font-sans: var(--font-sans);
}
```

Now components use plain, semantic utilities: `bg-surface text-text border-border`,
`bg-action hover:bg-action-hover text-text-on-action`, `text-danger`, `rounded-md`. All swap
with the theme automatically. For anything Tailwind can't express, use the CSS var directly
(`style={{ background: 'var(--color-surface)' }}` or a small CSS class) — the token is still the source.

### 7.2 No-flash theme boot (prevents light→dark flicker on load)

Set `data-theme` **before paint**. In `src/app/layout.js`, add `suppressHydrationWarning` on
`<html>` and inject a blocking inline script in `<head>`:

```js
// runs before React hydrates
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
```

### 7.3 Theme toggle

A small client component (`src/app/components/ThemeToggle.js`): reads current `data-theme`, flips
it, writes `<html data-theme>`, persists to `localStorage.theme`. Place it in `Header.js`.
No context/provider strictly required (the DOM attribute *is* the state); a tiny `useTheme` hook
that reads/writes the attribute + localStorage is enough. `next-themes` is an acceptable drop-in
if preferred, but it's not needed and adds a dependency.

### 7.4 Files to touch

| File | Change |
|---|---|
| [`src/app/globals.css`](../../src/app/globals.css) | Full token system (Tiers 1–2 + `@theme inline` bridge) |
| [`src/app/layout.js`](../../src/app/layout.js) | No-flash script; `suppressHydrationWarning`; load Inter |
| `src/app/components/ThemeToggle.js` | **New** — toggle + persistence |
| [`src/app/components/Header.js`](../../src/app/components/Header.js) | Mount `ThemeToggle`; migrate to tokens |
| All UI components (§10) | Replace hardcoded hex / `bg-[#…]` with token utilities |

---

## 8. Governance (how tokens stay the single source of truth)

- **Never** introduce a raw hex or `*-[#…]` arbitrary color in a component. If a needed color has
  no token, add a token — don't inline the value.
- **Never** reference a Tier 1 primitive (`--green-600`) in a component. Go through Tier 2.
- New color need → add semantic token (light + dark) in `globals.css`, then use it.
- Suggested lint guard: forbid `#[0-9a-fA-F]{3,6}` and `-\[#` inside `src/app/components/**` and
  page files (allow only in `globals.css`). Add to review checklist even before automating.
- **PR checklist:** ✅ no literal colors in components ✅ both light+dark verified ✅ new tokens
  named by role ✅ focus/hover/disabled states use state tokens.

---

## 9. Information architecture (rebuild target)

From doc 06, mapped to the **actual** current routes.

### Routes (current → role)

| Route | File | Role in rebuild |
|---|---|---|
| `/` | `src/app/page.js` | Landing (marketing) — hero, output preview, how-it-works, modes, FAQ, closing CTA |
| `/analyze` | `src/app/analyze/page.js` | Audit setup — URL + audit type (Full Audit / Quick Check) + advanced |
| `/results/[jobId]` | `src/app/results/[jobId]/page.js` | Progress **and** report (summary-first) |
| `/documentation` | `src/app/documentation/page.js` | Docs |
| `/changelog` | `src/app/changelog/page.js` | Changelog |
| `/ui-drafts` | `src/app/ui-drafts/page.js` | **Styleguide/token gallery** — keep as the living token+component reference |

### Primary nav

`Product` · `How It Works` · `Documentation` · **`Start Audit`** (primary CTA, right-aligned).
Intent-first labels: **Full Audit** (was Smart Analyzer), **Quick Check** (was Basic Checker),
**Audit Report** (was Results). See doc 06 §3 for the full mapping — keep technical terms as
helper copy only.

### Page models (summary — full wireframes in doc 06 §6–9)

- **Landing:** Header → Hero (dark heading + one green-emphasis line + URL/CTA) → Output preview
  (product window mock) → How it works (3 steps) → Choose mode → Who it's for → FAQ → Closing CTA.
- **Audit setup:** main column (URL, audit type, advanced, submit) + supporting column (est. size,
  runtime, what you'll get).
- **Progress:** audit header → progress block → live stats → activity log → early findings.
- **Report:** header (domain, timestamp, status, export) → executive summary → key takeaways →
  findings by priority (Critical/Major/Minor) → affected pages → issue breakdown → detailed table
  (evidence appendix) → methodology.

---

## 10. Component inventory → tokens

Every reusable surface and which semantic tokens it consumes. Build these token-first; the
`/ui-drafts` styleguide is the proving ground.

| Component | File | Key tokens |
|---|---|---|
| Button (primary) | rebuild shared | `--color-action-primary` / `-hover` / `-active` / `-subtle`, `--color-text-on-action`, `--radius-md`, `--shadow-md` |
| Button (secondary/ghost/outline) | shared | `--color-surface`, `--color-border(-strong)`, `--color-action-primary` (text/border), `--color-surface-subtle` (ghost hover) |
| URL input | `LargeCrawlForm.js`, `CrawlForm.js` | `--color-surface`, `--color-border-strong`, `--color-text`, `--color-text-subtle`, `--color-focus` |
| Header / nav | `Header.js` | `--color-surface`, `--color-border`, `--color-text`, `--color-action-primary`; hosts `ThemeToggle` |
| Footer | `Footer.js` | `--color-surface-subtle`, `--color-text-muted`, `--color-border` |
| Stat card | `HomeSidebar.js`, results | `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, status colors for deltas |
| Feature card | `HomeFeaturesSection.js` | `--color-surface`, `--color-border`, `--color-text`, `--color-action-primary-subtle` (icon bg) |
| Tabs | results | `--color-text-muted` (idle), `--color-text` + `--color-action-primary` underline (active) |
| Issue tag / status badge | `ResultsTable.js`, `SecurityNotice.js` | `--color-{success,warning,danger,info}` + matching `-subtle` bg |
| Table | `ResultsTable.js` | `--color-surface`, `--color-surface-subtle` (header), `--color-border`, `--color-text`, status for cells only |
| Tooltip | `ToolTip.js` | `--color-surface-raised`, `--color-text`, `--shadow-lg`, `--z-dropdown` |

**Do not** let homepage buttons, report buttons, and analyzer buttons drift into separate styles —
one shared `Button` reading one set of tokens (doc 07 §14).

---

## 11. Rebuild sequence

1. **Land the token layer** — write `globals.css` (Tiers 1–2 + bridge), no-flash script, `ThemeToggle`,
   Inter font. Nothing visual changes yet, but tokens exist and dark mode toggles.
2. **Tokenize the styleguide** (`/ui-drafts`) first — it's isolated and is the component reference.
   Prove every component in both themes here before touching real pages.
3. **Migrate shared components** — Button, input, card, badge, tabs, table → tokens. Delete
   hardcoded hex as you go.
4. **Landing page** (`/`) → tokens + new IA (doc 06 §6).
5. **Audit setup** (`/analyze`) and **report** (`/results/[jobId]`) → tokens + report-first layout.
6. **Docs/changelog** → tokens (mostly text/surface).
7. **Add the lint guard** (§8) so no new literals creep back in.

Each step is independently shippable and reversible. Follow the branch convention
(`phase2-<id>-<slug>`).

---

## 12. Acceptance criteria

- Changing `--color-action-primary` in `globals.css` recolors **every** CTA across all pages and
  both themes — with no other edits.
- No component file contains a literal hex or `*-[#…]` color (only `globals.css` holds values).
- Toggling theme flips the entire app light↔dark with no flash on reload; choice persists.
- First load with no saved choice follows the OS `prefers-color-scheme`.
- Light and dark both meet WCAG AA for text and interactive contrast.
- `/ui-drafts` renders every component correctly in both themes and serves as the living token doc.
- Landing, setup, and report read as one product and follow the doc 06 IA.

---

## 13. Open decisions (fill in during build)

- **Dark surface exact values** — the §5 dark column is a sound starting point derived from the
  brand kit's dark backgrounds; tune `--color-surface` / `-subtle` against real screens.
- **Elevation in dark** — shadows read weakly on dark; consider pairing `--shadow-*` with a subtle
  `--color-border` hairline on raised surfaces instead of relying on shadow alone.
- **Charts** (SEO score trend, etc.) — add chart-specific tokens (`--chart-1..n`) mapped to
  brand+status so data viz also themes cleanly.
