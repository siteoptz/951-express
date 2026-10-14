import { expect, test } from '@playwright/test';
import { bookableWeeks } from '../src/lib/weeks';

// The server decides the vehicle, the size class and the price from the typed text. The browser's size pick is only
// used for a vehicle our tables do not know, and totals, deposits or classes it sends are ignored.
const week = bookableWeeks()[2];
const body = (over: Record<string, unknown> = {}) => ({
  pickupZip: '90001',
  deliveryZip: '21201',
  vehicle: { year: 2021, make: 'honda', model: 'civic' },
  operable: true,
  modified: false,
  highValue: false,
  topDeck: false,
  personalItems: false,
  weekStart: week.start,
  termsAccepted: true,
  ...over,
});
const headers = (i: number, n: number) => ({ 'x-forwarded-for': `10.77.${i}.${n}` });

test('a class sent by the browser cannot change the class or price of a known vehicle', async ({
  request,
}, info) => {
  const honest = await (
    await request.post('/api/quote', { data: body(), headers: headers(info.workerIndex, 1) })
  ).json();
  const forged = await request.post('/api/quote', {
    data: body({
      selectedClass: 'minivan',
      sizeClass: 'minivan',
      totalCents: 1,
      depositCents: 1,
      lines: [{ id: 'base', label: 'x', cents: 1 }],
    }),
    headers: headers(info.workerIndex, 2),
  });
  expect(forged.status()).toBe(200);
  const q = await forged.json();
  expect(q.sizeClass).toMatchObject({ id: 'small-sedan', source: 'table' });
  expect(q.totalCents).toBe(honest.totalCents);
  expect(q.depositCents).toBe(10000);
  expect(q.totalCents).toBeGreaterThan(1);
});

test('typed text is normalized and classified on the server', async ({ request }, info) => {
  const r = await request.post('/api/quote', {
    data: body({ vehicle: { year: 2022, make: ' chevy ', model: 'MALIBU' } }),
    headers: headers(info.workerIndex, 3),
  });
  expect(await r.json()).toMatchObject({
    vehicle: { year: 2022, make: 'Chevrolet', model: 'Malibu' },
    sizeClass: { id: 'large-sedan', source: 'table' },
  });
});

test('a full-size SUV stays a personalized quote whatever size the browser claims', async ({
  request,
}, info) => {
  const base = body({
    vehicle: { year: 2022, make: 'chevy', model: 'tahoe' },
    selectedClass: 'small-sedan',
  });
  const quote = await request.post('/api/quote', {
    data: base,
    headers: headers(info.workerIndex, 4),
  });
  expect(await quote.json()).toMatchObject({
    quoteRequired: true,
    quoteReasons: ['large_vehicle'],
  });
  const checkout = await request.post('/api/checkout', {
    data: base,
    headers: headers(info.workerIndex, 5),
  });
  const c = await checkout.json();
  expect(checkout.status()).not.toBe(200);
  expect(c.clientSecret).toBeUndefined();
});

test('the browser pick is used only for a vehicle we do not know, and the booking is flagged', async ({
  request,
}, info) => {
  const unknown = { year: 2020, make: 'zzz motors', model: 'thing' };
  const missing = await request.post('/api/quote', {
    data: body({ vehicle: unknown }),
    headers: headers(info.workerIndex, 6),
  });
  expect(missing.status()).toBe(422);
  const picked = await request.post('/api/quote', {
    data: body({ vehicle: unknown, selectedClass: 'small-suv' }),
    headers: headers(info.workerIndex, 7),
  });
  expect(await picked.json()).toMatchObject({
    vehicle: { make: 'Zzz Motors', model: 'Thing' },
    sizeClass: { id: 'small-suv', source: 'customer' },
    needsReview: true,
  });
});

test('"rolls royce ghost" is exotic: a personalized quote, no checkout', async ({
  request,
}, info) => {
  const data = body({ vehicle: { year: 2021, make: 'rolls royce', model: 'ghost' } });
  const quote = await request.post('/api/quote', { data, headers: headers(info.workerIndex, 8) });
  expect(await quote.json()).toMatchObject({ quoteRequired: true, quoteReasons: ['exotic'] });
  const checkout = await request.post('/api/checkout', {
    data,
    headers: headers(info.workerIndex, 9),
  });
  expect(checkout.status()).not.toBe(200);
  const short = await request.post('/api/quote', {
    data: body({ vehicle: { year: 2021, make: 'rr', model: 'ghost' } }),
    headers: headers(info.workerIndex, 10),
  });
  expect(await short.json()).toMatchObject({ quoteRequired: true, quoteReasons: ['exotic'] });
});

test('a make with no size table ("2008 Saab 9-3") asks for the vehicle type and is flagged for review', async ({
  request,
}, info) => {
  const saab = { year: 2008, make: 'saab', model: '9-3' };
  const missing = await request.post('/api/quote', {
    data: body({ vehicle: saab }),
    headers: headers(info.workerIndex, 11),
  });
  expect(missing.status()).toBe(422);
  const picked = await request.post('/api/quote', {
    data: body({ vehicle: saab, selectedClass: 'small-sedan' }),
    headers: headers(info.workerIndex, 12),
  });
  expect(await picked.json()).toMatchObject({
    vehicle: { make: 'Saab', model: '9-3' },
    sizeClass: { id: 'small-sedan', source: 'customer' },
    needsReview: true,
  });
});
