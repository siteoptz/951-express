import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { CustomerConfirmationEmail } from '@/emails/CustomerConfirmationEmail';
import { NewBookingEmail } from '@/emails/NewBookingEmail';
import { NewLeadEmail } from '@/emails/NewLeadEmail';
import { QuoteReceivedEmail } from '@/emails/QuoteReceivedEmail';
import { customerText, leadText, quoteReceivedText, teamText } from '@/emails/text';
import {
  buildBookingEmailData,
  buildLeadEmailData,
  buildQuoteReceivedData,
  leadSubject,
  quoteReceivedSubject,
  type BookingForEmail,
} from '@/lib/email-data';
import { company } from '@/config/company';
import { normalizeVehicle } from '@/lib/vehicle-normalize';

// Fixed data, so the snapshots only change when the emails do.
const addr = { street: '1 Main St', city: 'Corona', state: 'CA', zip: '92881' };
const booking: BookingForEmail = {
  id: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b',
  vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
  customer: {
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: addr,
  },
  pickupAddress: { ...addr, zip: '92882' },
  deliveryAddress: {
    street: '9 Pier Rd',
    street2: 'Unit 2',
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
  },
  pickupZip: '92881',
  deliveryZip: '21201',
  weekStart: '2026-10-19',
  sizeClass: 'small-suv',
  sizeClassSource: 'table',
  operable: true,
  modified: false,
  topDeck: false,
  personalItems: true,
  totalCents: 150000,
  depositCents: 37500,
  balanceCents: 112500,
  needsReview: false,
  termsVersion: '0.0-placeholder',
  termsAcceptedAt: new Date('2026-10-10T20:05:00Z'),
  paidAt: new Date('2026-10-10T20:09:30Z'),
  stripePaymentIntent: 'pi_123',
  notes: 'Gate code 1234',
};
const ctx = {
  routeName: 'West → East',
  sizeClassLabel: 'Small SUV',
  spot: { n: 3, of: 12 },
  stripeTestMode: true,
};
const text = (el: React.ReactElement) => render(el, { plainText: true });
const html = (el: React.ReactElement) => render(el);

describe('NewBookingEmail', () => {
  const d = buildBookingEmailData(booking, ctx);
  it('lists customer, shipment, and payment (snapshot)', async () => {
    expect(teamText(d)).toMatchSnapshot();
  });
  it('shows the details the team needs, in Pacific time', async () => {
    const out = await text(<NewBookingEmail d={d} />);
    for (const s of [
      '2021 Toyota RAV4',
      'West → East',
      'Oct 19 – 25 (spot 3 of 12)',
      'Small SUV',
      'from our size table',
      '$1,500',
      '$375',
      '$1,125',
      'Oct 10, 2026, 1:05 PM PDT',
      'Version 0.0-placeholder',
      'Gate code 1234',
      '(quoted for ZIP 92881)',
    ]) {
      expect(out).toContain(s);
    }
    expect(out).not.toMatch(/Review needed/);
    expect(out).not.toMatch(/TOP DECK/);
  });
  it('shows what the customer typed next to the normalized vehicle', async () => {
    const typed = buildBookingEmailData(
      { ...booking, vehicleTyped: { year: '2021', make: 'toyota', model: 'rav 4' } },
      ctx,
    );
    const out = await text(<NewBookingEmail d={typed} />);
    expect(out).toContain('As typed by the customer');
    expect(out).toContain('2021 toyota rav 4');
    expect(teamText(typed)).toContain('As typed by the customer: 2021 toyota rav 4');
    expect(teamText(buildBookingEmailData(booking, ctx))).not.toContain('As typed');
  });
  it('shows an address review block only when the customer confirmed a mismatch', async () => {
    const flag =
      'Delivery address: city "Parrs Ridge" does not match ZIP 21771 (Mount Airy, MD). The customer confirmed it is correct.';
    const flagged = buildBookingEmailData(
      { ...booking, needsReview: true, reviewReason: 'city/ZIP mismatch', addressFlags: [flag] },
      ctx,
    );
    const out = await text(<NewBookingEmail d={flagged} />);
    expect(out).toContain('Address review');
    expect(out).toContain('does not match ZIP 21771');
    expect(out).toContain('city/ZIP mismatch');
    expect(teamText(flagged)).toContain('ADDRESS REVIEW');
    expect(teamText(flagged)).toContain(`- ${flag}`);
    const clean = await text(<NewBookingEmail d={buildBookingEmailData(booking, ctx)} />);
    expect(clean).not.toContain('Address review');
    expect(teamText(buildBookingEmailData(booking, ctx))).not.toContain('ADDRESS REVIEW');
  });
  it('tells the team how the balance is collected', async () => {
    const out = await text(<NewBookingEmail d={d} />);
    expect(out).toContain("Cash, Cashier's Check, Zelle only. No credit cards.");
    expect(teamText(d)).toContain(
      "Balance payment: Cash, Cashier's Check, Zelle only. No credit cards.",
    );
  });
  it('the plain-text version carries the same facts', () => {
    const t = teamText(d);
    for (const s of [
      'Pickup week: Oct 19 – 25 (spot 3 of 12)',
      'Deposit paid: $375',
      'Balance due at delivery: $1,125',
      'Terms accepted: Version 0.0-placeholder, Oct 10, 2026, 1:05 PM PDT',
    ])
      expect(t).toContain(s);
    expect(t).not.toContain('REVIEW NEEDED');
    const flagged = teamText(
      buildBookingEmailData(
        {
          ...booking,
          topDeck: true,
          sizeClassSource: 'customer',
          needsReview: true,
          customer: { ...booking.customer, address: undefined },
          notes: null,
        },
        ctx,
      ),
    );
    expect(flagged).toMatch(/^REVIEW NEEDED/);
    expect(flagged).toContain('Load type: TOP DECK LOAD');
    expect(flagged).not.toContain('Home address');
  });
  it('flags review and Top Deck Load', async () => {
    const flagged = buildBookingEmailData(
      { ...booking, topDeck: true, sizeClassSource: 'customer', needsReview: true },
      ctx,
    );
    const out = await text(<NewBookingEmail d={flagged} />);
    expect(out).toMatch(/Review needed/);
    expect(out).toContain('chosen by the customer');
    expect(out).toContain('TOP DECK LOAD');
    expect(await html(<NewBookingEmail d={flagged} />)).toContain('#C8343B');
  });
  it('escapes customer-supplied text', async () => {
    const hostile = buildBookingEmailData({ ...booking, notes: '<script>alert(1)</script>' }, ctx);
    const out = await html(<NewBookingEmail d={hostile} />);
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });
});

describe('CustomerConfirmationEmail', () => {
  it('is a receipt with next steps and the 100 lb policy (snapshot)', async () => {
    expect(customerText(buildBookingEmailData(booking, ctx))).toMatchSnapshot();
  });
  it('plain text carries the balance message and the delivery window', () => {
    const t = customerText(buildBookingEmailData(booking, ctx));
    expect(t).toContain(
      "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
    );
    expect(t).toContain('Estimated delivery: 7–10 days after pickup');
  });
  it('includes the Top Deck benefits only when chosen', async () => {
    const without = await text(
      <CustomerConfirmationEmail d={buildBookingEmailData(booking, ctx)} />,
    );
    const withTop = await text(
      <CustomerConfirmationEmail d={buildBookingEmailData({ ...booking, topDeck: true }, ctx)} />,
    );
    expect(without).not.toContain('oil leaks');
    expect(withTop).toContain('Eliminates the possibility of oil leaks from other vehicles');
    expect(withTop).toContain('Protects the vehicle from road debris');
    for (const out of [without, withTop]) {
      expect(out).toContain(
        "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
      );
      expect(out).toContain('Balance due at delivery');
      expect(out).toContain(
        "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
      );
      expect(out).toContain('Estimated delivery');
      expect(out).toContain('7–10 days after pickup');
      expect(out).toContain('951.dispatcher@gmail.com');
      expect(out).not.toMatch(/\(951\) 427/);
    }
  });
});

describe('NewLeadEmail', () => {
  const leadRow = {
    id: booking.id,
    createdAt: new Date('2026-10-10T20:05:00Z'),
    name: 'Lee Large',
    phone: '555-0100',
    email: 'lee@example.com',
    vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
    pickupZip: '90001',
    deliveryZip: '21201',
    operable: false,
    modified: true,
    highValue: false,
    quoteReasons: ['large_vehicle', 'inoperable', 'modified'],
    modificationDetails: '5-inch lift, 35-inch tires',
    topDeck: false,
    preferredWeekStart: '2026-10-26',
    notes: 'Lifted',
  };
  const lead = buildLeadEmailData(leadRow, 'West → East');
  it('shows the cleaned-up vehicle and what the customer typed, for "2022 chevy tahoe"', async () => {
    const typed = { year: '2022', make: 'chevy', model: 'tahoe' };
    const d = buildLeadEmailData(
      {
        ...leadRow,
        vehicle: normalizeVehicle({ year: 2022, make: 'chevy', model: 'tahoe' }),
        vehicleTyped: typed,
      },
      'West → East',
    );
    expect(d.vehicle).toBe('2022 Chevrolet Tahoe');
    expect(d.vehicleTyped).toBe('2022 chevy tahoe');
    const body = leadText(d);
    expect(body).toContain('Vehicle: 2022 Chevrolet Tahoe');
    expect(body).toContain('As typed by the customer: 2022 chevy tahoe');
    expect(leadSubject(d)).toContain('2022 Chevrolet Tahoe');
    expect(leadSubject(d)).not.toMatch(/chevy/i);
  });
  it('asks the team to quote (snapshot)', async () => {
    expect(leadText(lead)).toMatchSnapshot();
  });
  it('puts the reasons and modification details at the top of the body', () => {
    const body = leadText(lead);
    expect(body).toContain('Reasons: large vehicle, inoperable, modified');
    expect(body).toContain('Modifications: 5-inch lift, 35-inch tires');
    expect(body.indexOf('Reasons:')).toBeLessThan(body.indexOf('CONTACT'));
  });
  it('plain text without a preference, notes, or top deck, and with them', () => {
    expect(leadText({ ...lead, preferredWeek: null, notes: null })).toContain(
      'Preferred pickup week: No preference',
    );
    expect(leadText({ ...lead, topDeck: true })).toContain('Load type: Top Deck Load');
    expect(leadText(lead)).toContain('Notes: Lifted');
  });
  it('customer plain text includes Top Deck benefits only when chosen', () => {
    expect(customerText(buildBookingEmailData(booking, ctx))).not.toContain('oil leaks');
    expect(customerText(buildBookingEmailData({ ...booking, topDeck: true }, ctx))).toContain(
      '- Eliminates the possibility of oil leaks from other vehicles',
    );
  });
  it('says there is no preference when none was given', async () => {
    const out = await text(
      <NewLeadEmail d={{ ...lead, preferredWeek: null, notes: null, topDeck: true }} />,
    );
    expect(out).toContain('No preference');
    expect(out).toContain('Top Deck Load');
    expect(out).not.toContain('Lifted');
  });
});

describe('QuoteReceivedEmail (to the customer)', () => {
  const row = {
    id: booking.id,
    createdAt: new Date('2026-10-10T20:05:00Z'),
    name: 'Lee Large',
    phone: '555-0100',
    email: 'lee@example.com',
    vehicle: normalizeVehicle({ year: 2022, make: 'chevy', model: 'tahoe' }),
    vehicleTyped: { year: '2022', make: 'chevy', model: 'tahoe' },
    pickupZip: '90001',
    deliveryZip: '21201',
    operable: true,
    modified: false,
    highValue: false,
    quoteReasons: ['large_vehicle' as const],
    modificationDetails: null,
    topDeck: false,
    preferredWeekStart: '2026-10-26',
    notes: 'private note',
  };
  const places = { pickup: 'Los Angeles, CA 90001', delivery: 'Baltimore, MD 21201' };
  const d = buildQuoteReceivedData(row, 'West → East', places);

  it('has the agreed subject with the cleaned-up vehicle', () => {
    expect(quoteReceivedSubject(d)).toBe('We received your quote request: 2022 Chevrolet Tahoe');
  });
  it('shows the vehicle, ZIPs with cities, week and the reply promise (snapshot)', () => {
    expect(quoteReceivedText(d)).toMatchSnapshot();
  });
  it('says no preference when no week was chosen', () => {
    expect(
      buildQuoteReceivedData({ ...row, preferredWeekStart: null }, 'West → East', places)
        .preferredWeek,
    ).toBe('No preference');
  });
  it('renders the same facts in HTML, with the contact email and no phone, price or typed text', async () => {
    const html = await render(<QuoteReceivedEmail d={d} />);
    const text = quoteReceivedText(d);
    for (const body of [html, text]) {
      expect(body).toContain('2022 Chevrolet Tahoe');
      expect(body).toContain('Los Angeles, CA 90001');
      expect(body).toContain('Baltimore, MD 21201');
      expect(body).toContain('Our dispatcher will reply by email within 1 business day.');
      expect(body).toContain(company.contactEmail);
      expect(body.replace(company.insurance, '')).not.toMatch(/\$\s?\d/); // no price (the footer's cargo limit is not one)
      expect(body).not.toMatch(/\(\d{3}\)|\d{3}-\d{4}/); // no phone number
      expect(body).not.toMatch(/chevy|555-0100|private note/i); // nothing the customer typed or sent is echoed
    }
  });
});
