import 'server-only';
import type { Region } from '@/config/routes';
import { stateName } from '@/lib/address';
import { zipPlace } from '@/lib/address.server';
import { resolvePickupZip } from '@/lib/routing.server';

export type ZipCheck = {
  valid: boolean;
  served: boolean;
  region: Region | null;
  city: string | null;
  state: string | null;
  /** "Maryland": the state's full name, for "Maryland, from your ZIP". */
  stateName: string | null;
  oppositeRegion: Region | null;
};

const empty: ZipCheck = {
  valid: false,
  served: false,
  region: null,
  city: null,
  state: null,
  stateName: null,
  oppositeRegion: null,
};

/** Answers one ZIP without exposing the lists. */
export function checkZip(zip: string): ZipCheck {
  const r = resolvePickupZip(zip);
  if (!r.ok && r.reason === 'invalid_zip') return empty;
  const normalized = (r.ok ? zip : r.zip).slice(0, 5);
  const found = zipPlace(normalized);
  const place = {
    city: found?.city ?? null,
    state: found?.state ?? null,
    stateName: stateName(found?.state),
  };
  if (!r.ok) return { ...empty, valid: true, ...place };
  return {
    valid: true,
    served: true,
    region: r.pickupRegion,
    oppositeRegion: r.deliveryRegion,
    ...place,
  };
}
