import { getDb } from '@/db';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { getByToken, syncWithStripe } from '@/server/bookings';
import { sendDepositReceivedEmail } from '@/server/email';
import { getStripe } from '@/server/stripe';

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

// The client's onComplete callback is UX only. This asks Stripe directly if the webhook has not landed yet.
export async function GET(request: Request, ctx: RouteContext<'/api/bookings/[token]/status'>) {
  if (!limiter.check(clientIp(request.headers)).ok)
    return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const { token } = await ctx.params;
  const db = getDb();
  const found = await getByToken(db, token);
  if (!found) return Response.json({ error: 'Not found.' }, { status: 404 });

  const { booking, newlyPaid } = await syncWithStripe(db, getStripe(), found);
  if (newlyPaid && booking.payerEmail) {
    // The webhook has not landed yet: send the link from here (the webhook's conditional update then sends nothing).
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    await sendDepositReceivedEmail({
      to: booking.payerEmail,
      publicToken: booking.publicToken,
      vehicle: booking.vehicle,
      weekStart: booking.weekStart,
      baseUrl,
    }).catch(() => undefined);
  }
  return Response.json(
    {
      status: booking.status,
      paid: booking.status === 'paid' || booking.status === 'completed',
      holdExpiresAt: booking.holdExpiresAt,
      // Prefills the email field on Step 3 (the address Stripe collected). Only the holder of the token sees it.
      payerEmail: booking.payerEmail,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
