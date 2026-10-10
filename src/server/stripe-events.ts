import type Stripe from 'stripe';
import type { Db } from '@/db';
import {
  markExpired,
  markPaid,
  paymentIntentId,
  sessionPaid,
  type Booking,
} from '@/server/bookings';
import type { EmailResult } from '@/server/email';

export type EventDeps = {
  /** Sends the "deposit received" link. Failures are logged, never thrown, so Stripe is not asked to retry. */
  sendDepositEmail: (booking: Booking, to: string) => Promise<EmailResult>;
  log?: (message: string) => void;
};

export type EventResult = { handled: 'paid' | 'expired' | 'ignored'; changed: boolean };

/**
 * Applies a verified Stripe event. Both handlers are idempotent: a status only changes from a valid previous
 * status, and the email goes out only on the call that changed it.
 */
export async function handleStripeEvent(
  db: Db,
  event: Stripe.Event,
  deps: EventDeps,
  now: Date = new Date(),
): Promise<EventResult> {
  const log = deps.log ?? (() => {});
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!sessionPaid(session)) return { handled: 'ignored', changed: false }; // e.g. a delayed method still pending
      const email = session.customer_details?.email ?? null;
      const booking = await markPaid(
        db,
        {
          sessionId: session.id,
          paymentIntent: paymentIntentId(session.payment_intent),
          payerEmail: email,
        },
        now,
      );
      if (!booking) return { handled: 'paid', changed: false };
      if (email) {
        try {
          const sent = await deps.sendDepositEmail(booking, email);
          if (!sent.sent) log(`deposit email not sent (${sent.reason}) for booking ${booking.id}`);
        } catch (e) {
          log(
            `deposit email threw for booking ${booking.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      return { handled: 'paid', changed: true };
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const booking = await markExpired(db, session.id);
      return { handled: 'expired', changed: !!booking };
    }
    default:
      return { handled: 'ignored', changed: false };
  }
}
