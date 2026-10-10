import type Stripe from 'stripe';
import { getDb } from '@/db';
import { sendDepositReceivedEmail } from '@/server/email';
import { handleStripeEvent } from '@/server/stripe-events';
import { getStripe } from '@/server/stripe';

// Node.js runtime (the default). The signature is verified against the exact raw body.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 500 });
  if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(raw, signature, secret);
  } catch {
    return Response.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const result = await handleStripeEvent(getDb(), event, {
    log: (m) => console.warn(`[stripe webhook] ${m}`),
    sendDepositEmail: (booking, to) =>
      sendDepositReceivedEmail({
        to,
        publicToken: booking.publicToken,
        vehicle: booking.vehicle,
        weekStart: booking.weekStart,
        baseUrl,
      }),
  });
  return Response.json({ received: true, ...result });
}
