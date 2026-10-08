// NHTSA vPIC helpers for the year/make/model dropdowns. Server-side use: callers pass no secrets.
import { z } from 'zod';
import { makeAcronyms, vehicleYears, vpic } from '@/config/vehicles';

export class VpicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VpicError';
  }
}

type FetchLike = (
  url: string,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

const makesResponse = z.object({ Results: z.array(z.object({ MakeName: z.string() })) });
const modelsResponse = z.object({ Results: z.array(z.object({ Model_Name: z.string() })) });

async function getJson<T extends z.ZodType>(
  url: string,
  schema: T,
  fetchImpl: FetchLike,
): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      next: { revalidate: vpic.revalidateSeconds },
      signal: AbortSignal.timeout(vpic.timeoutMs),
    });
  } catch (e) {
    throw new VpicError(`vPIC request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new VpicError(`vPIC responded ${res.status}`);
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new VpicError('vPIC returned an unexpected response');
  return parsed.data;
}

/** Merge names case-insensitively (first spelling wins), drop blanks, sort A-Z. */
export function mergeNames(lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const name of lists.flat()) {
    const trimmed = name.trim();
    const key = trimmed.toUpperCase();
    if (trimmed && !seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** "MERCEDES-BENZ" -> "Mercedes-Benz", "BMW" stays "BMW". */
export function formatMake(make: string): string {
  if ((makeAcronyms as readonly string[]).includes(make.toUpperCase())) return make.toUpperCase();
  return make
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function makesUrl(type: string): string {
  return `${vpic.baseUrl}/GetMakesForVehicleType/${type}?format=json`;
}

export function modelsUrl(make: string, year: number, type: string): string {
  return `${vpic.baseUrl}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}/vehicletype/${type}?format=json`;
}

export function isValidYear(year: number, now: Date = new Date()): boolean {
  return (
    Number.isInteger(year) &&
    year >= vehicleYears.min &&
    year <= now.getFullYear() + vehicleYears.maxAheadOfToday
  );
}

/** Makes for cars, trucks, and SUVs/minivans (mpv), merged and de-duplicated. */
export async function fetchMakes(fetchImpl: FetchLike = fetch): Promise<string[]> {
  const lists = await Promise.all(
    vpic.vehicleTypes.map(async (t) =>
      (await getJson(makesUrl(t), makesResponse, fetchImpl)).Results.map((r) => r.MakeName),
    ),
  );
  return mergeNames(lists);
}

/** Models for one make and model year across all vehicle types. An unknown make or year returns []. */
export async function fetchModels(
  year: number,
  make: string,
  fetchImpl: FetchLike = fetch,
  now: Date = new Date(),
): Promise<string[]> {
  if (!isValidYear(year, now)) throw new VpicError(`Invalid model year: ${year}`);
  if (!make.trim()) throw new VpicError('A make is required');
  const lists = await Promise.all(
    vpic.vehicleTypes.map(async (t) =>
      (await getJson(modelsUrl(make.trim(), year, t), modelsResponse, fetchImpl)).Results.map(
        (r) => r.Model_Name,
      ),
    ),
  );
  return mergeNames(lists);
}
