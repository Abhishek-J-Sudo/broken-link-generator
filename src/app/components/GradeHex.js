/**
 * GradeHex — the brand's one sanctioned exception to square containers:
 * the score that matters sits inside a hairline hexagon (brand board #5).
 * Pointy-top regular hexagon, hairline stroke, single brand-accent node on the
 * top vertex. Everything else in a report stays square so this lands.
 */
export default function GradeHex({
  grade,
  sub,
  tone = 'text-text',
  size = 150,
  gradeClass = 'font-display text-6xl',
}) {
  // Regular pointy-top hexagon: height = width * 2/√3
  const height = Math.round(size * 1.1547);
  return (
    <div
      className="relative inline-flex flex-col items-center justify-center"
      style={{ width: size, height }}
    >
      <svg
        viewBox="0 0 104 120.09"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <polygon
          points="52,2 102,30.87 102,88.6 52,117.47 2,88.6 2,30.87"
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="52" cy="2" r="2.5" fill="var(--color-accent)" />
      </svg>
      <p className={`leading-none ${gradeClass} ${tone}`}>{grade}</p>
      {sub && <p className="mt-2 font-mono text-xs text-text-muted">{sub}</p>}
    </div>
  );
}
