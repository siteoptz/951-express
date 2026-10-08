import { getDb } from '@/db';
import { leads, routes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { routeErrorMessage } from '@/lib/routing';
import { resolveRouteForZips } from '@/lib/routing.server';
import { quoteRequestSchema } from '@/lib/schemas';
import { resolveSizeClass } from '@/lib/size-class';
import { findBookableWeek } from '@/lib/weeks';

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

// Stores a quote-required (large vehicle) request. No deposit and no spot hold. The email is wired in Phase 7.
export async function POST(request: Request) {
  const limited = limiter.check(clientIp(request.headers));
  if (!limited.ok) {
    return Response.json(
      { error: 'Too many requests. Please wait a minute or call us.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Check your details and try again.' }, { status: 400 });
  const d = parsed.data;

  const routed = resolveRouteForZips(d.pickupZip, d.deliveryZip);
  if (!routed.ok)
    return Response.json(
      { error: routeErrorMessage(routed), reason: routed.reason },
      { status: 422 },
    );

  // The server decides what is "large"; a lead for a vehicle with an online price is refused.
  const size = resolveSizeClass(d.vehicle, d.selectedClass);
  if (!size.ok || size.sizeClass !== 'large') {
    return Response.json(
      { error: 'This vehicle has an online price. Use the instant quote.' },
      { status: 422 },
    );
  }

  if (d.preferredWeekStart && !findBookableWeek(d.preferredWeekStart)) {
    return Response.json(
      {
        error: 'That pickup week is no longer available. Pick another or leave it blank.',
        reason: 'week_unavailable',
      },
      { status: 422 },
    );
  }

  const db = getDb();
  const [route] = await db
    .select({ id: routes.id })
    .from(routes)
    .where(eq(routes.slug, routed.route.id));
  if (!route) return Response.json({ error: 'Route unavailable.' }, { status: 503 });

  await db.insert(leads).values({
    routeId: route.id,
    pickupZip: d.pickupZip,
    deliveryZip: d.deliveryZip,
    vehicle: d.vehicle,
    operable: d.operable,
    modified: d.modified,
    topDeck: d.topDeck,
    preferredWeekStart: d.preferredWeekStart ?? null,
    name: d.name,
    phone: d.phone,
    email: d.email,
    notes: d.notes || null,
  });
  return Response.json({ ok: true }, { status: 201 });
}
