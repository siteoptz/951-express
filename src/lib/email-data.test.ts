import { describe, expect, it } from 'vitest';
import {
  buildBookingEmailData,
  buildLeadEmailData,
  customerSubject,
  leadSubject,
  reviewReasons,
  typedVehicleText,
  teamSubject,
  vehicleName,
  type BookingForEmail,
} from '@/lib/email-data';
import { bookingRef, formatAddress, formatPacific, money } from '@/lib/format';

const addr = { street: '1 Main St', city: 'Corona', state: 'CA', zip: '92881' };
const base: BookingForEmail = {
  id: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b',
  vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
  customer: {
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: addr,
  },
  pickupAddress: addr,
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

describe('formatting', () => {
  it('formats money, addresses, references, and Pacific times', () => {
    expect(money(150000)).toBe('$1,500');
    expect(money(38750)).toBe('$387.50');
    expect(formatAddress(base.deliveryAddress)).toBe('9 Pier Rd, Unit 2, Baltimore, MD 21201');
    expect(formatAddress(addr)).toBe('1 Main St, Corona, CA 92881');
    expect(bookingRef(base.id)).toBe('3F2B6C1E');
  });
  it('always shows America/Los_Angeles, in daylight and standard time', () => {
    expect(formatPacific(new Date('2026-10-10T20:05:00Z'))).toBe('Oct 10, 2026, 1:05 PM PDT');
    expect(formatPacific(new Date('2026-12-10T20:05:00Z'))).toBe('Dec 10, 2026, 12:05 PM PST');
    expect(formatPacific(new Date('2026-10-11T03:30:00Z'))).toBe('Oct 10, 2026, 8:30 PM PDT'); // UTC is already the 11th
  });
});

describe('buildBookingEmailData', () => {
  it('builds the record the team needs', () => {
    const d = buildBookingEmailData(base, ctx);
    expect(d).toMatchObject({
      ref: '3F2B6C1E',
      vehicle: '2021 Toyota RAV4',
      routeName: 'West → East',
      week: 'Oct 19 – 25',
      spotText: 'spot 3 of 12',
      loadType: 'Standard',
      sizeClass: 'Small SUV',
      sizeSource: 'from our size table',
      needsReview: false,
      reviewReasons: [],
      termsAcceptedAt: 'Oct 10, 2026, 1:05 PM PDT',
      paidAt: 'Oct 10, 2026, 1:09 PM PDT',
      stripeUrl: 'https://dashboard.stripe.com/test/payments/pi_123',
    });
    expect(d.customer).toEqual({
      name: 'Pat Driver',
      phone: '951-555-0100',
      email: 'pat@example.com',
      address: '1 Main St, Corona, CA 92881',
    });
    expect(d.pickup.changedFrom).toBeNull();
  });
  it('flags a changed ZIP, a Top Deck Load, a customer-chosen class, and live-mode links', () => {
    const d = buildBookingEmailData(
      {
        ...base,
        topDeck: true,
        sizeClassSource: 'customer',
        needsReview: true,
        pickupAddress: { ...addr, zip: '92882' },
        customer: { ...base.customer, address: undefined },
        stripePaymentIntent: null,
      },
      { ...ctx, stripeTestMode: false },
    );
    expect(d).toMatchObject({
      loadType: 'Top Deck Load',
      topDeck: true,
      sizeSource: 'chosen by the customer; not in our size table',
      stripeUrl: null,
      paymentIntent: null,
    });
    expect(d.pickup.changedFrom).toBe('92881');
    expect(d.customer.address).toBeNull();
    expect(
      buildBookingEmailData(
        { ...base, stripePaymentIntent: 'pi_9' },
        { ...ctx, stripeTestMode: false },
      ).stripeUrl,
    ).toBe('https://dashboard.stripe.com/payments/pi_9');
    expect(buildBookingEmailData({ ...base, paidAt: null }, ctx).paidAt).toBeNull();
  });
});

describe('typed vehicle and review reason', () => {
  it('reads back the typed text next to the normalized vehicle', () => {
    expect(typedVehicleText({ year: '2021', make: 'chevy', model: 'tahoe' })).toBe(
      '2021 chevy tahoe',
    );
    expect(typedVehicleText(null)).toBeNull();
    const d = buildBookingEmailData(
      { ...base, vehicleTyped: { year: '2021', make: 'toyota', model: 'rav 4' } },
      ctx,
    );
    expect(d.vehicle).toBe('2021 Toyota RAV4');
    expect(d.vehicleTyped).toBe('2021 toyota rav 4');
    expect(buildBookingEmailData(base, ctx).vehicleTyped).toBeNull();
  });
  it('lists the not-recognized reason first', () => {
    const r = reviewReasons({
      needsReview: true,
      sizeClassSource: 'customer',
      reviewReason: "vehicle not recognized: 'zzz thing'",
    });
    expect(r[0]).toBe("vehicle not recognized: 'zzz thing'");
    expect(r[1]).toMatch(/chosen by the customer/);
  });
});

describe('reviewReasons', () => {
  it('is empty when nothing needs review', () => {
    expect(reviewReasons({ needsReview: false, sizeClassSource: 'customer' })).toEqual([]);
  });
  it('explains why in plain words', () => {
    expect(reviewReasons({ needsReview: true, sizeClassSource: 'customer' })[0]).toMatch(
      /chosen by the customer/,
    );
    expect(reviewReasons({ needsReview: true, sizeClassSource: 'table' })[0]).toMatch(
      /flagged for review/,
    );
  });
});

describe('subjects', () => {
  it('match the agreed wording', () => {
    const d = buildBookingEmailData(base, ctx);
    expect(teamSubject(d)).toBe(
      'New Booking: 2021 Toyota RAV4 · West → East · Week of Oct 19 · Deposit Paid',
    );
    expect(customerSubject(d)).toBe('Your 951 Express booking is confirmed · Week of Oct 19');
    expect(vehicleName(base.vehicle)).toBe('2021 Toyota RAV4');
  });
  it('builds the lead email data and subject', () => {
    const l = buildLeadEmailData(
      {
        id: base.id,
        createdAt: new Date('2026-10-10T20:05:00Z'),
        name: 'Lee Large',
        phone: '555-0100',
        email: 'lee@example.com',
        vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
        pickupZip: '90001',
        deliveryZip: '21201',
        operable: true,
        modified: true,
        highValue: false,
        quoteReasons: ['large_vehicle', 'modified'],
        modificationDetails: '5-inch lift, 35-inch tires',
        topDeck: false,
        preferredWeekStart: '2026-10-26',
        notes: null,
      },
      'West → East',
    );
    expect(l).toMatchObject({
      preferredWeek: 'Oct 26 – Nov 1',
      receivedAt: 'Oct 10, 2026, 1:05 PM PDT',
      ref: '3F2B6C1E',
    });
    expect(leadSubject(l)).toBe(
      'Quote request (large vehicle, modified): 2021 Chevrolet Tahoe · West → East',
    );
    expect(
      buildLeadEmailData(
        {
          ...{
            id: base.id,
            createdAt: new Date(),
            name: 'x',
            phone: 'x',
            email: 'x',
            vehicle: base.vehicle,
            pickupZip: '1',
            deliveryZip: '2',
            operable: true,
            modified: true,
            highValue: true,
            quoteReasons: ['exotic', 'high_value'],
            modificationDetails: null,
            topDeck: true,
            notes: 'n',
          },
          preferredWeekStart: null,
        },
        'r',
      ).preferredWeek,
    ).toBeNull();
  });
});
