import { describe, expect, it } from 'vitest';
import { stripeKeyMismatch, stripeKeyMode } from '@/lib/stripe-mode';

describe('stripeKeyMode', () => {
  it('reads the mode from the prefix', () => {
    expect(stripeKeyMode('pk_test_abc')).toBe('test');
    expect(stripeKeyMode('sk_live_abc')).toBe('live');
    expect(stripeKeyMode('rk_live_abc')).toBe('live');
    expect(stripeKeyMode('rk_test_abc')).toBe('test');
  });
  it('is unknown for missing or odd values', () => {
    expect(stripeKeyMode(undefined)).toBeNull();
    expect(stripeKeyMode('')).toBeNull();
    expect(stripeKeyMode('whsec_abc')).toBeNull();
    expect(stripeKeyMode('xx_test_abc')).toBeNull();
  });
});

describe('stripeKeyMismatch', () => {
  it('flags pk_test with sk_live and the reverse', () => {
    expect(stripeKeyMismatch('pk_test_a', 'sk_live_b')).toMatch(
      /publishable key is test.*secret key is live/,
    );
    expect(stripeKeyMismatch('pk_live_a', 'sk_test_b')).toMatch(
      /publishable key is live.*secret key is test/,
    );
    expect(stripeKeyMismatch('pk_live_a', 'rk_test_b')).not.toBeNull();
  });
  it('passes matching keys', () => {
    expect(stripeKeyMismatch('pk_test_a', 'sk_test_b')).toBeNull();
    expect(stripeKeyMismatch('pk_live_a', 'sk_live_b')).toBeNull();
    expect(stripeKeyMismatch('pk_live_a', 'rk_live_b')).toBeNull();
  });
  it('leaves a missing key to the other checks', () => {
    expect(stripeKeyMismatch(undefined, 'sk_live_b')).toBeNull();
    expect(stripeKeyMismatch('pk_test_a', undefined)).toBeNull();
  });
});
