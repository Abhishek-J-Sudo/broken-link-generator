'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Theme toggle. The `data-theme` attribute on <html> is the source of truth
 * (set pre-hydration by the boot script in layout.tsx); this just flips it and
 * persists the choice. No context/provider needed. See docs/handoff/08 §7.3.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null until mounted → avoids hydration mismatch

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* localStorage unavailable (private mode) — attribute still applies */
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title="Toggle theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
    >
      {/* icon is client-only (theme is null on the server render) */}
      {theme !== null && (isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
    </button>
  );
}
