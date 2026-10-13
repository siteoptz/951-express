import { describe, expect, it } from 'vitest';
import { booking } from '@/config/booking';
import { deliveryWindowText, estimatedDeliveryLine } from '@/lib/delivery-window';

describe('delivery window', () => {
  it('is 7–10 days after pickup, from config', () => {
    expect(booking.deliveryWindowDays).toEqual({ min: 7, max: 10 });
    expect(deliveryWindowText()).toBe('7–10 days after pickup');
    expect(estimatedDeliveryLine()).toBe('Estimated delivery: 7–10 days after pickup');
  });
  it('follows the numbers it is given', () => {
    expect(deliveryWindowText({ min: 5, max: 8 })).toBe('5–8 days after pickup');
  });
});

describe('balance payment message', () => {
  it('has a short form for places under a "Balance due at delivery" label', () => {
    expect(booking.balanceMessageShort).toBe(
      "Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
    );
    expect(booking.balanceMessage).toBe(`Balance due at delivery: ${booking.balanceMessageShort}`);
  });
  it('says Cash, Cashier’s Check, or Zelle only, with no credit cards', () => {
    expect(booking.balanceMethods).toEqual(['Cash', "Cashier's Check", 'Zelle']);
    expect(booking.balanceMessage).toBe(
      "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
    );
  });
});
