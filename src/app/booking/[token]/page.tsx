import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { Wordmark } from '@/components/landing/Wordmark';
import { getDb } from '@/db';
import { bookingCopy as t } from '@/content/booking';
import { getBookingView } from '@/server/booking-view';

export const metadata: Metadata = {
  title: `${t.fallback.title} | 951 Express`,
  robots: { index: false, follow: false },
};

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getBookingView(getDb(), token);
  // The page streams, so a 404 status is not possible here: say so on the page (it is also marked noindex).
  if (!view) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold uppercase">
          {t.fallback.notFoundHeading}
        </h1>
        <p className="mt-3 text-muted">{t.fallback.notFoundBody}</p>
        <div className="mt-5">
          <ButtonLink href="/">{t.fallback.startQuote}</ButtonLink>
        </div>
      </div>
    );
  }
  return <BookingFlow token={token} view={view} />;
}

// Where the "deposit received" email sends customers who closed the window after paying. Private by its token.
export default function BookingPage({ params }: PageProps<'/booking/[token]'>) {
  return (
    <div className="min-h-screen bg-soft">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-xl items-center px-5">
          <Link href="/" aria-label="951 Express home">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-8 sm:py-12">
        <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-8">
          <Suspense fallback={<p className="text-muted">Loading your booking…</p>}>
            <Content params={params.then((p) => ({ token: p.token }))} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
