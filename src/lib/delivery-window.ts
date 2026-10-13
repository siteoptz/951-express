import { addDays, format } from 'date-fns';
import { booking } from '@/config/booking';

/** "7–10 days after pickup", from config. */
export function deliveryWindowText(
  days: { min: number; max: number } = booking.deliveryWindowDays,
): string {
  return `${days.min}–${days.max} days after pickup`;
}

/** "Estimated delivery: 7–10 days after pickup" (customer-facing: cart, confirmation, emails). */
export const estimatedDeliveryLine = (days?: { min: number; max: number }): string =>
  `Estimated delivery: ${deliveryWindowText(days)}`;

/**
 * The dispatch sheet's estimated delivery: the first day of the pickup week plus the minimum days, to the last day of
 * the week plus the maximum days. The week of Oct 19 – 25 gives "Oct 26 – Nov 4".
 */
export function estimatedDeliveryRange(
  weekStart: string,
  days: { min: number; max: number } = booking.deliveryWindowDays,
): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const from = addDays(start, days.min);
  const to = addDays(start, 6 + days.max);
  const fmt = (d: Date, f: string) =>
    format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), f);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  return `${fmt(from, 'MMM d')} – ${fmt(to, sameMonth ? 'd' : 'MMM d')}`;
}
