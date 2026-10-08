import { describe, expect, it } from 'vitest';
import { evaluateStep1 } from '@/lib/booking-quote';
import type { Step1 } from '@/lib/schemas';

const now = new Date('2026-10-08T19:00:00Z');
const regionOf = (z: string) => (z.startsWith('9') ? 'west' : z.startsWith('2') ? 'east' : null);
const base: Step1 = {
  pickupZip: '90001',
  deliveryZip: '21201',
  vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
  operable: true,
  modified: false,
  topDeck: false,
  personalItems: false,
  weekStart: '2026-10-19',
  termsAccepted: true,
};

describe('evaluateStep1', () => {
  it('prices a known vehicle from the table', () => {
    const r = evaluateStep1(base, regionOf, now);
    expect(r).toMatchObject({
      ok: true,
      quoteRequired: false,
      sizeClass: 'small-sedan',
      sizeClassSource: 'table',
      loadType: 'Standard',
    });
    if (r.ok && !r.quoteRequired) {
      expect(r.route.id).toBe('west-to-east');
      expect(r.week.label).toBe('Oct 19 – 25');
      expect(r.lines).toEqual([{ id: 'base', label: 'Small sedan transport', cents: 140000 }]);
      expect(r.quote).toMatchObject({
        totalCents: 140000,
        depositCents: 35000,
        balanceCents: 105000,
      });
    }
  });
  it('top deck adds exactly $150 as its own line', () => {
    const r = evaluateStep1({ ...base, topDeck: true }, regionOf, now);
    expect(r.ok && !r.quoteRequired && r.quote.totalCents).toBe(155000);
    expect(r.ok && !r.quoteRequired && r.lines.at(-1)).toEqual({
      id: 'topDeck',
      label: 'Top Deck Load',
      cents: 15000,
    });
    expect(r.ok && !r.quoteRequired && r.loadType).toBe('Top Deck Load');
  });
  it('ignores a cheaper class chosen for a known vehicle', () => {
    const tahoe = {
      ...base,
      vehicle: { year: 2020, make: 'Chevrolet', model: 'Tahoe' },
      selectedClass: 'small-sedan' as const,
    };
    expect(evaluateStep1(tahoe, regionOf, now)).toMatchObject({ ok: true, quoteRequired: true });
    const civic = { ...base, selectedClass: 'minivan' as const };
    expect(evaluateStep1(civic, regionOf, now)).toMatchObject({ sizeClass: 'small-sedan' });
  });
  it('uses the customer class for unknown vehicles and flags review', () => {
    const v = { ...base, vehicle: { year: 2020, make: 'Zzz', model: 'Thing' } };
    expect(evaluateStep1(v, regionOf, now)).toEqual({ ok: false, error: 'class_required' });
    expect(evaluateStep1({ ...v, selectedClass: 'small-suv' }, regionOf, now)).toMatchObject({
      sizeClass: 'small-suv',
      sizeClassSource: 'customer',
      needsReview: true,
    });
  });
  it('flags a large vehicle as quote required without checking the week', () => {
    const large = {
      ...base,
      vehicle: { year: 2021, make: 'Ford', model: 'F-150' },
      weekStart: '2020-01-06',
    };
    expect(evaluateStep1(large, regionOf, now)).toMatchObject({ ok: true, quoteRequired: true });
  });
  it('rejects bad routes and unavailable weeks', () => {
    expect(evaluateStep1({ ...base, deliveryZip: '90002' }, regionOf, now)).toMatchObject({
      ok: false,
      error: 'route',
      failure: { reason: 'same_region' },
    });
    expect(evaluateStep1({ ...base, pickupZip: '10001' }, regionOf, now)).toMatchObject({
      error: 'route',
      failure: { reason: 'pickup_not_served' },
    });
    expect(evaluateStep1({ ...base, weekStart: '2026-10-05' }, regionOf, now)).toEqual({
      ok: false,
      error: 'week_unavailable',
    });
  });
  it('rejects an unknown selected class', () => {
    const v = {
      ...base,
      vehicle: { year: 2020, make: 'Zzz', model: 'Thing' },
      selectedClass: 'huge' as never,
    };
    expect(evaluateStep1(v, regionOf, now)).toEqual({ ok: false, error: 'invalid_class' });
  });
});
