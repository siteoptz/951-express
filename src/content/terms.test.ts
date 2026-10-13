import { describe, expect, it } from 'vitest';
import { booking } from '@/config/booking';
import { termsIntro, termsSections, type TermsBlock } from '@/content/terms';

const text = [
  termsIntro,
  ...termsSections.flatMap((s) => [
    s.title,
    ...s.body.flatMap((b: TermsBlock) => (typeof b === 'string' ? [b] : b.list)),
  ]),
].join('\n');

describe('terms content', () => {
  it('states our actual rules', () => {
    for (const s of [
      'West region and our East region',
      'a flat deposit of $100',
      "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
      'Standard delivery is estimated at 7–10 days after pickup. That is an estimate, not a guarantee',
      '$150',
      "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
      '7 or more days before the first day of your pickup week',
      'Fully licensed and bonded with a cargo limit of $250,000 per occurrence',
      'USDOT 4020917',
      'MC-1516594',
      'California',
      '951.dispatcher@gmail.com',
      'Bill of Lading',
      'toll tags',
      'one-quarter tank',
      'hazardous materials',
      'firearms',
    ])
      expect(text, s).toContain(s);
  });
  it('shows no draft or TODO wording to the public, and no phone number', () => {
    expect(text).not.toMatch(/TODO|draft|placeholder|lorem/i);
    expect(text).not.toMatch(/\(\d{3}\) \d{3}-\d{4}/);
  });
  it('has unique section ids and numbered titles in order', () => {
    const ids = termsSections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    termsSections.forEach((s, i) => expect(s.title.startsWith(`${i + 1}. `)).toBe(true));
  });
  it('has a version and a last-updated date', () => {
    expect(booking.termsVersion).toBe('2026-10-13.2');
    expect(booking.termsLastUpdated).toBe('October 13, 2026');
  });
});
