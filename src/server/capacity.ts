// Race-safe capacity. Every check-then-insert runs in one transaction guarded by
// pg_advisory_xact_lock(route id, week number), so two requests for the same route and week queue up
// and the 13th hold can never be sold.
import { randomBytes } from 'node:crypto';
import { and, count, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { booking as bookingConfig } from '@/config/booking';
import type { Region } from '@/config/routes';
import { bookings, routes, weekOverrides, type Vehicle } from '@/db/schema';
import type { Db } from '@/db';
import {
  defaultTopDeckCapacity,
  topDeckFits,
  topDeckRemaining,
  topDeckSlotFor,
  usedFromClasses,
  type SlotCounts,
} from '@/lib/top-deck';
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
  | { ok: false; reason: 'full' | 'top_deck_full'; nextAvailableWeek: Week | null }
  | { ok: false; reason: 'week_unavailable' | 'route_unavailable' };

const SPOT_STATUSES = ['paid', 'completed'] as const;

/** Paid and completed bookings, plus held bookings whose hold has not expired. Stale holds are ignored. */
const countsAsSpot = (now: Date) =>
  or(
    inArray(bookings.status, [...SPOT_STATUSES]),
    and(eq(bookings.status, 'held'), gt(bookings.holdExpiresAt, now)),
  );

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
      and(eq(bookings.routeId, routeId), eq(bookings.weekStart, weekStart), countsAsSpot(now)),
    );
  return row.n;
}

/** Top-deck bookings that count (held, paid, completed) for a route and week, by the slot each needs. */
export async function topDeckUsed(
  ex: Executor,
  routeId: number,
  weekStart: string,
  now: Date = new Date(),
): Promise<SlotCounts> {
  const rows = await ex
    .select({ sizeClass: bookings.sizeClass, n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.routeId, routeId),
        eq(bookings.weekStart, weekStart),
        eq(bookings.topDeck, true),
        countsAsSpot(now),
      ),
    )
    .groupBy(bookings.sizeClass);
  return usedFromClasses(rows);
}

/** Top-deck slots for a week: the per-week override, else the config default. */
export async function weekTopDeckCapacity(
  ex: Executor,
  routeId: number,
  weekStart: string,
): Promise<SlotCounts> {
  const [o] = await ex
    .select()
    .from(weekOverrides)
    .where(and(eq(weekOverrides.routeId, routeId), eq(weekOverrides.weekStart, weekStart)));
  const base = defaultTopDeckCapacity();
  return { suv: o?.topDeckSuvOverride ?? base.suv, car: o?.topDeckCarOverride ?? base.car };
}

/** Does a top-deck booking for this size class still fit in the week? */
export async function topDeckHasRoom(
  ex: Executor,
  routeId: number,
  weekStart: string,
  sizeClass: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [used, capacity] = await Promise.all([
    topDeckUsed(ex, routeId, weekStart, now),
    weekTopDeckCapacity(ex, routeId, weekStart),
  ]);
  return topDeckFits(topDeckSlotFor(sizeClass), used, capacity);
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

    // A top-deck booking also needs a free top-deck slot, checked inside the same lock as the main spots.
    if (
      input.topDeck &&
      !(await topDeckHasRoom(tx, route.id, input.weekStart, input.sizeClass, now))
    ) {
      return {
        ok: false,
        reason: 'top_deck_full',
        nextAvailableWeek: await nextAvailableWeek(
          tx,
          route,
          input.weekStart,
          now,
          input.sizeClass,
        ),
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
  /** When set, the week must also have a top-deck slot for this size class. */
  topDeckFor?: string,
): Promise<Week | null> {
  for (const week of bookableWeeks(now)) {
    if (week.start <= after) continue;
    const { capacity } = await weekCapacity(ex, route, week.start);
    if ((await spotsTaken(ex, route.id, week.start, now)) >= capacity) continue;
    if (topDeckFor && !(await topDeckHasRoom(ex, route.id, week.start, topDeckFor, now))) continue;
    return week;
  }
  return null;
}

/** The next bookable week after `after` that has a main spot and, for top deck, a slot for this size class. */
export async function getNextTopDeckWeek(
  db: Db,
  routeSlug: string,
  after: string,
  sizeClass: string,
  now: Date = new Date(),
): Promise<Week | null> {
  const route = await findRoute(db, routeSlug);
  return route ? nextAvailableWeek(db, route, after, now, sizeClass) : null;
}

export type WeekAvailability = Week & {
  capacity: number;
  taken: number;
  remaining: number;
  closed: boolean;
  /** Top-deck slots this week, by the kind of slot a vehicle needs. `remaining.car` includes free SUV slots. */
  topDeck: { capacity: SlotCounts; taken: SlotCounts; remaining: SlotCounts };
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
      const [used, tdCapacity] = await Promise.all([
        topDeckUsed(db, route.id, week.start, now),
        weekTopDeckCapacity(db, route.id, week.start),
      ]);
      return {
        ...week,
        capacity,
        taken,
        remaining: Math.max(capacity - taken, 0),
        closed,
        topDeck: {
          capacity: tdCapacity,
          taken: used,
          remaining: topDeckRemaining(used, tdCapacity),
        },
      };
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
