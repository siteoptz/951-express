import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/zip-check/route';

let n = 0;
const post = (payload: unknown, ip = `10.0.0.${++n}`) =>
  POST(
    new Request('http://localhost/api/zip-check', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  );

describe('POST /api/zip-check', () => {
  it('serves a West ZIP', async () => {
    const res = await post({ zip: '90001' });
    expect(await res.json()).toEqual({
      valid: true,
      served: true,
      region: 'west',
      city: 'Los Angeles',
      state: 'CA',
      oppositeRegion: 'east',
    });
  });
  it('serves an East ZIP', async () => {
    expect(await (await post({ zip: '21201' })).json()).toEqual({
      valid: true,
      served: true,
      region: 'east',
      city: 'Baltimore',
      state: 'MD',
      oppositeRegion: 'west',
    });
  });
  it('reports an unserved ZIP with its city', async () => {
    expect(await (await post({ zip: '10001' })).json()).toEqual({
      valid: true,
      served: false,
      region: null,
      city: 'New York',
      state: 'NY',
      oppositeRegion: null,
    });
  });
  it('reports an invalid ZIP', async () => {
    const res = await post({ zip: '1234' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: false,
      served: false,
      region: null,
      city: null,
      state: null,
      oppositeRegion: null,
    });
  });
  it('treats a leading-zero ZIP as a string: valid but not served; the 4-digit form is invalid', async () => {
    expect(await (await post({ zip: '02108' })).json()).toMatchObject({
      valid: true,
      served: false,
      city: 'Boston',
    });
    expect(await (await post({ zip: '2108' })).json()).toMatchObject({ valid: false });
  });
  it('serves a listed ZIP the zipcodes package does not know, without a city', async () => {
    expect(await (await post({ zip: '85288' })).json()).toMatchObject({
      served: true,
      region: 'west',
      city: null,
    });
  });
  it('rejects a malformed body', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ zip: 90001 })).status).toBe(400);
  });
  it('never returns a list', async () => {
    const text = await (await post({ zip: '90001' })).text();
    expect(text.length).toBeLessThan(200);
  });
  it('rate limits per IP', async () => {
    const ip = '203.0.113.9';
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await post({ zip: '90001' }, ip)).status;
    expect(last).toBe(429);
    expect((await post({ zip: '90001' }, ip)).headers.get('Retry-After')).toBeTruthy();
    expect((await post({ zip: '90001' }, '203.0.113.10')).status).toBe(200);
  });
});
