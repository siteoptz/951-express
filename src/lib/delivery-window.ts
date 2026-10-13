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
