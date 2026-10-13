// Seeds routes, rates, and settings from src/config. Insert-if-missing only: an existing row is never updated, so a
// value someone changed in the database (Phase 8's editors) survives every deploy. The config values are defaults;
// once a row exists, the database is the source of truth. A change to an existing row ships as a one-time data
// migration in drizzle/ instead (see 0005_data_capacity_and_deposit.sql).
import type { Db } from '@/db';
import { rates, routes, settings } from '@/db/schema';
import { pricing, sizeClasses, topDeck } from '@/config/pricing';
import { routes as routeConfig } from '@/config/routes';

export async function seedDatabase(db: Db) {
  await db
    .insert(routes)
    .values(
      routeConfig.map((r) => ({
        slug: r.id,
        name: r.name,
        pickupRegion: r.pickupRegion,
        deliveryRegion: r.deliveryRegion,
        weeklyCapacity: r.weeklyCapacity,
      })),
    )
    .onConflictDoNothing({ target: routes.slug });

  await db
    .insert(rates)
    .values(
      sizeClasses.map((c, i) => ({
        sizeClass: c.id,
        label: c.label,
        example: c.example,
        baseCents: c.baseCents,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing({ target: rates.sizeClass });

  await db
    .insert(settings)
    .values([
      { key: 'top_deck_surcharge_cents', value: topDeck.surchargeCents },
      { key: 'deposit', value: pricing.deposit },
    ])
    .onConflictDoNothing({ target: settings.key });

  const [r, c, s] = await Promise.all([
    db.select().from(routes),
    db.select().from(rates),
    db.select().from(settings),
  ]);
  return { routes: r, rates: c, settings: s };
}
