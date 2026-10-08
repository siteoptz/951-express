import {
  classRules,
  makeAliases,
  unknownExceptions,
  yearRules,
  type ModelsByMake,
  type VehicleClass,
} from '@/config/vehicle-classes';
import { sizeClassIds } from '@/config/pricing';

export type VehicleInput = { year: number; make: string; model: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function normalizeMake(make: string): string {
  const m = squash(make);
  return makeAliases[m] ?? m;
}

/** Longest model prefix matched for this make, or -1 for no match. */
function matchLength(models: ModelsByMake, make: string, model: string): number {
  let best = -1;
  for (const candidate of models[make] ?? []) {
    const c = squash(candidate);
    if (model.startsWith(c) && c.length > best) best = c.length;
  }
  return best;
}

/**
 * Classifies a vehicle from the model lists. Returns a size class, 'large' (quote required), or null when the
 * vehicle is unknown. Unknown or year-ambiguous vehicles let the customer pick a class and flag the booking.
 */
export function classifyVehicle({ year, make, model }: VehicleInput): VehicleClass | null {
  const mk = normalizeMake(make);
  const md = squash(model);
  if (!mk || !md) return null;

  let best: { len: number; result: VehicleClass | null } | null = null;
  const consider = (len: number, result: VehicleClass | null) => {
    if (len >= 0 && (!best || len > best.len)) best = { len, result };
  };

  for (const rule of classRules) consider(matchLength(rule.models, mk, md), rule.result);
  consider(matchLength(unknownExceptions, mk, md), null);

  for (const y of yearRules) {
    if (y.make !== mk || !md.startsWith(squash(y.model))) continue;
    const len = squash(y.model).length;
    let result: VehicleClass | null = null;
    if (Number.isInteger(year)) {
      if (y.small && year <= y.small.maxYear) result = 'small-pickup';
      else if (y.midsize && year >= y.midsize.minYear) result = 'midsize-pickup';
    }
    consider(len, result);
  }

  return (best as { result: VehicleClass | null } | null)?.result ?? null;
}

export type SizeResolution =
  | { ok: true; sizeClass: VehicleClass; needsReview: boolean }
  | { ok: false; reason: 'class_required' | 'invalid_class' };

/**
 * Server-side class decision. The table always wins: a customer-selected class is only used when the
 * vehicle is unknown, and then the booking needs review.
 */
export function resolveSizeClass(vehicle: VehicleInput, selected?: string | null): SizeResolution {
  const classified = classifyVehicle(vehicle);
  if (classified) return { ok: true, sizeClass: classified, needsReview: false };
  if (!selected) return { ok: false, reason: 'class_required' };
  if (selected !== 'large' && !(sizeClassIds as readonly string[]).includes(selected)) {
    return { ok: false, reason: 'invalid_class' };
  }
  return { ok: true, sizeClass: selected as VehicleClass, needsReview: true };
}
