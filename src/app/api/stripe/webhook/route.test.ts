import Stripe from 'stripe';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Ignored event types never touch the database, so the handler runs with an empty stand-in.
vi.mock('@/db', () => ({ getDb: () => ({}) }));

const SECRET = 'whsec_test_secret_for_unit_tests';
const stripe = new Stripe('sk_test_dummy_key_for_signing_only');
const payload = JSON.stringify({
  id: 'evt_1',
  object: 'event',
  type: 'charge.succeeded',
  data: { object: {} },
});
const sign = (body: string, secret = SECRET) =>
  stripe.webhooks.generateTestHeaderString({ payload: body, secret });

const post = async (body: string, headers: Record<string, string> = {}) => {
  const { POST } = await import('@/app/api/stripe/webhook/route');
  return POST(
    new Request('http://localhost/api/stripe/webhook', { method: 'POST', body, headers }),
  );
};

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_key_for_signing_only';
});

describe('POST /api/stripe/webhook', () => {
  it('fails closed when no webhook secret is configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post(payload, { 'stripe-signature': sign(payload) })).status).toBe(500);
  });
  it('rejects a missing, forged, or wrong-secret signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    expect((await post(payload)).status).toBe(400);
    expect((await post(payload, { 'stripe-signature': 't=1,v1=deadbeef' })).status).toBe(400);
    expect((await post(payload, { 'stripe-signature': sign(payload, 'whsec_other') })).status).toBe(
      400,
    );
  });
  it('verifies against the exact raw body: any change breaks the signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const header = sign(payload);
    expect((await post(payload + ' ', { 'stripe-signature': header })).status).toBe(400);
    expect(
      (await post(JSON.stringify(JSON.parse(payload), null, 2), { 'stripe-signature': header }))
        .status,
    ).toBe(400);
  });
  it('accepts a correctly signed event', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const res = await post(payload, { 'stripe-signature': sign(payload) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: 'ignored', changed: false });
  });
});
