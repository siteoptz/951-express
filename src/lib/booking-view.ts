// What the browser may know about a booking, from its unguessable token. No payment ids, no other customers' data.
import type { Region } from '@/config/routes';
import type { Address, Customer, Vehicle } from '@/db/schema';
import { bookingRef } from '@/lib/format';
import { weekLabel } from '@/lib/weeks';
import { topDeck } from '@/config/pricing';

export type BookingViewInput = {
  id: string;
  status: 'held' | 'paid' | 'completed' | 'cancelled' | 'expired';
  vehicle: Vehicle;
  weekStart: string;
  pickupZip: string;
  deliveryZip: string;
  pickupRegion: Region;
  deliveryRegion: Region;
  topDeck: boolean;
  personalItems: boolean;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  payerEmail: string | null;
  customer: Customer | null;
  pickupAddress: Address | null;
  deliveryAddress: Address | null;
};

export type BookingView = ReturnType<typeof buildBookingView>;

const place = (a: Address | null, zip: string) => (a ? `${a.city}, ${a.state}` : zip);

export function buildBookingView(b: BookingViewInput, routeName: string) {
  return {
    ref: bookingRef(b.id),
    status: b.status,
    vehicle: `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`,
    routeName,
    weekLabel: weekLabel(b.weekStart),
    pickupZip: b.pickupZip,
    deliveryZip: b.deliveryZip,
    pickupRegion: b.pickupRegion,
    deliveryRegion: b.deliveryRegion,
    pickupPlace: place(b.pickupAddress, b.pickupZip),
    deliveryPlace: place(b.deliveryAddress, b.deliveryZip),
    loadType: b.topDeck ? topDeck.label : topDeck.standardLabel,
    personalItems: b.personalItems,
    totalCents: b.totalCents,
    depositCents: b.depositCents,
    balanceCents: b.balanceCents,
    payerEmail: b.payerEmail,
    firstName: b.customer?.firstName ?? null,
    email: b.customer?.email ?? b.payerEmail,
  };
}
