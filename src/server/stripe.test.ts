import { afterEach, describe, expect, it } from 'vitest';
import { stripeApiVersion } from '@/config/stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
afterEach(() => {
  if (KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = KEY;
});

describe('getStripe', () => {
  it('pins every request to the tested API version', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_key_for_unit_tests';
    const { getStripe } = await import('@/server/stripe');
    const client = getStripe() as unknown as { getApiField: (k: string) => string };
    expect(stripeApiVersion).toBe('2026-09-30.endive');
    expect(client.getApiField('version')).toBe(stripeApiVersion);
  });
  it('fails clearly without a key', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import('@/server/stripe');
    // the client is cached after the first test, so reset modules to see the missing-key path
    const fresh = await (async () => {
      const { vi } = await import('vitest');
      vi.resetModules();
      return import('@/server/stripe');
    })();
    expect(() => fresh.getStripe()).toThrow(/STRIPE_SECRET_KEY/);
    expect(typeof getStripe).toBe('function');
  });
});
