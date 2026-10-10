// Booking status transitions. Every update is conditional on the current status, so replaying a webhook,
// or running the status backstop and the webhook together, can never change a booking twice.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { bookings } from '@/db/schema';
import type { StripeApi } from '@/server/stripe';

export type Booking = typeof bookings.$inferSelect;
export type PaidInput = {
  sessionId: string;
  paymentIntent: string | null;
  payerEmail: string | null;
};

export async function getByToken(db: Db, token: string): Promise<Booking | null> {
  const [row] = await db.select().from(bookings).where(eq(bookings.publicToken, token));
  return row ?? null;
}

/**
 * held -> paid. A booking already marked expired can still receive a payment that landed at the very edge of the
 * hold; it becomes paid but is flagged for review, because its spot may have been given away.
 * Returns the booking only when this call changed it.
 */
export async function markPaid(
  db: Db,
  input: PaidInput,
  now: Date = new Date(),
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set({
      status: 'paid',
      paidAt: now,
      stripePaymentIntent: input.paymentIntent,
      payerEmail: input.payerEmail,
      needsReview: sql`case when ${bookings.status} = 'expired' then true else ${bookings.needsReview} end`,
    })
    .where(
      and(
        eq(bookings.stripeSessionId, input.sessionId),
        inArray(bookings.status, ['held', 'expired']),
      ),
    )
    .returning();
  return row ?? null;
}

/** held -> expired. A paid or cancelled booking is left alone. */
export async function markExpired(db: Db, sessionId: string): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set({ status: 'expired' })
    .where(and(eq(bookings.stripeSessionId, sessionId), eq(bookings.status, 'held')))
    .returning();
  return row ?? null;
}

/** held -> cancelled, freeing the spot at once. */
export async function cancelHold(
  db: Db,
  bookingId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: now })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'held')))
    .returning({ id: bookings.id });
  return rows.length > 0;
}

export const sessionPaid = (s: { payment_status?: string | null }) => s.payment_status === 'paid';

export const paymentIntentId = (pi: unknown): string | null =>
  typeof pi === 'string'
    ? pi
    : pi && typeof pi === 'object' && 'id' in pi
      ? String((pi as { id: string }).id)
      : null;

/**
 * The status backstop: if the webhook has not landed yet, ask Stripe directly. Returns the fresh booking and whether
 * this call was the one that marked it paid.
 */
export async function syncWithStripe(
  db: Db,
  stripe: StripeApi,
  booking: Booking,
  now: Date = new Date(),
): Promise<{ booking: Booking; newlyPaid: boolean }> {
  if (booking.status !== 'held' || !booking.stripeSessionId) return { booking, newlyPaid: false };
  const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
  if (sessionPaid(session)) {
    const changed = await markPaid(
      db,
      {
        sessionId: session.id,
        paymentIntent: paymentIntentId(session.payment_intent),
        payerEmail: session.customer_details?.email ?? null,
      },
      now,
    );
    return {
      booking: changed ?? (await getByToken(db, booking.publicToken)) ?? booking,
      newlyPaid: !!changed,
    };
  }
  if (session.status === 'expired') {
    const changed = await markExpired(db, session.id);
    return { booking: changed ?? booking, newlyPaid: false };
  }
  return { booking, newlyPaid: false };
}

/**
 * Release a held booking on purpose (the customer edited their answers or closed the window). If the payment
 * actually went through, it is marked paid instead and nothing is cancelled.
 */
export async function releaseHold(
  db: Db,
  stripe: StripeApi,
  token: string,
  now: Date = new Date(),
): Promise<{ result: 'released' | 'paid' | 'not_found' | 'unchanged'; newlyPaid?: Booking }> {
  const booking = await getByToken(db, token);
  if (!booking) return { result: 'not_found' };
  if (booking.status === 'paid' || booking.status === 'completed') return { result: 'paid' };
  if (booking.status !== 'held') return { result: 'unchanged' };

  if (booking.stripeSessionId) {
    const synced = await syncWithStripe(db, stripe, booking, now);
    if (synced.booking.status === 'paid')
      return { result: 'paid', newlyPaid: synced.newlyPaid ? synced.booking : undefined };
    try {
      await stripe.checkout.sessions.expire(booking.stripeSessionId);
    } catch {
      // Already expired or completed on Stripe's side; the check below decides what the booking becomes.
      const again = await syncWithStripe(db, stripe, booking, now);
      if (again.booking.status === 'paid')
        return { result: 'paid', newlyPaid: again.newlyPaid ? again.booking : undefined };
    }
  }
  await cancelHold(db, booking.id, now);
  return { result: 'released' };
}
