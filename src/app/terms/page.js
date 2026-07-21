import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandRule from '@/app/components/BrandRule';

export const metadata = {
  title: 'Terms of Service — SeoScrub',
  description: 'Terms governing the use of the SeoScrub site audit service.',
};

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const SECTIONS = [
  { id: 'acceptance', serial: '§ 01', label: 'Acceptance' },
  { id: 'authorized-use', serial: '§ 02', label: 'Authorized use' },
  { id: 'prohibited', serial: '§ 03', label: 'Prohibited conduct' },
  { id: 'service', serial: '§ 04', label: 'Service & availability' },
  { id: 'liability', serial: '§ 05', label: 'Liability' },
  { id: 'termination', serial: '§ 06', label: 'Termination' },
  { id: 'changes', serial: '§ 07', label: 'Changes' },
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

export default function TermsPage() {
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
          <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">Terms of Service</h1>
          <p className="max-w-xl leading-relaxed text-text-muted">
            Last updated <span className="font-mono text-xs text-text">21 July 2026</span>. By
            using SeoScrub you agree to these terms. If you do not agree, do not use the service.
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
            <DocSection id="acceptance" serial="§ 01" label="Acceptance" title="Agreement to terms">
              <Para>
                These Terms of Service govern your use of SeoScrub, a site-audit service that
                crawls websites, checks link integrity, and runs SEO analysis. By accessing or
                using SeoScrub you agree to be bound by these terms and our{' '}
                <Link href="/privacy" className="text-action hover:underline">Privacy Policy</Link>.
              </Para>
              <Para>
                If you are using SeoScrub on behalf of a company or organization, you represent
                that you have authority to bind that entity to these terms.
              </Para>
            </DocSection>

            <DocSection id="authorized-use" serial="§ 02" label="Authorized use" title="Authorized use">
              <Para>
                SeoScrub crawls websites by following links and making HTTP requests, in a manner
                similar to search engine bots. You are solely responsible for ensuring your use
                is authorized:
              </Para>
              <DashList items={[
                'Only submit URLs for sites you own, control, or have explicit written permission to audit',
                'Comply with the target site\'s robots.txt and terms of service',
                'Comply with all applicable laws, including the Computer Fraud and Abuse Act (CFAA), the UK Computer Misuse Act, and equivalent legislation in your jurisdiction',
                'Obtain any necessary consents before scanning sites that process personal data',
              ]} />
              <Para>
                The crawler identifies itself with a User-Agent string that includes a reference to
                this service. Do not attempt to disguise or misrepresent the origin of audit
                requests.
              </Para>
            </DocSection>

            <DocSection id="prohibited" serial="§ 03" label="Prohibited conduct" title="What you must not do">
              <DashList items={[
                'Scan websites without authorization from the site owner',
                'Use the service to conduct reconnaissance for unauthorized access',
                'Submit URLs designed to cause the crawler to attack or overload a target',
                'Attempt to circumvent rate limits, access controls, or other service restrictions',
                'Resell or sublicense access to the service without prior written agreement',
                'Use the service in any way that violates applicable law',
              ]} />
              <Para>
                Violation of these prohibitions may result in immediate termination of access
                and, where appropriate, referral to law enforcement.
              </Para>
            </DocSection>

            <DocSection id="service" serial="§ 04" label="Service & availability" title="Service and availability">
              <Para>
                SeoScrub is provided &ldquo;as-is&rdquo; without warranties of any kind, express
                or implied. We do not guarantee that the service will be available at any particular
                time, that audit results will be accurate or complete, or that the service will meet
                your requirements.
              </Para>
              <Para>
                Audit results depend on the accessibility and behaviour of the sites being crawled.
                We are not responsible for false positives, missed links, or results that differ
                from those of other tools.
              </Para>
              <Para>
                We reserve the right to modify, suspend, or discontinue the service at any time
                without notice. We may also impose rate limits or usage quotas to protect the
                reliability of the service for all users.
              </Para>
            </DocSection>

            <DocSection id="liability" serial="§ 05" label="Liability" title="Limitation of liability">
              <Para>
                To the fullest extent permitted by law, SeoScrub and its operators shall not be
                liable for any indirect, incidental, special, consequential, or punitive damages
                arising from your use of the service, including but not limited to:
              </Para>
              <DashList items={[
                'Legal claims arising from unauthorized scanning',
                'Loss of data, revenue, or business opportunity',
                'Inaccurate or incomplete audit results',
                'Service interruptions or downtime',
              ]} />
              <Para>
                You agree to indemnify and hold harmless SeoScrub and its operators from any
                claims, damages, or expenses (including legal fees) arising from your use of the
                service or your violation of these terms.
              </Para>
            </DocSection>

            <DocSection id="termination" serial="§ 06" label="Termination" title="Termination">
              <Para>
                We may suspend or terminate your access to SeoScrub at any time, with or without
                notice, if we believe you have violated these terms or if continued access would
                cause harm to the service or to third parties.
              </Para>
              <Para>
                On termination, your right to use the service ceases immediately. Audit results
                stored in your account may be deleted.
              </Para>
            </DocSection>

            <DocSection id="changes" serial="§ 07" label="Changes" title="Changes to these terms">
              <Para>
                We may update these terms from time to time. Material changes will be noted at
                the top of this page with a revised date. Continued use of the service after a
                change constitutes acceptance of the updated terms.
              </Para>
              <Para>
                If you have questions about these terms, use the{' '}
                <Link href="/contact" className="text-action hover:underline">contact form</Link>.
              </Para>
            </DocSection>

            <div>
              <BrandRule className="mb-10" />
              <div className="flex flex-wrap items-center gap-5">
                <Link
                  href="/privacy"
                  className="font-medium text-text underline decoration-action decoration-2 underline-offset-4 transition-colors duration-200 hover:text-action"
                >
                  Read the Privacy Policy &rarr;
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
