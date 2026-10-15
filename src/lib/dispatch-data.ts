// What the dispatch sheet says, as plain data. Pure, so the wording is easy to test; src/pdf draws it.
import { booking as bookingConfig } from '@/config/booking';
import { company } from '@/config/company';
import type { Address, Contact } from '@/db/schema';
import { deliveryWindowText } from '@/lib/delivery-window';
import {
  reviewReasons,
  typedVehicleText,
  vehicleName,
  type BookingForEmail,
  type EmailContext,
} from '@/lib/email-data';
import { bookingRef } from '@/lib/format';

/** "Cash, Cashier's Check, or Zelle" from the configured list. */
const methodList = (m: readonly string[]): string =>
  m.length < 3 ? m.join(' or ') : `${m.slice(0, -1).join(', ')}, or ${m[m.length - 1]}`;

export const dispatchPaymentLine = (): string =>
  `Payment method: ${methodList(bookingConfig.balanceMethods)} only. No credit cards.`;

// Keeps the sheet on one page: longer notes are cut, and the booking email carries them in full.
const NOTES_ON_SHEET = 500;

// Super Dispatch reads each field as one "Label: value" line, so every field here is a single string, and a field with
// no value is left out. Dates are MM/DD/YYYY, money is "$1500.00" and phone numbers are digits only.
export const field = (label: string, value?: string | null): string =>
  value ? `${label}: ${value}` : `${label}:`;

/** A field with no value is left out entirely (Super Dispatch imports a bare "Phone:" badly). */
const present = (label: string, value?: string | null): string[] =>
  value ? [field(label, value)] : [];

export const phoneDigits = (phone?: string | null): string => (phone ?? '').replace(/\D/g, '');

/** 150000 -> "$1500.00" (no thousands separator) */
export const plainMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** "10/13/2026", the date in the business time zone. */
const slashDate = (d: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: bookingConfig.timezone,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(d);

/** "2026-10-19" plus days -> "10/26/2026". The date alone, so no time zone shifts it. */
const slashDay = (isoDay: string, plusDays = 0): string => {
  const [y, m, d] = isoDay.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + plusDays));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(t.getUTCMonth() + 1)}/${two(t.getUTCDate())}/${t.getUTCFullYear()}`;
};

/** Super Dispatch's vehicle types: Sedan, SUV, Pickup or Van. */
export function superDispatchType(sizeClass: string): string {
  if (sizeClass.includes('pickup')) return 'Pickup';
  if (sizeClass.includes('suv')) return 'SUV';
  if (sizeClass.includes('van')) return 'Van';
  return 'Sedan';
}

const streetLine = (a: Address): string => [a.street, a.street2].filter(Boolean).join(', ');
const cityLine = (a: Address): string => `${a.city}, ${a.state} ${a.zip}`;

export function buildDispatchData(b: BookingForEmail, _ctx: EmailContext, siteUrl: string) {
  const c = b.customer;
  const customerName = `${c.firstName} ${c.lastName}`.trim();
  const phone = phoneDigits(c.phone);
  // 951 Express is the shipper (Cal's sample): the name, the word "Shipper", then (after the Order ID line) our address
  // and email. The customer is the pickup and delivery contact and is named in the dispatch instructions.
  const [companyStreet, ...companyRest] = company.dispatchAddress.split(', ');
  const addressLines = [companyStreet, companyRest.join(', ')];
  const shipper = {
    name: company.name,
    role: 'Shipper',
    lines: [...addressLines, field('Email', company.contactEmail)],
  };
  const party = (address: Address, contact: Contact | null | undefined) => {
    const digits = phoneDigits(contact?.phone ?? c.phone);
    return [
      field('Name', contact?.name ?? customerName),
      streetLine(address),
      cityLine(address),
      ...present('Phone', digits),
      ...present('Mobile', digits),
    ];
  };
  const typed = typedVehicleText(b.vehicleTyped);
  const name = vehicleName(b.vehicle);
  const flags = [...reviewReasons(b), ...(b.addressFlags ?? [])];
  // The first lines land in Super Dispatch's driver instructions, so the money comes first. Amounts are the
  // booking's own, as the server recorded them.
  const instructions: string[] = [
    `DEPOSIT PAID: ${plainMoney(b.depositCents)} (already deducted from the total)`,
    `COLLECT AT DELIVERY: ${plainMoney(b.balanceCents)} — ${methodList(bookingConfig.balanceMethods)} only. No credit cards.`,
    `Total booking price: ${plainMoney(b.totalCents)}`,
    `Customer: ${customerName}, ${phone}, ${c.email}`,
  ];
  if (b.notes)
    instructions.push(
      `Customer notes: ${
        b.notes.length > NOTES_ON_SHEET
          ? `${b.notes.slice(0, NOTES_ON_SHEET).trimEnd()}… (full notes are in the booking email)`
          : b.notes
      }`,
    );
  instructions.push(`Delivery window: ${deliveryWindowText()}`);
  if (b.topDeck) instructions.push('Top Deck Load: load on the top deck.');
  instructions.push(
    b.personalItems
      ? `Personal items: Yes. ${bookingConfig.personalItemsNotice}`
      : 'Personal items: None declared.',
  );
  if (!b.operable) instructions.push('Vehicle is NOT operable.');
  if (b.modified) instructions.push('Vehicle has been modified.');
  if (typed && typed.toLowerCase() !== name.toLowerCase())
    instructions.push(`Typed by customer: ${typed}`);

  return {
    ref: bookingRef(b.id),
    title: 'Dispatch Sheet',
    shipper,
    // No "Phone:" line: there is no phone number on our side.
    carrier: [
      field('Carrier', company.name),
      field('USDOT', company.usdot),
      ...addressLines,
      ...present('Contact', company.dispatchContact),
      field('Email', company.contactEmail),
    ],
    order: [
      field('Dispatch Date', slashDate(b.paidAt ?? b.termsAcceptedAt)),
      field('Carrier Pickup Estimated', slashDay(b.weekStart)),
      field(
        'Carrier Delivery Estimated',
        slashDay(b.weekStart, bookingConfig.deliveryWindowDays.min),
      ),
      field('Ship Via', 'OPEN'),
      field('Condition', b.operable ? 'Operable' : 'Inoperable'),
      // Super Dispatch uses this as the amount to collect (COD), so it is the balance, not the booking total.
      field('Total Payment to Carrier', plainMoney(b.balanceCents)),
      field('Payment method', 'Cash'),
      field('Payment terms', 'COD'),
      field('Carrier owes Shipper', '$ 0.00'),
    ],
    totalVehicles: field('Total Vehicles', '1'),
    vehicle: {
      n: '1',
      name,
      type: superDispatchType(b.sizeClass),
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
