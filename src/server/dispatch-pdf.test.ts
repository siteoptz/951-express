import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pdfText, pdftotextLayout } from '../../test/pdf-text';
import {
  buildDispatchData,
  dispatchFileName,
  dispatchPaymentLine,
  superDispatchType,
} from '@/lib/dispatch-data';
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
const env = { NEXT_PUBLIC_SITE_URL: 'https://951express.com' };

const hasPdftotext = !spawnSync('pdftotext', ['-v']).error; // poppler: `brew install poppler`
const layout = async (b: BookingForEmail) =>
  pdftotextLayout((await renderDispatchPdf(b, ctx, env)).content) ?? '';
/** One "Label: value" line, found anywhere on a line of the layout text (other columns may share the line). */
const hasLine = (text: string, line: string) =>
  text.split('\n').some((l) => l.replace(/\s+/g, ' ').includes(line));

describe('dispatch sheet PDF', () => {
  it('is a single US Letter page with real text, for a booking with all optional fields', async () => {
    const pdf = await renderDispatchPdf(full, ctx, env);
    expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.filename).toBe('951-Express-Dispatch-3F2B6C1E-2021-Chevrolet-Tahoe.pdf');
    if (process.env.DISPATCH_SAMPLE_DIR) {
      mkdirSync(process.env.DISPATCH_SAMPLE_DIR, { recursive: true });
      writeFileSync(path.join(process.env.DISPATCH_SAMPLE_DIR, 'full.pdf'), pdf.content);
      const min = await renderDispatchPdf(base, { ...ctx, spot: { n: 1, of: 6 } }, env);
      writeFileSync(path.join(process.env.DISPATCH_SAMPLE_DIR, 'minimal.pdf'), min.content);
    }
    const { pages, text } = await pdfText(pdf.content);
    expect(pages).toBe(1);
    expect(text).toContain('Dispatch Sheet');
    // Letter size: 612 x 792 points
    expect(pdf.content.toString('latin1')).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/);
    expect(pdf.content.toString('latin1')).toContain('Helvetica');
  });

  it.skipIf(!hasPdftotext)(
    'reads back with pdftotext -layout as one "Label: value" line per field',
    async () => {
      const text = await layout(full);
      for (const line of [
        'Order ID: 3F2B6C1E',
        'Dispatch Sheet',
        'Pat Driver',
        'Shipper',
        '1 Main St',
        'Corona, CA 92881',
        'Co. Phone: 9515550100',
        'Email: pat@example.com',
        'Carrier: 951 Express Inc',
        'USDOT: 4020917',
        '2108 Collett Ave Apt 204, Corona, CA 92879',
        'Contact: Jesse Calzada',
        'Email: 951.dispatcher@gmail.com',
        'Dispatch Date: 10/13/2026',
        'Carrier Pickup Estimated: 10/19/2026',
        'Carrier Delivery Estimated: 10/26/2026',
        'Ship Via: OPEN',
        'Condition: Operable',
        'Total Payment to Carrier: $1850.00',
        'Payment terms: On delivery',
        'Payment method: COD',
        'Carrier owes Shipper: $ 0.00',
        'Total Vehicles: 1',
        'Name: Lee Neighbor',
        'Name: Sam Receiver',
        '1 Main St',
        'Corona, CA 92882',
        '9 Pier Rd, Unit 2',
        'Parrs Ridge, MD 21771',
        'Phone: 9515550111',
        'Mobile: 9515550111',
        'Phone: 3015550122',
        'Mobile: 3015550122',
        'Customer notes: Gate code 4412 at pickup.',
        'Delivery window: 7–10 days after pickup',
        'Top Deck Load: load on the top deck.',
        "Deposit $100.00 paid by card. Balance due at delivery: $1750.00. Cash, Cashier's Check, or Zelle only. No credit cards.",
        "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
        'Typed by customer: 2021 chevy tahoe',
        'NEEDS REVIEW BEFORE DISPATCH',
        'city/ZIP mismatch',
      ])
        expect(hasLine(text, line), line).toBe(true);
      // The section titles, exactly as Super Dispatch spells them.
      for (const title of [
        'Carrier Information',
        'Order Information',
        'Vehicle Information',
        'Pickup Information',
        'Delivery Information',
        'DISPATCH INSTRUCTIONS',
      ])
        expect(text, title).toContain(title);
      // The vehicle table: header, then the row.
      expect(text).toMatch(/#\s+Vehicle\s+Type\s+Color\s+VIN\s+Lot #/);
      expect(text).toMatch(/1\s+2021 Chevrolet Tahoe\s+SUV\s+Midnight blue\s+1GNSKCKD5MR123456/);
    },
  );

  it.skipIf(!hasPdftotext)(
    'header: shipper on the left, Order ID centered, "Dispatch Sheet" on the right, and a blank carrier "Phone:"',
    async () => {
      const text = await layout(full);
      const top = text.split('\n').slice(0, 8);
      const orderLine = top.find((l) => l.includes('Order ID: 3F2B6C1E'))!;
      expect(orderLine).toBeDefined();
      expect(orderLine.indexOf('Order ID')).toBeGreaterThan(20);
      const titleLine = top.find((l) => l.includes('Dispatch Sheet'))!;
      expect(titleLine.indexOf('Dispatch Sheet')).toBeGreaterThan(orderLine.indexOf('Order ID'));
      expect(top.join('\n')).toContain('Pat Driver');
      // One shipper block, top left: name, then the word "Shipper", then address, Co. Phone and Email.
      const left = text
        .split('\n')
        .slice(0, 8)
        .filter((l) => l.trim() && !l.startsWith(' ')) // lines that start in the left column
        .map((l) => l.trim().split(/\s{3,}/)[0]);
      expect(left).toEqual([
        'Pat Driver',
        'Shipper',
        '1 Main St',
        'Corona, CA 92881',
        'Co. Phone: 9515550100',
        'Email: pat@example.com',
      ]);
      expect(text.match(/Co\. Phone:/g)).toHaveLength(1); // no second shipper section
      expect(text.match(/^\s*Shipper\s*$/gm)).toHaveLength(1);
      // The carrier's phone is blank: the label has nothing after it.
      expect(text.split('\n').some((l) => /(^|\s)Phone:\s*$/.test(l))).toBe(true);
      expect(text).not.toMatch(/\(\d{3}\)|\d{3}-\d{3}-\d{4}/); // phone numbers are digits only
    },
  );

  it.skipIf(!hasPdftotext)(
    'uses MM/DD/YYYY dates, "$1500.00" money, and no Super Dispatch branding',
    async () => {
      const text = await layout(full);
      const body = text.replace(/Terms version \S+/, ''); // the footer's version is a label, not a date
      expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(text).not.toMatch(/\$\d{1,3},\d{3}/);
      expect(text).toContain('$1850.00');
      expect(text.toLowerCase()).not.toContain('super dispatch');
      expect(text.toLowerCase()).not.toContain('powered by');
      expect(text).toContain('https://951express.com/terms');
      expect(text).not.toContain('vercel.app');
    },
  );

  it('still fits one page when every optional field is empty, and leaves optional values blank', async () => {
    const pdf = await renderDispatchPdf(base, ctx, env);
    const { pages, text } = await pdfText(pdf.content);
    expect(pages).toBe(1);
    expect(text).not.toContain('NEEDS REVIEW');
    expect(text).not.toContain('Top Deck');
    expect(text).not.toContain('Typed by customer'); // 2021 Chevrolet Tahoe typed as such
    if (hasPdftotext) {
      const lt = await layout(base);
      expect(hasLine(lt, 'Name: Pat Driver')).toBe(true); // contacts are the customer
      expect(lt).toMatch(/1\s+2021 Chevrolet Tahoe\s+SUV\s*$/m);
    }
  });

  it('stays on one page with the longest realistic notes', async () => {
    const long = { ...full, notes: 'Call before arriving. '.repeat(90).trim() }; // the form allows 2,000 characters
    const { pages, text } = await pdfText((await renderDispatchPdf(long, ctx, env)).content);
    expect(pages).toBe(1);
    expect(text).toContain('full notes are in the booking email');
  });
});

describe('dispatch data', () => {
  it('builds each field as one "Label: value" string, blank values as "Label:"', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.carrier).toContain('Phone:');
    expect(d.order).toContain('Ship Via: OPEN');
    expect(d.order).toContain('Carrier owes Shipper: $ 0.00');
    expect(d.order).toContain('Total Payment to Carrier: $1700.00');
    expect(d.shipper.slice(0, 2)).toEqual(['Pat Driver', 'Shipper']);
    expect(d.shipper).toContain('Co. Phone: 9515550100');
    expect(d.carrier).toContain('Contact: Jesse Calzada');
    expect(d.order).toContain('Payment terms: On delivery');
    expect(d.order).toContain('Payment method: COD');
  });
  it('dates: dispatch date is the booking date, pickup the first day of the week, delivery that + 7', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.order).toContain('Dispatch Date: 10/13/2026');
    expect(d.order).toContain('Carrier Pickup Estimated: 10/19/2026');
    expect(d.order).toContain('Carrier Delivery Estimated: 10/26/2026');
    // across a month and a year
    const y = buildDispatchData({ ...base, weekStart: '2026-12-28' }, ctx, 'https://x.test');
    expect(y.order).toContain('Carrier Delivery Estimated: 01/04/2027');
  });
  it('maps size classes to Sedan, SUV, Pickup or Van', () => {
    expect(superDispatchType('small-sedan')).toBe('Sedan');
    expect(superDispatchType('large-sedan')).toBe('Sedan');
    expect(superDispatchType('midsize-suv')).toBe('SUV');
    expect(superDispatchType('small-pickup')).toBe('Pickup');
    expect(superDispatchType('minivan')).toBe('Van');
  });
  it('shows an inoperable vehicle, and a top deck booking only in the instructions', () => {
    const d = buildDispatchData({ ...full, operable: false }, ctx, 'https://x.test');
    expect(d.order).toContain('Condition: Inoperable');
    expect(d.order).toContain('Ship Via: OPEN');
    expect(d.instructions).toContain('Top Deck Load: load on the top deck.');
  });
  it('states the balance method as the dispatch sheet line', () => {
    expect(dispatchPaymentLine()).toBe(
      "Payment method: Cash, Cashier's Check, or Zelle only. No credit cards.",
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
