import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandRule from '@/app/components/BrandRule';

export const metadata = {
  title: 'Privacy Policy — SeoScrub',
  description: 'How SeoScrub collects, uses, and protects your information.',
};

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const SECTIONS = [
  { id: 'overview', serial: '§ 01', label: 'Overview' },
  { id: 'data-collected', serial: '§ 02', label: 'Data we collect' },
  { id: 'how-used', serial: '§ 03', label: 'How it is used' },
  { id: 'storage', serial: '§ 04', label: 'Storage & retention' },
  { id: 'third-parties', serial: '§ 05', label: 'Third parties' },
  { id: 'your-rights', serial: '§ 06', label: 'Your rights' },
  { id: 'contact', serial: '§ 07', label: 'Contact' },
];

function DocSection({ id, serial, label, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-4">
        <p className={`${microLabel} shrink-0 text-action`}>{serial}</p>
        <p className={`${microLabel} shrink-0 text-text-subtle`}>{label}</p>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <h2 className="mb-6 font-display text-3xl text-text md:text-4xl">{title}</h2>
      {children}
    </section>
  );
}

function Para({ children }) {
  return <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-muted">{children}</p>;
}

function DashList({ items }) {
  return (
    <ul className="mb-4 space-y-2 text-sm text-text-muted">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="text-action" aria-hidden="true">&mdash;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {/* Masthead */}
        <div className="mb-14">
          <div className="mb-4 flex items-center gap-4">
            <p className={`${microLabel} shrink-0 text-action`}>Legal</p>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">Privacy Policy</h1>
          <p className="max-w-xl leading-relaxed text-text-muted">
            Last updated <span className="font-mono text-xs text-text">21 July 2026</span>. This
            policy explains what information SeoScrub collects, how it is used, and what choices you
            have.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Contents rail */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4 flex items-center gap-4">
                <p className={`${microLabel} shrink-0 text-text-subtle`}>Contents</p>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              <nav className="space-y-2.5">
                {SECTIONS.map((item) => (
                  <Link
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-baseline gap-2 font-mono text-xs"
                  >
                    <span className="text-action">{item.serial}</span>
                    <span className="flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
                    <span className="text-text-muted transition-colors duration-200 group-hover:text-action">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* Document */}
          <div className="space-y-20 lg:col-span-9">
            <DocSection id="overview" serial="§ 01" label="Overview" title="What this covers">
              <Para>
                SeoScrub (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;the service&rdquo;) is a
                site-audit tool. You give it a URL; it crawls that site, checks every link, and
                optionally runs an SEO review. This policy covers what data that process involves
                and how we handle it.
              </Para>
              <Para>
                We do not run advertising, sell data, or build profiles. The tool processes URLs
                and audit results — that is all it needs to do its job.
              </Para>
            </DocSection>

            <DocSection id="data-collected" serial="§ 02" label="Data we collect" title="What we collect">
              <Para>
                SeoScrub collects only what the service requires to function:
              </Para>
              <DashList items={[
                'The URL you submit for auditing and the crawl settings you choose',
                'Audit results — the list of URLs discovered, their HTTP status codes, SEO findings, and computed scores',
                'Contact form submissions — name, email address, and message — if you use the contact form',
                'Basic server logs — request timestamps and IP addresses, retained for security purposes',
              ]} />
              <Para>
                We do not use cookies for tracking, run analytics scripts, or collect any
                information beyond what is listed above.
              </Para>
            </DocSection>

            <DocSection id="how-used" serial="§ 03" label="How it is used" title="How we use it">
              <Para>
                The data listed above is used exclusively to operate the service:
              </Para>
              <DashList items={[
                'Audit results are stored so you can return to a report, export data, or create a share link for a client',
                'Contact form submissions are used only to respond to your message',
                'Server logs are reviewed only to investigate security incidents or abuse',
              ]} />
              <Para>
                We do not use your data for marketing, profiling, or any purpose beyond delivering
                the audit you requested.
              </Para>
            </DocSection>

            <DocSection id="storage" serial="§ 04" label="Storage & retention" title="Storage and retention">
              <Para>
                Audit results are stored in a private database hosted on our infrastructure. They
                are not shared with third parties except where you explicitly create a share link —
                in which case the report is accessible to anyone with that link until you revoke it.
              </Para>
              <Para>
                We retain audit results for as long as your account is active. Contact form
                submissions are deleted once the enquiry is resolved. Server logs are retained for
                up to 90 days.
              </Para>
              <Para>
                All data is stored within the European Union. If you require data to be stored in a
                specific jurisdiction, contact us before using the service.
              </Para>
            </DocSection>

            <DocSection id="third-parties" serial="§ 05" label="Third parties" title="Third-party services">
              <Para>
                SeoScrub uses a small number of third-party services to operate:
              </Para>
              <DashList items={[
                'Web3Forms — processes contact form submissions and forwards them to us by email. Your name and email address are transmitted to Web3Forms solely for this purpose.',
                'Google PageSpeed Insights API — if the Performance snapshot is enabled, the audited URL is sent to Google\'s API to retrieve Core Web Vitals data. This is the public URL you submitted for auditing, not your personal information.',
                'DeepSeek AI — if the Smart Analyzer is enabled, aggregate crawl statistics (page counts and URL patterns, no personal data) are sent to generate recommendations.',
              ]} />
              <Para>
                No other third-party services receive your data. We do not use Google Analytics,
                Meta Pixel, or any advertising technology.
              </Para>
            </DocSection>

            <DocSection id="your-rights" serial="§ 06" label="Your rights" title="Your rights">
              <Para>
                If you are located in the European Economic Area, you have rights under the GDPR
                including the right to access, correct, or delete personal data we hold about you.
              </Para>
              <Para>
                Since SeoScrub does not require account registration, the personal data we hold is
                limited to contact form submissions. To request access to or deletion of your data,
                contact us using the details below.
              </Para>
              <Para>
                You also have the right to lodge a complaint with your local data protection
                authority if you believe we have handled your data unlawfully.
              </Para>
            </DocSection>

            <DocSection id="contact" serial="§ 07" label="Contact" title="Questions">
              <Para>
                If you have questions about this policy or want to exercise your data rights,
                use the{' '}
                <Link href="/contact" className="text-action hover:underline">
                  contact form
                </Link>{' '}
                or email us directly. We aim to respond within five business days.
              </Para>
              <Para>
                We may update this policy from time to time. Material changes will be noted at
                the top of this page with a revised date.
              </Para>
            </DocSection>

            <div>
              <BrandRule className="mb-10" />
              <div className="flex flex-wrap items-center gap-5">
                <Link
                  href="/terms"
                  className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 transition-colors duration-200 hover:text-action"
                >
                  Read the Terms of Service &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
