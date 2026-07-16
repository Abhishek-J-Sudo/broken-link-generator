'use client';

// Accent experiment switch: flips data-accent="teal" on <html> so the whole
// app renders with the teal ramp (see globals.css). Survives client-side
// navigation; resets on a hard reload.
import { useEffect, useState } from 'react';

export default function AccentToggle() {
  const [teal, setTeal] = useState(false);

  useEffect(() => {
    setTeal(document.documentElement.dataset.accent === 'teal');
  }, []);

  const toggle = () => {
    const next = !teal;
    if (next) {
      document.documentElement.dataset.accent = 'teal';
    } else {
      delete document.documentElement.dataset.accent;
    }
    setTeal(next);
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
        style={{ background: teal ? '#3ca5b1' : 'var(--green-600)' }}
      />
      Accent: {teal ? 'Teal (experiment)' : 'Green (default)'} &mdash; click to switch
    </button>
  );
}
