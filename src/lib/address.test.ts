import { describe, expect, it } from 'vitest';
import { cityMismatchMessage, normalizeCity, placeLabel, sameCity, stateName } from '@/lib/address';
import { zipPlace } from '@/lib/address.server';
import { stateNames } from '@/config/us-states';

describe('city matching', () => {
  it.each([
    ['Mount Airy', 'Mount Airy'],
    ['mount airy', 'MOUNT AIRY'],
    ['Mt. Airy', 'Mount Airy'],
    ['Mt Airy', 'Mount Airy'],
    ['St. Louis', 'Saint Louis'],
    ['St Louis', 'saint louis'],
    ['Ft. Worth', 'Fort Worth'],
    ['  Los   Angeles ', 'Los Angeles'],
    ['Winston-Salem', 'Winston Salem'],
    ["Coeur d'Alene", 'Coeur dAlene'],
  ])('%s = %s', (a, b) => expect(sameCity(a, b)).toBe(true));

  it.each([
    ['Los Angeles', 'Mount Airy'],
    ['Baltimore', 'Mount Airy'],
    ['Springfield', 'Corona'],
    ['', 'Corona'],
    ['   ', ''],
  ])('%s is not %s', (a, b) => expect(sameCity(a, b)).toBe(false));

  it('normalizes to letters only', () => {
    expect(normalizeCity('Mt. Airy, MD')).toBe('mountairymd');
  });
});

describe('state names and messages', () => {
  it('names the states, including DC, and nothing for an unknown code', () => {
    expect(stateName('MD')).toBe('Maryland');
    expect(stateName('md')).toBe('Maryland');
    expect(stateName('DC')).toBe('District of Columbia');
    expect(stateName('ZZ')).toBeNull();
    expect(stateName(null)).toBeNull();
    expect(Object.keys(stateNames)).toHaveLength(52);
  });
  it('writes the agreed mismatch message', () => {
    expect(cityMismatchMessage('21771', { city: 'Mount Airy', state: 'MD' })).toBe(
      "That city doesn't match ZIP 21771 (Mount Airy, MD). Please check your address.",
    );
    expect(placeLabel({ city: null, state: 'GA' })).toBe('GA');
  });
});

describe('zipPlace', () => {
  it('knows the city and state of a listed ZIP', () => {
    expect(zipPlace('21771')).toEqual({ city: 'Mount Airy', state: 'MD', approximate: false });
    expect(zipPlace('90001')).toMatchObject({ city: 'Los Angeles', state: 'CA' });
    expect(zipPlace('92881')).toMatchObject({ city: 'Corona', state: 'CA' });
    expect(zipPlace('30303')).toMatchObject({ city: 'Atlanta', state: 'GA' });
  });
  it('still gives the state for a real ZIP the address data does not list (from its first three digits)', () => {
    const p = zipPlace('30020'); // inside the Atlanta range, but not in the package
    expect(p).toMatchObject({ state: 'GA', approximate: true });
    expect(p?.city).toBeNull();
  });
  it('knows nothing about a ZIP with no neighbors', () => {
    expect(zipPlace('00000')).toBeNull();
    expect(zipPlace('abcde')).toBeNull();
    expect(zipPlace('123')).toBeNull();
  });
});
