// Seeds routes, rates, and settings from src/config, insert-if-missing only (see src/server/seed.ts).
import { createDb } from '../src/db';
import { seedDatabase } from '../src/server/seed';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (put the Neon dev branch string in .env.local)');

const { db, pool } = createDb(url);

seedDatabase(db)
  .then(({ routes, rates, settings }) => {
    console.log(`routes: ${routes.map((x) => `${x.slug}(${x.weeklyCapacity})`).join(', ')}`);
    console.log(`rates: ${rates.length}, settings: ${settings.length}`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
