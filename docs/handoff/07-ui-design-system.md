# 07 - UI Design System & Visual Theme

**Priority:** P2
**Goal:** Turn the approved design exploration assets in `public/design/` into a usable
visual system for implementation. This doc defines the brand theme, color tokens,
typography, component styling, and page-level UI direction for SeoScrub.

---

## 1. Source of truth

The visual source material for this doc lives in:

- [`public/design/ChatGPT Image Jul 9, 2026, 03_35_29 PM (1).png`](../../public/design/ChatGPT%20Image%20Jul%209,%202026,%2003_35_29%20PM%20(1).png)
- [`public/design/ChatGPT Image Jul 9, 2026, 03_35_30 PM (2).png`](../../public/design/ChatGPT%20Image%20Jul%209,%202026,%2003_35_30%20PM%20(2).png)
- [`public/design/ChatGPT Image Jul 9, 2026, 03_35_30 PM (3).png`](../../public/design/ChatGPT%20Image%20Jul%209,%202026,%2003_35_30%20PM%20(3).png)
- [`public/design/ChatGPT Image Jul 9, 2026, 03_35_30 PM (4).png`](../../public/design/ChatGPT%20Image%20Jul%209,%202026,%2003_35_30%20PM%20(4).png)

These four images collectively define:

- the landing page visual direction
- the report/dashboard surface style
- the logo system
- the color palette
- the typography choice
- the reusable component library

This doc should be treated as the text version of those assets.

---

## 2. Design intent

SeoScrub should feel:

- clean
- modern
- trustworthy
- actionable
- easy to use

It should not feel:

- playful or noisy
- dark and aggressive by default
- enterprise-boring
- like a generic purple SaaS template
- over-decorated

The design language is best described as:

- soft white surfaces
- dark navy text
- strong green brand accents
- clear spacing
- rounded, friendly UI
- polished, productized reporting

---

## 3. Brand traits

Based on the approved draft assets, the brand traits are:

1. `Clean`
   Minimal visuals that reduce noise.

2. `Trustworthy`
   Calm surfaces, strong contrast, dependable structure.

3. `Actionable`
   The UI should move users from issue detection to fixing.

4. `Precise`
   Data-heavy, but clearly organized and easy to parse.

5. `Modern`
   Fresh, current, polished, and software-native.

These should guide design decisions more than visual novelty alone.

---

## 4. Canonical color system

### Core palette

Use these as the canonical brand/theme values:

| Token | Hex | Usage |
|------|-----|-------|
| `brand-primary` | `#16A34A` | Primary CTA, active tab underline, key brand moments |
| `brand-primary-dark` | `#059669` | Hover/pressed green, richer accents |
| `brand-success-soft` | `#22C55E` | Positive trend text, success support accents |
| `text-primary` | `#0F172A` | Main headings and primary content |
| `text-secondary` | `#64748B` | Secondary UI text, metadata |
| `bg-page` | `#F8FAFC` | Overall page background |
| `bg-soft` | `#F1F5F9` | Soft section backgrounds, muted panels |
| `border-default` | `#E5E7EB` | Card borders, dividers |
| `status-error` | `#EF4444` | Broken/error states |
| `status-warning` | `#F59E0B` | Warning states |
| `status-info` | `#2563EB` | Informational accents, secondary charts/indicators |

### Color usage rules

#### Green

Use green for:

- primary actions
- positive outcomes
- success states
- active/highlight state in navigation or tabs

Do not use green as a giant wash across the full UI. It should lead attention, not flood it.

#### Navy / dark text

Use `#0F172A` heavily for:

- main headings
- logos/wordmarks
- critical text
- chart lines or high-emphasis data

This dark navy is a core part of the visual identity and should be treated as almost-black.

#### Slate / light gray surfaces

Use:

- `#F8FAFC` for page background
- `#F1F5F9` for soft panels
- `#E5E7EB` for borders

The system should stay bright and airy rather than flat white everywhere.

#### Status colors

Use:

- red for broken links, severe issues, errors
- amber for warnings, performance concerns, moderate risk
- blue for informational elements, secondary status, support visuals
- green for success, healthy links, positive deltas

---

## 5. Typography

### Primary typeface

The draft assets clearly point to **Inter** as the UI typeface.

Use:

- `Inter` for headings
- `Inter` for body
- `Inter` for metric values and UI labels

### Type scale guidance

#### H1

- Weight: `600` to `700`
- Example use: hero statement, main report headline
- Tone: bold, clear, compressed only slightly via tight tracking

#### H2

- Weight: `600`
- Example use: section titles, major report blocks

#### H3 / H4

- Weight: `600`
- Example use: card titles, panel titles, subsection labels

#### Body

- Weight: `400`
- Line-height: relaxed
- Keep readable, not overly dense

#### Small / caption

- Use for helper copy, metadata, chip text, timestamps
- Keep contrast adequate; avoid washed-out gray text

### Typography rules

1. Use strong scale contrast between hero/report headline and body.
2. Avoid overusing bold on every card title.
3. Keep numeric metrics large and clear.
4. Prefer sentence case over excessive all caps except for tiny section labels.

---

## 6. Logo system

The design assets define three main logo forms:

1. Primary horizontal logo
2. Icon-only mark
3. Stacked logo

### Rules

- Use the horizontal logo in headers and nav bars.
- Use the icon-only mark for favicon/app icon/social use.
- Use the stacked form in certain marketing or constrained spaces only if needed.

### Color variants

Approved variants:

- green mark + dark wordmark on light background
- monochrome dark on light background
- green mark / white mark on dark background

### Clear space

Respect safe area around the logo mark using approximately the width of the inner `S` form.

### Avoid

- stretching
- drop shadows on the logo
- alternate brand colors
- decorative outlines

---

## 7. Surface and layout system

### Core surface style

The UI should be built from:

- large rounded cards
- light borders
- soft shadows
- clean page gutters
- generous whitespace

### Radius guidance

From the component drafts, the system should skew toward rounded UI:

| Token | Value | Usage |
|------|-------|-------|
| `radius-sm` | `8px` | chips, small buttons, tiny inputs |
| `radius-md` | `12px` | default cards, inputs |
| `radius-lg` | `16px` | larger cards, panels |
| `radius-xl` | `24px` | hero cards, major surface groups |

### Shadow guidance

Keep shadows subtle and modern:

- `sm`: gentle lift for small cards
- `md`: default interactive surfaces
- `lg`: hero/report overview panels

Avoid heavy, muddy shadows.

### Border guidance

Default border:

- `1px solid #E5E7EB`

Borders are important in this system because they create structure without heavy color fills.

---

## 8. Spacing system

The component board suggests an 8px-based system.

### Recommended spacing scale

| Token | Value |
|------|-------|
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `12px` |
| `space-4` | `16px` |
| `space-5` | `24px` |
| `space-6` | `32px` |
| `space-7` | `40px` |
| `space-8` | `48px` |
| `space-9` | `64px` |

### Spacing rules

1. Use larger vertical breathing room than horizontal density where possible.
2. Hero/report sections should breathe.
3. Data groups inside cards should align on a consistent internal padding rhythm.

---

## 9. Component guidance

### Buttons

The design assets define four button modes:

- Primary
- Secondary
- Ghost
- Outline

#### Primary button

Use:

- solid green background
- white text
- medium shadow or subtle lift
- rounded corners

Primary CTA text example:

- `Start Free Audit`

#### Secondary button

Use:

- white or light surface
- dark text
- border

#### Ghost button

Use:

- no strong fill
- mostly text-driven
- for low-emphasis actions

#### Outline button

Use:

- white/light background
- green border
- green text

### Inputs

The URL input style should be:

- large
- full-width
- calm border
- visually paired with the CTA button
- high readability placeholder text

### Tabs

Tabs are:

- text-first
- underlined when active
- not pill-heavy
- should feel precise and lightweight

### Stat cards

Stat cards should include:

- icon or small label
- large number
- delta or status trend

Keep them clean and not overloaded.

### Issue tags

Issue tags should be:

- lightly tinted
- icon-supported
- count-aware

Examples from design:

- Broken Links
- Missing Meta Description
- Images Missing Alt Text
- Slow Page Speed

### Status badges

Supported states:

- success
- warning
- error
- info

These should stay compact and readable.

### Feature cards

Use for:

- landing page benefits
- trust/value blocks

Examples:

- Fast & Accurate
- Easy to Use
- Actionable
- Trusted

---

## 10. Landing page design direction

The homepage draft shows the clearest direction for the marketing-facing surface.

### Homepage structure

1. Top navigation
2. Left hero content
3. Right dashboard/report preview
4. URL input + CTA
5. trust metrics
6. why-value cards

### Homepage tone

The homepage should feel:

- polished
- conversion-friendly
- calm
- product-led

Not:

- loud
- flashy
- startup-gimmicky

### Hero direction

The hero should use:

- strong dark heading text
- selected green emphasis in one line
- short explanatory paragraph
- large CTA input block

### Product preview

The right-side preview should feel like:

- a live product window
- KPI/report visualization
- proof of output quality

This is important because the preview sells the usefulness of the product.

---

## 11. Report and dashboard design direction

The report/dashboard styling should inherit the same design language as the landing page.

### Report page visual rules

1. Summary first
2. Data second
3. Issues should feel triaged, not dumped
4. Keep the green brand color for success/highlight, not for every chart
5. Use ample whitespace between major report blocks

### Preferred report sections

- Executive summary
- Trend/score visualization
- KPI stats
- recent issues / issue categories
- detailed findings table

### Tables

Tables should:

- have strong horizontal rhythm
- be readable without zebra overload
- use subtle borders
- reserve color for status, not for every cell

---

## 12. Motion and interaction

The current visual system suggests restrained motion.

### Recommended motion style

- subtle hover lift on cards
- gentle button hover transitions
- smooth tab underline changes
- soft focus states

Avoid:

- bouncy effects
- excessive scale animations
- dramatic gradients or glow effects

---

## 13. Accessibility and UX rules

### Contrast

- ensure strong contrast between `#0F172A` text and light backgrounds
- do not rely on pale green for meaning without labels

### Touch targets

- buttons and tab targets should be comfortably clickable on mobile

### States

Design states needed:

- default
- hover
- active
- disabled
- focus
- error

### Forms

The URL entry path should feel frictionless:

- large field
- obvious CTA
- clear placeholder
- quick validation feedback

---

## 14. Implementation notes for this repo

### Files to align with this design system

Primary UI files:

- [`src/app/globals.css`](../../src/app/globals.css)
- [`src/app/page.js`](../../src/app/page.js)
- [`src/app/components/Header.js`](../../src/app/components/Header.js)
- [`src/app/components/HomeHeroSection.js`](../../src/app/components/HomeHeroSection.js)
- [`src/app/components/HomeFeaturesSection.js`](../../src/app/components/HomeFeaturesSection.js)
- [`src/app/components/HomeSidebar.js`](../../src/app/components/HomeSidebar.js)
- [`src/app/results/[jobId]/page.js`](../../src/app/results/[jobId]/page.js)
- [`src/app/components/ResultsTable.js`](../../src/app/components/ResultsTable.js)

### Theme tokens to introduce

At minimum, add CSS variables for:

- brand greens
- text colors
- surface colors
- border color
- error/warning/info colors
- radius scale
- shadow scale

### Typography implementation

The current global font fallback should be updated to match this design system.

If the team wants to stay close to the brand kit:

- use `Inter` as the UI font
- keep headings crisp and modern

### Component consistency

Do not let:

- homepage buttons
- report buttons
- analyzer buttons
- table badges

all drift into separate styles. This doc exists to prevent that.

---

## 15. Canonical design decisions

These are the decisions that should now be treated as approved unless intentionally revised:

1. Brand accent color is green, centered on `#16A34A`
2. Primary text color is dark navy, centered on `#0F172A`
3. Page backgrounds stay light, airy, and neutral
4. Inter is the primary UI typeface
5. Rounded cards + light borders are the primary surface model
6. Buttons follow primary/secondary/ghost/outline variants
7. The homepage uses a left-copy + right-product-preview structure
8. The product should feel clean, modern, precise, and actionable

---

## 16. Acceptance criteria

This design system is successful when:

- a new implementer can reproduce the visual language from the docs alone
- the landing page and report page feel like the same product
- the brand color usage is consistent across marketing and product surfaces
- buttons, cards, badges, tabs, and inputs follow one shared style system
- the UI feels close to the approved design images in `public/design`

---

## 17. Recommended next steps

1. Update [`src/app/globals.css`](../../src/app/globals.css) with theme variables
2. Apply the theme to the landing page first
3. Apply the same tokens/components to the report/results page
4. Retire any older ad-hoc color choices that conflict with this system
5. Create a lightweight shared component/tokens layer if theme drift starts happening

This doc should be the reference point for future UI work in the repo.
