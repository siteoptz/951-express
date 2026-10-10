import { describe, expect, it } from 'vitest';
import { buildSessionParams, depositLineName, sessionExpiry, weekOf } from '@/lib/checkout-session';

describe('depositLineName', () => {
  it('matches the agreed wording', () => {
    expect(
      depositLineName({ year: 2021, make: 'Toyota', model: 'RAV4' }, 'West → East', 'Oct 19 – 25'),
    ).toBe('Transport deposit: 2021 Toyota RAV4, West → East, week of Oct 19');
    expect(weekOf('Oct 26 – Nov 1')).toBe('Oct 26');
    expect(weekOf('Dec 28 – Jan 3')).toBe('Dec 28');
  });
});

describe('sessionExpiry', () => {
  const now = Date.parse('2026-10-08T19:00:00.000Z');
  it('extends a 30-minute hold so Stripe accepts it (minimum 30 minutes from now)', () => {
    const hold = new Date(now + 30 * 60_000); // by the time Stripe is called this is already < 30 min away
    const r = sessionExpiry(hold, now + 400);
    expect(r.extended).toBe(true);
    expect(r.expiresAtSec * 1000).toBeGreaterThanOrEqual(now + 400 + 30 * 60_000);
    expect(r.holdExpiresAt.getTime()).toBe(r.expiresAtSec * 1000);
  });
  it('keeps a longer hold as it is', () => {
    const hold = new Date(now + 45 * 60_000);
    expect(sessionExpiry(hold, now)).toEqual({
      expiresAtSec: now / 1000 + 45 * 60,
      holdExpiresAt: hold,
      extended: false,
    });
  });
});

describe('buildSessionParams', () => {
  const p = buildSessionParams({
    bookingId: 'b1',
    depositCents: 35000,
    lineName: 'Transport deposit: x',
    expiresAtSec: 1_800_000_000,
    integrationIdentifier: 'id',
  });
  it('uses embedded checkout, one-time payment with no redirect', () => {
    expect(p).toMatchObject({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      customer_creation: 'if_required',
      expires_at: 1_800_000_000,
    });
  });
  it('charges exactly the deposit as one line item, tagged with the booking', () => {
    expect(p.line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 35000,
          product_data: { name: 'Transport deposit: x' },
        },
      },
    ]);
    expect(p.metadata).toEqual({ bookingId: 'b1' });
    expect(p.client_reference_id).toBe('b1');
    expect(p.payment_intent_data.metadata).toEqual({ bookingId: 'b1' });
  });
  it('never fixes payment methods in code', () => {
    expect(Object.keys(p)).not.toContain('payment_method_types');
  });
});
