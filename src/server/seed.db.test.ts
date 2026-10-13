// The seed only inserts what is missing. It must never overwrite a value that was changed in the database,
// because Phase 8 lets the client edit these and every deploy runs the seed. Runs only with TEST_DATABASE_URL.
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { rates, routes, settings } from '@/db/schema';
import { seedDatabase } from '@/server/seed';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('seed (database)', () => {
  const { db, pool } = createDb(url ?? 'postgres://unused');
  const original: { route?: number; rate?: number; deposit?: unknown; topDeck?: unknown } = {};

  afterAll(async () => {
    // Put the dev branch back the way it was.
    if (original.route !== undefined)
      await db
        .update(routes)
        .set({ weeklyCapacity: original.route })
        .where(eq(routes.slug, 'east-to-west'));
    if (original.rate !== undefined)
      await db
        .update(rates)
        .set({ baseCents: original.rate })
        .where(eq(rates.sizeClass, 'small-sedan'));
    if (original.deposit !== undefined)
      await db.update(settings).set({ value: original.deposit }).where(eq(settings.key, 'deposit'));
    if (original.topDeck !== undefined)
      await db
        .update(settings)
        .set({ value: original.topDeck })
        .where(eq(settings.key, 'top_deck_surcharge_cents'));
    await pool.end();
  });

  it('seeds the defaults from config when rows are missing, and is idempotent', async () => {
    const first = await seedDatabase(db);
    const second = await seedDatabase(db);
    expect(second.routes.map((r) => r.slug).sort()).toEqual(['east-to-west', 'west-to-east']);
    expect(second.rates).toHaveLength(first.rates.length);
    expect(second.settings.map((s) => s.key)).toEqual(
      expect.arrayContaining(['deposit', 'top_deck_surcharge_cents']),
    );
    expect(second.settings).toHaveLength(first.settings.length);
  });

  it('leaves a route capacity, a rate, and the settings alone after they were changed in the database', async () => {
    const seeded = await seedDatabase(db);
    original.route = seeded.routes.find((r) => r.slug === 'east-to-west')!.weeklyCapacity;
    original.rate = seeded.rates.find((r) => r.sizeClass === 'small-sedan')!.baseCents;
    original.deposit = seeded.settings.find((s) => s.key === 'deposit')!.value;
    original.topDeck = seeded.settings.find((s) => s.key === 'top_deck_surcharge_cents')!.value;

    const changedDeposit = { type: 'percent', value: 30 };
    await db.update(routes).set({ weeklyCapacity: 9 }).where(eq(routes.slug, 'east-to-west'));
    await db.update(rates).set({ baseCents: 123400 }).where(eq(rates.sizeClass, 'small-sedan'));
    await db.update(settings).set({ value: changedDeposit }).where(eq(settings.key, 'deposit'));
    await db
      .update(settings)
      .set({ value: 17500 })
      .where(eq(settings.key, 'top_deck_surcharge_cents'));

    await seedDatabase(db);
    const after = await seedDatabase(db); // twice

    expect(after.routes.find((r) => r.slug === 'east-to-west')!.weeklyCapacity).toBe(9);
    expect(after.rates.find((r) => r.sizeClass === 'small-sedan')!.baseCents).toBe(123400);
    expect(after.settings.find((s) => s.key === 'deposit')!.value).toEqual(changedDeposit);
    expect(after.settings.find((s) => s.key === 'top_deck_surcharge_cents')!.value).toBe(17500);
  });

  it('does not bring back a setting that a migration retired', async () => {
    const { settings: rows } = await seedDatabase(db);
    const keys = rows.map((s) => s.key);
    for (const gone of [
      'deposit_percent',
      'inoperable_surcharge_cents',
      'modified_surcharge_cents',
      'modified_policy',
    ])
      expect(keys).not.toContain(gone);
  });
});
