// NHTSA vPIC settings. The API is free and needs no key. Endpoints verified against the live API.
export const vpic = {
  baseUrl: 'https://vpic.nhtsa.dot.gov/api/vehicles',
  // SUVs and minivans are filed under "mpv", not "car" or "truck", so all three types are merged.
  vehicleTypes: ['car', 'truck', 'mpv'],
  revalidateSeconds: 86400,
  timeoutMs: 8000,
} as const;

export const vehicleYears = { min: 1980, maxAheadOfToday: 1 } as const; // TODO(client)

// vPIC returns makes in ALL CAPS. These stay capitalized as acronyms; everything else is title-cased.
export const makeAcronyms = ['BMW', 'GMC', 'MG', 'AMC', 'FIAT', 'KTM', 'MV', 'DS'] as const;
