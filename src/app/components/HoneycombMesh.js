/**
 * HoneycombMesh — the interactive variant of the main brand texture
 * (pattern lab round 2, C). Real SVG cells so the pointer lights them:
 * hover a cell and it flashes accent, then fades out slowly — a scrub
 * trail through the mesh. One cell carries the angular S mark; a few sit
 * brighter for depth; sparse accent apex nodes echo GradeHex.
 *
 * Rendered as an absolute background layer. It must NOT be
 * pointer-events-none — the hover IS the point — but content stacked
 * after it (position: relative) still receives its own events, so the
 * mesh only reacts in the open space around content.
 *
 * Lattice: pointy-top hexagons r=52; column pitch 90, row pitch 156,
 * odd rows offset 45. Coverage 2700x1100 handles ultrawide heroes.
 */

const R = 52;

function hexPoints(cx, cy, r) {
  const dx = r * 0.866;
  const dy = r / 2;
  return `${cx},${cy - r} ${cx + dx},${cy - dy} ${cx + dx},${cy + dy} ${cx},${cy + r} ${cx - dx},${cy + dy} ${cx - dx},${cy - dy}`;
}

const HI_CELLS = new Set([
  '405,338',
  '900,572',
  '135,26',
  '1215,182',
  '630,650',
  '1350,416',
  '1800,104',
  '2205,494',
]);

export default function HoneycombMesh({ className = '' }) {
  const cells = [];
  for (let j = 0; j < 7; j += 1) {
    for (let i = 0; i < 30; i += 1) {
      cells.push([45 + 90 * i, 26 + 156 * j]);
    }
  }
  for (let j = 0; j < 7; j += 1) {
    for (let i = 0; i < 31; i += 1) {
      cells.push([90 * i, 104 + 156 * j]);
    }
  }
  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg className="h-full w-full" strokeWidth="1">
        {cells.map(([cx, cy]) => (
          <polygon
            key={`${cx},${cy}`}
            className={`hexmesh-cell${HI_CELLS.has(`${cx},${cy}`) ? ' hexmesh-hi' : ''}`}
            points={hexPoints(cx, cy, R)}
          />
        ))}
        {/* Brand S marks (traced logo SVG) breathing in and out of cells:
            staggered 12s fades so ~1-2 are faintly visible somewhere at any
            moment. Positions are lattice cell centers spread across widths. */}
        {[
          [405, 338, '0s'],
          [1305, 494, '3s'],
          [720, 572, '6s'],
          [1980, 260, '9s'],
        ].map(([cx, cy, delay]) => (
          <image
            key={`${cx},${cy}`}
            className="hexmesh-s"
            style={{ animationDelay: delay }}
            href="/seoscrub-logo.svg"
            x={cx - 14.8}
            y={cy - 18}
            width="29.6"
            height="36"
            pointerEvents="none"
          />
        ))}
        {/* Sparse accent apex nodes */}
        <g fill="var(--color-accent)" opacity="0.6" pointerEvents="none">
          <circle cx="405" cy="286" r="2" />
          <circle cx="900" cy="520" r="2" />
          <circle cx="1215" cy="130" r="2" />
          <circle cx="1935" cy="286" r="2" />
        </g>
      </svg>
    </div>
  );
}
