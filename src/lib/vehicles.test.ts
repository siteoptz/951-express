import { describe, expect, it } from 'vitest';
import {
  fetchMakes,
  fetchModels,
  formatMake,
  isValidYear,
  makesUrl,
  mergeNames,
  modelsUrl,
  VpicError,
} from '@/lib/vehicles';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const makes = (...n: string[]) => ({ Results: n.map((MakeName) => ({ MakeName })) });
const models = (...n: string[]) => ({ Results: n.map((Model_Name) => ({ Model_Name })) });

describe('urls', () => {
  it('match the live vPIC endpoints', () => {
    expect(makesUrl('mpv')).toBe(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/mpv?format=json',
    );
    expect(modelsUrl('land rover', 2020, 'truck')).toBe(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/land%20rover/modelyear/2020/vehicletype/truck?format=json',
    );
  });
});

describe('fetchMakes', () => {
  it('merges car, truck, and mpv makes without duplicates, sorted', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.includes('/car?')) return json(makes('HONDA', 'TESLA'));
      if (url.includes('/truck?')) return json(makes('FORD', 'Tesla', 'HONDA'));
      return json(makes('ford', 'JEEP', ' '));
    };
    expect(await fetchMakes(fetchImpl)).toEqual(['FORD', 'HONDA', 'JEEP', 'TESLA']);
    expect(calls).toHaveLength(3);
  });
  it('asks Next to cache for a day', async () => {
    let init: (RequestInit & { next?: { revalidate: number } }) | undefined;
    await fetchMakes(async (_u, i) => ((init = i), json(makes('A'))));
    expect(init?.next?.revalidate).toBe(86400);
  });
  it('wraps network failures, HTTP errors, and bad bodies in VpicError', async () => {
    await expect(fetchMakes(async () => Promise.reject(new Error('offline')))).rejects.toThrow(
      /offline/,
    );
    await expect(fetchMakes(async () => Promise.reject('boom'))).rejects.toBeInstanceOf(VpicError);
    await expect(fetchMakes(async () => json({}, 503))).rejects.toThrow(/503/);
    await expect(fetchMakes(async () => json({ nope: true }))).rejects.toThrow(/unexpected/);
    await expect(fetchMakes(async () => new Response('not json'))).rejects.toThrow(/unexpected/);
  });
});

describe('fetchModels', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('merges models across vehicle types', async () => {
    const fetchImpl = async (url: string) =>
      json(
        url.includes('/mpv?')
          ? models('CR-V', 'Pilot')
          : url.includes('/car?')
            ? models('Civic', 'Accord')
            : models(),
      );
    expect(await fetchModels(2020, ' Honda ', fetchImpl, now)).toEqual([
      'Accord',
      'Civic',
      'CR-V',
      'Pilot',
    ]);
  });
  it('returns [] when vPIC knows nothing', async () => {
    expect(await fetchModels(2020, 'zzzz', async () => json(models()), now)).toEqual([]);
  });
  it('rejects bad input before calling the API', async () => {
    const never = async () => {
      throw new Error('should not be called');
    };
    await expect(fetchModels(1900, 'Honda', never, now)).rejects.toThrow(/Invalid model year/);
    await expect(fetchModels(2020, '  ', never, now)).rejects.toThrow(/make is required/);
  });
  it('defaults to the real clock', async () => {
    await expect(fetchModels(2020, 'Honda', async () => json(models('Civic')))).resolves.toEqual([
      'Civic',
    ]);
  });
});

describe('helpers', () => {
  it('validates model years, allowing next year', () => {
    expect(isValidYear(2027, new Date('2026-10-08'))).toBe(true);
    expect(isValidYear(2028, new Date('2026-10-08'))).toBe(false);
    expect(isValidYear(1979, new Date('2026-10-08'))).toBe(false);
    expect(isValidYear(2020.5, new Date('2026-10-08'))).toBe(false);
    expect(isValidYear(2020)).toBe(true);
  });
  it('formats makes', () => {
    expect(formatMake('MERCEDES-BENZ')).toBe('Mercedes-Benz');
    expect(formatMake('LAND ROVER')).toBe('Land Rover');
    expect(formatMake('bmw')).toBe('BMW');
    expect(formatMake('GMC')).toBe('GMC');
  });
  it('merges names', () => {
    expect(
      mergeNames([
        ['b', 'A'],
        ['B', ''],
      ]),
    ).toEqual(['A', 'b']);
  });
});
