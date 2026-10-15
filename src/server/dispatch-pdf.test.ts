import { spawnSync } from 'node:child_process';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { pdfText, pdftotextLayout, pdftotextRaw } from '../../test/pdf-text';
import {
  buildDispatchData,
  dispatchFileName,
  dispatchPaymentLine,
  superDispatchType,
} from '@/lib/dispatch-data';
import type { BookingForEmail, EmailContext } from '@/lib/email-data';
import { DispatchSheet } from '@/pdf/DispatchSheet';
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
const raw = async (b: BookingForEmail) =>
  pdftotextRaw((await renderDispatchPdf(b, ctx, env)).content) ?? '';
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
        '951 Express Inc',
        'Shipper',
        '2108 Collett Ave Apt 204',
        'Corona, CA 92879',
        'Carrier: 951 Express Inc',
        'USDOT: 4020917',
        'Contact: Jesse Calzada',
        'Email: 951.dispatcher@gmail.com',
        'Dispatch Date: 10/13/2026',
        'Carrier Pickup Estimated: 10/19/2026',
        'Carrier Delivery Estimated: 10/26/2026',
        'Ship Via: OPEN',
        'Condition: Operable',
        'Total Payment to Carrier: $1750.00',
        'Payment method: Cash',
        'Payment terms: COD',
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
        'DEPOSIT PAID: $100.00 (already deducted from the total)',
        "COLLECT AT DELIVERY: $1750.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
        'Total booking price: $1850.00',
        'Customer: Pat Driver, 9515550100, pat@example.com',
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
    'reads in Super Dispatch order (pdftotext -raw): shipper, Order ID, address, then each section, one field per line',
    async () => {
      const lines = (await raw(full)).split('\n').filter(Boolean);
      const head = lines.slice(0, 7);
      expect(head).toEqual([
        '951 Express Inc',
        'Shipper',
        'Order ID: 3F2B6C1E Dispatch Sheet',
        '2108 Collett Ave Apt 204',
        'Corona, CA 92879',
        'Email: 951.dispatcher@gmail.com',
        'Carrier Information',
      ]);
      // Sections come in the sample's order.
      const at = [
        'Carrier Information',
        'Order Information',
        'Vehicle Information Total Vehicles: 1',
        '# Vehicle Type Color VIN Lot #',
        'Pickup Information',
        'Delivery Information',
        'DISPATCH INSTRUCTIONS',
      ].map((t) => lines.indexOf(t));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      // The carrier block, with two address lines and no empty "Phone:".
      const c = lines.indexOf('Carrier Information');
      expect(lines.slice(c, c + 7)).toEqual([
        'Carrier Information',
        'Carrier: 951 Express Inc',
        'USDOT: 4020917',
        '2108 Collett Ave Apt 204',
        'Corona, CA 92879',
        'Contact: Jesse Calzada',
        'Email: 951.dispatcher@gmail.com',
      ]);
      // The vehicle row is read as one line, not column by column.
      expect(lines).toContain('1 2021 Chevrolet Tahoe SUV Midnight blue 1GNSKCKD5MR123456');
      // Pickup, then delivery, each its own block with its own heading, each field on its own line.
      const p = lines.indexOf('Pickup Information');
      expect(lines.slice(p, p + 6)).toEqual([
        'Pickup Information',
        'Name: Lee Neighbor',
        '1 Main St',
        'Corona, CA 92882',
        'Phone: 9515550111',
        'Mobile: 9515550111',
      ]);
      const dv = lines.indexOf('Delivery Information');
      expect(lines.slice(dv, dv + 6)).toEqual([
        'Delivery Information',
        'Name: Sam Receiver',
        '9 Pier Rd, Unit 2',
        'Parrs Ridge, MD 21771',
        'Phone: 3015550122',
        'Mobile: 3015550122',
      ]);
      // No concatenated fields, no empty fields, no customer details outside the instructions.
      for (const l of lines) {
        expect(l, l).not.toMatch(/\w:\s?\S.*\b(Email|Phone|Carrier|USDOT|Name|Mobile):/);
        expect(l, l).not.toMatch(/^(Co\. Phone|Phone|Mobile|Contact|Email):\s*$/);
      }
      expect(lines.join('\n').match(/pat@example\.com/g)).toHaveLength(1);
      expect(lines.join('\n')).not.toMatch(/\(\d{3}\)|\d{3}-\d{3}-\d{4}/);
    },
  );

  it.skipIf(!hasPdftotext)('a numeric order ID takes the same place in the header', async () => {
    const d = { ...buildDispatchData(full, ctx, 'https://951express.com'), ref: '951000123' };
    const text = pdftotextRaw(await renderToBuffer(DispatchSheet({ d })))!;
    expect(text.split('\n').slice(0, 3)).toEqual([
      '951 Express Inc',
      'Shipper',
      'Order ID: 951000123 Dispatch Sheet',
    ]);
  });

  it.skipIf(!hasPdftotext)(
    'collects the balance as the payment, keeps the deposit in the instructions, and comes from the booking',
    async () => {
      const lines = (
        await raw({ ...full, totalCents: 123400, depositCents: 10000, balanceCents: 113400 })
      )
        .split('\n')
        .filter(Boolean);
      const at = lines.indexOf('DISPATCH INSTRUCTIONS');
      expect(lines.slice(at + 1, at + 4)).toEqual([
        'DEPOSIT PAID: $100.00 (already deducted from the total)',
        "COLLECT AT DELIVERY: $1134.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
        'Total booking price: $1234.00',
      ]);
      const o = lines.indexOf('Total Payment to Carrier: $1134.00');
      expect(lines.slice(o, o + 4)).toEqual([
        'Total Payment to Carrier: $1134.00',
        'Payment method: Cash',
        'Payment terms: COD',
        'Carrier owes Shipper: $ 0.00',
      ]);
      const all = lines.join('\n');
      expect(all).not.toContain('Deposit Paid:');
      expect(all).not.toContain('COD Amount');
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

  it('still fits one page when every optional field is empty, and leaves empty fields out', async () => {
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
      expect(lt).not.toMatch(/(^|\s)(Co\. Phone|Phone|Mobile):\s*$/m);
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
  it('builds each field as one "Label: value" string and leaves empty fields out', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.carrier).toEqual([
      'Carrier: 951 Express Inc',
      'USDOT: 4020917',
      '2108 Collett Ave Apt 204',
      'Corona, CA 92879',
      'Contact: Jesse Calzada',
      'Email: 951.dispatcher@gmail.com',
    ]);
    expect(d.order).toContain('Ship Via: OPEN');
    expect(d.order).toContain('Carrier owes Shipper: $ 0.00');
    // Total Payment to Carrier is the balance Super Dispatch collects, not the booking total.
    expect(d.order).toContain('Total Payment to Carrier: $1600.00');
    expect(d.order).toContain('Payment method: Cash');
    expect(d.order).toContain('Payment terms: COD');
    expect(d.order.join('\n')).not.toMatch(/Deposit|COD Amount/);
    expect(d.shipper).toEqual({
      name: '951 Express Inc',
      role: 'Shipper',
      lines: ['2108 Collett Ave Apt 204', 'Corona, CA 92879', 'Email: 951.dispatcher@gmail.com'],
    });
    expect(d.instructions.slice(0, 3)).toEqual([
      'DEPOSIT PAID: $100.00 (already deducted from the total)',
      "COLLECT AT DELIVERY: $1600.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
      'Total booking price: $1700.00',
    ]);
  });
  it('omits a phone line when there is no phone digits', () => {
    const d = buildDispatchData(
      { ...base, customer: { ...base.customer, phone: '' } },
      ctx,
      'https://x.test',
    );
    expect(d.pickup.join('\n')).not.toMatch(/Phone|Mobile/);
    expect(d.delivery.join('\n')).not.toMatch(/Phone|Mobile/);
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
