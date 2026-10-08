import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@/db/schema';

// neon-serverless (Pool) rather than neon-http: capacity holds need real transactions.
export type Db = ReturnType<typeof createDb>['db'];

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

let shared: ReturnType<typeof createDb> | undefined;

/** One pool per server instance, from DATABASE_URL. */
export function getDb(): Db {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    shared = createDb(url);
  }
  return shared.db;
}
