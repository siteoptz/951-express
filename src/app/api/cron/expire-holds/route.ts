import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import { expireStaleHolds } from '@/server/capacity';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const expired = await expireStaleHolds(getDb());
  return Response.json({ expired });
}
