'use client';

import { useState } from 'react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Button from '@/app/components/Button';
import BrandRule from '@/app/components/BrandRule';

const microLabel = 'font-mono text-[11px] uppercase tracking-[0.18em]';

const inputClass =
  'w-full border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-subtle focus:border-action focus:outline-none transition-colors duration-200';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: process.env.NEXT_PUBLIC_WEB3FORMS_KEY,
          subject: 'SeoScrub contact form',
          from_name: form.name,
          ...form,
        }),
      });
      const data = await res.json();
      setStatus(data.success ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {/* Masthead */}
        <div className="mb-14">
          <div className="mb-4 flex items-center gap-4">
            <p className={`${microLabel} shrink-0 text-action`}>Contact</p>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <h1 className="mb-4 font-display text-4xl text-text md:text-5xl">Get in touch.</h1>
          <p className="max-w-xl leading-relaxed text-text-muted">
            Questions about the tool, feedback, or anything else &mdash; send a message and
            we&rsquo;ll get back to you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          {/* Form */}
          <div className="lg:col-span-7">
            {status === 'success' ? (
              <div className="border border-border p-10">
                <p className={`${microLabel} mb-4 text-action`}>Message sent</p>
                <p className="mb-3 font-display text-3xl text-text">Thanks, we&rsquo;ll be in touch.</p>
                <p className="text-sm text-text-muted">
                  We typically respond within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className={`${microLabel} mb-2 block text-text-subtle`}>
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="email" className={`${microLabel} mb-2 block text-text-subtle`}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="message" className={`${microLabel} mb-2 block text-text-subtle`}>
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={7}
                    required
                    value={form.message}
                    onChange={handleChange}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {status === 'error' && (
                  <p className="font-mono text-xs text-danger">
                    Something went wrong &mdash; please try again.
                  </p>
                )}

                <Button type="submit" size="md" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </div>

          {/* Side note */}
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="lg:sticky lg:top-24 space-y-8">
              <div>
                <p className={`${microLabel} mb-4 text-text-subtle`}>Response time</p>
                <p className="text-sm leading-relaxed text-text-muted">
                  We aim to respond within one business day. For urgent issues, include
                  as much detail as possible so we can help faster.
                </p>
              </div>
              <BrandRule />
              <div>
                <p className={`${microLabel} mb-4 text-text-subtle`}>Common topics</p>
                <ul className="space-y-2 text-sm text-text-muted">
                  {[
                    'Audit not starting or stuck',
                    'Unexpected results or false positives',
                    'Export or share link issues',
                    'Feature requests',
                    'Billing or account questions',
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-action" aria-hidden="true">
                        &mdash;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
