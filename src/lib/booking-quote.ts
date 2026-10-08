// Step 1 decision logic, shared by /api/quote and (later) /api/checkout. Pure: the ZIP lookup is injected,
// so this file never imports the ZIP lists. Nothing here trusts a price, route, or class from the browser.
import { sizeClasses, topDeck, type SizeClassId } from '@/config/pricing';
import type { Region, RouteConfig } from '@/config/routes';
import { calculateQuote, type Quote } from '@/lib/pricing';
import { resolveRoute, type RegionLookup, type RouteFailure } from '@/lib/routing';
import type { Step1 } from '@/lib/schemas';
import { resolveSizeClass } from '@/lib/size-class';
import { findBookableWeek, type Week } from '@/lib/weeks';

export type QuoteLine = { id: string; label: string; cents: number };

type Base = { route: RouteConfig; pickupRegion: Region; deliveryRegion: Region };

export type Step1Result =
  | { ok: false; error: 'route'; failure: RouteFailure }
  | { ok: false; error: 'class_required' | 'invalid_class' | 'week_unavailable' }
  | ({ ok: true; quoteRequired: true } & Base)
  | ({
      ok: true;
      quoteRequired: false;
      week: Week;
      sizeClass: SizeClassId;
      sizeClassLabel: string;
      sizeClassSource: 'table' | 'customer';
      loadType: string;
      needsReview: boolean;
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
  const base: Base = {
    route: routed.route,
    pickupRegion: routed.pickupRegion,
    deliveryRegion: routed.deliveryRegion,
  };

  const size = resolveSizeClass(input.vehicle, input.selectedClass);
  if (!size.ok) return { ok: false, error: size.reason };
  if (size.sizeClass === 'large') return { ok: true, quoteRequired: true, ...base };

  const week = findBookableWeek(input.weekStart, now);
  if (!week) return { ok: false, error: 'week_unavailable' };

  const quote = calculateQuote({
    sizeClass: size.sizeClass,
    operable: input.operable,
    modified: input.modified,
    topDeck: input.topDeck,
    needsReview: size.needsReview,
  });
  if ('quoteRequired' in quote) return { ok: true, quoteRequired: true, ...base };

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
    quote,
    lines: [
      { id: 'base', label: `${cls.label} transport`, cents: quote.baseCents },
      ...quote.surcharges.map((s) => ({ id: s.id, label: s.label, cents: s.cents })),
    ],
  };
}
