import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    const l = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(l.check('a', 0).ok).toBe(true);
    expect(l.check('a', 10).ok).toBe(true);
    expect(l.check('a', 20)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(l.check('b', 20).ok).toBe(true);
    expect(l.check('a', 1001).ok).toBe(true);
  });
  it('prunes expired keys, and clears when still over capacity', () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
    for (const k of ['a', 'b', 'c']) l.check(k, 0);
    expect(l.check('d', 5000).ok).toBe(true);
    for (const k of ['e', 'f', 'g', 'h']) l.check(k, 5001);
    expect(l.check('e', 5002).ok).toBe(true);
  });
  it('uses Date.now by default', () => {
    expect(createRateLimiter({ limit: 1, windowMs: 1000 }).check('x').ok).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers x-forwarded-for, then x-real-ip, then a shared bucket', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(new Headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
