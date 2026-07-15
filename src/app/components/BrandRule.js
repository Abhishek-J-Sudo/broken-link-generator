import Image from 'next/image';

/**
 * Brand section rule — hairline with node terminals and the S mark at center
 * (brand board #7, restrained: no glow, print-safe). Drop-in replacement for
 * a plain `h-px bg-border` document rule; use sparingly — mastheads and
 * document-level breaks, not every section.
 */
export default function BrandRule({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-border-strong" />
      <span className="h-px flex-1 bg-border" />
      <Image
        src="/seo-scrub-app-logo.png"
        alt=""
        width={93}
        height={113}
        className="h-3.5 w-auto opacity-70"
      />
      <span className="h-px flex-1 bg-border" />
      <span className="h-1 w-1 rounded-full bg-border-strong" />
    </div>
  );
}
