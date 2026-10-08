// Regions are defined only by the two client ZIP lists (src/data/zips/{west,east}.json, server-side only).
// A shipment must cross from one region to the other; same-region moves are rejected.
export type Region = 'west' | 'east';

export const regionLabels: Record<Region, string> = { west: 'West', east: 'East' };

export type RouteConfig = {
  id: 'west-to-east' | 'east-to-west';
  name: string;
  pickupRegion: Region;
  deliveryRegion: Region;
  weeklyCapacity: number;
};

// Each direction is its own route with its own capacity. TODO(client): confirm capacity.
export const routes: readonly RouteConfig[] = [
  { id: 'west-to-east', name: 'West → East', pickupRegion: 'west', deliveryRegion: 'east', weeklyCapacity: 12 },
  { id: 'east-to-west', name: 'East → West', pickupRegion: 'east', deliveryRegion: 'west', weeklyCapacity: 12 },
];

export const routingCopy = {
  sameRegion: 'We haul between the West and the East. Both of these ZIP codes are in our {region} region.',
  notServed: "We don't currently pick up or deliver in {zip}.",
  invalidZip: 'Enter a valid 5-digit ZIP code.',
  shipping: 'Shipping {from} → {to}',
} as const;
