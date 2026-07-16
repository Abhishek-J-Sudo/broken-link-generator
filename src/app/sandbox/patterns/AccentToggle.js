'use client';

// Accent comparison switch: teal is the brand default (2026-07-16); this
// flips data-accent="green" on <html> to preview the legacy green ramp
// site-wide. Survives client-side navigation; resets on a hard reload.
import { useEffect, useState } from 'react';

export default function AccentToggle() {
  const [green, setGreen] = useState(false);

  useEffect(() => {
    setGreen(document.documentElement.dataset.accent === 'green');
  }, []);

  const toggle = () => {
    const next = !green;
    if (next) {
      document.documentElement.dataset.accent = 'green';
    } else {
      delete document.documentElement.dataset.accent;
    }
    setGreen(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-3 rounded-md border border-border-strong px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-text hover:border-action hover:text-action transition-colors duration-200"
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: green ? 'var(--green-600)' : 'var(--teal-500)' }}
      />
      Accent: {green ? 'Green (legacy)' : 'Teal (default)'} &mdash; click to switch
    </button>
  );
}
