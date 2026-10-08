import { z } from 'zod';
import { createRateLimiter, clientIp } from '@/lib/rate-limit';
import { checkZip } from '@/lib/zip-check.server';

const body = z.object({ zip: z.string().max(12) });
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  const limited = limiter.check(clientIp(request.headers));
  if (!limited.ok) {
    return Response.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Send { "zip": "12345" }.' }, { status: 400 });
  return Response.json(checkZip(parsed.data.zip), { headers: { 'Cache-Control': 'no-store' } });
}
