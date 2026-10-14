// Turns what the customer typed into a clean vehicle. The browser sends the text exactly as typed; the server
// normalizes it here, stores BOTH, and classifies from the normalized values. Nothing here trusts the browser.
import { exoticMakes } from '@/config/eligibility';
import { allMakes } from '@/config/makes';
import { makeDisplayNames } from '@/config/vehicle-classes';
import { maxVehicleYear, vehicleYears } from '@/config/vehicles';
import { matchedModelName, normalizeMake, squash } from '@/lib/size-class';

/** Exactly what the customer typed in the three fields. */
export type TypedVehicle = { year: string; make: string; model: string };

/** The cleaned-up vehicle used everywhere after quoting (emails, Stripe, the booking record). */
export type CleanVehicle = { year: number; make: string; model: string };

/** Trim and collapse runs of spaces: "  chevy   tahoe " -> "chevy tahoe". */
export const collapseSpaces = (s: string): string => s.trim().replace(/\s+/g, ' ');

/**
 * Capitalize each word of all-lowercase text ("silverado 1500" -> "Silverado 1500"). ALL-CAPS text keeps short
 * words ("GTI", "XLT") and softens long ones ("SILVERADO" -> "Silverado"). Mixed case is kept as typed.
 */
export function tidyCase(s: string): string {
  const text = collapseSpaces(s);
  if (text === text.toLowerCase())
    return text.replace(
      /(^|[\s-])([a-z])/g,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
  if (text === text.toUpperCase())
    return text.replace(/[A-Z]{5,}/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  return text;
}

/** Make key ("rollsroyce") -> the name we write ("Rolls-Royce"): the display names, then the U.S.-market and exotic lists. */
export const knownMakeNames: Record<string, string> = Object.fromEntries(
  [...allMakes, ...exoticMakes].map((name) => [squash(name), name]),
);

/** "chevy" -> "Chevrolet", "vw" -> "Volkswagen", "merc" -> "Mercedes-Benz", "bmw" -> "BMW", unknown -> Title Case. */
export function normalizeMakeName(make: string): string {
  const key = normalizeMake(make);
  const known = makeDisplayNames[key] ?? knownMakeNames[key];
  if (known) return known;
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
