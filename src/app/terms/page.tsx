import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/landing/Logo';
import { booking } from '@/config/booking';
import { company, contactMailto } from '@/config/company';
import { termsIntro, termsSections } from '@/content/terms';

export const metadata: Metadata = {
  title: 'Terms & Conditions | 951 Express',
  description: 'The terms that apply when you book vehicle transport with 951 Express Inc.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-soft">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between px-5 md:h-24">
          <Link href="/" aria-label="951 Express home">
            <Logo size="header" />
          </Link>
          <Link href="/" className="text-sm font-semibold text-white/85 hover:text-accent">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <article className="rounded-2xl bg-white p-6 shadow-lg sm:p-10">
          <h1 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-muted">
            Last updated {booking.termsLastUpdated} · Version {booking.termsVersion}
          </p>
          <p className="mt-6 text-lg leading-relaxed">{termsIntro}</p>

          <nav aria-label="Sections" className="mt-8 rounded-xl bg-soft p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              In this document
            </h2>
            <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              {termsSections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="font-semibold text-navy underline-offset-2 hover:underline"
                  >
                    {s.title.replace(/^\d+\.\s*/, '')}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 space-y-10">
            {termsSections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
                <h2 id={`${s.id}-h`} className="font-display text-2xl font-extrabold uppercase">
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-ink">
                  {s.body.map((block, i) =>
                    typeof block === 'string' ? (
                      <p key={i}>{block}</p>
                    ) : (
                      <ul key={i} className="list-disc space-y-1.5 pl-6">
                        {block.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-10 border-t border-black/10 pt-6 text-sm text-muted">
            {company.name} · USDOT {company.usdot} ·{' '}
            <span className="whitespace-nowrap">{company.mc}</span> ·{' '}
            <a className="font-semibold text-navy underline" href={contactMailto}>
              {company.contactEmail}
            </a>
          </p>
        </article>
      </main>
    </div>
  );
}
