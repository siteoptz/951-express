'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { bookingCopy as t } from '@/content/booking';
import type { BookingView } from '@/lib/booking-view';
import { BookedView } from './BookedView';
import { DetailsForm } from './DetailsForm';

/** The /booking/[token] page body: Step 3 outside the modal, then the confirmation. */
export function BookingFlow({ token, view }: { token: string; view: BookingView }) {
  const [done, setDone] = useState<BookingView | null>(view.status === 'completed' ? view : null);
  const home = (
    <ButtonLink variant="ghostDark" href="/">
      {t.booked.home}
    </ButtonLink>
  );

  if (done) return <BookedView view={done} actions={home} />;

  if (view.status !== 'paid') {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold uppercase">
          {t.fallback.unpaidHeading}
        </h1>
        <p className="mt-3 text-muted">{t.fallback.unpaidBody}</p>
        <div className="mt-5">
          <ButtonLink href="/">{t.fallback.startQuote}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <DetailsForm
      token={token}
      ctx={{
        pickupZip: view.pickupZip,
        deliveryZip: view.deliveryZip,
        pickupRegion: view.pickupRegion,
        deliveryRegion: view.deliveryRegion,
        payerEmail: view.payerEmail,
        weekLabel: view.weekLabel,
      }}
      onDone={setDone}
    />
  );
}
