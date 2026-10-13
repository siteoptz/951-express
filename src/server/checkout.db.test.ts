// Database tests for checkout, the Stripe event handlers, and the status backstop. Stripe is faked; the
// database is a real Neon dev branch, opted into with TEST_DATABASE_URL (see capacity.concurrency.test.ts).
import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { bookings, routes, weekOverrides } from '@/db/schema';
import { regionOfZip } from '@/lib/routing.server';
import type { Step1 } from '@/lib/schemas';
import { bookableWeeks } from '@/lib/weeks';
import { getByToken, markExpired, markPaid, releaseHold, syncWithStripe } from '@/server/bookings';
import { createCheckout } from '@/server/checkout';
import { handleStripeEvent } from '@/server/stripe-events';
import type { StripeApi } from '@/server/stripe';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('checkout and Stripe events (database)', () => {
  const { db, pool } = createDb(url ?? 'postgres://unused');
  const weeks = bookableWeeks();
  const created: string[] = [];
  let routeId = 0;

  type Session = Awaited<ReturnType<StripeApi['checkout']['sessions']['retrieve']>>;
  const fake = (opts: { failCreate?: boolean; retrieve?: Partial<Session> } = {}) => {
    const calls = {
      create: [] as Stripe.Checkout.SessionCreateParams[],
      expire: [] as string[],
      retrieve: 0,
    };
    const api: StripeApi = {
      checkout: {
        sessions: {
          create: async (params) => {
            calls.create.push(params);
            if (opts.failCreate) throw new Error('stripe down');
            return {
              id: `cs_test_${randomBytes(6).toString('hex')}`,
              client_secret: 'cs_secret_test',
            };
          },
          retrieve: async (id) => {
            calls.retrieve++;
            return {
              id,
              status: 'open',
              payment_status: 'unpaid',
              payment_intent: null,
              customer_details: null,
              ...opts.retrieve,
            } as Session;
          },
          expire: async (id) => void calls.expire.push(id),
        },
      },
    };
    return { api, calls };
  };

  const step1 = (weekStart: string, over: Partial<Step1> = {}): Step1 => ({
    pickupZip: '90001',
    deliveryZip: '21201',
    vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
    operable: true,
    modified: false,
    highValue: false,
    topDeck: false,
    personalItems: false,
    weekStart,
    termsAccepted: true,
    ...over,
  });

  async function checkout(weekStart: string, f = fake(), over: Partial<Step1> = {}) {
    const r = await createCheckout(db, f.api, step1(weekStart, over), regionOfZip);
    if (r.status === 200) created.push(r.bookingId);
    return { r, f };
  }

  const event = (type: string, session: Record<string, unknown>) =>
    ({ type, data: { object: session } }) as unknown as Stripe.Event;
  const paidSession = (id: string, email: string | null = 'buyer@example.com') => ({
    id,
    payment_status: 'paid',
    payment_intent: 'pi_test_1',
    customer_details: email ? { email } : null,
  });
  const deps = () => {
    const sent: string[] = [];
    return {
      sent,
      d: {
        sendDepositEmail: async (_b: unknown, to: string) => (
          sent.push(to),
          { sent: true as const, id: 'e1' }
        ),
      },
    };
  };
  const row = async (id: string) =>
    (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

  beforeAll(async () => {
    const [r] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
    routeId = r.id;
  });
  afterAll(async () => {
    if (created.length) await db.delete(bookings).where(inArray(bookings.id, created));
    await db.delete(weekOverrides).where(eq(weekOverrides.routeId, routeId));
    await pool.end();
  });

  it('holds the spot, recomputes the deposit, and opens an embedded session that outlives the hold', async () => {
    const { r, f } = await checkout(weeks[4].start);
    expect(r).toMatchObject({
      status: 200,
      clientSecret: 'cs_secret_test',
      weekLabel: weeks[4].label,
    });
    if (r.status !== 200) return;
    const p = f.calls.create[0];
    expect(p).toMatchObject({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      customer_creation: 'if_required',
      metadata: { bookingId: r.bookingId },
    });
    expect(p.line_items?.[0]).toMatchObject({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: 37500 },
    }); // 25% of $1,500 small SUV
    expect((p.line_items?.[0].price_data?.product_data as { name: string }).name).toBe(
      `Transport deposit: 2021 Toyota RAV4, West → East, week of ${weeks[4].label.split(' – ')[0]}`,
    );
    expect(p.expires_at!).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000) + 30 * 60);

    const b = await row(r.bookingId);
    expect(b).toMatchObject({
      status: 'held',
      totalCents: 150000,
      depositCents: 37500,
      balanceCents: 112500,
      sizeClass: 'small-suv',
      sizeClassSource: 'table',
      routeId,
    });
    expect(b.stripeSessionId).toMatch(/^cs_test_/);
    expect(b.holdExpiresAt!.getTime() / 1000).toBe(p.expires_at); // spot held exactly as long as the session lives
  });

  it('ignores any price the browser sends', async () => {
    const f = fake();
    const r = await createCheckout(
      db,
      f.api,
      { ...step1(weeks[4].start), totalCents: 1, depositCents: 1 } as Step1,
      regionOfZip,
    );
    if (r.status === 200) created.push(r.bookingId);
    expect(f.calls.create[0].line_items?.[0].price_data?.unit_amount).toBe(37500);
  });

  it('releases the hold when Stripe fails', async () => {
    const f = fake({ failCreate: true });
    const r = await createCheckout(db, f.api, step1(weeks[5].start), regionOfZip);
    expect(r).toMatchObject({ status: 502, reason: 'stripe_unavailable' });
    const rows = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.routeId, routeId), eq(bookings.weekStart, weeks[5].start)));
    expect(rows.every((b) => b.status === 'cancelled')).toBe(true);
    created.push(...rows.map((b) => b.id));
  });

  it('returns 409 with the next available week when the week is full', async () => {
    await db
      .insert(weekOverrides)
      .values({ routeId, weekStart: weeks[6].start, capacityOverride: 1 });
    expect((await checkout(weeks[6].start)).r.status).toBe(200);
    const { r } = await checkout(weeks[6].start);
    expect(r).toMatchObject({
      status: 409,
      reason: 'week_full',
      nextAvailableWeek: { start: weeks[7].start },
    });
  });

  it('rejects large vehicles, bad routes, and unbookable weeks without holding anything', async () => {
    expect(
      (
        await checkout(weeks[4].start, fake(), {
          vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
        })
      ).r,
    ).toMatchObject({ status: 422, quoteRequired: true });
    expect((await checkout(weeks[4].start, fake(), { deliveryZip: '90002' })).r).toMatchObject({
      status: 422,
      reason: 'same_region',
    });
    expect((await checkout('2020-01-06')).r).toMatchObject({
      status: 422,
      reason: 'week_unavailable',
    });
  });

  it.each([
    ['large_vehicle', { vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' } }],
    ['inoperable', { operable: false }],
    ['modified', { modified: true, modificationDetails: '5-inch lift' }],
    ['exotic', { vehicle: { year: 2021, make: 'Ferrari', model: 'Roma' } }],
    ['exotic', { vehicle: { year: 2021, make: 'Mercedes-Benz', model: 'S 680 Maybach' } }],
    ['high_value', { highValue: true }],
  ] as const)(
    'never holds a spot or opens Stripe for a %s vehicle, however the request is forged',
    async (reason, over) => {
      // A pickup ZIP no other test uses, so concurrent test files cannot change this count.
      const zip = { pickupZip: '85004' };
      const count = async () =>
        (await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.pickupZip, '85004')))
          .length;
      const before = await count();
      const { r, f } = await checkout(weeks[4].start, fake(), {
        ...zip,
        ...over,
      } as Partial<Step1>);
      expect(r).toMatchObject({ status: 422, quoteRequired: true });
      expect((r as { quoteReasons?: string[] }).quoteReasons).toContain(reason);
      expect(f.calls.create).toHaveLength(0);
      expect(await count()).toBe(before);
    },
  );

  it('marks paid once: a replayed webhook changes nothing and sends no second email', async () => {
    const { r } = await checkout(weeks[4].start);
    if (r.status !== 200) throw new Error('expected a booking');
    const sessionId = (await row(r.bookingId)).stripeSessionId!;
    const { sent, d } = deps();

    const first = await handleStripeEvent(
      db,
      event('checkout.session.completed', paidSession(sessionId)),
      d,
    );
    expect(first).toEqual({ handled: 'paid', changed: true });
    const paid = await row(r.bookingId);
    expect(paid).toMatchObject({
      status: 'paid',
      stripePaymentIntent: 'pi_test_1',
      payerEmail: 'buyer@example.com',
      needsReview: false,
    });
    expect(paid.paidAt).toBeInstanceOf(Date);

    const replay = await handleStripeEvent(
      db,
      event('checkout.session.completed', paidSession(sessionId)),
      d,
    );
    expect(replay).toEqual({ handled: 'paid', changed: false });
    expect(sent).toEqual(['buyer@example.com']);
    expect((await row(r.bookingId)).paidAt).toEqual(paid.paidAt);

    // async_payment_succeeded is the same transition
    expect(
      await handleStripeEvent(
        db,
        event('checkout.session.async_payment_succeeded', paidSession(sessionId)),
        d,
      ),
    ).toMatchObject({ changed: false });
  });

  it('ignores an unpaid completion and unrelated events, and survives an email failure', async () => {
    const { r } = await checkout(weeks[4].start);
    if (r.status !== 200) throw new Error('expected a booking');
    const sessionId = (await row(r.bookingId)).stripeSessionId!;
    const { d } = deps();
    expect(
      await handleStripeEvent(
        db,
        event('checkout.session.completed', { id: sessionId, payment_status: 'unpaid' }),
        d,
      ),
    ).toEqual({ handled: 'ignored', changed: false });
    expect(await handleStripeEvent(db, event('charge.succeeded', {}), d)).toEqual({
      handled: 'ignored',
      changed: false,
    });
    expect((await row(r.bookingId)).status).toBe('held');

    const logs: string[] = [];
    const boom = {
      sendDepositEmail: async () => {
        throw new Error('resend down');
      },
      log: (m: string) => logs.push(m),
    };
    expect(
      await handleStripeEvent(
        db,
        event('checkout.session.completed', paidSession(sessionId)),
        boom,
      ),
    ).toEqual({ handled: 'paid', changed: true });
    expect(logs[0]).toMatch(/resend down/);
    const quiet = {
      sendDepositEmail: async () => ({
        sent: false as const,
        reason: 'not_configured' as const,
        error: 'not configured',
      }),
      log: (m: string) => logs.push(m),
    };
    const { r: r2 } = await checkout(weeks[4].start);
    if (r2.status !== 200) throw new Error('expected a booking');
    await handleStripeEvent(
      db,
      event('checkout.session.completed', paidSession((await row(r2.bookingId)).stripeSessionId!)),
      quiet,
    );
    expect(logs.at(-1)).toMatch(/not_configured/);
  });

  it('expires only a held booking, once', async () => {
    const { r } = await checkout(weeks[4].start);
    if (r.status !== 200) throw new Error('expected a booking');
    const sessionId = (await row(r.bookingId)).stripeSessionId!;
    const { d } = deps();
    expect(
      await handleStripeEvent(db, event('checkout.session.expired', { id: sessionId }), d),
    ).toEqual({ handled: 'expired', changed: true });
    expect((await row(r.bookingId)).status).toBe('expired');
    expect(
      await handleStripeEvent(db, event('checkout.session.expired', { id: sessionId }), d),
    ).toEqual({ handled: 'expired', changed: false });

    // an expired event never undoes a payment
    const { r: r2 } = await checkout(weeks[4].start);
    if (r2.status !== 200) throw new Error('expected a booking');
    const s2 = (await row(r2.bookingId)).stripeSessionId!;
    await handleStripeEvent(db, event('checkout.session.completed', paidSession(s2)), d);
    expect(await markExpired(db, s2)).toBeNull();
    expect((await row(r2.bookingId)).status).toBe('paid');
  });

  it('a payment that lands after the hold was marked expired is accepted but flagged for review', async () => {
    const { r } = await checkout(weeks[4].start);
    if (r.status !== 200) throw new Error('expected a booking');
    const sessionId = (await row(r.bookingId)).stripeSessionId!;
    await markExpired(db, sessionId);
    const paid = await markPaid(db, {
      sessionId,
      paymentIntent: 'pi_late',
      payerEmail: 'late@example.com',
    });
    expect(paid).toMatchObject({ status: 'paid', needsReview: true });
  });

  it('the status backstop marks a paid session paid once, and an expired session expired', async () => {
    const { r } = await checkout(weeks[4].start);
    if (r.status !== 200) throw new Error('expected a booking');
    const b = (await getByToken(db, (await row(r.bookingId)).publicToken))!;

    const open = await syncWithStripe(db, fake().api, b);
    expect(open).toMatchObject({ newlyPaid: false, booking: { status: 'held' } });

    const paidApi = fake({
      retrieve: {
        payment_status: 'paid',
        status: 'complete',
        payment_intent: 'pi_back',
        customer_details: { email: 'back@example.com' } as Session['customer_details'],
      },
    }).api;
    const synced = await syncWithStripe(db, paidApi, b);
    expect(synced).toMatchObject({
      newlyPaid: true,
      booking: { status: 'paid', stripePaymentIntent: 'pi_back', payerEmail: 'back@example.com' },
    });
    expect(await syncWithStripe(db, paidApi, synced.booking)).toMatchObject({
      newlyPaid: false,
      booking: { status: 'paid' },
    });

    const { r: r2 } = await checkout(weeks[4].start);
    if (r2.status !== 200) throw new Error('expected a booking');
    const b2 = (await getByToken(db, (await row(r2.bookingId)).publicToken))!;
    const expired = await syncWithStripe(db, fake({ retrieve: { status: 'expired' } }).api, b2);
    expect(expired.booking.status).toBe('expired');
  });

  it('releaseHold frees the spot and expires the session, but never cancels a paid booking', async () => {
    const f = fake();
    const { r } = await checkout(weeks[4].start, f);
    if (r.status !== 200) throw new Error('expected a booking');
    const token = (await row(r.bookingId)).publicToken;
    expect(await releaseHold(db, f.api, token)).toEqual({ result: 'released' });
    expect(f.calls.expire).toHaveLength(1);
    expect(await row(r.bookingId)).toMatchObject({ status: 'cancelled' });
    expect((await row(r.bookingId)).cancelledAt).toBeInstanceOf(Date);
    expect(await releaseHold(db, f.api, token)).toEqual({ result: 'unchanged' });
    expect(await releaseHold(db, f.api, 'no-such-token-0000000000')).toEqual({
      result: 'not_found',
    });

    // payment actually completed: marked paid, not cancelled
    const paidApi = fake({
      retrieve: {
        payment_status: 'paid',
        status: 'complete',
        payment_intent: 'pi_x',
        customer_details: { email: 'x@example.com' } as Session['customer_details'],
      },
    });
    const { r: r2 } = await checkout(weeks[4].start, paidApi);
    if (r2.status !== 200) throw new Error('expected a booking');
    const out = await releaseHold(db, paidApi.api, (await row(r2.bookingId)).publicToken);
    expect(out.result).toBe('paid');
    expect((await row(r2.bookingId)).status).toBe('paid');
    expect(await releaseHold(db, paidApi.api, (await row(r2.bookingId)).publicToken)).toEqual({
      result: 'paid',
    });

    // expire() fails because Stripe completed it meanwhile: checked again, then paid
    let n = 0;
    const racing = fake();
    racing.api.checkout.sessions.retrieve = async (id) =>
      (++n < 2
        ? {
            id,
            status: 'open',
            payment_status: 'unpaid',
            payment_intent: null,
            customer_details: null,
          }
        : {
            id,
            status: 'complete',
            payment_status: 'paid',
            payment_intent: 'pi_race',
            customer_details: { email: 'r@example.com' },
          }) as Session;
    racing.api.checkout.sessions.expire = async () => {
      throw new Error('already complete');
    };
    const { r: r3 } = await checkout(weeks[4].start, racing);
    if (r3.status !== 200) throw new Error('expected a booking');
    expect((await releaseHold(db, racing.api, (await row(r3.bookingId)).publicToken)).result).toBe(
      'paid',
    );
  });
});
