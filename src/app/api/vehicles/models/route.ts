import { z } from 'zod';
import { isValidYear, fetchModels, VpicError } from '@/lib/vehicles';

const query = z.object({ year: z.coerce.number().int(), make: z.string().trim().min(1).max(60) });
const CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || !isValidYear(parsed.data.year)) {
    return Response.json({ error: 'A valid year and make are required.' }, { status: 400 });
  }
  try {
    const models = await fetchModels(parsed.data.year, parsed.data.make);
    return Response.json({ models }, { headers: { 'Cache-Control': CACHE } });
  } catch (e) {
    if (e instanceof VpicError)
      return Response.json({ error: 'Vehicle lookup is unavailable right now.' }, { status: 502 });
    throw e;
  }
}
