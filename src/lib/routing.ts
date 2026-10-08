// Pure routing logic. It never imports the ZIP lists, so it is safe in client code; the lists are
// supplied through `regionOf` (see routing.server.ts).
import { regionLabels, routes, routingCopy, type Region, type RouteConfig } from '@/config/routes';
import { normalizeZip } from '@/lib/zip';

export type RegionLookup = (zip: string) => Region | null;

export type RouteFailure =
  | { ok: false; reason: 'invalid_zip' }
  | { ok: false; reason: 'pickup_not_served' | 'delivery_not_served'; zip: string }
  | { ok: false; reason: 'same_region'; region: Region };

export type RouteResult =
  | { ok: true; route: RouteConfig; pickupRegion: Region; deliveryRegion: Region }
  | RouteFailure;

export type PickupResult =
  | { ok: true; pickupRegion: Region; deliveryRegion: Region; route: RouteConfig }
  | { ok: false; reason: 'invalid_zip' }
  | { ok: false; reason: 'pickup_not_served'; zip: string };

const opposite = (r: Region): Region => (r === 'west' ? 'east' : 'west');

function routeFor(pickupRegion: Region): RouteConfig {
  const route = routes.find((r) => r.pickupRegion === pickupRegion);
  if (!route) throw new Error(`No route configured for pickup region ${pickupRegion}`);
  return route;
}

/** Once the pickup ZIP resolves, the delivery ZIP may only come from the opposite region. */
export function resolvePickup(regionOf: RegionLookup, pickupZip: unknown): PickupResult {
  const zip = normalizeZip(pickupZip);
  if (!zip) return { ok: false, reason: 'invalid_zip' };
  const pickupRegion = regionOf(zip);
  if (!pickupRegion) return { ok: false, reason: 'pickup_not_served', zip };
  return { ok: true, pickupRegion, deliveryRegion: opposite(pickupRegion), route: routeFor(pickupRegion) };
}

export function resolveRoute(regionOf: RegionLookup, pickupZip: unknown, deliveryZip: unknown): RouteResult {
  const delivery = normalizeZip(deliveryZip);
  const pickup = resolvePickup(regionOf, pickupZip);
  if (!pickup.ok) return pickup;
  if (!delivery) return { ok: false, reason: 'invalid_zip' };
  const deliveryRegion = regionOf(delivery);
  if (!deliveryRegion) return { ok: false, reason: 'delivery_not_served', zip: delivery };
  if (deliveryRegion === pickup.pickupRegion) return { ok: false, reason: 'same_region', region: deliveryRegion };
  return { ok: true, route: pickup.route, pickupRegion: pickup.pickupRegion, deliveryRegion };
}

/** "Shipping West → East" */
export function shippingLabel(pickupRegion: Region): string {
  return routingCopy.shipping
    .replace('{from}', regionLabels[pickupRegion])
    .replace('{to}', regionLabels[opposite(pickupRegion)]);
}

/** Customer-facing message for a failed result. A not-served message is followed by the call button in the UI. */
export function routeErrorMessage(failure: RouteFailure): string {
  switch (failure.reason) {
    case 'invalid_zip':
      return routingCopy.invalidZip;
    case 'same_region':
      return routingCopy.sameRegion.replace('{region}', regionLabels[failure.region]);
    default:
      return routingCopy.notServed.replace('{zip}', failure.zip);
  }
}
