import { describe, expect, it } from 'vitest';
import { calculateQuote, type Quote } from '@/lib/pricing';
import { pricing, sizeClasses } from '@/config/pricing';

const q = (r: ReturnType<typeof calculateQuote>) => r as Quote;

describe('base prices', () => {
  it.each([
    ['small-sedan', 140000],
    ['large-sedan', 150000],
    ['small-suv', 150000],
    ['midsize-suv', 170000],
    ['small-pickup', 170000],
    ['midsize-pickup', 190000],
    ['minivan', 190000],
  ] as const)('%s = %i cents', (sizeClass, cents) => {
    const r = q(calculateQuote({ sizeClass }));
    expect(r.baseCents).toBe(cents);
    expect(r.totalCents).toBe(cents);
    expect(r.surcharges).toEqual([]);
    expect(r.depositCents).toBe(10000);
    expect(r.balanceCents).toBe(cents - 10000);
    expect(r.needsReview).toBe(false);
  });
  it('covers every configured class', () => {
    expect(sizeClasses).toHaveLength(7);
  });
});

describe('quote required', () => {
  it('has no online price for large vehicles, even with options', () => {
    expect(calculateQuote({ sizeClass: 'large' })).toEqual({
      quoteRequired: true,
    });
    expect(calculateQuote({ sizeClass: 'large', topDeck: true })).toEqual({
      quoteRequired: true,
    });
  });
  it('throws on an unknown class', () => {
    expect(() => calculateQuote({ sizeClass: 'nope' as never })).toThrow(/Unknown size class/);
  });
});

describe('surcharges', () => {
  const base = { sizeClass: 'small-sedan' } as const;
  it('top deck off and on', () => {
    expect(q(calculateQuote({ ...base, topDeck: false })).totalCents).toBe(140000);
    const on = q(calculateQuote({ ...base, topDeck: true }));
    expect(on.surcharges).toEqual([{ id: 'topDeck', label: 'Top Deck Load', cents: 15000 }]);
    expect(on.totalCents).toBe(155000);
  });
  it('has no inoperable or modified surcharge (those vehicles get a personalized quote)', () => {
    const r = q(calculateQuote({ ...base, topDeck: true }));
    expect(r.surcharges.map((s) => s.id)).toEqual(['topDeck']);
    expect(Object.keys(pricing)).toEqual(['deposit']);
  });
  it('carries the needsReview flag from an unclassified vehicle', () => {
    expect(q(calculateQuote({ ...base, needsReview: true })).needsReview).toBe(true);
  });
});

describe('flat $100 deposit', () => {
  it('is exactly $100 for every class, with and without top deck', () => {
    for (const { id } of sizeClasses) {
      for (const topDeck of [false, true]) {
        const r = q(calculateQuote({ sizeClass: id, topDeck }));
        expect(r.depositCents).toBe(10000);
        expect(r.balanceCents).toBe(r.totalCents - 10000);
        expect(r.depositCents + r.balanceCents).toBe(r.totalCents);
      }
    }
  });
  it('is configured as flat, in cents', () => {
    expect(pricing.deposit).toEqual({ type: 'flat', amountCents: 10000 });
  });
  it('never exceeds the total', () => {
    const cfg = { deposit: { type: 'flat' as const, amountCents: 999_999_99 } };
    const r = q(calculateQuote({ sizeClass: 'small-sedan' }, cfg));
    expect(r.depositCents).toBe(140000);
    expect(r.balanceCents).toBe(0);
  });
});

describe('percent deposit (still supported)', () => {
  it('computes a percentage of the total', () => {
    const r = q(
      calculateQuote({ sizeClass: 'small-sedan' }, { deposit: { type: 'percent', value: 25 } }),
    );
    expect(r.depositCents).toBe(35000);
    expect(r.balanceCents).toBe(105000);
  });
});

describe('deposit rounding', () => {
  it('rounds to whole cents and always sums to the total', () => {
    const cfg = { deposit: { type: 'percent' as const, value: 33 } };
    for (const sizeClass of ['small-sedan', 'midsize-suv', 'minivan'] as const) {
      for (const topDeck of [false, true]) {
        const r = q(calculateQuote({ sizeClass, topDeck }, cfg));
        expect(Number.isInteger(r.depositCents)).toBe(true);
        expect(r.depositCents + r.balanceCents).toBe(r.totalCents);
      }
    }
    const r = q(
      calculateQuote({ sizeClass: 'small-sedan' }, { deposit: { type: 'percent', value: 33.333 } }),
    );
    expect(r.depositCents).toBe(46666);
  });
});
