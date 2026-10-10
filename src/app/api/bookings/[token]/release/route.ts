import { getDb } from '@/db';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { releaseHold } from '@/server/bookings';
import { getStripe } from '@/server/stripe';

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// Frees a held spot when the customer edits their answers or closes the window. A payment that already went
// through is never cancelled: the booking is marked paid instead.
export async function POST(request: Request, ctx: RouteContext<'/api/bookings/[token]/release'>) {
  if (!limiter.check(clientIp(request.headers)).ok)
    return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const { token } = await ctx.params;
  const { result } = await releaseHold(getDb(), getStripe(), token);
  return Response.json(
    { result },
    { status: result === 'not_found' ? 404 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
