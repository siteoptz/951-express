// Database tests for capacity. They run only when TEST_DATABASE_URL points at a Neon dev branch, so a plain
// `npm test` never touches a database. Each test file run creates its own throwaway route and removes it after.
//   TEST_DATABASE_URL=<dev branch string> npx vitest run src/server/capacity.concurrency.test.ts
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { bookings, routes, weekOverrides } from '@/db/schema';
import { bookableWeeks } from '@/lib/weeks';
import {
  createHold,
  expireStaleHolds,
  getAvailability,
  spotsTaken,
  type HoldInput,
} from '@/server/capacity';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('capacity (database)', () => {
  const { db, pool } = createDb(url ?? 'postgres://unused');
  const slug = `test-${randomBytes(4).toString('hex')}`;
  const now = new Date();
  const [week1, week2, week3] = bookableWeeks(now);
  let routeId = 0;

  const input = (weekStart: string): HoldInput => ({
    routeSlug: slug,
    weekStart,
    pickupZip: '90001',
    deliveryZip: '21201',
    pickupRegion: 'west',
    deliveryRegion: 'east',
    vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
    operable: true,
    modified: false,
    topDeck: false,
    personalItems: false,
    sizeClass: 'small-sedan',
    sizeClassSource: 'table',
    totalCents: 140000,
    depositCents: 35000,
    balanceCents: 105000,
    needsReview: false,
    termsVersion: 'test',
    termsAcceptedAt: now,
  });

  beforeAll(async () => {
    const [r] = await db
      .insert(routes)
      .values({
        slug,
        name: 'Test route',
        pickupRegion: 'west',
        deliveryRegion: 'east',
        weeklyCapacity: 12,
      })
      .returning({ id: routes.id });
    routeId = r.id;
  });

  afterAll(async () => {
    await db.delete(bookings).where(eq(bookings.routeId, routeId));
    await db.delete(weekOverrides).where(eq(weekOverrides.routeId, routeId));
    await db.delete(routes).where(eq(routes.id, routeId));
    await pool.end();
  });

  it('13 simultaneous holds: exactly 12 succeed and 1 is full', async () => {
    const results = await Promise.all(
      Array.from({ length: 13 }, () => createHold(db, input(week1.start), now)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(12);
    const full = results.filter((r) => !r.ok);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatchObject({ reason: 'full', nextAvailableWeek: { start: week2.start } });
    expect(await spotsTaken(db, routeId, week1.start, now)).toBe(12);
  });

  it('holds on different weeks do not block each other', async () => {
    expect((await createHold(db, input(week2.start), now)).ok).toBe(true);
  });

  it('paid bookings keep their spot after the hold window', async () => {
    const held = await createHold(db, input(week3.start), now);
    if (!held.ok) throw new Error('expected a hold');
    await db
      .update(bookings)
      .set({ status: 'paid', paidAt: now })
      .where(eq(bookings.id, held.bookingId));
    expect(
      await spotsTaken(db, routeId, week3.start, new Date(now.getTime() + 24 * 3_600_000)),
    ).toBe(1);
  });

  it('a closed week is full, and an override changes capacity', async () => {
    const week = bookableWeeks(now)[4];
    await db.insert(weekOverrides).values({ routeId, weekStart: week.start, closed: true });
    expect(await createHold(db, input(week.start), now)).toMatchObject({
      ok: false,
      reason: 'full',
    });
    await db
      .update(weekOverrides)
      .set({ closed: false, capacityOverride: 1 })
      .where(eq(weekOverrides.routeId, routeId));
    expect((await createHold(db, input(week.start), now)).ok).toBe(true);
    expect(await createHold(db, input(week.start), now)).toMatchObject({
      ok: false,
      reason: 'full',
    });
  });

  it('getAvailability reports capacity, taken, and remaining', async () => {
    const a = await getAvailability(db, slug, now);
    expect(a).toHaveLength(8);
    expect(a![0]).toMatchObject({
      start: week1.start,
      capacity: 12,
      taken: 12,
      remaining: 0,
      closed: false,
    });
    expect(a![1]).toMatchObject({ taken: 1, remaining: 11 });
    expect(a![2]).toMatchObject({ taken: 1, remaining: 11 });
    expect(await getAvailability(db, 'no-such-route', now)).toBeNull();
  });

  it('rejects unknown routes and weeks that are not bookable', async () => {
    expect(
      await createHold(db, { ...input(week1.start), routeSlug: 'no-such-route' }, now),
    ).toEqual({ ok: false, reason: 'route_unavailable' });
    expect(await createHold(db, input('2020-01-06'), now)).toEqual({
      ok: false,
      reason: 'week_unavailable',
    });
  });

  it('a stale hold never blocks a spot, even before cleanup runs; cleanup then marks it expired', async () => {
    const later = new Date(now.getTime() + 31 * 60_000);
    // Before cleanup: week 1 has 12 unpaid holds, all past their expiry at `later`, and none count.
    expect(await spotsTaken(db, routeId, week1.start, later)).toBe(0);
    expect(await spotsTaken(db, routeId, week2.start, later)).toBe(0);
    // A new hold on the full week succeeds at `later` even though the stale rows are still status 'held'.
    expect((await createHold(db, input(week1.start), later)).ok).toBe(true);
    expect(await expireStaleHolds(db, later)).toBeGreaterThanOrEqual(13);
  });
});
