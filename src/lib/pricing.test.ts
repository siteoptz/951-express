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
    const r = q(calculateQuote({ sizeClass, operable: true, modified: false }));
    expect(r.baseCents).toBe(cents);
    expect(r.totalCents).toBe(cents);
    expect(r.surcharges).toEqual([]);
    expect(r.depositCents).toBe(cents / 4);
    expect(r.balanceCents).toBe(cents - cents / 4);
    expect(r.needsReview).toBe(false);
  });
  it('covers every configured class', () => {
    expect(sizeClasses).toHaveLength(7);
  });
});

describe('quote required', () => {
  it('has no online price for large vehicles, even with options', () => {
    expect(calculateQuote({ sizeClass: 'large', operable: true, modified: false })).toEqual({ quoteRequired: true });
    expect(calculateQuote({ sizeClass: 'large', operable: false, modified: true, topDeck: true })).toEqual({
      quoteRequired: true,
    });
  });
  it('throws on an unknown class', () => {
    expect(() => calculateQuote({ sizeClass: 'nope' as never, operable: true, modified: false })).toThrow(/Unknown size class/);
  });
});

describe('surcharges', () => {
  const base = { sizeClass: 'small-sedan', operable: true, modified: false } as const;
  it('top deck off and on', () => {
    expect(q(calculateQuote({ ...base, topDeck: false })).totalCents).toBe(140000);
    const on = q(calculateQuote({ ...base, topDeck: true }));
    expect(on.surcharges).toEqual([{ id: 'topDeck', label: 'Top Deck Load', cents: 15000 }]);
    expect(on.totalCents).toBe(155000);
  });
  it('inoperable and modified', () => {
    expect(q(calculateQuote({ ...base, operable: false })).totalCents).toBe(155000);
    expect(q(calculateQuote({ ...base, modified: true })).totalCents).toBe(150000);
  });
  it('all three together, in a stable order', () => {
    const r = q(calculateQuote({ ...base, operable: false, modified: true, topDeck: true }));
    expect(r.surcharges.map((s) => s.id)).toEqual(['inoperable', 'modified', 'topDeck']);
    expect(r.totalCents).toBe(140000 + 15000 + 10000 + 15000);
    expect(r.depositCents + r.balanceCents).toBe(r.totalCents);
  });
  it('modified policy "review" adds no surcharge and flags review', () => {
    const r = q(calculateQuote({ ...base, modified: true }, { ...pricing, modifiedPolicy: 'review' }));
    expect(r.totalCents).toBe(140000);
    expect(r.needsReview).toBe(true);
  });
  it('carries the needsReview flag from an unclassified vehicle', () => {
    expect(q(calculateQuote({ ...base, needsReview: true })).needsReview).toBe(true);
  });
});

describe('deposit rounding', () => {
  it('rounds to whole cents and always sums to the total', () => {
    const cfg = { ...pricing, deposit: { type: 'percent' as const, value: 33 } };
    for (const sizeClass of ['small-sedan', 'midsize-suv', 'minivan'] as const) {
      for (const topDeck of [false, true]) {
        const r = q(calculateQuote({ sizeClass, operable: false, modified: true, topDeck }, cfg));
        expect(Number.isInteger(r.depositCents)).toBe(true);
        expect(r.depositCents + r.balanceCents).toBe(r.totalCents);
      }
    }
    const r = q(calculateQuote({ sizeClass: 'small-sedan', operable: true, modified: false }, { ...pricing, deposit: { type: 'percent', value: 33.333 } }));
    expect(r.depositCents).toBe(46666);
  });
});
