'use client';

export { default } from './SeoscrubDraftPage';

/*
import Link from 'next/link';

const metrics = [
  { label: 'Health Score', value: '78/100', tone: 'bg-[#f5d96b] text-[#3a2d00]' },
  { label: 'Broken Links', value: '184', tone: 'bg-[#ffb0a8] text-[#5a1007]' },
  { label: 'Affected Pages', value: '67', tone: 'bg-[#d8e1ea] text-[#203040]' },
  { label: 'Healthy Links', value: '11,903', tone: 'bg-[#b9edc5] text-[#133b1d]' },
];

const takeaways = [
  'Internal 404s are concentrated in shared navigation and footer templates.',
  'The pricing page and SEO resource pages account for the highest issue density.',
  'Most fixes can be resolved by updating templates before content-by-content cleanup.',
];

const priorities = [
  {
    severity: 'Critical',
    count: 12,
    detail: 'Navigation links to retired campaign pages are returning 404s.',
    action: 'Update shared header and footer references.',
  },
  {
    severity: 'Major',
    count: 41,
    detail: 'External documentation links are timing out from product pages.',
    action: 'Replace unstable vendor links or route them through monitored redirects.',
  },
  {
    severity: 'Minor',
    count: 26,
    detail: 'Metadata and low-priority content issues remain on support pages.',
    action: 'Bundle into the next content QA sprint.',
  },
];

const pages = [
  { page: '/pricing', issues: 18, owner: 'Marketing' },
  { page: '/resources/seo-audit-guide', issues: 14, owner: 'Content' },
  { page: '/blog/how-to-fix-broken-links', issues: 11, owner: 'SEO' },
];

const rows = [
  {
    source: '/pricing',
    target: 'https://acme.com/campaign/spring-growth',
    type: '404',
    severity: 'Critical',
  },
  {
    source: '/resources/seo-audit-guide',
    target: 'https://vendor.example/docs/api',
    type: 'Timeout',
    severity: 'Major',
  },
  {
    source: '/blog/how-to-fix-broken-links',
    target: 'https://acme.com/old-guide',
    type: '404',
    severity: 'Major',
  },
];

const breakdown = [
  { label: '404 Not Found', value: '43%' },
  { label: 'Timeouts', value: '24%' },
  { label: '5xx Errors', value: '18%' },
  { label: 'SEO Metadata', value: '15%' },
];

function Intro() {
  return (
    <div className="rounded-[36px] border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur md:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            SeoScrub UI Drafts
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Three bolder reporting concepts with actual personality
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            Same audit data. Different visual metaphors and different page structures. These are
            meant to feel more like artifacts with a point of view, less like generic admin UI.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Back to App
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['A', 'Newspaper Audit'],
          ['B', 'Consulting Deck'],
          ['C', 'Forensic Workspace'],
        ].map(([code, label]) => (
          <a
            key={code}
            href={`#concept-${code.toLowerCase()}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Concept {code}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function ThemeDemos() {
  return (
    <section className="rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-xl md:p-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Theme Demos
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">
          Four short slices of the new design system
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          These are not alternate concepts. They are small, practical examples showing how the
          approved green, navy, soft-white, rounded-card theme looks across common surfaces.
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-7 py-8">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
              SEO Audit & Broken Link Checker
            </span>
            <h3 className="mt-5 max-w-lg text-4xl font-semibold leading-tight text-slate-950">
              Clean site. <span className="text-emerald-600">Better SEO.</span> More traffic.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
              SeoScrub helps teams find broken links, review issues clearly, and act on the next
              best fixes with confidence.
            </p>
            <div className="mt-6 flex max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex-1 px-4 py-4 text-sm text-slate-400">Enter your website URL</div>
              <div className="bg-[#16A34A] px-6 py-4 text-sm font-semibold text-white">
                Start Free Audit
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Executive Summary
            </p>
          </div>
          <div className="p-6">
            <MetricStrip />
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">
                Shared template links are driving the majority of broken-link risk.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Most issues are clustered in navigation and footer structures, making template
                cleanup the fastest path to meaningful improvement.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Issue Modules
            </p>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {priorities.slice(0, 2).map((item) => (
              <div key={item.detail} className="rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{item.severity}</p>
                  <SeverityStamp severity={item.severity} />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-900">{item.detail}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.action}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Data Table Tone
            </p>
          </div>
          <div className="p-6">
            <div className="overflow-hidden rounded-[20px] border border-slate-200">
              <div className="grid grid-cols-[1.1fr_1.7fr_0.7fr_0.8fr] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div>Source</div>
                <div>Broken URL</div>
                <div>Type</div>
                <div>Status</div>
              </div>
              {rows.map((row) => (
                <div
                  key={row.target}
                  className="grid grid-cols-[1.1fr_1.7fr_0.7fr_0.8fr] gap-4 border-t border-slate-200 px-4 py-4 text-sm text-slate-700"
                >
                  <div>{row.source}</div>
                  <div className="truncate">{row.target}</div>
                  <div>{row.type}</div>
                  <div>
                    <SeverityStamp severity={row.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricStrip({ dark = false, paper = false }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`rounded-2xl p-4 ${
            dark
              ? 'border border-slate-700 bg-slate-950'
              : paper
              ? 'border border-[#c8bda8] bg-[#fffaf0]'
              : 'border border-slate-200 bg-white'
          }`}
        >
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${metric.tone}`}>
            {metric.label}
          </span>
          <div className={`mt-4 text-2xl font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeverityStamp({ severity }) {
  const tone =
    severity === 'Critical'
      ? 'bg-[#5f1510] text-[#ffd9d4]'
      : severity === 'Major'
      ? 'bg-[#6a3a06] text-[#ffe2b9]'
      : 'bg-[#18394b] text-[#d7edf8]';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${tone}`}>{severity}</span>;
}

function ConceptA() {
  return (
    <section id="concept-a" className="rounded-[36px] border border-[#c8bda8] bg-[#efe6d6] p-6 md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#716553]">Concept A</p>
      <h2 className="mt-2 text-3xl font-semibold text-[#1f1a14]">Newspaper Audit</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f5548]">
        This treats the report like an investigative front page: headline verdict, highlighted
        findings, annotated evidence, and strong editorial hierarchy.
      </p>

      <div className="mt-6 overflow-hidden rounded-[30px] border border-[#c8bda8] bg-[#fbf6ec] shadow-2xl">
        <div className="border-b border-[#c8bda8] px-8 py-6">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#7b6f5b]">SeoScrub Gazette</p>
              <h3 className="mt-3 max-w-4xl text-5xl font-semibold leading-none text-[#17120d]">
                Template failures are causing the majority of acme.com link risk
              </h3>
            </div>
            <div className="text-right text-xs uppercase tracking-[0.2em] text-[#7b6f5b]">
              July 9, 2026
            </div>
          </div>
          <div className="mt-6">
            <MetricStrip paper />
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-[#c8bda8] px-8 py-8 xl:border-b-0 xl:border-r">
            <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b6f5b]">
                  Lead Story
                </p>
                <p className="mt-4 text-lg leading-8 text-[#2c241b]">
                  Internal 404s are not scattered randomly. They are clustered inside shared
                  navigation and footer structures, creating repeat failures across high-value
                  pages including pricing and resource hubs.
                </p>
                <div className="mt-8 rounded-[28px] border border-[#c8bda8] bg-[#fffaf0] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b6f5b]">
                    Reporter Notes
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-[#4a4034]">
                    {takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                {priorities.map((item) => (
                  <div key={item.detail} className="rounded-[28px] border border-[#c8bda8] bg-[#fffaf0] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#1f1a14]">{item.detail}</p>
                        <p className="mt-3 text-sm leading-6 text-[#5f5548]">{item.action}</p>
                      </div>
                      <SeverityStamp severity={item.severity} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b6f5b]">Evidence Desk</p>
            <div className="mt-5 space-y-5">
              <div className="rounded-[28px] border border-[#c8bda8] bg-[#fffaf0] p-5">
                <h4 className="text-lg font-semibold text-[#1f1a14]">Issue Breakdown</h4>
                <div className="mt-4 space-y-3">
                  {breakdown.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm text-[#4a4034]">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#e3d8c6]">
                        <div className="h-2 rounded-full bg-[#1f1a14]" style={{ width: item.value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#c8bda8] bg-[#fffaf0] p-5">
                <h4 className="text-lg font-semibold text-[#1f1a14]">Most Affected Pages</h4>
                <div className="mt-4 space-y-3">
                  {pages.map((row) => (
                    <div key={row.page} className="flex items-center justify-between border-b border-[#e5dccd] pb-3 text-sm text-[#4a4034] last:border-b-0">
                      <span>{row.page}</span>
                      <span>{row.issues} issues</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConceptB() {
  return (
    <section id="concept-b" className="rounded-[36px] border border-[#d6dce6] bg-[#f4f6fb] p-6 md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#63708a]">Concept B</p>
      <h2 className="mt-2 text-3xl font-semibold text-[#111827]">Consulting Deck</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#586377]">
        This one is built like a strategy presentation: giant conclusions, clear chapter breaks,
        and recommendation-led slides rather than a continuous app surface.
      </p>

      <div className="mt-6 space-y-6">
        <div className="rounded-[30px] border border-[#d6dce6] bg-white p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#63708a]">Slide 01 · Executive Verdict</p>
          <h3 className="mt-4 max-w-4xl text-5xl font-semibold leading-[1.02] text-[#0f172a]">
            One template cleanup could remove the largest cluster of broken links in the current audit.
          </h3>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#475569]">
            The fastest path to impact is not page-by-page editing. It is repairing shared navigation
            and footer references that repeat across high-traffic pages.
          </p>
          <div className="mt-8">
            <MetricStrip />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-[#d6dce6] bg-white p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#63708a]">Slide 02 · Why This Matters</p>
            <ul className="mt-5 space-y-4 text-base leading-8 text-[#334155]">
              {takeaways.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[30px] border border-[#d6dce6] bg-[#0f172a] p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Slide 03 · Recommendation Stack</p>
            <div className="mt-5 space-y-4">
              {priorities.map((item) => (
                <div key={item.detail} className="rounded-2xl bg-slate-900/80 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.detail}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.action}</p>
                    </div>
                    <SeverityStamp severity={item.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[30px] border border-[#d6dce6] bg-white p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#63708a]">Slide 04 · Breakdown</p>
            <div className="mt-5 space-y-4">
              {breakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm text-[#334155]">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[#0f172a]" style={{ width: item.value }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#d6dce6] bg-white p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#63708a]">Slide 05 · Evidence Appendix</p>
            <div className="mt-5 space-y-3">
              {rows.map((row) => (
                <div key={row.target} className="grid grid-cols-[0.9fr_1.5fr_0.6fr_0.8fr] gap-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-[#334155]">
                  <span>{row.source}</span>
                  <span className="truncate">{row.target}</span>
                  <span>{row.type}</span>
                  <span>{row.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConceptC() {
  return (
    <section id="concept-c" className="rounded-[36px] border border-[#232931] bg-[#0b1017] p-6 md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7f8b9f]">Concept C</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Forensic Workspace</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b4bfce]">
        This version leans into diagnostics: traces, evidence clusters, and a working surface that
        feels more like an investigation desk than a dashboard.
      </p>

      <div className="mt-6 overflow-hidden rounded-[30px] border border-[#232931] bg-[#0f151d] shadow-2xl">
        <div className="grid gap-0 xl:grid-cols-[0.34fr_0.66fr]">
          <aside className="border-b border-[#232931] bg-[#0b1017] px-6 py-8 xl:border-b-0 xl:border-r">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Case Summary</p>
            <h3 className="mt-3 text-4xl font-semibold text-white">acme.com</h3>
            <p className="mt-4 text-sm leading-7 text-[#9eacbf]">
              Primary pattern: link failures radiate outward from shared template references, then
              surface repeatedly on conversion and resource pages.
            </p>
            <div className="mt-6">
              <MetricStrip dark />
            </div>

            <div className="mt-6 rounded-[26px] border border-[#232931] bg-[#121923] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Observed Signals</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#d6dfeb]">
                {takeaways.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6 px-6 py-8">
            <div className="rounded-[26px] border border-[#232931] bg-[#121923] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Trace View</p>
                  <h4 className="mt-2 text-3xl font-semibold text-white">Broken-link clusters by origin</h4>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0b1017]">
                  Share Case File
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
                {priorities.map((item) => (
                  <div key={item.detail} className="rounded-2xl border border-[#232931] bg-[#0f151d] p-4">
                    <div className="flex items-center justify-between">
                      <SeverityStamp severity={item.severity} />
                      <span className="text-xs text-[#7f8b9f]">{item.count} hits</span>
                    </div>
                    <p className="mt-4 text-sm font-medium text-white">{item.detail}</p>
                    <p className="mt-3 text-sm leading-6 text-[#9eacbf]">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[26px] border border-[#232931] bg-[#121923] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Signal Mix</p>
                <div className="mt-5 space-y-4">
                  {breakdown.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm text-[#d6dfeb]">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#202833]">
                        <div className="h-2 rounded-full bg-white" style={{ width: item.value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-[#232931] bg-[#121923] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Source-to-Target Evidence</p>
                <div className="mt-5 space-y-3">
                  {rows.map((row) => (
                    <div key={row.target} className="rounded-2xl border border-[#232931] bg-[#0f151d] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-white">{row.source}</span>
                        <SeverityStamp severity={row.severity} />
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-sm text-[#9eacbf]">
                        <span className="rounded-full bg-[#1a212d] px-3 py-1">{row.type}</span>
                        <span className="truncate">{row.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#232931] bg-[#121923] p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7f8b9f]">Affected Page Cluster</p>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {pages.map((row) => (
                  <div key={row.page} className="rounded-2xl border border-[#232931] bg-[#0f151d] p-5">
                    <p className="text-sm font-medium text-white">{row.page}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{row.issues}</p>
                    <p className="mt-2 text-sm text-[#9eacbf]">{row.owner}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function UiDraftsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e6ecf7_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Intro />
        <div className="mt-10">
          <ThemeDemos />
        </div>
        <div className="mt-10 space-y-10">
          <ConceptA />
          <ConceptB />
          <ConceptC />
        </div>
      </div>
    </main>
  );
}
*/
