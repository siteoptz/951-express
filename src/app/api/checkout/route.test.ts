import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createCheckout = vi.fn();
const releaseHold = vi.fn();
vi.mock('@/db', () => ({ getDb: () => ({}) }));
vi.mock('@/server/checkout', () => ({ createCheckout }));
vi.mock('@/server/bookings', () => ({ releaseHold }));
vi.mock('@/server/stripe', () => ({ getStripe: () => ({}) }));
vi.mock('@/lib/routing.server', () => ({ regionOfZip: () => null }));

const KEYS = {
  pk: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  sk: process.env.STRIPE_SECRET_KEY,
};
const restore = (name: string, value: string | undefined) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};
const post = async () => {
  const { POST } = await import('@/app/api/checkout/route');
  return POST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  );
};

beforeEach(() => {
  createCheckout.mockReset();
  releaseHold.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  restore('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', KEYS.pk);
  restore('STRIPE_SECRET_KEY', KEYS.sk);
  vi.restoreAllMocks();
});

describe('POST /api/checkout key-mode guard', () => {
  it.each([
    ['pk_test_a', 'sk_live_b'],
    ['pk_live_a', 'sk_test_b'],
  ])('refuses %s with %s before any hold or session is created', async (pk, sk) => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk;
    process.env.STRIPE_SECRET_KEY = sk;
    const res = await post();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/temporarily unavailable/);
    expect(createCheckout).not.toHaveBeenCalled();
    expect(releaseHold).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('different modes'));
  });

  it('lets matching keys through to normal validation', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_a';
    process.env.STRIPE_SECRET_KEY = 'sk_live_b';
    expect((await post()).status).toBe(400); // empty body fails the schema, not the guard
  });
});
