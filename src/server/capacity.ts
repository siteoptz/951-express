// Race-safe capacity. Every check-then-insert runs in one transaction guarded by
// pg_advisory_xact_lock(route id, week number), so two requests for the same route and week queue up
// and the 13th hold can never be sold.
import { randomBytes } from 'node:crypto';
import { and, count, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { booking as bookingConfig } from '@/config/booking';
import type { Region } from '@/config/routes';
import { bookings, routes, weekOverrides, type Vehicle } from '@/db/schema';
import type { Db } from '@/db';
import { bookableWeeks, findBookableWeek, weekNumber, type Week } from '@/lib/weeks';

type Executor = Pick<Db, 'select' | 'execute'>;

export type HoldInput = {
  routeSlug: string;
  weekStart: string;
  pickupZip: string;
  deliveryZip: string;
  pickupRegion: Region;
  deliveryRegion: Region;
  vehicle: Vehicle;
  operable: boolean;
  modified: boolean;
  topDeck: boolean;
  personalItems: boolean;
  sizeClass: string;
  sizeClassSource: 'table' | 'customer';
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  needsReview: boolean;
  termsVersion: string;
  termsAcceptedAt: Date;
};

export type HoldResult =
  | { ok: true; bookingId: string; publicToken: string; holdExpiresAt: Date }
  | { ok: false; reason: 'full'; nextAvailableWeek: Week | null }
  | { ok: false; reason: 'week_unavailable' | 'route_unavailable' };

const SPOT_STATUSES = ['paid', 'completed'] as const;

/** Paid and completed bookings, plus held bookings whose hold has not expired. Stale holds are ignored. */
export async function spotsTaken(
  ex: Executor,
  routeId: number,
  weekStart: string,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await ex
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.routeId, routeId),
        eq(bookings.weekStart, weekStart),
        or(
          inArray(bookings.status, [...SPOT_STATUSES]),
          and(eq(bookings.status, 'held'), gt(bookings.holdExpiresAt, now)),
        ),
      ),
    );
  return row.n;
}

/** Capacity for a week: a closed week is 0, else the override, else the route default. */
export async function weekCapacity(
  ex: Executor,
  route: { id: number; weeklyCapacity: number },
  weekStart: string,
): Promise<{ capacity: number; closed: boolean }> {
  const [o] = await ex
    .select()
    .from(weekOverrides)
    .where(and(eq(weekOverrides.routeId, route.id), eq(weekOverrides.weekStart, weekStart)));
  if (o?.closed) return { capacity: 0, closed: true };
  return { capacity: o?.capacityOverride ?? route.weeklyCapacity, closed: false };
}

async function findRoute(ex: Executor, slug: string) {
  const [route] = await ex.select().from(routes).where(eq(routes.slug, slug));
  return route?.active ? route : null;
}

export async function createHold(
  db: Db,
  input: HoldInput,
  now: Date = new Date(),
): Promise<HoldResult> {
  const route = await findRoute(db, input.routeSlug);
  if (!route) return { ok: false, reason: 'route_unavailable' };
  if (!findBookableWeek(input.weekStart, now)) return { ok: false, reason: 'week_unavailable' };

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${route.id}::int, ${weekNumber(input.weekStart)}::int)`,
    );

    const { capacity } = await weekCapacity(tx, route, input.weekStart);
    const taken = await spotsTaken(tx, route.id, input.weekStart, now);
    if (taken >= capacity) {
      return {
        ok: false,
        reason: 'full',
        nextAvailableWeek: await nextAvailableWeek(tx, route, input.weekStart, now),
      } as const;
    }

    const holdExpiresAt = new Date(now.getTime() + bookingConfig.holdMinutes * 60_000);
    const publicToken = randomBytes(24).toString('base64url');
    const [row] = await tx
      .insert(bookings)
      .values({
        publicToken,
        status: 'held',
        routeId: route.id,
        weekStart: input.weekStart,
        pickupZip: input.pickupZip,
        deliveryZip: input.deliveryZip,
        pickupRegion: input.pickupRegion,
        deliveryRegion: input.deliveryRegion,
        vehicle: input.vehicle,
        operable: input.operable,
        modified: input.modified,
        topDeck: input.topDeck,
        personalItems: input.personalItems,
        sizeClass: input.sizeClass,
        sizeClassSource: input.sizeClassSource,
        totalCents: input.totalCents,
        depositCents: input.depositCents,
        balanceCents: input.balanceCents,
        needsReview: input.needsReview,
        termsVersion: input.termsVersion,
        termsAcceptedAt: input.termsAcceptedAt,
        holdExpiresAt,
      })
      .returning({ id: bookings.id });
    return { ok: true, bookingId: row.id, publicToken, holdExpiresAt } as const;
  });
}

async function nextAvailableWeek(
  ex: Executor,
  route: { id: number; weeklyCapacity: number },
  after: string,
  now: Date,
): Promise<Week | null> {
  for (const week of bookableWeeks(now)) {
    if (week.start <= after) continue;
    const { capacity } = await weekCapacity(ex, route, week.start);
    if ((await spotsTaken(ex, route.id, week.start, now)) < capacity) return week;
  }
  return null;
}

export type WeekAvailability = Week & {
  capacity: number;
  taken: number;
  remaining: number;
  closed: boolean;
};

/** Each bookable week for a route with its capacity, spots taken, and spots remaining. */
export async function getAvailability(
  db: Db,
  routeSlug: string,
  now: Date = new Date(),
): Promise<WeekAvailability[] | null> {
  const route = await findRoute(db, routeSlug);
  if (!route) return null;
  return Promise.all(
    bookableWeeks(now).map(async (week) => {
      const { capacity, closed } = await weekCapacity(db, route, week.start);
      const taken = await spotsTaken(db, route.id, week.start, now);
      return { ...week, capacity, taken, remaining: Math.max(capacity - taken, 0), closed };
    }),
  );
}

/** Cleanup only: marks stale holds expired. Counting already ignores them. Returns how many changed. */
export async function expireStaleHolds(db: Db, now: Date = new Date()): Promise<number> {
  const rows = await db
    .update(bookings)
    .set({ status: 'expired' })
    .where(and(eq(bookings.status, 'held'), sql`${bookings.holdExpiresAt} <= ${now}`))
    .returning({ id: bookings.id });
  return rows.length;
}
