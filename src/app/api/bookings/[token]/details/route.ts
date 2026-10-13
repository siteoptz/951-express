import { after } from 'next/server';
import { getDb } from '@/db';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { regionOfZip } from '@/lib/routing.server';
import { step3Schema } from '@/lib/schemas';
import { sendBookingEmails } from '@/server/booking-emails';
import { submitDetails } from '@/server/details';

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

// Step 3. Only a paid booking can be completed, once. The emails go out after the response, and can never undo it.
export async function POST(request: Request, ctx: RouteContext<'/api/bookings/[token]/details'>) {
  if (!limiter.check(clientIp(request.headers)).ok)
    return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  const { token } = await ctx.params;
  const parsed = step3Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    return Response.json(
      { error: 'Check your details and try again.', reason: 'invalid', field },
      { status: 400 },
    );
  }

  const db = getDb();
  const result = await submitDetails(db, token, parsed.data, regionOfZip);
  if (!result.ok)
    return Response.json(
      {
        error: result.error,
        reason: result.reason,
        field: result.field,
        mismatches: result.mismatches,
      },
      { status: result.status },
    );

  after(() => sendBookingEmails(db, result.booking.id));
  return Response.json(
    { ok: true, confirmation: result.confirmation },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
