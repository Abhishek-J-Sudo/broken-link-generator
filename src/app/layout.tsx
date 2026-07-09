import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SeoScrub — SEO & Link Health Monitor',
  description: 'Crawl your site for broken links, redirect chains, and SEO issues.',
};

// Runs before React hydrates: pin data-theme from saved choice (or OS) so the
// first paint is already correct — no light→dark flash on load. See docs/handoff/08 §7.2.
const themeBootScript = `(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
