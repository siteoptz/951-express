import { describe, expect, it } from 'vitest';
import west from '@/data/zips/west.json';
import east from '@/data/zips/east.json';
import {
  resolvePickup,
  resolveRoute,
  routeErrorMessage,
  shippingLabel,
  type RouteFailure,
} from '@/lib/routing';
import { regionOfZip, resolvePickupZip, resolveRouteForZips } from '@/lib/routing.server';

// Los Angeles/Corona (west list) and Baltimore/Raleigh (east list).
const WEST = '90001';
const WEST2 = '92881';
const EAST = '21201';
const EAST2 = '27601';

describe('ZIP data integrity', () => {
  it('holds only unique 5-digit strings, with no overlap between regions', () => {
    for (const list of [west, east]) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.every((z) => /^\d{5}$/.test(z))).toBe(true);
    }
    const eastSet = new Set<string>(east);
    expect(west.filter((z) => eastSet.has(z))).toEqual([]);
  });
  it('keeps leading-zero ZIPs as strings', () => {
    expect([...west, ...east].every((z) => typeof z === 'string' && z.length === 5)).toBe(true);
  });
});

describe('Atlanta metro additions (30001–30400, client request 2026-10-13)', () => {
  const ATLANTA = '30303';
  it('routes every ZIP in the range, recognized or not', () => {
    const eastSet = new Set<string>(east);
    for (let n = 30001; n <= 30400; n++) expect(eastSet.has(String(n))).toBe(true);
  });
  it('resolves downtown Atlanta to East', () => {
    expect(regionOfZip(ATLANTA)).toBe('east');
  });
  it('routes Atlanta → Los Angeles as East → West', () => {
    const r = resolveRouteForZips(ATLANTA, WEST);
    expect(r).toMatchObject({ ok: true, pickupRegion: 'east', deliveryRegion: 'west' });
    expect(r.ok && r.route.id).toBe('east-to-west');
  });
  it('rejects Atlanta → Baltimore as same_region', () => {
    expect(resolveRouteForZips(ATLANTA, EAST)).toEqual({
      ok: false,
      reason: 'same_region',
      region: 'east',
    });
  });
});

describe('Yuma, AZ additions (client request 2026-10-13)', () => {
  const YUMA = ['85336', '85349', '85350', '85364', '85365', '85366', '85367', '85369'];
  it('puts every Yuma-area ZIP in West', () => {
    for (const z of YUMA) expect(regionOfZip(z), z).toBe('west');
    expect(east.some((z: string) => YUMA.includes(z))).toBe(false);
  });
  it('resolves 85364 to West for pickup and for delivery', () => {
    expect(resolvePickupZip('85364')).toMatchObject({
      ok: true,
      pickupRegion: 'west',
      deliveryRegion: 'east',
    });
    expect(resolveRouteForZips(EAST2, '85364')).toMatchObject({ ok: true, deliveryRegion: 'west' });
  });
  it('routes Yuma → Atlanta (85364 → 30303) as West → East', () => {
    const r = resolveRouteForZips('85364', '30303');
    expect(r).toMatchObject({ ok: true, pickupRegion: 'west', deliveryRegion: 'east' });
    expect(r.ok && r.route.id).toBe('west-to-east');
  });
  it('rejects Yuma → Corona (85364 → 92879) as same_region', () => {
    expect(resolveRouteForZips('85364', '92879')).toEqual({
      ok: false,
      reason: 'same_region',
      region: 'west',
    });
  });
});

describe('resolveRouteForZips', () => {
  it('routes West → East', () => {
    const r = resolveRouteForZips(WEST, EAST);
    expect(r).toMatchObject({ ok: true, pickupRegion: 'west', deliveryRegion: 'east' });
    expect(r.ok && r.route.id).toBe('west-to-east');
  });
  it('routes East → West', () => {
    const r = resolveRouteForZips(EAST2, WEST2);
    expect(r).toMatchObject({ ok: true, pickupRegion: 'east', deliveryRegion: 'west' });
    expect(r.ok && r.route.id).toBe('east-to-west');
  });
  it('rejects West → West', () => {
    expect(resolveRouteForZips(WEST, WEST2)).toEqual({
      ok: false,
      reason: 'same_region',
      region: 'west',
    });
  });
  it('rejects East → East', () => {
    expect(resolveRouteForZips(EAST, EAST2)).toEqual({
      ok: false,
      reason: 'same_region',
      region: 'east',
    });
  });
  it('rejects unknown ZIPs by side', () => {
    expect(resolveRouteForZips('99999', EAST)).toEqual({
      ok: false,
      reason: 'pickup_not_served',
      zip: '99999',
    });
    expect(resolveRouteForZips(WEST, '99999')).toEqual({
      ok: false,
      reason: 'delivery_not_served',
      zip: '99999',
    });
  });
  it('rejects malformed ZIPs', () => {
    expect(resolveRouteForZips('9288', EAST)).toEqual({ ok: false, reason: 'invalid_zip' });
    expect(resolveRouteForZips(WEST, 'abc')).toEqual({ ok: false, reason: 'invalid_zip' });
    expect(resolveRouteForZips(undefined, undefined)).toEqual({ ok: false, reason: 'invalid_zip' });
  });
  it('treats leading-zero ZIPs as strings: valid format, not served, and a 4-digit form is invalid', () => {
    expect(resolveRouteForZips('02108', EAST)).toEqual({
      ok: false,
      reason: 'pickup_not_served',
      zip: '02108',
    });
    expect(resolveRouteForZips('2108', EAST)).toEqual({ ok: false, reason: 'invalid_zip' });
  });
  it('accepts ZIP+4', () => {
    expect(resolveRouteForZips(`${WEST}-1234`, EAST).ok).toBe(true);
  });
});

describe('resolvePickup', () => {
  it('returns the opposite region for delivery', () => {
    expect(resolvePickupZip(WEST)).toMatchObject({
      ok: true,
      pickupRegion: 'west',
      deliveryRegion: 'east',
    });
    expect(resolvePickupZip(EAST)).toMatchObject({
      ok: true,
      pickupRegion: 'east',
      deliveryRegion: 'west',
    });
  });
  it('fails for invalid and unserved ZIPs', () => {
    expect(resolvePickupZip('x')).toEqual({ ok: false, reason: 'invalid_zip' });
    expect(resolvePickupZip('99999')).toEqual({
      ok: false,
      reason: 'pickup_not_served',
      zip: '99999',
    });
  });
  it('works with an injected lookup', () => {
    expect(resolvePickup(() => 'east', '11111')).toMatchObject({
      ok: true,
      route: { id: 'east-to-west' },
    });
  });
  it('throws if the route table lacks the region', () => {
    expect(() => resolvePickup(() => 'north' as never, '11111')).toThrow(/No route configured/);
  });
});

describe('regionOfZip / injected lookup', () => {
  it('maps list membership', () => {
    expect(regionOfZip(WEST)).toBe('west');
    expect(regionOfZip(EAST)).toBe('east');
    expect(regionOfZip('00000')).toBeNull();
  });
  it('resolveRoute works with any lookup', () => {
    const lookup = (z: string) => (z === '11111' ? 'west' : z === '22222' ? 'east' : null);
    expect(resolveRoute(lookup, '11111', '22222').ok).toBe(true);
  });
});

describe('copy', () => {
  it('labels the direction', () => {
    expect(shippingLabel('west')).toBe('Shipping West → East');
    expect(shippingLabel('east')).toBe('Shipping East → West');
  });
  it('writes the error messages', () => {
    const msg = (f: RouteFailure) => routeErrorMessage(f);
    expect(msg({ ok: false, reason: 'same_region', region: 'west' })).toBe(
      'We haul between the West and the East. Both of these ZIP codes are in our West region.',
    );
    expect(msg({ ok: false, reason: 'same_region', region: 'east' })).toContain('our East region');
    expect(msg({ ok: false, reason: 'pickup_not_served', zip: '99999' })).toBe(
      "We don't currently pick up or deliver in 99999.",
    );
    expect(msg({ ok: false, reason: 'delivery_not_served', zip: '88888' })).toContain('88888');
    expect(msg({ ok: false, reason: 'invalid_zip' })).toBe('Enter a valid 5-digit ZIP code.');
  });
});
