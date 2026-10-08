import { booking } from '@/config/booking';
import { getDb } from '@/db';
import { evaluateStep1 } from '@/lib/booking-quote';
import { routeErrorMessage } from '@/lib/routing';
import { regionOfZip } from '@/lib/routing.server';
import { step1Schema } from '@/lib/schemas';
import { getAvailability } from '@/server/capacity';

// Recomputes the route, size class, price, and week from the raw Step 1 answers. Nothing priced comes from the browser.
export async function POST(request: Request) {
  const parsed = step1Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Check your answers and try again.' }, { status: 400 });

  const r = evaluateStep1(parsed.data, regionOfZip);
  if (!r.ok) {
    if (r.error === 'route')
      return Response.json(
        { error: routeErrorMessage(r.failure), reason: r.failure.reason },
        { status: 422 },
      );
    return Response.json(
      {
        error:
          r.error === 'week_unavailable'
            ? 'That pickup week is no longer available.'
            : 'Choose a vehicle size.',
        reason: r.error,
      },
      { status: 422 },
    );
  }
  if (r.quoteRequired) return Response.json({ quoteRequired: true, route: r.route.id });

  const weeks = await getAvailability(getDb(), r.route.id);
  const spot = weeks?.find((w) => w.start === r.week.start);
  if (!spot || spot.closed || spot.remaining < 1) {
    return Response.json(
      { error: 'That pickup week just filled up. Pick another week.', reason: 'week_full' },
      { status: 409 },
    );
  }

  return Response.json({
    quoteRequired: false,
    route: { id: r.route.id, name: r.route.name },
    week: r.week,
    vehicle: parsed.data.vehicle,
    sizeClass: { id: r.sizeClass, label: r.sizeClassLabel, source: r.sizeClassSource },
    loadType: r.loadType,
    personalItems: parsed.data.personalItems,
    personalItemsNotice: parsed.data.personalItems ? booking.personalItemsNotice : null,
    operable: parsed.data.operable,
    modified: parsed.data.modified,
    lines: r.lines,
    totalCents: r.quote.totalCents,
    depositCents: r.quote.depositCents,
    balanceCents: r.quote.balanceCents,
    needsReview: r.quote.needsReview,
  });
}
