'use client';

import Link from 'next/link';

/**
 * Button — single source of truth for action buttons (see docs/handoff/08 +
 * the project-design-direction memory). Reproduces the established recipes
 * exactly; it unifies them, it does not restyle.
 *
 *   variant  primary      gel liquid-glass fill, brand action color (CTAs)
 *            secondary    hairline outline, hover tints to the brand accent
 *            danger       hairline outline in danger red (destructive, inline)
 *            dangerSolid  filled danger red (destructive confirm)
 *   size     sm | md | lg (fill and outline scales differ, matching the app)
 *
 * Renders a <button> by default, or a Next <Link> when `href` is passed (and
 * the button isn't disabled). Disabled primaries drop to a flat grey; the
 * other variants dim. Extra `className` is appended last for layout add-ons
 * (w-fit, flex-1, shrink-0, …); use `fullWidth` for w-full.
 *
 * Deliberate exception: the /share/* client reports keep their own flat,
 * non-gel toolbar buttons (print-first documents, not app chrome) — do NOT
 * migrate those to this component. Decided 2026-07-16.
 */

const BASE = 'inline-flex items-center justify-center gap-2 font-medium';

// Fill buttons (primary) run a touch wider than outline buttons at each step.
const FILL_SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3',
};

const OUTLINE_SIZES = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3.5 text-sm', // lg outline matches the 3.5 input height (estimate row)
};

const VARIANTS = {
  primary: {
    enabled: 'btn-gel rounded-lg bg-action text-text-on-action hover:bg-action-hover',
    disabled: 'rounded-lg bg-surface-subtle text-text-subtle transition-colors cursor-not-allowed',
  },
  secondary: {
    enabled:
      'rounded-md border border-border-strong text-text transition-colors hover:border-action hover:text-action',
    disabled: 'rounded-md border border-border-strong text-text cursor-not-allowed opacity-60',
  },
  danger: {
    enabled:
      'rounded-md border border-danger/50 text-danger transition-colors hover:bg-danger-subtle',
    disabled: 'rounded-md border border-danger/50 text-danger cursor-not-allowed opacity-60',
  },
  dangerSolid: {
    enabled: 'rounded-md bg-danger text-white transition-opacity hover:opacity-90',
    disabled: 'rounded-md bg-danger text-white cursor-not-allowed opacity-60',
  },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const sizes = variant === 'primary' ? FILL_SIZES : OUTLINE_SIZES;
  const recipe = VARIANTS[variant] || VARIANTS.primary;

  const classes = [
    BASE,
    sizes[size] || sizes.md,
    recipe[disabled ? 'disabled' : 'enabled'],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
