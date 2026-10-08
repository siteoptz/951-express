import 'server-only';
import zipcodes from 'zipcodes';
import type { Region } from '@/config/routes';
import { resolvePickupZip } from '@/lib/routing.server';

export type ZipCheck = {
  valid: boolean;
  served: boolean;
  region: Region | null;
  city: string | null;
  state: string | null;
  oppositeRegion: Region | null;
};

const empty: ZipCheck = {
  valid: false,
  served: false,
  region: null,
  city: null,
  state: null,
  oppositeRegion: null,
};

/** Answers one ZIP without exposing the lists. */
export function checkZip(zip: string): ZipCheck {
  const r = resolvePickupZip(zip);
  if (!r.ok && r.reason === 'invalid_zip') return empty;
  const normalized = (r.ok ? zip : r.zip).slice(0, 5);
  const info = zipcodes.lookup(normalized);
  const place = { city: info?.city ?? null, state: info?.state ?? null };
  if (!r.ok) return { ...empty, valid: true, ...place };
  return {
    valid: true,
    served: true,
    region: r.pickupRegion,
    oppositeRegion: r.deliveryRegion,
    ...place,
  };
}
