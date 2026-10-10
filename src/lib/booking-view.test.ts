import { describe, expect, it } from 'vitest';
import { buildBookingView, type BookingViewInput } from '@/lib/booking-view';

const base: BookingViewInput = {
  id: '3f2b6c1e-8a7d-4f43-9d0a-2b1c5e6f7a8b',
  status: 'paid',
  vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
  weekStart: '2026-10-19',
  pickupZip: '90001',
  deliveryZip: '21201',
  pickupRegion: 'west',
  deliveryRegion: 'east',
  topDeck: false,
  personalItems: true,
  totalCents: 150000,
  depositCents: 37500,
  balanceCents: 112500,
  payerEmail: 'pay@example.com',
  customer: null,
  pickupAddress: null,
  deliveryAddress: null,
};

describe('buildBookingView', () => {
  it('shows the ZIP until addresses are known, and the payer email', () => {
    expect(buildBookingView(base, 'West → East')).toMatchObject({
      ref: '3F2B6C1E',
      vehicle: '2021 Toyota RAV4',
      routeName: 'West → East',
      weekLabel: 'Oct 19 – 25',
      pickupPlace: '90001',
      deliveryPlace: '21201',
      loadType: 'Standard',
      firstName: null,
      email: 'pay@example.com',
    });
  });
  it('shows city and state, the first name, and the customer email once details are in', () => {
    const v = buildBookingView(
      {
        ...base,
        status: 'completed',
        topDeck: true,
        customer: { firstName: 'Pat', lastName: 'D', phone: '1', email: 'pat@example.com' },
        pickupAddress: { street: '1 A', city: 'Corona', state: 'CA', zip: '92881' },
        deliveryAddress: { street: '2 B', city: 'Baltimore', state: 'MD', zip: '21201' },
      },
      'West → East',
    );
    expect(v).toMatchObject({
      pickupPlace: 'Corona, CA',
      deliveryPlace: 'Baltimore, MD',
      firstName: 'Pat',
      email: 'pat@example.com',
      loadType: 'Top Deck Load',
    });
  });
});
