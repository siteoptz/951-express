import { z } from 'zod';
import { routeIds } from '@/config/routes';
import { getDb } from '@/db';
import { getAvailability } from '@/server/capacity';

const query = z.object({ route: z.enum(routeIds) });

export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: 'Unknown route.' }, { status: 400 });
  const weeks = await getAvailability(getDb(), parsed.data.route);
  if (!weeks) return Response.json({ error: 'Route unavailable.' }, { status: 404 });
  return Response.json(
    { route: parsed.data.route, weeks },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
