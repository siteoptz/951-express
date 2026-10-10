import { z } from 'zod';
import { getDb } from '@/db';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { regionOfZip } from '@/lib/routing.server';
import { step1Schema } from '@/lib/schemas';
import { releaseHold } from '@/server/bookings';
import { createCheckout } from '@/server/checkout';
import { getStripe } from '@/server/stripe';

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const body = step1Schema.extend({ replacePublicToken: z.string().min(16).max(64).optional() });

// Holds the spot and opens an embedded Stripe Checkout Session for the deposit.
export async function POST(request: Request) {
  const limited = limiter.check(clientIp(request.headers));
  if (!limited.ok) {
    return Response.json(
      { error: 'Too many requests. Please wait a minute or call us.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Check your answers and try again.' }, { status: 400 });
  const { replacePublicToken, ...step1 } = parsed.data;

  const db = getDb();
  const stripe = getStripe();
  // Going back and continuing again must not leave the first hold taking a spot.
  if (replacePublicToken) await releaseHold(db, stripe, replacePublicToken).catch(() => undefined);

  const result = await createCheckout(db, stripe, step1, regionOfZip);
  const { status, ...payload } = result;
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}
