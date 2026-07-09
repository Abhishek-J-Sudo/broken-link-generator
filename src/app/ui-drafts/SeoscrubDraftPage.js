'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  Gauge,
  Globe2,
  Image,
  Info,
  Link2,
  MonitorCheck,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

const navItems = ['Features', 'Pricing', 'Resources', 'Blog'];
const tabs = ['Overview', 'Issues', 'Broken Links', 'On-Page', 'Performance', 'Security'];

const stats = [
  { label: 'Crawled Pages', value: '1,248', trend: '+12%', tone: 'green', icon: Globe2 },
  { label: 'Indexable Pages', value: '1,102', trend: '+8%', tone: 'green', icon: FileCheck2 },
  { label: 'Broken Links', value: '48', trend: '-15%', tone: 'red', icon: Link2 },
  { label: 'Issues', value: '35', trend: '-20%', tone: 'amber', icon: AlertTriangle },
];

const issues = [
  { label: 'Broken Links', count: '48', tone: 'red', icon: Link2 },
  { label: 'Missing Meta Description', count: '18', tone: 'amber', icon: MonitorCheck },
  { label: 'Images Missing Alt Text', count: '36', tone: 'blue', icon: Image },
  { label: 'Slow Page Speed', count: '12', tone: 'blue', icon: Gauge },
];

const features = [
  { title: 'Fast & Accurate', body: 'Get precise results in minutes', icon: Target },
  { title: 'Easy to Use', body: 'Simple interface, powerful reports', icon: MonitorCheck },
  { title: 'Actionable', body: 'Clear steps to fix SEO issues', icon: ShieldCheck },
  { title: 'Trusted', body: 'By marketers, agencies & website owners', icon: Shield },
];

const palette = [
  ['Primary Green', '#16A34A'],
  ['Hover Green', '#059669'],
  ['Success Green', '#22C55E'],
  ['Dark Text', '#0F172A'],
  ['Slate Text', '#64748B'],
  ['Soft Background', '#F8FAFC'],
  ['Error Red', '#EF4444'],
  ['Warning Amber', '#F59E0B'],
  ['Blue Accent', '#2563EB'],
];

const iconTone = {
  green: 'bg-[#DCFCE7] text-[#16A34A]',
  red: 'bg-[#FEE2E2] text-[#EF4444]',
  amber: 'bg-[#FEF3C7] text-[#F59E0B]',
  blue: 'bg-[#DBEAFE] text-[#2563EB]',
};

function Logo({ markOnly = false, stacked = false, dark = false, size = 'md' }) {
  const mark = size === 'lg' ? 'h-16 w-16 rounded-[18px]' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-11 w-11 rounded-xl';
  const text = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  const s = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className={`inline-flex ${stacked ? 'flex-col items-center gap-3' : 'items-center gap-3'}`}>
      <div className={`${mark} grid place-items-center bg-gradient-to-br from-[#22C55E] to-[#059669] text-white shadow-[0_14px_30px_rgba(22,163,74,0.22)]`}>
        <span className={`${s} font-black leading-none`}>S</span>
      </div>
      {!markOnly && (
        <span className={`${text} font-black tracking-[-0.02em] ${dark ? 'text-white' : 'text-[#0F172A]'}`}>
          SEOSCRUB
        </span>
      )}
    </div>
  );
}

// Abstract layered "aurora" pattern for the green CTAs — overlapping translucent
// gradient layers (highlights + emerald depths + a soft conic swirl) blended over
// the base button gradient. On hover the layer scales + rotates so the pattern
// visibly shifts. Pure Tailwind + a React inline gradient (no external CSS).
const ctaAuroraStyle = {
  backgroundImage: [
    'radial-gradient(120% 95% at 10% 4%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 42%)',
    'radial-gradient(90% 85% at 92% 12%, rgba(217,249,157,0.50) 0%, rgba(217,249,157,0) 48%)',
    'radial-gradient(125% 105% at 78% 128%, rgba(4,120,87,0.75) 0%, rgba(4,120,87,0) 52%)',
    'conic-gradient(from 210deg at 42% 55%, rgba(255,255,255,0.25), rgba(255,255,255,0) 32%, rgba(6,95,70,0.38) 66%, rgba(255,255,255,0) 100%)',
  ].join(', '),
};

function CtaPattern() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <span
        className="absolute inset-[-30%] mix-blend-overlay transition-transform duration-700 ease-out group-hover:rotate-[10deg] group-hover:scale-[1.35]"
        style={ctaAuroraStyle}
      />
    </span>
  );
}

function Button({ variant = 'primary', disabled = false }) {
  const styles = {
    primary:
      'bg-[linear-gradient(180deg,#22C55E_0%,#16A34A_46%,#059669_100%)] text-white shadow-[0_10px_22px_rgba(22,163,74,0.24),inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-[linear-gradient(180deg,#16A34A_0%,#059669_100%)]',
    secondary: 'border border-[#E5E7EB] bg-white text-[#16A34A] shadow-sm hover:border-[#16A34A]',
    ghost: 'text-[#16A34A] hover:bg-[#F1F5F9]',
    outline: 'border border-[#16A34A] bg-white text-[#16A34A] hover:bg-[#F0FDF4]',
  };

  const showPattern = variant === 'primary' && !disabled;

  return (
    <button
      disabled={disabled}
      className={`group relative isolate h-11 overflow-hidden whitespace-nowrap rounded-lg px-6 text-sm font-semibold transition ${styles[variant]} ${
        disabled ? 'cursor-not-allowed border-0 bg-[#DCFCE7] text-[#74A987] shadow-none hover:bg-[#DCFCE7]' : ''
      }`}
    >
      {showPattern && <CtaPattern />}
      <span className="relative z-10">Start Free Audit</span>
    </button>
  );
}

function ToneIcon({ icon: Icon, tone = 'green' }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconTone[tone]}`}>
      <Icon size={21} strokeWidth={2.2} />
    </span>
  );
}

function UrlInput() {
  return (
    <div className="flex min-h-14 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white shadow-sm">
      <div className="flex min-w-0 flex-1 items-center px-5 text-sm text-[#64748B]">Enter your website URL</div>
      <button className="group relative isolate overflow-hidden bg-[linear-gradient(180deg,#22C55E_0%,#16A34A_46%,#059669_100%)] px-6 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-[linear-gradient(180deg,#16A34A_0%,#059669_100%)]">
        <CtaPattern />
        <span className="relative z-10">Start Free Audit</span>
      </button>
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-[0.02em] text-[#0F172A]">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ item }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-3">
        <ToneIcon icon={item.icon} tone={item.tone} />
        <span className="text-sm font-semibold text-[#334155]">{item.label}</span>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <strong className="text-3xl font-bold tracking-[-0.02em] text-[#0F172A]">{item.value}</strong>
        <span className={`text-sm font-bold ${item.tone === 'red' ? 'text-[#EF4444]' : 'text-[#16A34A]'}`}>
          {item.trend}
        </span>
      </div>
    </div>
  );
}

function IssueTag({ item }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex min-w-0 items-center gap-4">
        <ToneIcon icon={item.icon} tone={item.tone} />
        <span className="truncate text-sm font-semibold text-[#0F172A]">{item.label}</span>
      </div>
      <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-sm font-bold text-[#334155]">{item.count}</span>
    </div>
  );
}

function ReportPreview() {
  const chartPoints = [
    [45, 125],
    [80, 120],
    [110, 118],
    [145, 105],
    [180, 95],
    [215, 97],
    [245, 96],
    [278, 78],
    [310, 64],
    [370, 54],
    [430, 58],
    [465, 48],
    [492, 32],
    [510, 28],
  ];

  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap gap-8 border-b border-[#E5E7EB] px-2 text-sm font-medium text-[#334155]">
        {tabs.map((tab, index) => (
          <div key={tab} className={`pb-4 ${index === 0 ? 'border-b-4 border-[#16A34A] font-bold text-[#0F172A]' : ''}`}>
            {tab}
          </div>
        ))}
      </div>

      <div className="mt-4 grid overflow-hidden rounded-2xl border border-[#E5E7EB] lg:grid-cols-[0.38fr_0.62fr]">
        <div className="border-b border-[#E5E7EB] p-6 lg:border-b-0 lg:border-r">
          <h3 className="font-bold text-[#0F172A]">Overall SEO Score</h3>
          <div className="mx-auto mt-5 grid h-36 w-36 place-items-center rounded-full bg-[conic-gradient(#16A34A_0_88%,#DCFCE7_88%_100%)] p-3">
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
              <div>
                <div className="text-4xl font-black text-[#0F172A]">88</div>
                <div className="mt-1 text-sm font-semibold text-[#16A34A]">Excellent</div>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-48 text-center text-sm leading-6 text-[#64748B]">
            Great job! Your website is well optimized.
          </p>
        </div>

        <div className="p-6">
          <h3 className="font-bold text-[#0F172A]">SEO Score Trend</h3>
          <div className="mt-7 h-44">
            <svg viewBox="0 0 520 170" className="h-full w-full" role="img" aria-label="SEO score trend chart">
              <defs>
                <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#22C55E" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[25, 80, 135].map((y) => (
                <line key={y} x1="20" y1={y} x2="510" y2={y} stroke="#E5E7EB" />
              ))}
              <text x="0" y="30" fontSize="12" fill="#64748B">100</text>
              <text x="7" y="84" fontSize="12" fill="#64748B">50</text>
              <text x="14" y="139" fontSize="12" fill="#64748B">0</text>
              <path d="M45 125 L80 120 L110 118 L145 105 L180 95 L215 97 L245 96 L278 78 L310 64 L370 54 L430 58 L465 48 L492 32 L510 28 L510 145 L45 145 Z" fill="url(#trendFill)" />
              <path d="M45 125 L80 120 L110 118 L145 105 L180 95 L215 97 L245 96 L278 78 L310 64 L370 54 L430 58 L465 48 L492 32 L510 28" fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" />
              {chartPoints.map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="#16A34A" />
              ))}
              <text x="42" y="165" fontSize="12" fill="#64748B">Apr 20</text>
              <text x="170" y="165" fontSize="12" fill="#64748B">Apr 27</text>
              <text x="300" y="165" fontSize="12" fill="#64748B">May 04</text>
              <text x="430" y="165" fontSize="12" fill="#64748B">May 11</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} item={item} />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-bold text-[#0F172A]">Recent Issues</h3>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
            View All Issues <ArrowRight size={15} />
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {issues.map((item) => (
            <IssueTag key={item.label} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LandingDraft() {
  return (
    <section className="rounded-[28px] bg-white px-7 py-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <header className="flex items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-10 text-sm font-medium text-[#334155] lg:flex">
          {navItems.map((item) => (
            <span key={item} className="inline-flex items-center gap-1">
              {item}
              {item === 'Resources' && <ChevronDown size={14} />}
            </span>
          ))}
        </nav>
        <div className="hidden items-center gap-6 lg:flex">
          <span className="text-sm font-medium text-[#334155]">Log in</span>
          <Button />
        </div>
      </header>

      <div className="mt-16 grid items-center gap-12 xl:grid-cols-[0.34fr_0.66fr]">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-medium text-[#334155]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#16A34A]">
              <Link2 size={15} />
            </span>
            SEO Audit & Broken Link Checker
          </div>
          <h1 className="mt-7 text-5xl font-black leading-[1.15] tracking-[-0.02em] text-[#0F172A] md:text-6xl">
            Clean Site.
            <span className="block text-[#16A34A]">Better SEO.</span>
            More Traffic.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#475569]">
            SEOScrub helps you find SEO issues, fix broken links, and optimize your website for top rankings.
          </p>
          <div className="mt-8 max-w-lg">
            <UrlInput />
          </div>
          <div className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {[
              [MonitorCheck, '10K+', 'Websites Audited'],
              [ShieldCheck, '99%', 'Issue Detection'],
              [Clock3, '24/7', 'Always Available'],
            ].map(([Icon, value, label]) => (
              <div key={label} className="text-center">
                <Icon className="mx-auto text-[#334155]" size={28} />
                <div className="mt-3 text-2xl font-black text-[#0F172A]">{value}</div>
                <div className="mt-2 text-xs text-[#64748B]">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <ReportPreview />
      </div>

      <div className="mt-8 rounded-3xl bg-[#F8FAFC] p-8">
        <div className="grid items-center gap-5 lg:grid-cols-[0.18fr_0.82fr]">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-[#0F172A]">Why SEOScrub?</h2>
          <div className="grid gap-5 md:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <feature.icon className="text-[#16A34A]" size={36} strokeWidth={2.2} />
                <h3 className="mt-4 font-bold text-[#0F172A]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#475569]">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandKit() {
  const traits = [
    [Sparkles, 'Clean', 'Minimal, clear visuals that reduce noise.'],
    [ShieldCheck, 'Trustworthy', 'Reliable insights you can count on.'],
    [Target, 'Actionable', 'Turn insights into steps that drive results.'],
    [Gauge, 'Precise', 'Accurate data and detailed analysis.'],
    [Zap, 'Modern', 'Fresh, current and built for today.'],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard title="1. Logo System">
        <div className="mt-8 grid divide-y divide-[#E5E7EB] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="flex min-h-56 items-center justify-center p-8">
            <Logo size="lg" />
          </div>
          <div className="flex min-h-56 items-center justify-center p-8">
            <Logo markOnly size="lg" />
          </div>
          <div className="flex min-h-56 items-center justify-center p-8">
            <Logo stacked />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="2. Color Palette">
        <div className="mt-8 grid grid-cols-2 gap-7 sm:grid-cols-4">
          {palette.slice(0, 8).map(([name, hex]) => (
            <div key={hex}>
              <div className="h-20 rounded-xl border border-[#E5E7EB] shadow-inner" style={{ backgroundColor: hex }} />
              <div className="mt-3 text-sm font-semibold text-[#0F172A]">{name}</div>
              <div className="mt-1 text-sm text-[#64748B]">{hex}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="3. Typography">
        <div className="mt-7 grid gap-8 md:grid-cols-[0.25fr_0.75fr]">
          <div className="text-8xl font-black tracking-[-0.02em] text-[#0F172A]">Aa</div>
          <div className="space-y-5">
            <div className="border-b border-[#E5E7EB] pb-4">
              <div className="flex justify-between gap-4 text-xs text-[#64748B]">
                <span>Heading (H1)</span>
                <span>Inter Bold / 36-44</span>
              </div>
              <p className="mt-2 text-3xl font-black tracking-[-0.02em] text-[#0F172A]">Clean site. Better SEO. More traffic.</p>
            </div>
            <div className="border-b border-[#E5E7EB] pb-4">
              <div className="flex justify-between gap-4 text-xs text-[#64748B]">
                <span>Subheading (H2)</span>
                <span>Inter Semibold / 20-28</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-[#0F172A]">Identify issues, fix problems, and grow your rankings.</p>
            </div>
            <div>
              <div className="flex justify-between gap-4 text-xs text-[#64748B]">
                <span>Body</span>
                <span>Inter Regular / 16-24</span>
              </div>
              <p className="mt-2 max-w-xl text-base leading-7 text-[#475569]">
                SEOScrub helps you find SEO issues, fix broken links, and optimize your website for top rankings.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="4. Brand Traits">
        <div className="mt-8 grid gap-5 sm:grid-cols-5">
          {traits.map(([Icon, title, body]) => (
            <div key={title} className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
                <Icon size={34} strokeWidth={2.1} />
              </div>
              <h3 className="mt-4 font-bold text-[#0F172A]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#64748B]">{body}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function LogoVariants() {
  return (
    <SectionCard title="Logo Mark & App Icon Variants">
      <div className="mt-8 grid gap-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex min-h-40 items-center justify-center border-b border-[#E5E7EB] pb-8 lg:border-b-0 lg:border-r lg:pb-0">
            <Logo size="lg" />
          </div>
          <div className="flex min-h-40 items-center justify-center">
            <Logo markOnly size="lg" />
          </div>
        </div>
        <div className="grid gap-8 border-t border-[#E5E7EB] pt-8 md:grid-cols-4">
          {[
            ['iOS Light', 'bg-white', false],
            ['Android Light', 'bg-[#16A34A]', true],
            ['Light BG Primary', 'bg-[#F8FAFC]', false],
            ['Dark BG Monochrome', 'bg-[#0F172A]', true],
          ].map(([label, bg, invert]) => (
            <div key={label} className="text-center">
              <div className={`mx-auto grid h-28 w-28 place-items-center rounded-3xl border border-[#E5E7EB] ${bg} shadow-lg`}>
                <div className={`grid h-16 w-16 place-items-center rounded-2xl ${invert ? 'bg-white text-[#16A34A]' : 'bg-[#16A34A] text-white'}`}>
                  <span className="text-3xl font-black">S</span>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-[#475569]">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-8 border-t border-[#E5E7EB] pt-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#0F172A]">Favicon Variants</h3>
            <div className="mt-6 flex items-end gap-10">
              {[16, 32, 48, 64].map((size) => (
                <div key={size} className="text-center">
                  <div
                    className="grid place-items-center rounded bg-[#16A34A] text-white"
                    style={{ width: size, height: size, borderRadius: Math.max(4, size / 5) }}
                  >
                    <span className="font-black" style={{ fontSize: Math.max(10, size / 2.1) }}>S</span>
                  </div>
                  <p className="mt-3 text-sm text-[#64748B]">{size}px</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.02em] text-[#0F172A]">Browser Tab Previews</h3>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
                  <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                  <span className="h-3 w-3 rounded-full bg-[#22C55E]" />
                  <Logo size="sm" />
                  <span className="ml-auto text-[#64748B]">x</span>
                </div>
              </div>
              <div className="rounded-xl bg-[#0F172A] p-4 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
                  <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                  <span className="h-3 w-3 rounded-full bg-[#22C55E]" />
                  <Logo size="sm" dark />
                  <span className="ml-auto text-white/70">x</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ComponentsBoard() {
  const buttonRows = ['primary', 'secondary', 'ghost', 'outline'];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="1. Button Styles">
        <div className="mt-7 overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-[0.7fr_repeat(4,1fr)] items-center gap-5 text-sm">
            {['', 'Default', 'Hover', 'Active', 'Disabled'].map((item) => (
              <div key={item || 'blank'} className="font-medium text-[#475569]">{item}</div>
            ))}
            {buttonRows.map((variant) => (
              <div key={`${variant}-row`} className="contents">
                <div className="font-bold capitalize text-[#0F172A]">{variant}</div>
                <Button variant={variant} />
                <Button variant={variant} />
                <Button variant={variant} />
                <Button variant={variant} disabled />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6">
        <SectionCard title="2. URL Input With Button">
          <div className="mt-7">
            <UrlInput />
          </div>
        </SectionCard>

        <SectionCard title="3. Top Navigation & CTA Styles">
          <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-8 text-sm font-medium text-[#334155]">
              {navItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-1">
                  {item}
                  {item === 'Resources' && <ChevronDown size={14} />}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-5">
              <span className="text-sm font-medium text-[#334155]">Log in</span>
              <Button />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="4. Tabs">
          <div className="mt-7 flex flex-wrap gap-8 text-sm font-semibold text-[#334155]">
            {tabs.map((tab, index) => (
              <span key={tab} className={`pb-3 ${index === 0 ? 'border-b-4 border-[#16A34A] text-[#0F172A]' : ''}`}>
                {tab}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="5. Stat Cards">
        <div className="mt-7 grid gap-4 md:grid-cols-4">
          {stats.map((item) => (
            <StatCard key={item.label} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="6. Issue Tags">
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {issues.map((item) => (
            <IssueTag key={item.label} item={item} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="7. Status Badges">
        <div className="mt-7 flex flex-wrap gap-5">
          {[
            ['Success', CheckCircle2, 'bg-[#DCFCE7] text-[#16A34A]'],
            ['Warning', AlertTriangle, 'bg-[#FEF3C7] text-[#F59E0B]'],
            ['Error', AlertTriangle, 'bg-[#FEE2E2] text-[#EF4444]'],
            ['Info', Info, 'bg-[#DBEAFE] text-[#2563EB]'],
          ].map(([label, Icon, tone]) => (
            <span key={label} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tone}`}>
              <Icon size={16} /> {label}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="8. Feature Cards">
        <div className="mt-7 grid gap-4 md:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <feature.icon className="text-[#16A34A]" size={34} />
              <h3 className="mt-5 font-bold text-[#0F172A]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#475569]">{feature.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="9. Card Styles & Spacing Tokens" className="xl:col-span-2">
        <div className="mt-7 grid gap-8 lg:grid-cols-[0.58fr_0.42fr]">
          <div className="grid gap-5 md:grid-cols-3">
            {['Default Card', 'Elevated Card', 'Outline Card'].map((title, index) => (
              <div
                key={title}
                className={`rounded-xl border border-[#E5E7EB] bg-white p-5 ${
                  index === 1 ? 'shadow-[0_12px_28px_rgba(15,23,42,0.10)]' : index === 2 ? 'shadow-none' : 'shadow-sm'
                }`}
              >
                <h3 className="font-bold text-[#0F172A]">Card Title</h3>
                <p className="mt-3 text-sm leading-6 text-[#475569]">This is a {title.toLowerCase()} used for content and information.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
                  View Details <ArrowRight size={15} />
                </span>
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Spacing Scale</h3>
              <div className="mt-5 flex items-end gap-5">
                {[4, 8, 12, 16, 24, 32, 40, 48, 64].map((size) => (
                  <div key={size} className="text-center">
                    <div className="mx-auto rounded bg-[#BBF7D0]" style={{ width: size / 1.6, height: size / 1.6 }} />
                    <div className="mt-3 text-xs text-[#64748B]">{size}px</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Radius Scale</h3>
              <div className="mt-5 flex items-end gap-5">
                {[4, 8, 12, 16].map((radius) => (
                  <div key={radius} className="text-center">
                    <div className="h-12 w-12 bg-[#DCFCE7]" style={{ borderRadius: radius }} />
                    <div className="mt-3 text-xs text-[#64748B]">{radius}px</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Foundations() {
  return (
    <SectionCard title="10. Foundations">
      <div className="mt-7 grid gap-8 lg:grid-cols-3">
        <div>
          <h3 className="font-bold text-[#0F172A]">Color Palette</h3>
          <div className="mt-5 flex flex-wrap gap-5">
            {palette.map(([name, hex]) => (
              <div key={hex} className="text-center">
                <div className="mx-auto h-9 w-9 rounded-full border border-[#E5E7EB]" style={{ backgroundColor: hex }} title={name} />
                <div className="mt-2 text-xs text-[#64748B]">{hex}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-[#0F172A]">Typography</h3>
          <div className="mt-5 flex items-center gap-5">
            <span className="text-6xl font-black text-[#0F172A]">Aa</span>
            <div className="h-12 w-px bg-[#E5E7EB]" />
            <div>
              <div className="font-bold text-[#0F172A]">Inter</div>
              <div className="mt-1 text-sm text-[#64748B]">Heading / Semibold</div>
              <div className="text-sm text-[#64748B]">Body / Regular</div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-[#0F172A]">Shadows</h3>
          <div className="mt-5 grid grid-cols-3 gap-6">
            {[
              ['sm', 'shadow-sm'],
              ['md', 'shadow-md'],
              ['lg', 'shadow-lg'],
            ].map(([label, shadow]) => (
              <div key={label}>
                <div className={`h-12 rounded bg-white ${shadow}`} />
                <div className="mt-3 text-center text-xs text-[#64748B]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function SeoscrubDraftPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1536px]">
        <div className="mb-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden h-10 w-px bg-[#CBD5E1] sm:block" />
            <div>
              <p className="text-lg font-bold tracking-[0.18em] text-[#64748B]">UI DRAFTS</p>
              <p className="mt-1 text-sm text-[#64748B]">Matched to the approved SEOSCRUB design screenshots</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-sm font-semibold text-[#334155] shadow-sm transition hover:border-[#16A34A] hover:text-[#16A34A]"
          >
            Back to App
          </Link>
        </div>

        <div className="space-y-8">
          <LandingDraft />
          <BrandKit />
          <LogoVariants />
          <ComponentsBoard />
          <Foundations />
        </div>

        <footer className="py-8 text-center text-sm text-[#64748B]">
          <span className="font-bold text-[#16A34A]">SEOSCRUB</span>
          <span className="px-3">.</span>
          Clean site. Better SEO. More traffic.
        </footer>
      </div>
    </main>
  );
}
