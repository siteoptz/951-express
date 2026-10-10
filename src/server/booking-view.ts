import 'server-only';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { routes } from '@/db/schema';
import { buildBookingView } from '@/lib/booking-view';
import { getByToken } from '@/server/bookings';

/** The browser-safe view of a booking for its token, or null when there is no such booking. */
export async function getBookingView(db: Db, token: string) {
  const b = await getByToken(db, token);
  if (!b) return null;
  const [route] = await db.select().from(routes).where(eq(routes.id, b.routeId));
  return buildBookingView(b, route.name);
}
