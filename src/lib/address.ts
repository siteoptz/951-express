// City and state checks for an address, shared by the browser (to show the state and suggest a city) and the server
// (which decides). The state always comes from the ZIP, never from what the customer types.
import { stateNames } from '@/config/us-states';

const WORDS: Record<string, string> = { st: 'saint', ste: 'sainte', mt: 'mount', ft: 'fort' };

/** "Mt. Airy" and "Mount Airy" are the same city: lowercase, drop punctuation, spell out St/Mt/Ft. */
export function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join('');
}

export const sameCity = (a: string, b: string): boolean =>
  normalizeCity(a) !== '' && normalizeCity(a) === normalizeCity(b);

export const stateName = (code: string | null | undefined): string | null =>
  code ? (stateNames[code.toUpperCase()] ?? null) : null;

/** "Mount Airy, MD" */
export const placeLabel = (place: { city: string | null; state: string }): string =>
  place.city ? `${place.city}, ${place.state}` : place.state;

/** The message shown (and stored on the review flag) when the city does not match the ZIP. */
export const cityMismatchMessage = (
  zip: string,
  place: { city: string | null; state: string },
): string =>
  `That city doesn't match ZIP ${zip} (${placeLabel(place)}). Please check your address.`;
