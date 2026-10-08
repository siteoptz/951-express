// Seeds routes, rates, and settings from src/config. Idempotent: existing rows are left alone, so
// re-running never overwrites a rate the admin has edited.
import { createDb } from '../src/db';
import { rates, routes, settings } from '../src/db/schema';
import { pricing, sizeClasses, topDeck } from '../src/config/pricing';
import { routes as routeConfig } from '../src/config/routes';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (put the Neon dev branch string in .env.local)');

const { db, pool } = createDb(url);

async function main() {
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
      { key: 'inoperable_surcharge_cents', value: pricing.inoperableSurchargeCents },
      { key: 'modified_surcharge_cents', value: pricing.modifiedSurchargeCents },
      { key: 'modified_policy', value: pricing.modifiedPolicy },
      { key: 'top_deck_surcharge_cents', value: topDeck.surchargeCents },
      { key: 'deposit_percent', value: pricing.deposit.value },
    ])
    .onConflictDoNothing({ target: settings.key });

  const [r, c, s] = await Promise.all([
    db.select().from(routes),
    db.select().from(rates),
    db.select().from(settings),
  ]);
  console.log(`routes: ${r.map((x) => `${x.slug}(${x.weeklyCapacity})`).join(', ')}`);
  console.log(`rates: ${c.length}, settings: ${s.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
