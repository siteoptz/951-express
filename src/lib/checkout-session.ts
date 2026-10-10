// Pure helpers for the Stripe Checkout Session: the line-item text, the session expiry, and the params.
import { booking } from '@/config/booking';
import type { Vehicle } from '@/db/schema';

/** "Oct 19 – 25" -> "Oct 19" */
export const weekOf = (label: string): string => label.split(' – ')[0];

/** "Transport deposit: 2021 Toyota RAV4, West → East, week of Oct 19" */
export function depositLineName(vehicle: Vehicle, routeName: string, weekLabel: string): string {
  return `Transport deposit: ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${routeName}, week of ${weekOf(weekLabel)}`;
}

/**
 * The Checkout Session must outlive the spot hold, and Stripe requires at least 30 minutes. A hold that would
 * end sooner is extended to match the session, so the spot is held exactly as long as the customer can pay.
 */
export function sessionExpiry(
  holdExpiresAt: Date,
  nowMs: number,
): { expiresAtSec: number; holdExpiresAt: Date; extended: boolean } {
  const floorSec =
    Math.ceil(nowMs / 1000) + booking.stripeMinSessionSeconds + booking.stripeSessionBufferSeconds;
  const holdSec = Math.floor(holdExpiresAt.getTime() / 1000);
  const expiresAtSec = Math.max(holdSec, floorSec);
  return {
    expiresAtSec,
    holdExpiresAt: new Date(expiresAtSec * 1000),
    extended: expiresAtSec * 1000 !== holdExpiresAt.getTime(),
  };
}

export type SessionInput = {
  bookingId: string;
  depositCents: number;
  lineName: string;
  expiresAtSec: number;
  /** Tags the session in the Dashboard (the SDK takes any label; the suffix is random per deployment). */
  integrationIdentifier: string;
};

/**
 * Embedded Checkout (inline on our page), one-time payment, no redirect. Payment methods are left to the Dashboard configuration
 * (no payment_method_types). The booking id rides on the session and the PaymentIntent.
 */
export function buildSessionParams(i: SessionInput) {
  return {
    // The current Stripe API renamed 'embedded' to 'embedded_page'. Same inline checkout, same client component.
    ui_mode: 'embedded_page' as const,
    redirect_on_completion: 'never' as const,
    mode: 'payment' as const,
    customer_creation: 'if_required' as const,
    client_reference_id: i.bookingId,
    expires_at: i.expiresAtSec,
    integration_identifier: i.integrationIdentifier,
    metadata: { bookingId: i.bookingId },
    payment_intent_data: { metadata: { bookingId: i.bookingId }, description: i.lineName },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: i.depositCents,
          product_data: { name: i.lineName },
        },
      },
    ],
  };
}
