import type { Address } from '@/db/schema';
import { booking } from '@/config/booking';

/** 140000 -> "$1,400", 38750 -> "$387.50" */
export const money = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

/** "Oct 10, 2026, 1:23 PM PDT": always the business time zone, never the server's or the reader's. */
export function formatPacific(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: booking.timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export const formatAddress = (a: Address): string =>
  [a.street, a.street2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(', ');

/** A short reference the customer and the team can quote. */
export const bookingRef = (id: string): string => id.replace(/-/g, '').slice(0, 8).toUpperCase();
