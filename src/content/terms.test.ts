import { describe, expect, it } from 'vitest';
import { booking } from '@/config/booking';
import { company } from '@/config/company';
import { termsClosing, termsIntro, termsSections, type TermsBlock } from '@/content/terms';

const text = [
  termsIntro,
  ...termsSections.flatMap((s) => [
    s.title,
    ...s.body.flatMap((b: TermsBlock) => (typeof b === 'string' ? [b] : b.list)),
  ]),
  termsClosing,
].join('\n');

describe('terms content', () => {
  it("is Cal's text, with the company facts from config", () => {
    for (const s of [
      `by and between ${company.name}, USDOT #${company.usdot}, and the vehicle owner`,
      'on its own fleet of commercial car haulers',
      'That week is an estimate, not a guaranteed date.',
      'Standard delivery is estimated at 7–10 days after pickup. That is an estimate, not a guarantee',
      "The Customer may place up to 100 lbs of personal items confined solely to the vehicle's trunk.",
      "by Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
      "If the Customer cancels 7 or more days before the first day of the Customer's pickup week",
      'the deposit is not refundable',
      'ALL DAMAGE MUST BE NOTED ON THE BOL AT THE TIME OF DELIVERY.',
      'laws of the State of California',
      `via email at ${company.contactEmail}.`,
      "(as saved with the Customer's booking)",
    ])
      expect(text, s).toContain(s);
    expect(text).toContain(termsClosing);
  });
  it('matches the booking config: balance methods and the personal-items rule', () => {
    expect(booking.balanceMethods).toEqual(['Cash', "Cashier's Check", 'Zelle']);
    expect(booking.personalItemsNotice).toBe('Up to 100 lbs of personal items, in the trunk only.');
  });
  it('shows no draft or TODO wording to the public, and no phone number', () => {
    expect(text).not.toMatch(/TODO|draft|placeholder|lorem/i);
    expect(text).not.toMatch(/\(\d{3}\) \d{3}-\d{4}/);
    expect(text).not.toMatch(/guaranteedate/);
  });
  it('has unique section ids and numbered titles in order, 15 sections', () => {
    const ids = termsSections.map((s) => s.id);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(ids.length);
    termsSections.forEach((s, i) => expect(s.title.startsWith(`${i + 1}. `)).toBe(true));
  });
  it('has a version and a last-updated date', () => {
    expect(booking.termsVersion).toBe('2026-10-17.1');
    expect(booking.termsLastUpdated).toBe('October 17, 2026');
  });
});
