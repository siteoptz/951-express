// What the dispatch sheet says, as plain data. Pure, so the wording is easy to test; src/pdf draws it.
import { booking as bookingConfig } from '@/config/booking';
import { company } from '@/config/company';
import { topDeck } from '@/config/pricing';
import type { Address, Contact } from '@/db/schema';
import { estimatedDeliveryRange } from '@/lib/delivery-window';
import {
  reviewReasons,
  typedVehicleText,
  vehicleName,
  type BookingForEmail,
  type EmailContext,
} from '@/lib/email-data';
import { bookingRef, formatAddress, money } from '@/lib/format';
import { weekLabel } from '@/lib/weeks';

export type DispatchParty = { name: string; phone: string; address: string; contactNote: string };

/** "Cash, Cashier's Check, or Zelle" from the configured list. */
const methodList = (m: readonly string[]): string =>
  m.length < 3 ? m.join(' or ') : `${m.slice(0, -1).join(', ')}, or ${m[m.length - 1]}`;

export const dispatchPaymentLine = (): string =>
  `Payment method: ${methodList(bookingConfig.balanceMethods)} only. No credit cards.`;

// Keeps the sheet on one page: longer notes are cut, and the booking email carries them in full.
const NOTES_ON_SHEET = 500;

const dateOnly = (d: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: bookingConfig.timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

export function buildDispatchData(b: BookingForEmail, ctx: EmailContext, siteUrl: string) {
  const c = b.customer;
  const customerName = `${c.firstName} ${c.lastName}`.trim();
  const party = (address: Address, contact: Contact | null | undefined): DispatchParty => ({
    name: contact?.name ?? customerName,
    phone: contact?.phone ?? c.phone,
    address: formatAddress(address),
    contactNote: contact ? 'On-site contact' : 'Same as customer',
  });
  const typed = typedVehicleText(b.vehicleTyped);
  const name = vehicleName(b.vehicle);
  const flags = [...reviewReasons(b), ...(b.addressFlags ?? [])];
  const instructions: string[] = [];
  if (b.notes)
    instructions.push(
      `Customer notes: ${
        b.notes.length > NOTES_ON_SHEET
          ? `${b.notes.slice(0, NOTES_ON_SHEET).trimEnd()}… (full notes are in the booking email)`
          : b.notes
      }`,
    );
  instructions.push(
    b.personalItems
      ? `Personal items: Yes. ${bookingConfig.personalItemsNotice}`
      : 'Personal items: None declared.',
  );
  if (!b.operable) instructions.push('Vehicle is NOT operable.');
  if (b.modified) instructions.push('Vehicle has been modified.');
  if (b.topDeck) instructions.push('Top Deck Load: load on the top deck.');

  return {
    ref: bookingRef(b.id),
    title: 'Dispatch Sheet',
    shipper: {
      name: customerName,
      phone: c.phone,
      email: c.email,
      address: c.address ? formatAddress(c.address) : null,
    },
    carrier: {
      name: company.name,
      usdot: `USDOT ${company.usdot}`,
      mc: company.mc,
      address: company.dispatchAddress,
      email: company.contactEmail,
    },
    order: {
      booked: dateOnly(b.paidAt ?? b.termsAcceptedAt),
      route: ctx.routeName.replace('→', 'to'), // the PDF's built-in font has no arrow
      pickup: `${weekLabel(b.weekStart)} (pickup week)`,
      delivery: `${estimatedDeliveryRange(b.weekStart)} (estimate)`,
      shipVia: 'OPEN',
      loadType: b.topDeck ? `${topDeck.label.toUpperCase()} (top deck)` : topDeck.standardLabel,
      topDeck: b.topDeck,
    },
    payment: {
      total: money(b.totalCents),
      deposit: `${money(b.depositCents)}${b.paidAt ? ` (paid online ${dateOnly(b.paidAt)})` : ''}`,
      balance: money(b.balanceCents),
      method: dispatchPaymentLine(),
      note: bookingConfig.balanceMessage,
    },
    vehicle: {
      n: 1,
      name,
      typedNote:
        typed && typed.toLowerCase() !== name.toLowerCase() ? `Typed by customer: ${typed}` : null,
      type: ctx.sizeClassLabel,
      color: b.vehicleColor ?? '',
      vin: b.vehicleVin ?? '',
      lot: '',
    },
    pickup: party(b.pickupAddress, b.pickupContact),
    delivery: party(b.deliveryAddress, b.deliveryContact),
    instructions,
    flags,
    footer: `${siteUrl}/terms  ·  Terms version ${b.termsVersion}`,
  };
}
export type DispatchData = ReturnType<typeof buildDispatchData>;

/** 951-Express-Dispatch-1A2B3C4D-2021-Chevrolet-Tahoe.pdf: letters and digits only in each part. */
export function dispatchFileName(
  ref: string,
  v: { year: number; make: string; model: string },
): string {
  const part = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `951-Express-Dispatch-${ref}-${[v.year, v.make, v.model].map((x) => part(String(x))).join('-')}.pdf`;
}
