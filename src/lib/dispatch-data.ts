// What the dispatch sheet says, as plain data. Pure, so the wording is easy to test; src/pdf draws it.
// The layout follows the grid Super Dispatch imports: a label above its value, two sub-columns per half.
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

/** What the sheet prints for a value we do not have. */
export const EMPTY = '--';

export const phoneDigits = (phone?: string | null): string => (phone ?? '').replace(/\D/g, '');

/** "9515550111" -> "(951) 555-0111" (anything that is not 10 digits is printed as digits only). */
export const phoneText = (phone?: string | null): string => {
  const d = phoneDigits(phone);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
};

/** 150000 -> "$1500.00" (no thousands separator) */
export const plainMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** 175000 -> "$1,750"; 175050 -> "$1,750.50" */
export const priceText = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

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

/** Super Dispatch's vehicle types: Car, SUV, Pickup or Van. */
export function superDispatchType(sizeClass: string): string {
  if (sizeClass.includes('pickup')) return 'Pickup';
  if (sizeClass.includes('suv')) return 'SUV';
  if (sizeClass.includes('van')) return 'Van';
  return 'Car';
}

const streetLine = (a: Address): string => [a.street, a.street2].filter(Boolean).join(', ');
const cityLine = (a: Address): string => `${a.city}, ${a.state} ${a.zip}`;

/** "2108 Collett Ave Apt 204, Corona, CA 92879" -> ["2108 Collett Ave, Apt 204", "Corona, CA 92879"] */
function companyAddressLines(): string[] {
  const [street, ...rest] = company.dispatchAddress.split(', ');
  return [street.replace(/ (Apt|Unit|Suite|Ste) /, ', $1 '), rest.join(', ')];
}

export type DispatchParty = { name: string; street: string; city: string; phone: string };

export function buildDispatchData(b: BookingForEmail, _ctx: EmailContext, siteUrl: string) {
  const c = b.customer;
  const customerName = `${c.firstName} ${c.lastName}`.trim();
  const customerPhone = phoneDigits(c.phone);
  const [companyStreet, companyCity] = companyAddressLines();
  const companyLines = [company.name, companyStreet, companyCity];
  // The pickup or delivery contact if given, otherwise the customer.
  const party = (address: Address, contact: Contact | null | undefined): DispatchParty => ({
    name: contact?.name ?? customerName,
    street: streetLine(address),
    city: cityLine(address),
    phone: phoneText(contact?.phone ?? c.phone) || EMPTY,
  });
  const typed = typedVehicleText(b.vehicleTyped);
  const name = vehicleName(b.vehicle);
  const flags = [...reviewReasons(b), ...(b.addressFlags ?? [])];

  // Load-Specific Terms: the money comes first. Amounts are the booking's own, as the server recorded them.
  const terms = [
    `DEPOSIT PAID: ${plainMoney(b.depositCents)} (already deducted from the total)`,
    `COLLECT AT DELIVERY: ${plainMoney(b.balanceCents)} — ${methodList(bookingConfig.balanceMethods)} only. No credit cards.`,
    `Total booking price: ${plainMoney(b.totalCents)}`,
  ];
  const special: string[] = [`Customer: ${customerName}, ${customerPhone}, ${c.email}`];
  special.push(`Delivery window: ${deliveryWindowText()}`);
  if (b.topDeck) special.push('Top Deck Load: load on the top deck.');
  special.push(
    b.personalItems
      ? `Personal items: Yes. ${bookingConfig.personalItemsNotice}`
      : 'Personal items: None declared.',
  );
  if (!b.operable) special.push('Vehicle is NOT operable.');
  if (b.modified) special.push('Vehicle has been modified.');
  if (typed && typed.toLowerCase() !== name.toLowerCase())
    special.push(`Typed by customer: ${typed}`);

  return {
    ref: bookingRef(b.id),
    title: 'Dispatch Sheet',
    // 951 Express is both the shipper and the carrier. The shipper's special number is left empty so it does not repeat
    // the carrier's MC number (Super Dispatch read the repeat as a mismatch).
    shipper: {
      lines: companyLines,
      contact: [company.dispatchContact, company.dispatchPhone],
      loadContact: company.dispatchPhone,
      special: EMPTY,
    },
    carrier: {
      lines: companyLines,
      contact: [company.dispatchContact, company.dispatchPhone],
      special: company.mc.replace('-', ''),
    },
    origin: party(b.pickupAddress, b.pickupContact),
    destination: party(b.deliveryAddress, b.deliveryContact),
    locationType: bookingConfig.dispatchLocationType,
    dispatchDate: slashDate(b.paidAt ?? b.termsAcceptedAt),
    pickupDate: slashDay(b.weekStart),
    deliveryDate: slashDay(b.weekStart, bookingConfig.deliveryWindowDays.min),
    // What Super Dispatch collects: the balance, by the one method it names.
    totalPrice: priceText(b.balanceCents),
    paymentTerms: `Carrier will receive ${priceText(b.balanceCents)} via ${bookingConfig.dispatchPaymentTerms}.`,
    vehicle: {
      name,
      vin: b.vehicleVin ?? EMPTY,
      type: superDispatchType(b.sizeClass),
      color: b.vehicleColor ?? EMPTY,
    },
    terms,
    notes: b.notes
      ? b.notes.length > NOTES_ON_SHEET
        ? `${b.notes.slice(0, NOTES_ON_SHEET).trimEnd()}… (full notes are in the booking email)`
        : b.notes
      : EMPTY,
    special,
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
