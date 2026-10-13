import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { bookings, routes, type Address } from '@/db/schema';
import { buildBookingView } from '@/lib/booking-view';
import { cityMismatchMessage, sameCity } from '@/lib/address';
import { zipPlace } from '@/lib/address.server';
import type { RegionLookup } from '@/lib/routing';
import { regionLabels } from '@/config/routes';
import type { Step3 } from '@/lib/schemas';
import { getByToken, type Booking } from '@/server/bookings';

export type DetailsResult =
  | { ok: true; booking: Booking; confirmation: ReturnType<typeof buildBookingView> }
  | {
      ok: false;
      status: 404 | 409 | 422;
      reason:
        | 'not_found'
        | 'not_paid'
        | 'already_submitted'
        | 'pickup_region'
        | 'delivery_region'
        | 'unknown_zip'
        | 'city_zip_mismatch';
      error: string;
      field?: string;
      /** For `city_zip_mismatch`: every address whose city does not match its ZIP. */
      mismatches?: { field: string; message: string }[];
    };

/** The review reason stored when the customer confirmed a city that does not match its ZIP. */
export const CITY_ZIP_REASON = 'city/ZIP mismatch';

const ADDRESS_LABELS = {
  address: 'Home address',
  pickupAddress: 'Pickup address',
  deliveryAddress: 'Delivery address',
} as const;

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

  // The state is derived from the ZIP, never taken from the customer. The city is checked against the ZIP; a
  // mismatch is refused unless the customer confirmed it, and then the booking is flagged for the team.
  const addresses = {} as Record<keyof typeof ADDRESS_LABELS, Address>;
  const mismatches: { field: string; message: string; flag: string }[] = [];
  for (const key of Object.keys(ADDRESS_LABELS) as (keyof typeof ADDRESS_LABELS)[]) {
    const a = input[key];
    const place = zipPlace(a.zip);
    if (!place) {
      return {
        ok: false,
        status: 422,
        reason: 'unknown_zip',
        field: `${key}.zip`,
        error: `We could not find ZIP ${a.zip}. Please check it and try again.`,
      };
    }
    addresses[key] = {
      street: a.street,
      ...(a.street2 ? { street2: a.street2 } : {}),
      city: a.city,
      state: place.state,
      zip: a.zip,
    };
    if (place.city && !sameCity(a.city, place.city)) {
      const message = cityMismatchMessage(a.zip, { city: place.city, state: place.state });
      mismatches.push({
        field: `${key}.city`,
        message,
        flag: `${ADDRESS_LABELS[key]}: city "${a.city}" does not match ZIP ${a.zip} (${place.city}, ${place.state}). The customer confirmed it is correct.`,
      });
    }
  }
  if (mismatches.length > 0 && !input.confirmAddresses) {
    return {
      ok: false,
      status: 422,
      reason: 'city_zip_mismatch',
      field: mismatches[0].field,
      error: mismatches[0].message,
      mismatches: mismatches.map(({ field, message }) => ({ field, message })),
    };
  }
  const flagged = mismatches.length > 0;

  const [done] = await db
    .update(bookings)
    .set({
      status: 'completed',
      customer: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        address: addresses.address,
      },
      pickupAddress: addresses.pickupAddress,
      deliveryAddress: addresses.deliveryAddress,
      notes: input.notes || null,
      vehicleColor: input.vehicleColor ?? null,
      vehicleVin: input.vin ?? null,
      pickupContact: input.pickupContact ?? null,
      deliveryContact: input.deliveryContact ?? null,
      detailsSubmittedAt: now,
      ...(flagged
        ? {
            needsReview: true,
            reviewReason: sql`case when ${bookings.reviewReason} is null then ${CITY_ZIP_REASON} else ${bookings.reviewReason} || '; ' || ${CITY_ZIP_REASON} end`,
            addressFlags: mismatches.map((m) => m.flag),
          }
        : {}),
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
