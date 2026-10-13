// Turns what the customer typed into a clean vehicle. The browser sends the text exactly as typed; the server
// normalizes it here, stores BOTH, and classifies from the normalized values. Nothing here trusts the browser.
import { makeDisplayNames } from '@/config/vehicle-classes';
import { maxVehicleYear, vehicleYears } from '@/config/vehicles';
import { matchedModelName, normalizeMake, squash } from '@/lib/size-class';

/** Exactly what the customer typed in the three fields. */
export type TypedVehicle = { year: string; make: string; model: string };

/** The cleaned-up vehicle used everywhere after quoting (emails, Stripe, the booking record). */
export type CleanVehicle = { year: number; make: string; model: string };

/** Trim and collapse runs of spaces: "  chevy   tahoe " -> "chevy tahoe". */
export const collapseSpaces = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** Capitalize each word of all-lowercase text ("silverado 1500" -> "Silverado 1500"); mixed case is kept as typed. */
export function tidyCase(s: string): string {
  const text = collapseSpaces(s);
  return text === text.toLowerCase()
    ? text.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    : text;
}

/** "chevy" -> "Chevrolet", "vw" -> "Volkswagen", "merc" -> "Mercedes-Benz", "bmw" -> "BMW", unknown -> Title Case. */
export function normalizeMakeName(make: string): string {
  const key = normalizeMake(make);
  if (makeDisplayNames[key]) return makeDisplayNames[key];
  // An alias was used ("chevy"): write the canonical make. Otherwise keep what was typed, tidied.
  return key !== squash(make) ? key.charAt(0).toUpperCase() + key.slice(1) : tidyCase(make);
}

/** The list name when the typed model matches it exactly ignoring spaces and hyphens ("crv" -> "CR-V"), else tidied. */
export function normalizeModelName(make: string, model: string, year: number): string {
  const listed = matchedModelName({ year, make, model });
  return listed && squash(listed) === squash(model) ? listed : tidyCase(model);
}

export function normalizeVehicle(typed: {
  year: number;
  make: string;
  model: string;
}): CleanVehicle {
  return {
    year: typed.year,
    make: normalizeMakeName(typed.make),
    model: normalizeModelName(typed.make, typed.model, typed.year),
  };
}

export const isValidYear = (year: number, now: Date = new Date()): boolean =>
  Number.isInteger(year) && year >= vehicleYears.min && year <= maxVehicleYear(now);

/** A typed year is exactly four digits and in range. */
export function parseYear(text: string, now: Date = new Date()): number | null {
  if (!/^\d{4}$/.test(text.trim())) return null;
  const year = Number(text.trim());
  return isValidYear(year, now) ? year : null;
}

/** The text a human would read for "what they typed": "chevy tahoe" (make and model). */
export const typedMakeModel = (v: { make: string; model: string }): string =>
  collapseSpaces(`${v.make} ${v.model}`);

/** The review reason stored when a vehicle is not in our size table. */
export const notRecognizedReason = (v: { make: string; model: string }): string =>
  `vehicle not recognized: '${typedMakeModel(v)}'`;
