import { z } from 'zod';
import { fetchMakes, formatMake, VpicError } from '@/lib/vehicles';

const query = z.object({ year: z.coerce.number().int().min(1900).max(2100) });
const CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';

// vPIC's make list does not depend on the model year, so `year` is validated and then unused. The upstream
// fetches are cached for 24 hours by Next.
export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json({ error: 'A valid year is required.' }, { status: 400 });
  try {
    const makes = await fetchMakes();
    return Response.json(
      { makes: makes.map((m) => ({ value: m, label: formatMake(m) })) },
      { headers: { 'Cache-Control': CACHE } },
    );
  } catch (e) {
    if (e instanceof VpicError)
      return Response.json({ error: 'Vehicle lookup is unavailable right now.' }, { status: 502 });
    throw e;
  }
}
