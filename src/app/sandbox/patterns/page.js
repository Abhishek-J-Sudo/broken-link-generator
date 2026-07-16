// src/app/sandbox/patterns/page.js — PATTERN LAB round 2 (dev sandbox, not linked in nav).
// Three directions rebuilt from user feedback on round 1: the site graph loses
// its full-width chains (they read as boxes), the constellation gets a real
// choreography, the honeycomb becomes mouse-reactive. Theme tokens throughout;
// motion is hover-scoped and disabled under prefers-reduced-motion.

import AccentToggle from './AccentToggle';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

/* Pointy-top hexagon polygon points for center (cx,cy), circumradius r. */
function hexPoints(cx, cy, r) {
  const dx = r * 0.866;
  const dy = r / 2;
  return `${cx},${cy - r} ${cx + dx},${cy - dy} ${cx + dx},${cy + dy} ${cx},${cy + r} ${cx - dx},${cy + dy} ${cx - dx},${cy - dy}`;
}

/* ── A. Site graph, organic — short 60° links inside clusters, no chains ── */
function OrganicTile() {
  return (
    <g>
      {/* Cluster 1 — the S page and a neighbor */}
      <g fill="none" stroke="var(--color-border-strong)" strokeWidth="1" strokeLinejoin="round">
        <polygon points={hexPoints(140, 170, 36)} />
        <path d="M147.5,163h-12l-3,7h12l3,7h-12" />
        <polygon points={hexPoints(210, 101.4, 16)} />
        <line x1="171.2" y1="170" x2="230" y2="170" />
        <polyline points="171.2,152 190,152 210,117.4" />
        <polygon points={hexPoints(400, 120, 22)} />
        <polygon points={hexPoints(560, 320, 26)} />
        <polygon points={hexPoints(240, 560, 30)} />
      </g>
      <g fill="var(--color-border-strong)">
        <circle cx="140" cy="134" r="2" />
        <circle cx="230" cy="170" r="1.5" />
        <circle cx="530" cy="242" r="2" />
        <circle cx="240" cy="530" r="2" />
      </g>
      {/* Secondary tier */}
      <g
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.55"
      >
        <polygon points={hexPoints(605, 320, 26)} />
        <line x1="560" y1="294" x2="530" y2="242" />
        <line x1="627.5" y1="320" x2="680" y2="320" strokeDasharray="1 5" />
        <polygon points={hexPoints(325, 595, 16)} />
        <polyline points="266,575 290,575 311.1,587.2" />
        <line x1="240" y1="590" x2="240" y2="640" strokeDasharray="1 5" />
        <line x1="223.9" y1="101.4" x2="270" y2="101.4" strokeDasharray="1 5" />
        <line x1="400" y1="98" x2="400" y2="40" strokeDasharray="1 5" />
        <polygon points={hexPoints(90, 400, 16)} />
        <line x1="90" y1="416" x2="90" y2="470" strokeDasharray="1 5" />
      </g>
      <g fill="var(--color-border-strong)" opacity="0.55">
        <circle cx="680" cy="320" r="1.5" />
        <circle cx="240" cy="640" r="1.5" />
        <circle cx="270" cy="101.4" r="1.5" />
        <circle cx="400" cy="40" r="1.5" />
        <circle cx="90" cy="470" r="1.5" />
      </g>
      {/* Tertiary tier */}
      <g fill="none" stroke="var(--color-border-strong)" strokeWidth="1" opacity="0.3">
        <polygon points={hexPoints(360, 360, 60)} />
      </g>
      <g fill="var(--color-border-strong)" opacity="0.3">
        <circle cx="60" cy="60" r="1.2" />
        <circle cx="650" cy="90" r="1.2" />
        <circle cx="60" cy="250" r="1.2" />
        <circle cx="495" cy="235" r="1.2" />
        <circle cx="330" cy="470" r="1.2" />
        <circle cx="690" cy="610" r="1.2" />
        <circle cx="120" cy="660" r="1.2" />
        <circle cx="680" cy="150" r="1.2" />
      </g>
      {/* Static green accents */}
      <g opacity="0.5">
        <line x1="419.1" y1="120" x2="470" y2="120" stroke="var(--color-accent)" strokeWidth="1" />
        <circle cx="470" cy="120" r="2" fill="var(--color-accent)" />
        <circle cx="560" cy="346" r="1.5" fill="var(--color-accent)" />
      </g>
    </g>
  );
}

/* Short scan pulses per cluster; pathLength normalizes every path to 100 so
   one keyframe set drives them all. */
function OrganicPulses() {
  const paths = [
    ['plab-p1', 'M171.2,152L190,152L210,117.4'],
    ['plab-p2', 'M560,294L530,242'],
    ['plab-p3', 'M266,575L290,575L311.1,587.2'],
    ['plab-p4', 'M419.1,120H470'],
  ];
  return (
    <g
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.9"
    >
      {[0, 720].map((off) => (
        <g key={off} transform={`translate(${off},0)`}>
          {paths.map(([cls, d]) => (
            <path key={cls} className={`plab-pulse ${cls}`} d={d} pathLength="100" />
          ))}
          <circle className="plab-ping" style={{ animationDelay: '0.3s' }} cx="140" cy="134" r="2.5" fill="none" strokeWidth="1" />
          <circle className="plab-ping" style={{ animationDelay: '1.4s' }} cx="240" cy="530" r="2.5" fill="none" strokeWidth="1" />
        </g>
      ))}
    </g>
  );
}

/* ── C. Honeycomb lattice cells, rendered explicitly so each is hoverable ── */
function HoneycombCells() {
  const R = 52;
  const cells = [];
  for (let j = 0; j < 5; j += 1) {
    for (let i = 0; i < 16; i += 1) {
      cells.push([45 + 90 * i, 26 + 156 * j]);
    }
  }
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 17; i += 1) {
      cells.push([90 * i, 104 + 156 * j]);
    }
  }
  // Slightly emphasized cells for depth (chosen for even spread)
  const hi = new Set(['405,338', '900,572', '135,26', '1215,182', '630,650', '1350,416']);
  return (
    <g strokeWidth="1">
      {cells.map(([cx, cy]) => (
        <polygon
          key={`${cx},${cy}`}
          className={`plab-cell${hi.has(`${cx},${cy}`) ? ' plab-cell-hi' : ''}`}
          points={hexPoints(cx, cy, R)}
        />
      ))}
      {/* S-mark cell (logo echo) + static green apex nodes */}
      <path
        d="M416,329h-16l-4,9.5h16l4,9.5h-16"
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth="1.25"
        strokeLinejoin="round"
        opacity="0.5"
        pointerEvents="none"
      />
      <g fill="var(--color-accent)" opacity="0.6" pointerEvents="none">
        <circle cx="405" cy="286" r="2" />
        <circle cx="900" cy="520" r="2" />
        <circle cx="1215" cy="130" r="2" />
      </g>
    </g>
  );
}

function PatternCard({ serial, title, note, children }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-4">
        <p className={`${microLabel} shrink-0 text-action`}>{serial}</p>
        <h2 className="font-display text-2xl text-text">{title}</h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-muted">{note}</p>
      <div className="plab-card overflow-hidden border border-border bg-bg">
        <svg viewBox="0 0 1440 720" className="block h-auto w-full" aria-hidden="true">
          {children}
        </svg>
      </div>
    </div>
  );
}

export const metadata = { title: 'Pattern Lab — SeoScrub sandbox', robots: { index: false } };

export default function PatternLabPage() {
  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className={`${microLabel} text-text-subtle mb-2`}>
          Sandbox &middot; Round 2 &middot; Not linked in nav
        </p>
        <h1 className="font-display text-4xl text-text mb-3">Pattern Lab</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted mb-2">
          Rebuilt from round-1 feedback: no more full-width chain boxes, real choreography on the
          constellation, and a honeycomb you can actually touch.{' '}
          <strong className="text-text">Hover the panels</strong> &mdash; on C, move the mouse
          around inside the mesh.
        </p>
        <p className={`${microLabel} text-text-subtle mb-6`}>
          Strokes boosted for comparison &mdash; in situ they run far quieter.
        </p>
        <div className="mb-12">
          <AccentToggle />
          <p className={`${microLabel} text-text-subtle mt-2`}>
            Teal is the default now; the toggle previews the legacy green ramp. Applies while you
            navigate (client-side); hard reload resets. Status colors stay green either way.
          </p>
        </div>

        <div className="space-y-16">
          <PatternCard
            serial="A"
            title="Site graph — organic"
            note="The long chains are gone; links now live inside small page-clusters at hex angles, nothing spans the panel, so no boxes. Hover: short scan pulses fire cluster to cluster and the page apexes ping — network chatter, not a plotter drawing."
          >
            <defs>
              <pattern id="plab-a" width="720" height="720" patternUnits="userSpaceOnUse">
                <OrganicTile />
              </pattern>
            </defs>
            <rect width="1440" height="720" fill="url(#plab-a)" />
            <OrganicPulses />
          </PatternCard>

          <PatternCard
            serial="B"
            title="Minimal constellation — choreographed"
            note="Same quiet survey-grid, now with the animation it was missing. Hover: the dots march along the rules, hex apexes ping in sequence, and green ticks twinkle across the field like URLs lighting up as they're checked."
          >
            <defs>
              <pattern id="plab-b" width="360" height="360" patternUnits="userSpaceOnUse">
                <g stroke="var(--color-border-strong)" fill="none" strokeWidth="1">
                  <line className="plab-march" x1="180" y1="0" x2="180" y2="360" strokeDasharray="1 6" />
                  <line className="plab-march" x1="0" y1="180" x2="360" y2="180" strokeDasharray="1 6" />
                  <polygon points={hexPoints(180, 180, 14)} />
                  <polygon points={hexPoints(40, 40, 10)} opacity="0.55" />
                </g>
                <g fill="var(--color-border-strong)">
                  <circle cx="180" cy="60" r="1.2" />
                  <circle cx="180" cy="300" r="1.2" />
                  <circle cx="60" cy="180" r="1.2" />
                  <circle cx="300" cy="180" r="1.2" />
                  <circle cx="290" cy="70" r="1.2" opacity="0.55" />
                  <circle cx="80" cy="300" r="1.2" opacity="0.55" />
                </g>
                <circle cx="180" cy="166" r="2" fill="var(--color-accent)" opacity="0.55" />
              </pattern>
            </defs>
            <rect width="1440" height="720" fill="url(#plab-b)" />
            <g stroke="var(--color-accent)">
              {[
                [180, 166, '0s'],
                [900, 166, '0.5s'],
                [540, 526, '1s'],
                [1260, 526, '1.5s'],
              ].map(([cx, cy, delay]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r="2.5" fill="var(--color-accent)" stroke="none" />
                  <circle
                    className="plab-ping"
                    style={{ animationDelay: delay }}
                    cx={cx}
                    cy={cy}
                    r="2.5"
                    fill="none"
                    strokeWidth="1"
                  />
                </g>
              ))}
            </g>
            <g fill="var(--color-accent)">
              {[
                [300, 180, '0.2s'],
                [660, 180, '1.1s'],
                [1140, 180, '1.9s'],
                [60, 540, '0.7s'],
                [420, 540, '1.5s'],
                [780, 540, '0.4s'],
                [1380, 540, '2.2s'],
                [1020, 180, '2.6s'],
              ].map(([cx, cy, delay]) => (
                <circle
                  key={`${cx}-${cy}`}
                  className="plab-twinkle"
                  style={{ animationDelay: delay }}
                  cx={cx}
                  cy={cy}
                  r="1.5"
                />
              ))}
            </g>
          </PatternCard>

          <PatternCard
            serial="C"
            title="Honeycomb — interactive"
            note="Every cell is real now. Move the mouse through the mesh: cells light green instantly and fade out slowly behind you — a scrub trail. One cell carries the S mark; a few sit brighter for depth. (On the homepage this reacts in the space around content; areas under text keep the static mesh.)"
          >
            <HoneycombCells />
          </PatternCard>
        </div>

        <p className={`${microLabel} text-text-subtle mt-16`}>
          End of round 2 &mdash; pick the direction (or the crossbreed) and it ships.
        </p>
      </main>

      <style>{`
        .plab-pulse { opacity: 0; }
        .plab-ping {
          opacity: 0;
          stroke: var(--color-accent);
          transform-box: fill-box;
          transform-origin: center;
          animation-duration: 2.4s;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-iteration-count: infinite;
          animation-name: none;
        }
        .plab-twinkle {
          opacity: 0;
          animation-duration: 2.8s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-name: none;
        }

        .plab-cell {
          fill: transparent;
          stroke: var(--color-border-strong);
          stroke-opacity: 0.22;
          transition: stroke-opacity 1.6s ease, stroke 1.6s ease;
        }
        .plab-cell-hi { stroke-opacity: 0.45; }
        .plab-cell:hover {
          stroke: var(--color-accent);
          stroke-opacity: 0.9;
          transition-duration: 0.05s, 0.05s;
        }

        @media (prefers-reduced-motion: no-preference) {
          .plab-card:hover .plab-pulse { opacity: 1; }
          .plab-card:hover .plab-p1 { animation: plab-dash 1.8s linear infinite; }
          .plab-card:hover .plab-p2 { animation: plab-dash 1.6s linear infinite 0.6s; }
          .plab-card:hover .plab-p3 { animation: plab-dash 2s linear infinite 1.1s; }
          .plab-card:hover .plab-p4 { animation: plab-dash 1.5s linear infinite 0.9s; }
          .plab-card:hover .plab-ping { animation-name: plab-ping; opacity: 1; }
          .plab-card:hover .plab-twinkle { animation-name: plab-twinkle; }
          .plab-card:hover .plab-march { animation: plab-march 0.9s linear infinite; }
        }

        .plab-pulse { stroke-dasharray: 18 100; }
        @keyframes plab-dash { from { stroke-dashoffset: 118; } to { stroke-dashoffset: 0; } }
        @keyframes plab-march { from { stroke-dashoffset: 7; } to { stroke-dashoffset: 0; } }
        @keyframes plab-ping {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes plab-twinkle {
          0%, 100% { opacity: 0; }
          40% { opacity: 0.8; }
          60% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
