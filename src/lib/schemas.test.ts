import { describe, expect, it } from 'vitest';
import {
  adminActionSchema,
  quoteRequestSchema,
  selectableClass,
  step1Schema,
  step3Schema,
} from '@/lib/schemas';

const vehicle = { year: 2021, make: 'Chevrolet', model: 'Tahoe' };

describe('quoteRequestSchema (large-vehicle lead)', () => {
  const valid = {
    name: 'Pat Driver',
    phone: '(951) 555-0100',
    email: 'pat@example.com',
    pickupZip: '90001',
    deliveryZip: '21201',
    vehicle,
    operable: true,
    modified: false,
  };
  it('accepts a valid request and defaults topDeck to false', () => {
    const r = quoteRequestSchema.parse(valid);
    expect(r.topDeck).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, topDeck: true, notes: 'Lifted' }).success).toBe(
      true,
    );
  });
  it('rejects bad email, phone, ZIP, and year', () => {
    expect(quoteRequestSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
    expect(
      quoteRequestSchema.safeParse({ ...valid, phone: 'call me maybe 5555555555' }).success,
    ).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, pickupZip: '9000' }).success).toBe(false);
    expect(
      quoteRequestSchema.safeParse({ ...valid, vehicle: { ...vehicle, year: 1800 } }).success,
    ).toBe(false);
  });
  it('takes an optional preferred pickup week that must be a Monday', () => {
    expect(
      quoteRequestSchema.safeParse({ ...valid, preferredWeekStart: '2026-10-19' }).success,
    ).toBe(true);
    expect(
      quoteRequestSchema.safeParse({ ...valid, preferredWeekStart: '2026-10-20' }).success,
    ).toBe(false);
    expect(quoteRequestSchema.parse(valid).preferredWeekStart).toBeUndefined();
  });
  it('allows large as a selectable class', () => {
    expect(selectableClass.safeParse('large').success).toBe(true);
    expect(selectableClass.safeParse('huge').success).toBe(false);
  });
});

describe('step1Schema', () => {
  const valid = {
    pickupZip: '90001',
    deliveryZip: '21201',
    vehicle,
    operable: true,
    modified: false,
    personalItems: true,
    weekStart: '2026-10-19',
    termsAccepted: true as const,
  };
  it('accepts a valid payload; topDeck defaults to false and can be true', () => {
    expect(step1Schema.parse(valid).topDeck).toBe(false);
    expect(step1Schema.parse({ ...valid, topDeck: true, selectedClass: 'small-suv' }).topDeck).toBe(
      true,
    );
  });
  it('requires terms, a Monday week, and a known class', () => {
    expect(step1Schema.safeParse({ ...valid, termsAccepted: false }).success).toBe(false);
    expect(step1Schema.safeParse({ ...valid, weekStart: '2026-10-20' }).success).toBe(false);
    expect(step1Schema.safeParse({ ...valid, selectedClass: 'huge' }).success).toBe(false);
  });
  it('never takes prices from the browser: unknown keys are dropped', () => {
    const r = step1Schema.parse({ ...valid, totalCents: 1, depositCents: 1 }) as Record<
      string,
      unknown
    >;
    expect(r.totalCents).toBeUndefined();
    expect(r.depositCents).toBeUndefined();
  });
});

describe('step3Schema', () => {
  const addr = { street: '1 Main St', city: 'Corona', state: 'ca', zip: '92881' };
  const valid = {
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: addr,
    pickupAddress: addr,
    deliveryAddress: { ...addr, street2: 'Unit 2', city: 'Baltimore', state: 'MD', zip: '21201' },
  };
  it('accepts valid details and upper-cases the state', () => {
    const r = step3Schema.parse({ ...valid, notes: 'Gate code 1234' });
    expect(r.address.state).toBe('CA');
  });
  it('rejects a missing address field and a bad state', () => {
    expect(step3Schema.safeParse({ ...valid, address: { ...addr, street: '' } }).success).toBe(
      false,
    );
    expect(step3Schema.safeParse({ ...valid, address: { ...addr, state: 'Cali' } }).success).toBe(
      false,
    );
  });
});

describe('adminActionSchema', () => {
  const routeId = 'west-to-east';
  const weekStart = '2026-10-19';
  it('accepts each action', () => {
    for (const a of [
      { action: 'close_week', routeId, weekStart },
      { action: 'reopen_week', routeId, weekStart },
      { action: 'set_capacity', routeId, weekStart, capacity: 10 },
      { action: 'set_capacity', routeId, weekStart, capacity: null },
      { action: 'cancel_booking', bookingId: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b' },
      {
        action: 'update_rates',
        baseCents: { 'small-sedan': 145000 },
        topDeckSurchargeCents: 15000,
        depositPercent: 25,
      },
      { action: 'update_rates' },
    ])
      expect(adminActionSchema.safeParse(a).success).toBe(true);
  });
  it('rejects bad routes, weeks, capacity, ids, and rates', () => {
    expect(
      adminActionSchema.safeParse({ action: 'close_week', routeId: 'north', weekStart }).success,
    ).toBe(false);
    expect(
      adminActionSchema.safeParse({ action: 'close_week', routeId, weekStart: '2026-10-20' })
        .success,
    ).toBe(false);
    expect(
      adminActionSchema.safeParse({ action: 'set_capacity', routeId, weekStart, capacity: -1 })
        .success,
    ).toBe(false);
    expect(
      adminActionSchema.safeParse({ action: 'cancel_booking', bookingId: 'nope' }).success,
    ).toBe(false);
    expect(adminActionSchema.safeParse({ action: 'update_rates', depositPercent: 0 }).success).toBe(
      false,
    );
    expect(
      adminActionSchema.safeParse({ action: 'update_rates', baseCents: { 'big-rig': 1 } }).success,
    ).toBe(false);
    expect(adminActionSchema.safeParse({ action: 'delete_everything' }).success).toBe(false);
  });
});
