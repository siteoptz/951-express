import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { and, eq, gte } from 'drizzle-orm';
import Stripe from 'stripe';
import { createDb } from '../src/db';
import { bookings, routes, weekOverrides } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';

// Payment behavior without Stripe's iframe. Holds are made through our own /api/checkout (real Stripe test-mode
// sessions); "Stripe says it happened" is a webhook event we sign ourselves with the webhook secret, posted straight
// at /api/stripe/webhook, exactly as Stripe would. Run with the rest of the Stripe suite: npm run e2e:stripe
// Uses the DATABASE_URL in .env.local: a Neon dev branch only.
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const weeks = bookableWeeks();
const startedAt = new Date();
let routeId = 0;
let seq = 0;

test.beforeAll(async () => {
  const [r] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  routeId = r.id;
});
test.afterAll(async () => {
  await db
    .delete(bookings)
    .where(and(eq(bookings.routeId, routeId), gte(bookings.createdAt, startedAt)));
  await db.delete(weekOverrides).where(eq(weekOverrides.routeId, routeId));
  await pool.end();
});

/** Each call pretends to be a different visitor, because the endpoints are rate limited per IP. */
const visitor = () => ({ 'x-forwarded-for': `10.150.${Math.floor(++seq / 250)}.${seq % 250}` });

const step1 = (weekStart: string, over: Record<string, unknown> = {}) => ({
  pickupZip: '90001',
  deliveryZip: '21201',
  vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
  operable: true,
  modified: false,
  highValue: false,
  topDeck: false,
  personalItems: false,
  weekStart,
  termsAccepted: true,
  ...over,
});

type Hold = { bookingId: string; publicToken: string; clientSecret: string };
async function hold(request: APIRequestContext, weekStart: string): Promise<Hold> {
  const res = await request.post('/api/checkout', { data: step1(weekStart), headers: visitor() });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

const booking = async (id: string) =>
  (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

async function remaining(request: APIRequestContext, weekStart: string) {
  const res = await (await request.get('/api/availability?route=west-to-east')).json();
  return res.weeks.find((w: { start: string }) => w.start === weekStart) as {
    taken: number;
    remaining: number;
  };
}

/** A webhook event signed with the webhook secret, the way Stripe signs it. */
function signed(type: string, session: object) {
  const payload = JSON.stringify({
    id: `evt_e2e_${randomBytes(8).toString('hex')}`,
    object: 'event',
    api_version: '2026-09-30.endive',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object: session },
  });
  return { payload, header: stripe.webhooks.generateTestHeaderString({ payload, secret }) };
}
const post = (request: APIRequestContext, e: { payload: string; header: string }) =>
  request.post('/api/stripe/webhook', {
    data: e.payload,
    headers: { 'stripe-signature': e.header, 'content-type': 'application/json' },
  });

async function paidSession(sessionId: string) {
  const live = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    ...JSON.parse(JSON.stringify(live)),
    status: 'complete',
    payment_status: 'paid',
    payment_intent: `pi_e2e_${randomBytes(6).toString('hex')}`,
    customer_details: { email: 'e2e-buyer@example.com' },
  };
}

test.describe('webhook signature', () => {
  test('an unsigned, wrongly signed, or tampered event is refused and changes nothing @stripe-api', async ({
    request,
  }) => {
    const h = await hold(request, weeks[1].start);
    const row = await booking(h.bookingId);
    const e = signed('checkout.session.completed', await paidSession(row.stripeSessionId!));

    const none = await request.post('/api/stripe/webhook', { data: e.payload });
    expect(none.status()).toBe(400);
    const wrong = await post(request, {
      payload: e.payload,
      header: stripe.webhooks.generateTestHeaderString({
        payload: e.payload,
        secret: 'whsec_wrong',
      }),
    });
    expect(wrong.status()).toBe(400);
    const tampered = await post(request, {
      payload: e.payload.replace('"paid"', '"paid" '),
      header: e.header,
    });
    expect(tampered.status()).toBe(400);
    expect((await booking(h.bookingId)).status).toBe('held');
  });
});

test.describe('paid', () => {
  test('a signed paid event marks the booking paid, and replaying it changes nothing @stripe-api', async ({
    request,
  }) => {
    const week = weeks[2];
    const h = await hold(request, week.start);
    expect(await remaining(request, week.start)).toMatchObject({ taken: 1, remaining: 5 });
    const row = await booking(h.bookingId);
    expect(row).toMatchObject({ status: 'held', depositCents: 10000 });
    const session = await stripe.checkout.sessions.retrieve(row.stripeSessionId!);
    expect(session).toMatchObject({
      ui_mode: 'embedded_page',
      mode: 'payment',
      amount_total: 10000,
      metadata: { bookingId: row.id },
    });
    expect(session.expires_at).toBe(Math.floor(row.holdExpiresAt!.getTime() / 1000));

    const event = signed('checkout.session.completed', await paidSession(row.stripeSessionId!));
    expect(await (await post(request, event)).json()).toMatchObject({
      received: true,
      handled: 'paid',
      changed: true,
    });
    const paid = await booking(h.bookingId);
    expect(paid.status).toBe('paid');
    expect(paid.paidAt).toBeInstanceOf(Date);
    expect(paid.stripePaymentIntent).toMatch(/^pi_e2e_/);
    expect(paid.payerEmail).toBe('e2e-buyer@example.com');
    expect(await remaining(request, week.start)).toMatchObject({ taken: 1, remaining: 5 });

    // The same event again, correctly signed: accepted, and nothing changes.
    expect(await (await post(request, event)).json()).toMatchObject({
      handled: 'paid',
      changed: false,
    });
    const again = await booking(h.bookingId);
    expect(again.status).toBe('paid');
    expect(again.paidAt).toEqual(paid.paidAt);
    expect(again.stripePaymentIntent).toBe(paid.stripePaymentIntent);
  });

  test('an event that says the payment is not paid yet does not mark it paid @stripe-api', async ({
    request,
  }) => {
    const h = await hold(request, weeks[2].start);
    const row = await booking(h.bookingId);
    const unpaid = { ...(await paidSession(row.stripeSessionId!)), payment_status: 'unpaid' };
    expect(
      await (await post(request, signed('checkout.session.completed', unpaid))).json(),
    ).toMatchObject({
      handled: 'ignored',
      changed: false,
    });
    expect((await booking(h.bookingId)).status).toBe('held');
  });

  test('a paid booking can be finished from its link, and closing the window never gave the spot back @stripe-api', async ({
    request,
    page,
  }) => {
    const week = weeks[3];
    const h = await hold(request, week.start);
    const row = await booking(h.bookingId);
    await post(
      request,
      signed('checkout.session.completed', await paidSession(row.stripeSessionId!)),
    );

    // Closing the window after paying is a release call: a paid booking is never cancelled.
    const release = await request.post(`/api/bookings/${h.publicToken}/release`, {
      headers: visitor(),
    });
    expect(await release.json()).toEqual({ result: 'paid' });
    expect((await booking(h.bookingId)).status).toBe('paid');

    const status = await request.get(`/api/bookings/${h.publicToken}/status`, {
      headers: visitor(),
    });
    expect(await status.json()).toMatchObject({
      status: 'paid',
      paid: true,
      payerEmail: 'e2e-buyer@example.com',
    });
    await page.goto(`/booking/${h.publicToken}`);
    await expect(
      page.getByText(`✓ Deposit received. Your spot for ${week.label} is reserved.`),
    ).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('e2e-buyer@example.com');
  });
});

test.describe('expired and released', () => {
  test('a signed expired event releases the spot, and cannot undo a payment @stripe-api', async ({
    request,
  }) => {
    const week = weeks[4];
    const h = await hold(request, week.start);
    expect(await remaining(request, week.start)).toMatchObject({ taken: 1, remaining: 5 });
    const row = await booking(h.bookingId);

    const expired = signed(
      'checkout.session.expired',
      JSON.parse(JSON.stringify(await stripe.checkout.sessions.retrieve(row.stripeSessionId!))),
    );
    expect(await (await post(request, expired)).json()).toMatchObject({
      handled: 'expired',
      changed: true,
    });
    expect((await booking(h.bookingId)).status).toBe('expired');
    expect(await remaining(request, week.start)).toMatchObject({ taken: 0, remaining: 6 });
    expect(await (await post(request, expired)).json()).toMatchObject({ changed: false }); // replay

    // An expired event for a booking that was paid in the meantime does nothing.
    const h2 = await hold(request, week.start);
    const row2 = await booking(h2.bookingId);
    await post(
      request,
      signed('checkout.session.completed', await paidSession(row2.stripeSessionId!)),
    );
    const late = signed(
      'checkout.session.expired',
      JSON.parse(JSON.stringify(await stripe.checkout.sessions.retrieve(row2.stripeSessionId!))),
    );
    expect(await (await post(request, late)).json()).toMatchObject({ changed: false });
    expect((await booking(h2.bookingId)).status).toBe('paid');
  });

  test('the status check asks Stripe, and finds a session that expired without a webhook @stripe-api', async ({
    request,
  }) => {
    const week = weeks[5];
    const h = await hold(request, week.start);
    const row = await booking(h.bookingId);

    const open = await request.get(`/api/bookings/${h.publicToken}/status`, { headers: visitor() });
    expect(await open.json()).toMatchObject({ status: 'held', paid: false });

    await stripe.checkout.sessions.expire(row.stripeSessionId!); // Stripe ends the session; no webhook is delivered here
    const after = await request.get(`/api/bookings/${h.publicToken}/status`, {
      headers: visitor(),
    });
    expect(await after.json()).toMatchObject({ status: 'expired', paid: false });
    expect(await remaining(request, week.start)).toMatchObject({ taken: 0, remaining: 6 });
  });

  test('closing the window releases the hold at once and expires the Stripe session @stripe-api', async ({
    request,
  }) => {
    const week = weeks[6];
    const h = await hold(request, week.start);
    const row = await booking(h.bookingId);
    expect(await remaining(request, week.start)).toMatchObject({ taken: 1 });

    const release = await request.post(`/api/bookings/${h.publicToken}/release`, {
      headers: visitor(),
    });
    expect(await release.json()).toEqual({ result: 'released' });
    expect((await booking(h.bookingId)).status).toBe('cancelled');
    expect((await stripe.checkout.sessions.retrieve(row.stripeSessionId!)).status).toBe('expired');
    expect(await remaining(request, week.start)).toMatchObject({ taken: 0, remaining: 6 });

    // Releasing twice is harmless.
    const twice = await request.post(`/api/bookings/${h.publicToken}/release`, {
      headers: visitor(),
    });
    expect(await twice.json()).toEqual({ result: 'unchanged' });
    const missing = await request.post('/api/bookings/not-a-real-token-123456/release', {
      headers: visitor(),
    });
    expect(missing.status()).toBe(404);
  });
});

test.describe('full week', () => {
  test('a week that fills between the quote and the hold is refused with the next week, and no hold is made @stripe-api', async ({
    request,
  }) => {
    const week = weeks[6];
    const next = weeks[7];
    await db.insert(weekOverrides).values({ routeId, weekStart: week.start, capacityOverride: 1 });
    // The quote is still fine...
    const quote = await request.post('/api/quote', { data: step1(week.start), headers: visitor() });
    expect(quote.status()).toBe(200);
    // ...then someone else takes the last spot.
    await db.insert(bookings).values({
      publicToken: `e2e-race-${Date.now()}`,
      status: 'paid',
      routeId,
      weekStart: week.start,
      pickupZip: '90001',
      deliveryZip: '21201',
      pickupRegion: 'west',
      deliveryRegion: 'east',
      vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
      operable: true,
      modified: false,
      personalItems: false,
      sizeClass: 'small-sedan',
      sizeClassSource: 'table',
      totalCents: 140000,
      depositCents: 10000,
      balanceCents: 130000,
      termsVersion: 'e2e',
      termsAcceptedAt: new Date(),
    });
    const before = (await db.select().from(bookings).where(eq(bookings.routeId, routeId))).length;
    const res = await request.post('/api/checkout', {
      data: step1(week.start),
      headers: visitor(),
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      reason: 'week_full',
      error: 'That pickup week just filled up.',
      nextAvailableWeek: { start: next.start },
    });
    expect(body.clientSecret).toBeUndefined();
    expect((await db.select().from(bookings).where(eq(bookings.routeId, routeId))).length).toBe(
      before,
    );

    // Taking the offered week works.
    const retry = await hold(request, next.start);
    expect((await booking(retry.bookingId)).status).toBe('held');
  });
});
