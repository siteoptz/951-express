import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { bookings, routes } from '@/db/schema';
import { buildBookingView } from '@/lib/booking-view';
import type { RegionLookup } from '@/lib/routing';
import { regionLabels } from '@/config/routes';
import type { Step3 } from '@/lib/schemas';
import { getByToken, type Booking } from '@/server/bookings';

export type DetailsResult =
  | { ok: true; booking: Booking; confirmation: ReturnType<typeof buildBookingView> }
  | {
      ok: false;
      status: 404 | 409 | 422;
      reason: 'not_found' | 'not_paid' | 'already_submitted' | 'pickup_region' | 'delivery_region';
      error: string;
      field?: string;
    };

/**
 * Step 3: saves the customer's details on a paid booking and completes it. Only a `paid` booking can be completed, once:
 * the status change itself is the guard, so two submits at the same moment cannot both win.
 */
export async function submitDetails(
  db: Db,
  token: string,
  input: Step3,
  regionOf: RegionLookup,
  now: Date = new Date(),
): Promise<DetailsResult> {
  const found = await getByToken(db, token);
  if (!found)
    return {
      ok: false,
      status: 404,
      reason: 'not_found',
      error: 'We could not find that booking.',
    };
  if (found.status === 'completed') return alreadySubmitted();
  if (found.status !== 'paid') return notPaid();

  // The shipment was quoted for a region on each end, and the price depends on it: refine the ZIP, never cross regions.
  for (const side of ['pickup', 'delivery'] as const) {
    const zip = side === 'pickup' ? input.pickupAddress.zip : input.deliveryAddress.zip;
    const expected = side === 'pickup' ? found.pickupRegion : found.deliveryRegion;
    if (regionOf(zip) !== expected) {
      return {
        ok: false,
        status: 422,
        reason: side === 'pickup' ? 'pickup_region' : 'delivery_region',
        field: `${side}Address.zip`,
        error: `Your ${side} must stay in our ${regionLabels[expected]} region, the one you got your quote for. ${zip} is not in it.`,
      };
    }
  }

  const [done] = await db
    .update(bookings)
    .set({
      status: 'completed',
      customer: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes || null,
      detailsSubmittedAt: now,
    })
    .where(and(eq(bookings.publicToken, token), eq(bookings.status, 'paid')))
    .returning();
  if (!done) {
    // Lost a race with another submit (or a status change): say which.
    const again = await getByToken(db, token);
    return again?.status === 'completed' ? alreadySubmitted() : notPaid();
  }

  const [route] = await db.select().from(routes).where(eq(routes.id, done.routeId));
  return { ok: true, booking: done, confirmation: buildBookingView(done, route.name) };
}

const alreadySubmitted = (): DetailsResult => ({
  ok: false,
  status: 409,
  reason: 'already_submitted',
  error: 'Your details were already submitted. Your booking is complete.',
});
const notPaid = (): DetailsResult => ({
  ok: false,
  status: 409,
  reason: 'not_paid',
  error: 'We have not received your deposit for this booking yet.',
});
