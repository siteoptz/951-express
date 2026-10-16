import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { pdfText, pdftotextLayout, pdftotextRaw } from '../../test/pdf-text';
import {
  buildDispatchData,
  dispatchFileName,
  dispatchPaymentLine,
  superDispatchType,
} from '@/lib/dispatch-data';
import type { BookingForEmail, EmailContext } from '@/lib/email-data';
import { company } from '@/config/company';
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
/** The sheet's grid as rows of cells: each non-empty layout line split where there are two or more spaces. */
const cells = (text: string): string[][] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s{2,}/));
const from = (rows: string[][], first: string, n: number) => {
  const at = rows.findIndex((r) => r[0] === first);
  return rows.slice(at, at + n);
};

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
    'lays out the grid: labels above values, two sub-columns per half',
    async () => {
      const rows = cells(await layout(full));
      expect(rows[0]).toEqual(['Dispatch Sheet', 'Load 3F2B6C1E']);
      expect(rows[1]).toEqual(['Page 1 of 1']);
      expect(from(rows, 'Shipper Info', 7)).toEqual([
        ['Shipper Info', 'Carrier Info'],
        ['Shipper', 'Contact Info', 'Carrier', 'Contact Info'],
        ['951 Express Inc', 'Jesse Calzada', '951 Express Inc', 'Jesse Calzada'],
        [
          '2108 Collett Ave, Apt 204',
          '(951) 407-8198',
          '2108 Collett Ave, Apt 204',
          '(951) 407-8198',
        ],
        ['Corona, CA 92879', 'Corona, CA 92879'],
        ['Special Number', 'Load Contact Info', 'Special Number', 'Driver'],
        // the shipper's special number is empty so it does not repeat the carrier's MC number
        ['--', '(951) 407-8198', 'MC1516594', '--'],
      ]);
      expect(from(rows, 'Origin Info', 8)).toEqual([
        ['Origin Info', 'Destination Info'],
        ['Origin', 'Contact Info', 'Destination', 'Contact Info'],
        ['Lee Neighbor', '--', 'Sam Receiver', '--'],
        ['1 Main St', '(951) 555-0111', '9 Pier Rd, Unit 2', '(301) 555-0122'],
        ['Corona, CA 92882', 'Parrs Ridge, MD 21771'],
        ['Location Type', 'Buyer Reference Number', 'Location Type', 'Buyer Reference Number'],
        ['Residential', '--', 'Residential', '--'],
        ['Dates', 'Load Info'],
      ]);
      expect(from(rows, 'Dates', 9)).toEqual([
        ['Dates', 'Load Info'],
        ['Dispatch Date', 'Load ID'],
        ['10/13/2026', '3F2B6C1E'],
        ['Requested Pick Up', 'Requested Delivery', 'Total Price'],
        ['Estimated', 'Estimated', '$1,750'],
        ['10/19/2026', '10/26/2026', 'Payment Terms'],
        ['Carrier will receive $1,750 via Cash upon delivery.'],
        ['Vehicle Info (1 Total)'],
        ['Vehicle Year/Make/Model', 'VIN', 'Max Weight', 'Max Dimensions', 'Critical Notes'],
      ]);
      expect(from(rows, 'Vehicle Year/Make/Model', 4)).toEqual([
        ['Vehicle Year/Make/Model', 'VIN', 'Max Weight', 'Max Dimensions', 'Critical Notes'],
        ['2021 Chevrolet Tahoe', '1GNSKCKD5MR123456', '--', '--', '--'],
        ['Vehicle Type', 'Color', 'License State/#', 'Lot #'],
        ['SUV', 'Midnight blue', '--', '--'],
      ]);
    },
  );

  it.skipIf(!hasPdftotext)('prints the additional info, in order, one item per line', async () => {
    const rows = cells(await layout(full)).map((r) => r.join('  '));
    const at = rows.indexOf('Additional Info');
    expect(rows.slice(at, at + 15)).toEqual([
      'Additional Info',
      'Load-Specific Terms',
      'DEPOSIT PAID: $100.00 (already deducted from the total)',
      "COLLECT AT DELIVERY: $1750.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
      'Total booking price: $1850.00',
      'Pre-Dispatch Notes from Customer',
      'Gate code 4412 at pickup. Call 30 minutes before arriving. Low clearance on the driveway.',
      'Transport Special Instructions',
      'Customer: Pat Driver, 9515550100, pat@example.com',
      'Delivery window: 7–10 days after pickup',
      'Top Deck Load: load on the top deck.',
      "Personal items: Yes. 100 lbs included. Anything over 100 lbs is at the driver's discretion.",
      'Typed by customer: 2021 chevy tahoe',
      'Needs review: city/ZIP mismatch',
      expect.stringContaining('Needs review: Delivery address: city "Parrs Ridge"'),
    ]);
  });

  it.skipIf(!hasPdftotext)(
    'the money comes from the booking: balance as the price, one payment method, deposit first in the terms',
    async () => {
      const b = { ...full, totalCents: 123400, depositCents: 10000, balanceCents: 113400 };
      const rows = cells(await layout(b)).map((r) => r.join('  '));
      expect(rows.some((r) => r.includes('$1,134'))).toBe(true);
      expect(rows).toContain('Carrier will receive $1,134 via Cash upon delivery.');
      const at = rows.indexOf('Load-Specific Terms');
      expect(rows.slice(at + 1, at + 4)).toEqual([
        'DEPOSIT PAID: $100.00 (already deducted from the total)',
        "COLLECT AT DELIVERY: $1134.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
        'Total booking price: $1234.00',
      ]);
      const text = rows.join('\n');
      expect(text).not.toContain('Zelle on delivery'); // the payment terms name one method only
      expect(text).not.toContain("Cashier's Check via");
    },
  );

  it.skipIf(!hasPdftotext)(
    'reads in drawing order (pdftotext -raw): each label before its value, nothing glued together',
    async () => {
      const lines = (await raw(full)).split('\n').filter(Boolean);
      expect(lines.slice(0, 3)).toEqual(['Dispatch Sheet', 'Page 1 of 1', 'Load 3F2B6C1E']);
      expect(lines).toContain('Carrier will receive $1,750 via Cash upon delivery.');
      expect(lines).toContain('MC1516594');
      for (const l of lines) {
        expect(l, l).not.toMatch(/Shipper InfoCarrier Info/);
        if (!l.startsWith('Customer:')) expect(l, l).not.toMatch(/\d{10}/); // phones are formatted
      }
      // no customer details outside the instructions line
      expect(lines.join('\n').match(/pat@example\.com/g)).toHaveLength(1);
    },
  );

  it.skipIf(!hasPdftotext)(
    'uses MM/DD/YYYY dates, readable phones, and no Super Dispatch or Central Dispatch branding',
    async () => {
      const text = await layout(full);
      const body = text.replace(/Terms version \S+/, ''); // the footer's version is a label, not a date
      expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(text).toMatch(/\(951\) 555-0111/);
      expect(text.toLowerCase()).not.toContain('super dispatch');
      expect(text.toLowerCase()).not.toContain('central dispatch');
      expect(text.toLowerCase()).not.toContain('powered by');
      expect(text).toContain('https://951express.com/terms');
      expect(text).toContain('Terms version 2026-10-13.3');
      expect(text).not.toContain('vercel.app');
    },
  );

  it('still fits one page when every optional field is empty, and prints "--" for missing values', async () => {
    const pdf = await renderDispatchPdf(base, ctx, env);
    const { pages, text } = await pdfText(pdf.content);
    expect(pages).toBe(1);
    expect(text).not.toContain('NEEDS REVIEW');
    expect(text).not.toContain('Needs review');
    expect(text).not.toContain('Top Deck');
    expect(text).not.toContain('Typed by customer'); // 2021 Chevrolet Tahoe typed as such
    if (hasPdftotext) {
      const rows = cells(await layout(base));
      expect(from(rows, 'Vehicle Type', 2)[1]).toEqual(['SUV', '--', '--', '--']); // no color
      expect(from(rows, 'Vehicle Year/Make/Model', 2)[1]).toEqual([
        '2021 Chevrolet Tahoe',
        '--',
        '--',
        '--',
        '--',
      ]); // no VIN
      expect(hasLine(await layout(base), 'Lee Neighbor')).toBe(false); // no contacts: the customer
      expect(hasLine(await layout(base), 'Pat Driver')).toBe(true);
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
  it('shipper and carrier are 951 Express; the shipper special number is empty, the carrier has the MC number', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.shipper).toEqual({
      lines: ['951 Express Inc', '2108 Collett Ave, Apt 204', 'Corona, CA 92879'],
      contact: ['Jesse Calzada', '(951) 407-8198'],
      loadContact: '(951) 407-8198',
      special: '--',
    });
    expect(d.carrier).toEqual({
      lines: ['951 Express Inc', '2108 Collett Ave, Apt 204', 'Corona, CA 92879'],
      contact: ['Jesse Calzada', '(951) 407-8198'],
      special: 'MC1516594',
    });
    expect(d.carrier.special).toBe(company.mc.replace('-', '')); // from config
  });
  it('price is the balance, payment terms name one method, and the terms start with the money', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.totalPrice).toBe('$1,600');
    expect(d.paymentTerms).toBe('Carrier will receive $1,600 via Cash upon delivery.');
    expect(d.terms).toEqual([
      'DEPOSIT PAID: $100.00 (already deducted from the total)',
      "COLLECT AT DELIVERY: $1600.00 — Cash, Cashier's Check, or Zelle only. No credit cards.",
      'Total booking price: $1700.00',
    ]);
    expect(buildDispatchData({ ...base, balanceCents: 175050 }, ctx, 'x').totalPrice).toBe(
      '$1,750.50',
    );
  });
  it('pickup and delivery use the contact, otherwise the customer, with formatted phones', () => {
    const d = buildDispatchData(full, ctx, 'https://x.test');
    expect(d.origin).toEqual({
      name: 'Lee Neighbor',
      street: '1 Main St',
      city: 'Corona, CA 92882',
      phone: '(951) 555-0111',
    });
    expect(d.destination.phone).toBe('(301) 555-0122');
    const c = buildDispatchData(base, ctx, 'https://x.test');
    expect(c.origin.name).toBe('Pat Driver');
    expect(c.origin.phone).toBe('(951) 555-0100');
    expect(c.locationType).toBe('Residential');
    // a phone that is not 10 digits is printed as digits, and no phone at all as "--"
    expect(
      buildDispatchData(
        { ...base, customer: { ...base.customer, phone: '+44 20 7946 0958' } },
        ctx,
        'x',
      ).origin.phone,
    ).toBe('442079460958');
    expect(
      buildDispatchData({ ...base, customer: { ...base.customer, phone: '' } }, ctx, 'x').origin
        .phone,
    ).toBe('--');
  });
  it('dates: dispatch date is the booking date, pickup the first day of the week, delivery that + 7', () => {
    const d = buildDispatchData(base, ctx, 'https://x.test');
    expect(d.dispatchDate).toBe('10/13/2026');
    expect(d.pickupDate).toBe('10/19/2026');
    expect(d.deliveryDate).toBe('10/26/2026');
    // across a month and a year
    expect(buildDispatchData({ ...base, weekStart: '2026-12-28' }, ctx, 'x').deliveryDate).toBe(
      '01/04/2027',
    );
  });
  it('maps size classes to Car, SUV, Pickup or Van', () => {
    expect(superDispatchType('small-sedan')).toBe('Car');
    expect(superDispatchType('large-sedan')).toBe('Car');
    expect(superDispatchType('midsize-suv')).toBe('SUV');
    expect(superDispatchType('small-pickup')).toBe('Pickup');
    expect(superDispatchType('minivan')).toBe('Van');
  });
  it('puts an inoperable vehicle, a top deck booking and the delivery window in the instructions', () => {
    const d = buildDispatchData({ ...full, operable: false }, ctx, 'https://x.test');
    expect(d.special).toContain('Vehicle is NOT operable.');
    expect(d.special).toContain('Top Deck Load: load on the top deck.');
    expect(d.special).toContain('Delivery window: 7–10 days after pickup');
    expect(buildDispatchData({ ...base, modified: true }, ctx, 'x').special).toContain(
      'Vehicle has been modified.',
    );
    expect(buildDispatchData(base, ctx, 'x').special).toContain('Personal items: None declared.');
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
