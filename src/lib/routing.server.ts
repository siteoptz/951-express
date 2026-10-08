// Server-only: this module pulls in the full ZIP lists, which must never reach the browser bundle.
import 'server-only';
import west from '@/data/zips/west.json';
import east from '@/data/zips/east.json';
import type { Region } from '@/config/routes';
import { resolvePickup, resolveRoute, type RouteResult, type PickupResult } from '@/lib/routing';

const westSet = new Set<string>(west);
const eastSet = new Set<string>(east);

export function regionOfZip(zip: string): Region | null {
  if (westSet.has(zip)) return 'west';
  if (eastSet.has(zip)) return 'east';
  return null;
}

export const resolveRouteForZips = (pickupZip: unknown, deliveryZip: unknown): RouteResult =>
  resolveRoute(regionOfZip, pickupZip, deliveryZip);

export const resolvePickupZip = (pickupZip: unknown): PickupResult => resolvePickup(regionOfZip, pickupZip);
