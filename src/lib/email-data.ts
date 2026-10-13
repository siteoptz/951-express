// Turns a booking row into the plain data the email templates show. Pure, so it is easy to test.
import { booking as bookingConfig } from '@/config/booking';
import { topDeck } from '@/config/pricing';
import { emailCopy } from '@/content/emails';
import type { Address, Contact, Customer, Vehicle, VehicleTyped } from '@/db/schema';
import { bookingRef, formatAddress, formatPacific } from '@/lib/format';
import { weekLabel } from '@/lib/weeks';

export type BookingForEmail = {
  id: string;
  vehicle: Vehicle;
  /** What the customer typed, exactly (null for bookings made before typed entry). */
  vehicleTyped?: VehicleTyped | null;
  /** Why the booking needs review, e.g. "vehicle not recognized: 'zzz thing'". */
  reviewReason?: string | null;
  /** Address problems the customer confirmed anyway (a city that does not match its ZIP). */
  addressFlags?: string[] | null;
  /** Optional Step 3 details for the dispatch sheet. */
  vehicleColor?: string | null;
  vehicleVin?: string | null;
  pickupContact?: Contact | null;
  deliveryContact?: Contact | null;
  customer: Customer;
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupZip: string; // the ZIP that was qualified, which the customer may have refined
  deliveryZip: string;
  weekStart: string;
  sizeClass: string;
  sizeClassSource: 'table' | 'customer';
  operable: boolean;
  modified: boolean;
  topDeck: boolean;
  personalItems: boolean;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  needsReview: boolean;
  termsVersion: string;
  termsAcceptedAt: Date;
  paidAt: Date | null;
  stripePaymentIntent: string | null;
  notes: string | null;
};

export type EmailContext = {
  routeName: string; // "West → East"
  sizeClassLabel: string;
  spot: { n: number; of: number };
  stripeTestMode: boolean;
};

export type BookingEmailData = ReturnType<typeof buildBookingEmailData>;

export const vehicleName = (v: Vehicle): string => `${v.year} ${v.make} ${v.model}`;

/** "2021 chevy tahoe": the vehicle exactly as typed, or null when we have no typed text. */
export const typedVehicleText = (t: VehicleTyped | null | undefined): string | null =>
  t ? `${t.year} ${t.make} ${t.model}` : null;

/** Why a booking is flagged, in words the team can act on. */
export function reviewReasons(
  b: Pick<BookingForEmail, 'needsReview' | 'sizeClassSource'> & { reviewReason?: string | null },
): string[] {
  if (!b.needsReview) return [];
  const reasons: string[] = [];
  if (b.reviewReason) reasons.push(b.reviewReason);
  if (b.sizeClassSource === 'customer')
    reasons.push(
      'Vehicle size was chosen by the customer because the vehicle is not in our size table. Confirm the class and price.',
    );
  if (reasons.length === 0)
    reasons.push(
      'This booking was flagged for review (for example, a payment that arrived after the hold had expired). Check the spot before confirming.',
    );
  return reasons;
}

export function buildBookingEmailData(b: BookingForEmail, ctx: EmailContext) {
  const week = weekLabel(b.weekStart);
  const c = b.customer;
  return {
    ref: bookingRef(b.id),
    vehicle: vehicleName(b.vehicle),
    vehicleTyped: typedVehicleText(b.vehicleTyped),
    routeName: ctx.routeName,
    week,
    weekStart: b.weekStart,
    spotText: `spot ${ctx.spot.n} of ${ctx.spot.of}`,
    customer: {
      name: `${c.firstName} ${c.lastName}`.trim(),
      phone: c.phone,
      email: c.email,
      address: c.address ? formatAddress(c.address) : null,
    },
    pickup: {
      address: formatAddress(b.pickupAddress),
      changedFrom: b.pickupAddress.zip !== b.pickupZip ? b.pickupZip : null,
    },
    delivery: {
      address: formatAddress(b.deliveryAddress),
      changedFrom: b.deliveryAddress.zip !== b.deliveryZip ? b.deliveryZip : null,
    },
    sizeClass: ctx.sizeClassLabel,
    sizeSource:
      b.sizeClassSource === 'customer'
        ? 'chosen by the customer; not in our size table'
        : 'from our size table',
    operable: b.operable,
    modified: b.modified,
    topDeck: b.topDeck,
    loadType: b.topDeck ? topDeck.label : topDeck.standardLabel,
    personalItems: b.personalItems,
    notes: b.notes,
    totalCents: b.totalCents,
    depositCents: b.depositCents,
    balanceCents: b.balanceCents,
    termsVersion: b.termsVersion,
    termsAcceptedAt: formatPacific(b.termsAcceptedAt),
    paidAt: b.paidAt ? formatPacific(b.paidAt) : null,
    paymentIntent: b.stripePaymentIntent,
    stripeUrl: b.stripePaymentIntent
      ? `https://dashboard.stripe.com/${ctx.stripeTestMode ? 'test/' : ''}payments/${b.stripePaymentIntent}`
      : null,
    needsReview: b.needsReview,
    reviewReason: b.reviewReason ?? null,
    addressFlags: b.addressFlags ?? [],
    reviewReasons: reviewReasons(b),
    personalItemsNotice: bookingConfig.personalItemsNotice,
    topDeckBenefits: topDeck.benefits,
  };
}

export const teamSubject = (d: Pick<BookingEmailData, 'vehicle' | 'routeName' | 'week'>): string =>
  emailCopy.team.subject
    .replace('{vehicle}', d.vehicle)
    .replace('{route}', d.routeName)
    .replace('{week}', d.week.split(' – ')[0]);

export const customerSubject = (d: Pick<BookingEmailData, 'week'>): string =>
  emailCopy.customer.subject.replace('{week}', d.week.split(' – ')[0]);

export type LeadForEmail = {
  id: string;
  createdAt: Date;
  name: string;
  phone: string;
  email: string;
  vehicle: Vehicle;
  vehicleTyped?: VehicleTyped | null;
  pickupZip: string;
  deliveryZip: string;
  operable: boolean;
  modified: boolean;
  highValue: boolean;
  quoteReasons: string[];
  modificationDetails: string | null;
  topDeck: boolean;
  preferredWeekStart: string | null;
  notes: string | null;
};

export function buildLeadEmailData(l: LeadForEmail, routeName: string) {
  return {
    ref: bookingRef(l.id),
    receivedAt: formatPacific(l.createdAt),
    vehicle: vehicleName(l.vehicle),
    vehicleTyped: typedVehicleText(l.vehicleTyped),
    routeName,
    name: l.name,
    phone: l.phone,
    email: l.email,
    pickupZip: l.pickupZip,
    deliveryZip: l.deliveryZip,
    operable: l.operable,
    modified: l.modified,
    highValue: l.highValue,
    reasons: l.quoteReasons.map(reasonLabel),
    modificationDetails: l.modificationDetails,
    topDeck: l.topDeck,
    preferredWeek: l.preferredWeekStart ? weekLabel(l.preferredWeekStart) : null,
    notes: l.notes,
  };
}

const reasonLabel = (id: string): string =>
  (emailCopy.lead.reasonLabels as Record<string, string>)[id] ?? id.replace(/_/g, ' ');

export const leadSubject = (
  d: Pick<ReturnType<typeof buildLeadEmailData>, 'vehicle' | 'routeName' | 'reasons'>,
): string =>
  emailCopy.lead.subject
    .replace('{reasons}', d.reasons.join(', '))
    .replace('{vehicle}', d.vehicle)
    .replace('{route}', d.routeName);
