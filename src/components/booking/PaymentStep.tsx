'use client';

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { booking } from '@/config/booking';
import { bookingCopy as t } from '@/content/booking';
import { estimatedDeliveryLine } from '@/lib/delivery-window';
import { money, type QuoteResponse } from './SummaryStep';

export type CheckoutInfo = {
  clientSecret: string;
  publicToken: string;
  holdExpiresAt: string;
  bookingId: string;
};

// Created once, from the publishable key (test key until launch).
const stripePromise = (() => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return key ? loadStripe(key) : null;
})();

export const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Counts down to a deadline. Returns the milliseconds left (0 once it has passed). */
function useCountdown(deadline: string): number {
  const end = useMemo(() => new Date(deadline).getTime(), [deadline]);
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  return left;
}

export function PaymentStep({
  quote,
  checkout,
  onEdit,
  onPaid,
  onHoldAgain,
}: {
  quote: QuoteResponse;
  checkout: CheckoutInfo;
  onEdit: () => void;
  onPaid: (info: { payerEmail: string | null }) => void;
  onHoldAgain: () => void;
}) {
  const left = useCountdown(checkout.holdExpiresAt);
  const [confirming, setConfirming] = useState<'idle' | 'checking' | 'slow'>('idle');
  const v = quote.vehicle;

  // The client callback is only a nudge. The booking counts as paid when our server says so (it asks Stripe).
  const onComplete = useCallback(async () => {
    setConfirming('checking');
    for (let i = 0; i < 15; i++) {
      try {
        const res = await fetch(`/api/bookings/${checkout.publicToken}/status`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.paid) return onPaid({ payerEmail: body.payerEmail ?? null });
        }
      } catch {
        // keep trying
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setConfirming('slow');
  }, [checkout.publicToken, onPaid]);

  const options = useMemo(
    () => ({ clientSecret: checkout.clientSecret, onComplete }),
    [checkout.clientSecret, onComplete],
  );
  const expired = left <= 0 && confirming === 'idle';

  return (
    <div>
      <h3 className="font-display text-2xl font-extrabold uppercase">{t.payment.heading}</h3>

      <div className="mt-4 rounded-lg border border-black/10 p-4">
        <p className="font-bold">
          {v.year} {v.make} {v.model}
        </p>
        <p className="text-sm text-muted">{quote.sizeClass.label}</p>
        <dl className="mt-3 divide-y divide-black/10 text-sm">
          {[
            [t.summary.route, quote.route.name],
            [t.summary.week, quote.week.label],
            [t.summary.load, quote.loadType],
            [t.payment.personalItems, quote.personalItems ? t.payment.yes : t.payment.no],
            [t.summary.total, money(quote.totalCents)],
            [t.summary.balance, money(quote.balanceCents)],
          ].map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm font-semibold" data-testid="balance-message">
          {booking.balanceMessageShort}
        </p>
        <p className="mt-2 text-sm font-semibold" data-testid="delivery-estimate">
          {estimatedDeliveryLine()}
        </p>
      </div>

      <div className="mt-3 flex justify-between gap-4 rounded-lg bg-success-dark px-4 py-3 text-lg font-extrabold text-white">
        <span>{t.summary.deposit}</span>
        <span>{money(quote.depositCents)}</span>
      </div>

      {confirming === 'idle' && !expired && (
        <p role="timer" aria-live="off" className="mt-3 text-center text-sm font-semibold">
          {t.payment.hold.replace('{time}', formatCountdown(left))}
        </p>
      )}

      {expired && (
        <div role="alert" className="mt-4 rounded-lg border-2 border-danger p-4 text-center">
          <p className="font-bold text-danger">{t.payment.holdExpired}</p>
          <p className="mt-1 text-sm">{t.payment.holdExpiredBody}</p>
          <Button className="mt-3" onClick={onHoldAgain}>
            {t.payment.holdAgain}
          </Button>
        </div>
      )}

      {confirming === 'checking' && (
        <p role="status" className="mt-4 text-center font-semibold">
          {t.payment.confirming}
        </p>
      )}
      {confirming === 'slow' && (
        <p role="alert" className="mt-4 rounded-lg bg-accent/20 px-4 py-3 text-sm font-semibold">
          {t.payment.confirmingSlow}
        </p>
      )}

      {!expired && confirming === 'idle' && (
        <div className="mt-4" data-testid="embedded-checkout">
          {stripePromise ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <p role="alert" className="text-danger">
              {t.payment.noKey}
            </p>
          )}
          <p className="mt-2 text-center text-sm text-muted">{t.payment.secure}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="mt-4 w-full rounded-lg px-4 py-3 font-semibold text-navy underline"
      >
        {t.payment.back}
      </button>
    </div>
  );
}
