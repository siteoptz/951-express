import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pdfText } from '../../test/pdf-text';
import { buildDispatchData, dispatchFileName, dispatchPaymentLine } from '@/lib/dispatch-data';
import type { BookingForEmail, EmailContext } from '@/lib/email-data';
import { renderDispatchPdf } from '@/server/dispatch-pdf';

const home = { street: '1 Main St', city: 'Corona', state: 'CA', zip: '92881' };
export const base: BookingForEmail = {
  id: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b',
  vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
  customer: {
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: home,
  },
  pickupAddress: { ...home, zip: '92882' },
  deliveryAddress: {
    street: '9 Pier Rd',
    street2: 'Unit 2',
    city: 'Parrs Ridge',
    state: 'MD',
    zip: '21771',
  },
  pickupZip: '92881',
  deliveryZip: '21771',
  weekStart: '2026-10-19',
  sizeClass: 'midsize-suv',
  sizeClassSource: 'table',
  operable: true,
  modified: false,
  topDeck: false,
  personalItems: false,
  totalCents: 170000,
  depositCents: 10000,
  balanceCents: 160000,
  needsReview: false,
  termsVersion: '2026-10-13.3',
  termsAcceptedAt: new Date('2026-10-13T18:00:00Z'),
  paidAt: new Date('2026-10-13T18:05:00Z'),
  stripePaymentIntent: 'pi_123',
  notes: null,
};
export const full: BookingForEmail = {
  ...base,
  vehicleTyped: { year: '2021', make: 'chevy', model: 'tahoe' },
  topDeck: true,
  personalItems: true,
  totalCents: 185000,
  balanceCents: 175000,
  needsReview: true,
  reviewReason: 'city/ZIP mismatch',
  addressFlags: [
    'Delivery address: city "Parrs Ridge" does not match ZIP 21771 (Mount Airy, MD). The customer confirmed it is correct.',
  ],
  vehicleColor: 'Midnight blue',
  vehicleVin: '1GNSKCKD5MR123456',
  pickupContact: { name: 'Lee Neighbor', phone: '951-555-0111' },
  deliveryContact: { name: 'Sam Receiver', phone: '301-555-0122' },
  notes:
    'Gate code 4412 at pickup. Call 30 minutes before arriving. Low clearance on the driveway.',
};
const ctx: EmailContext = {
  routeName: 'West → East',
  sizeClassLabel: 'Midsize SUV',
  spot: { n: 2, of: 6 },
  stripeTestMode: true,
};
const env = { VERCEL_PROJECT_PRODUCTION_URL: '951-express.vercel.app' };

describe('dispatch sheet PDF', () => {
  it('is a single US Letter page with every section, for a booking with all optional fields', async () => {
    const pdf = await renderDispatchPdf(full, ctx, env);
    expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.filename).toBe('951-Express-Dispatch-3F2B6C1E-2021-Chevrolet-Tahoe.pdf');
    if (process.env.DISPATCH_SAMPLE_DIR) {
      mkdirSync(process.env.DISPATCH_SAMPLE_DIR, { recursive: true });
      writeFileSync(path.join(process.env.DISPATCH_SAMPLE_DIR, 'full.pdf'), pdf.content);
      const min = await renderDispatchPdf(base, { ...ctx, spot: { n: 1, of: 6 } }, env);
      writeFileSync(path.join(process.env.DISPATCH_SAMPLE_DIR, 'minimal.pdf'), min.content);
    }
    const { pages, text: raw } = await pdfText(pdf.content);
    const text = raw.replace(/\s+/g, ' ');
    expect(pages).toBe(1);
    for (const want of [
      'Dispatch Sheet',
      'Order ID: 3F2B6C1E',
      'SHIPPER (CUSTOMER)',
      'Pat Driver',
      'USDOT 4020917',
      'MC-1516594',
      '2108 Collett Ave Apt 204, Corona, CA 92879',
      'Estimated pickup',
      'Oct 19 – 25',
      'Estimated delivery',
      'Oct 26 – Nov 4',
      'OPEN',
      'TOP DECK LOAD',
      '$1,750',
      '$100',
      'Balance to collect at delivery',
      "Payment method: Cash, Cashier's Check, or Zelle only. No credit cards.",
      '2021 Chevrolet Tahoe',
      'Typed by customer: 2021 chevy tahoe',
      'Midsize SUV',
      'Midnight blue',
      '1GNSKCKD5MR123456',
      'Lee Neighbor',
      'Sam Receiver',
      '9 Pier Rd, Unit 2, Parrs Ridge, MD 21771',
      'Gate code 4412',
      "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
      'NEEDS REVIEW BEFORE DISPATCH',
      'city/ZIP mismatch',
      'does not match ZIP 21771 (Mount Airy, MD)',
      '951-express.vercel.app/terms',
    ])
      expect(text, want).toContain(want);
  });

  it('still fits one page, and says "Same as customer", when every optional field is empty', async () => {
    const pdf = await renderDispatchPdf(base, ctx, env);
    const { pages, text } = await pdfText(pdf.content);
    expect(pages).toBe(1);
    expect(text).toContain('Same as customer');
    expect(text).not.toContain('NEEDS REVIEW');
    expect(text).not.toContain('TOP DECK');
    expect(text).toContain('Standard');
    expect(text).not.toContain('Typed by customer'); // 2021 Chevrolet Tahoe typed as such
  });

  it('stays on one page with the longest realistic notes', async () => {
    const long = { ...full, notes: 'Call before arriving. '.repeat(90).trim() }; // the form allows 2,000 characters
    const { pages, text } = await pdfText((await renderDispatchPdf(long, ctx, env)).content);
    expect(pages).toBe(1);
    expect(text).toContain('full notes are in the booking email');
  });
});

describe('dispatch data', () => {
  it('shows the estimated delivery as pickup week start + 7 to pickup week end + 10', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.order.delivery).toBe('Oct 26 – Nov 4 (estimate)');
    // A week that stays inside one month: Nov 2 – 8 gives Nov 9 – 18.
    expect(
      buildDispatchData({ ...base, weekStart: '2026-11-02' }, ctx, 'https://x.test').order.delivery,
    ).toBe('Nov 9 – 18 (estimate)');
  });
  it('states the balance method as the dispatch sheet line', () => {
    expect(dispatchPaymentLine()).toBe(
      "Payment method: Cash, Cashier's Check, or Zelle only. No credit cards.",
    );
    expect(buildDispatchData(base, ctx, 'https://x.test').payment.note).toContain(
      'Balance due at delivery',
    );
  });
  it('builds the file name from the reference and the vehicle', () => {
    expect(
      dispatchFileName('AB12CD34', { year: 2020, make: 'Mercedes-Benz', model: 'GLC 300' }),
    ).toBe('951-Express-Dispatch-AB12CD34-2020-Mercedes-Benz-GLC-300.pdf');
  });
  it('lists review reasons and address flags together', () => {
    expect(buildDispatchData(full, ctx, 'https://x.test').flags).toEqual([
      'city/ZIP mismatch',
      expect.stringContaining('Delivery address: city "Parrs Ridge"'),
    ]);
  });
});
