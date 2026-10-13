import { eq } from 'drizzle-orm';
import { booking as bookingConfig } from '@/config/booking';
import type { Db } from '@/db';
import { bookings } from '@/db/schema';
import { evaluateStep1 } from '@/lib/booking-quote';
import { buildSessionParams, depositLineName, sessionExpiry } from '@/lib/checkout-session';
import type { RegionLookup } from '@/lib/routing';
import { routeErrorMessage } from '@/lib/routing';
import type { Step1 } from '@/lib/schemas';
import type { Week } from '@/lib/weeks';
import { cancelHold } from '@/server/bookings';
import { createHold } from '@/server/capacity';
import type { StripeApi } from '@/server/stripe';

export type CheckoutResult =
  | {
      status: 200;
      clientSecret: string;
      bookingId: string;
      publicToken: string;
      holdExpiresAt: string;
      weekLabel: string;
    }
  | { status: 409; error: string; reason: 'week_full'; nextAvailableWeek: Week | null }
  | { status: 422; error: string; reason: string; quoteRequired?: true; quoteReasons?: string[] }
  | { status: 502 | 503; error: string; reason: string };

/**
 * Recompute everything from the raw Step 1 answers, hold the spot, then open the Stripe Checkout Session for the
 * deposit. Nothing priced or routed comes from the browser. If Stripe fails, the hold is released at once.
 */
export async function createCheckout(
  db: Db,
  stripe: StripeApi,
  input: Step1,
  regionOf: RegionLookup,
  now: Date = new Date(),
): Promise<CheckoutResult> {
  const r = evaluateStep1(input, regionOf, now);
  if (!r.ok) {
    if (r.error === 'route')
      return { status: 422, error: routeErrorMessage(r.failure), reason: r.failure.reason };
    return {
      status: 422,
      error:
        r.error === 'week_unavailable'
          ? 'That pickup week is no longer available.'
          : 'Choose a vehicle size.',
      reason: r.error,
    };
  }
  if (r.quoteRequired) {
    return {
      status: 422,
      error: 'This vehicle needs a personalized quote.',
      reason: 'quote_required',
      quoteRequired: true,
      quoteReasons: r.quoteReasons,
    };
  }

  const hold = await createHold(
    db,
    {
      routeSlug: r.route.id,
      weekStart: r.week.start,
      pickupZip: input.pickupZip,
      deliveryZip: input.deliveryZip,
      pickupRegion: r.pickupRegion,
      deliveryRegion: r.deliveryRegion,
      vehicle: input.vehicle,
      // Only fully eligible vehicles reach here (running, factory stock), so these are fixed.
      operable: true,
      modified: false,
      topDeck: input.topDeck,
      personalItems: input.personalItems,
      sizeClass: r.sizeClass,
      sizeClassSource: r.sizeClassSource,
      totalCents: r.quote.totalCents,
      depositCents: r.quote.depositCents,
      balanceCents: r.quote.balanceCents,
      needsReview: r.needsReview,
      termsVersion: bookingConfig.termsVersion,
      termsAcceptedAt: now,
    },
    now,
  );
  if (!hold.ok) {
    if (hold.reason === 'full') {
      return {
        status: 409,
        error: 'That pickup week just filled up.',
        reason: 'week_full',
        nextAvailableWeek: hold.nextAvailableWeek,
      };
    }
    if (hold.reason === 'week_unavailable')
      return {
        status: 422,
        error: 'That pickup week is no longer available.',
        reason: 'week_unavailable',
      };
    return {
      status: 503,
      error: 'Booking is unavailable right now. Please email us.',
      reason: 'route_unavailable',
    };
  }

  const expiry = sessionExpiry(hold.holdExpiresAt, Date.now());
  try {
    const session = await stripe.checkout.sessions.create(
      buildSessionParams({
        bookingId: hold.bookingId,
        depositCents: r.quote.depositCents,
        lineName: depositLineName(input.vehicle, r.route.name, r.week.label),
        expiresAtSec: expiry.expiresAtSec,
        integrationIdentifier: bookingConfig.stripeIntegrationIdentifier,
      }),
    );
    if (!session.client_secret) throw new Error('Stripe returned no client secret');
    await db
      .update(bookings)
      .set({
        stripeSessionId: session.id,
        ...(expiry.extended ? { holdExpiresAt: expiry.holdExpiresAt } : {}),
      })
      .where(eq(bookings.id, hold.bookingId));
    return {
      status: 200,
      clientSecret: session.client_secret,
      bookingId: hold.bookingId,
      publicToken: hold.publicToken,
      holdExpiresAt: expiry.holdExpiresAt.toISOString(),
      weekLabel: r.week.label,
    };
  } catch (e) {
    console.error(
      `[checkout] Stripe session failed for booking ${hold.bookingId}: ${e instanceof Error ? e.message : String(e)}`,
    );
    await cancelHold(db, hold.bookingId); // do not keep a spot for a payment that cannot happen
    return {
      status: 502,
      error: 'We could not start secure checkout. Please try again or email us.',
      reason: 'stripe_unavailable',
    };
  }
}
