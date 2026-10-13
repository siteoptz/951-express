// Step 1 decision logic, shared by /api/quote and (later) /api/checkout. Pure: the ZIP lookup is injected,
// so this file never imports the ZIP lists. Nothing here trusts a price, route, or class from the browser.
import type { QuoteReason } from '@/config/eligibility';
import { sizeClasses, topDeck, type SizeClassId } from '@/config/pricing';
import type { Region, RouteConfig } from '@/config/routes';
import { quoteReasons } from '@/lib/eligibility';
import { calculateQuote, type Quote } from '@/lib/pricing';
import { resolveRoute, type RegionLookup, type RouteFailure } from '@/lib/routing';
import type { Step1 } from '@/lib/schemas';
import { resolveSizeClass } from '@/lib/size-class';
import {
  normalizeVehicle,
  notRecognizedReason,
  type CleanVehicle,
  type TypedVehicle,
} from '@/lib/vehicle-normalize';
import { findBookableWeek, type Week } from '@/lib/weeks';

export type QuoteLine = { id: string; label: string; cents: number };

type Base = {
  route: RouteConfig;
  pickupRegion: Region;
  deliveryRegion: Region;
  /** The vehicle after normalization ("chevy" -> Chevrolet). Used for the booking record, emails and Stripe. */
  vehicle: CleanVehicle;
  /** The vehicle exactly as the customer typed it, kept next to the normalized one. */
  vehicleTyped: TypedVehicle;
};

export type Step1Result =
  | { ok: false; error: 'route'; failure: RouteFailure }
  | { ok: false; error: 'class_required' | 'invalid_class' | 'week_unavailable' }
  | ({ ok: true; quoteRequired: true; quoteReasons: QuoteReason[] } & Base)
  | ({
      ok: true;
      quoteRequired: false;
      week: Week;
      sizeClass: SizeClassId;
      sizeClassLabel: string;
      sizeClassSource: 'table' | 'customer';
      loadType: string;
      needsReview: boolean;
      /** Why the booking is flagged, e.g. "vehicle not recognized: 'zzz thing'". Null when nothing is. */
      reviewReason: string | null;
      quote: Quote;
      lines: QuoteLine[];
    } & Base);

export function evaluateStep1(
  input: Step1,
  regionOf: RegionLookup,
  now: Date = new Date(),
): Step1Result {
  const routed = resolveRoute(regionOf, input.pickupZip, input.deliveryZip);
  if (!routed.ok) return { ok: false, error: 'route', failure: routed };
  // Everything below works from the normalized vehicle; the typed text is kept for the record.
  const vehicle = normalizeVehicle(input.vehicle);
  const base: Base = {
    route: routed.route,
    pickupRegion: routed.pickupRegion,
    deliveryRegion: routed.deliveryRegion,
    vehicle,
    vehicleTyped: {
      year: String(input.vehicle.year),
      make: input.vehicle.make,
      model: input.vehicle.model,
    },
  };

  // Anything that cannot be booked online goes to the personalized quote form, before any price, hold, or
  // Stripe session. This runs first so an exotic or high-value vehicle never has to pick a size class.
  const reasons = quoteReasons({
    vehicle,
    selectedClass: input.selectedClass,
    operable: input.operable,
    modified: input.modified,
    highValue: input.highValue,
  });
  if (reasons.length > 0) return { ok: true, quoteRequired: true, quoteReasons: reasons, ...base };

  const size = resolveSizeClass(vehicle, input.selectedClass);
  if (!size.ok) return { ok: false, error: size.reason };

  const week = findBookableWeek(input.weekStart, now);
  if (!week) return { ok: false, error: 'week_unavailable' };

  const quote = calculateQuote({
    sizeClass: size.sizeClass,
    topDeck: input.topDeck,
    needsReview: size.needsReview,
  });
  if ('quoteRequired' in quote)
    return { ok: true, quoteRequired: true, quoteReasons: ['large_vehicle'], ...base };

  const cls = sizeClasses.find((c) => c.id === size.sizeClass)!;
  return {
    ok: true,
    quoteRequired: false,
    ...base,
    week,
    sizeClass: cls.id,
    sizeClassLabel: cls.label,
    sizeClassSource: size.needsReview ? 'customer' : 'table',
    loadType: input.topDeck ? topDeck.label : topDeck.standardLabel,
    needsReview: quote.needsReview,
    reviewReason: size.needsReview ? notRecognizedReason(input.vehicle) : null,
    quote,
    lines: [
      { id: 'base', label: `${cls.label} transport`, cents: quote.baseCents },
      ...quote.surcharges.map((s) => ({ id: s.id, label: s.label, cents: s.cents })),
    ],
  };
}
