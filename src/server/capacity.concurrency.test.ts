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
  getNextTopDeckWeek,
  spotsTaken,
  topDeckUsed,
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
    depositCents: 10000,
    balanceCents: 130000,
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
        weeklyCapacity: 6,
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

  it('7 simultaneous holds: exactly 6 succeed and 1 is full', async () => {
    const results = await Promise.all(
      Array.from({ length: 7 }, () => createHold(db, input(week1.start), now)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(6);
    const full = results.filter((r) => !r.ok);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatchObject({ reason: 'full', nextAvailableWeek: { start: week2.start } });
    expect(await spotsTaken(db, routeId, week1.start, now)).toBe(6);
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
      capacity: 6,
      taken: 6,
      remaining: 0,
      closed: false,
    });
    expect(a![1]).toMatchObject({ taken: 1, remaining: 5 });
    expect(a![2]).toMatchObject({ taken: 1, remaining: 5 });
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
    // Before cleanup: week 1 has 6 unpaid holds, all past their expiry at `later`, and none count.
    expect(await spotsTaken(db, routeId, week1.start, later)).toBe(0);
    expect(await spotsTaken(db, routeId, week2.start, later)).toBe(0);
    // A new hold on the full week succeeds at `later` even though the stale rows are still status 'held'.
    expect((await createHold(db, input(week1.start), later)).ok).toBe(true);
    expect(await expireStaleHolds(db, later)).toBeGreaterThanOrEqual(7);
  });

  describe('Top Deck Load limits', () => {
    const [, , , , , wA, wB, wC] = bookableWeeks(now);
    const topDeckInput = (weekStart: string, sizeClass: string): HoldInput => ({
      ...input(weekStart),
      topDeck: true,
      sizeClass,
      totalCents: 155000,
    });
    const standard = (weekStart: string, sizeClass = 'small-suv'): HoldInput => ({
      ...input(weekStart),
      sizeClass,
    });
    const ok = (rs: { ok: boolean }[]) => rs.filter((r) => r.ok).length;

    it('5 simultaneous SUV top-deck holds: exactly 3 succeed', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => createHold(db, topDeckInput(wA.start, 'small-suv'), now)),
      );
      expect(ok(results)).toBe(3);
      const refused = results.filter((r) => !r.ok);
      expect(refused).toHaveLength(2);
      for (const r of refused) expect(r).toMatchObject({ ok: false, reason: 'top_deck_full' });
      expect(await topDeckUsed(db, routeId, wA.start, now)).toEqual({ suv: 3, car: 0 });
      // Each top-deck booking also used one of the 6 main spots.
      expect(await spotsTaken(db, routeId, wA.start, now)).toBe(3);
    });

    it('once the SUV slots are full, another SUV top deck is refused but standard loading still works', async () => {
      expect(await createHold(db, topDeckInput(wA.start, 'midsize-suv'), now)).toMatchObject({
        ok: false,
        reason: 'top_deck_full',
      });
      expect((await createHold(db, standard(wA.start), now)).ok).toBe(true);
      expect((await createHold(db, standard(wA.start, 'small-sedan'), now)).ok).toBe(true);
    });

    it('a refused top-deck hold offers the next week that has top-deck space for the vehicle', async () => {
      const r = await createHold(db, topDeckInput(wA.start, 'minivan'), now);
      expect(r).toMatchObject({ ok: false, reason: 'top_deck_full' });
      if (r.ok || !('nextAvailableWeek' in r)) return;
      expect(r.nextAvailableWeek?.start).toBe(wB.start);
      expect((await getNextTopDeckWeek(db, slug, wA.start, 'minivan', now))?.start).toBe(wB.start);
    });

    it('the next-week offer skips a week whose main spots are full or whose top deck is full', async () => {
      // Week B: fill the SUV slots, so week C is the next with room for an SUV top deck.
      for (let i = 0; i < 3; i++)
        expect((await createHold(db, topDeckInput(wB.start, 'small-pickup'), now)).ok).toBe(true);
      const r = await createHold(db, topDeckInput(wA.start, 'small-suv'), now);
      expect(r).toMatchObject({ ok: false, reason: 'top_deck_full' });
      if (r.ok || !('nextAvailableWeek' in r)) return;
      expect(r.nextAvailableWeek?.start).toBe(wC.start);
    });

    it('car slot: one sedan takes it, and a second sedan uses a free SUV slot', async () => {
      expect((await createHold(db, topDeckInput(wC.start, 'small-sedan'), now)).ok).toBe(true);
      expect(await topDeckUsed(db, routeId, wC.start, now)).toEqual({ suv: 0, car: 1 });
      expect((await createHold(db, topDeckInput(wC.start, 'large-sedan'), now)).ok).toBe(true);
      // Two sedans: one in the car slot, one in an SUV slot, so only 2 SUV slots are left.
      const a = await getAvailability(db, slug, now);
      expect(a!.find((w) => w.start === wC.start)!.topDeck.remaining).toEqual({ suv: 2, car: 2 });
    });

    it('simultaneous sedans and SUVs never exceed 4 top-deck loads, 3 of them SUVs at most', async () => {
      const week = bookableWeeks(now)[3];
      const mix = [
        'small-sedan',
        'large-sedan',
        'small-suv',
        'minivan',
        'midsize-pickup',
        'small-suv',
      ];
      const results = await Promise.all(
        mix.map((sizeClass) => createHold(db, topDeckInput(week.start, sizeClass), now)),
      );
      expect(ok(results)).toBe(4);
      const used = await topDeckUsed(db, routeId, week.start, now);
      expect(used.suv).toBeLessThanOrEqual(3);
      expect(used.suv + used.car).toBe(4);
    });

    it('a per-week override changes the slots', async () => {
      const week = bookableWeeks(now)[2];
      await db
        .insert(weekOverrides)
        .values({ routeId, weekStart: week.start, topDeckSuvOverride: 1, topDeckCarOverride: 0 })
        .onConflictDoUpdate({
          target: [weekOverrides.routeId, weekOverrides.weekStart],
          set: { topDeckSuvOverride: 1, topDeckCarOverride: 0 },
        });
      expect((await createHold(db, topDeckInput(week.start, 'small-suv'), now)).ok).toBe(true);
      expect(await createHold(db, topDeckInput(week.start, 'small-suv'), now)).toMatchObject({
        ok: false,
        reason: 'top_deck_full',
      });
      expect(await createHold(db, topDeckInput(week.start, 'small-sedan'), now)).toMatchObject({
        ok: false,
        reason: 'top_deck_full',
      });
    });

    it('expired holds free their top-deck slot, and paid ones keep it', async () => {
      const week = bookableWeeks(now)[1]; // week 2 holds only a few standard bookings from earlier tests
      const held = await createHold(db, topDeckInput(week.start, 'small-suv'), now);
      if (!held.ok) throw new Error('expected a hold');
      const later = new Date(now.getTime() + 31 * 60_000);
      expect((await topDeckUsed(db, routeId, week.start, now)).suv).toBe(1);
      expect((await topDeckUsed(db, routeId, week.start, later)).suv).toBe(0);
      await db
        .update(bookings)
        .set({ status: 'paid', paidAt: now })
        .where(eq(bookings.id, held.bookingId));
      expect((await topDeckUsed(db, routeId, week.start, later)).suv).toBe(1);
    });

    it('availability reports top-deck capacity, taken and remaining per slot type', async () => {
      const a = await getAvailability(db, slug, now);
      const weekA = a!.find((w) => w.start === wA.start)!;
      expect(weekA.topDeck).toEqual({
        capacity: { suv: 3, car: 1 },
        taken: { suv: 3, car: 0 },
        remaining: { suv: 0, car: 1 },
      });
    });
  });
});
