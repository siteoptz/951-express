// Database tests for Step 3 and the booking emails. Opt in with TEST_DATABASE_URL (a Neon dev branch).
// Each file run uses its own throwaway route, so spot numbers are not disturbed by other tests.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb } from '@/db';
import { bookings, leads, routes } from '@/db/schema';
import { regionOfZip } from '@/lib/routing.server';
import type { Step3 } from '@/lib/schemas';
import { bookableWeeks } from '@/lib/weeks';
import { sendBookingEmails, sendLeadEmail, spotNumber } from '@/server/booking-emails';
import { submitDetails } from '@/server/details';
import type { EmailMessage, EmailResult } from '@/server/email';

const url = process.env.TEST_DATABASE_URL;
const TEAM = 'team@example.com';

describe.skipIf(!url)('Step 3 details and booking emails (database)', () => {
  const { db, pool } = createDb(url ?? 'postgres://unused');
  const slug = `test-${randomBytes(4).toString('hex')}`;
  const week = bookableWeeks()[1];
  let routeId = 0;
  const bookingIds: string[] = [];
  const leadIds: string[] = [];

  // Real cities for the ZIPs used here: the server checks the city against the ZIP.
  const CITY: Record<string, [string, string]> = {
    '90001': ['Los Angeles', 'CA'],
    '92881': ['Corona', 'CA'],
    '90210': ['Beverly Hills', 'CA'],
    '21201': ['Baltimore', 'MD'],
    '21771': ['Mount Airy', 'MD'],
    '10001': ['New York', 'NY'],
  };
  const addr = (zip = '90001') => ({
    street: '1 Main St',
    city: CITY[zip][0],
    state: CITY[zip][1],
    zip,
  });
  const input = (over: Partial<Step3> = {}): Step3 => ({
    firstName: 'Pat',
    lastName: 'Driver',
    phone: '951-555-0100',
    email: 'pat@example.com',
    address: addr('92881'),
    pickupAddress: addr('90001'),
    deliveryAddress: { ...addr('21201'), street: '9 Pier Rd' },
    notes: 'Gate code 1234',
    ...over,
  });

  async function booking(
    status: 'held' | 'paid' | 'cancelled' | 'completed' = 'paid',
    over: Partial<typeof bookings.$inferInsert> = {},
  ) {
    const token = randomBytes(18).toString('base64url');
    const [row] = await db
      .insert(bookings)
      .values({
        publicToken: token,
        status,
        routeId,
        weekStart: week.start,
        pickupZip: '90001',
        deliveryZip: '21201',
        pickupRegion: 'west',
        deliveryRegion: 'east',
        vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
        operable: true,
        modified: false,
        topDeck: false,
        personalItems: true,
        sizeClass: 'small-suv',
        sizeClassSource: 'table',
        totalCents: 150000,
        depositCents: 37500,
        balanceCents: 112500,
        termsVersion: 'test',
        termsAcceptedAt: new Date(),
        paidAt: status === 'paid' || status === 'completed' ? new Date() : null,
        payerEmail: 'payer@example.com',
        stripePaymentIntent: 'pi_test_x',
        ...over,
      })
      .returning();
    bookingIds.push(row.id);
    return row;
  }
  const row = async (id: string) =>
    (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

  const fakeSend = (results: (EmailResult | Error)[] = []) => {
    const sent: EmailMessage[] = [];
    const send = async (m: EmailMessage): Promise<EmailResult> => {
      sent.push(m);
      const next = results[sent.length - 1];
      if (next instanceof Error) throw next;
      return next ?? { sent: true, id: `em_${sent.length}` };
    };
    return { sent, send };
  };
  const env = {
    BOOKINGS_EMAIL_TO: `${TEAM}, other@example.com`,
    RESEND_API_KEY: 're_x',
    EMAIL_FROM: 'onboarding@resend.dev',
    STRIPE_SECRET_KEY: 'sk_test_x',
  };
  const pause = async () => undefined;

  beforeAll(async () => {
    const [r] = await db
      .insert(routes)
      .values({
        slug,
        name: 'West → East',
        pickupRegion: 'west',
        deliveryRegion: 'east',
        weeklyCapacity: 12,
      })
      .returning({ id: routes.id });
    routeId = r.id;
  });
  afterAll(async () => {
    if (leadIds.length) for (const id of leadIds) await db.delete(leads).where(eq(leads.id, id));
    for (const id of bookingIds) await db.delete(bookings).where(eq(bookings.id, id));
    await db.delete(routes).where(eq(routes.id, routeId));
    await pool.end();
  });

  describe('submitDetails', () => {
    it('saves the details and completes a paid booking', async () => {
      const b = await booking();
      const r = await submitDetails(db, b.publicToken, input(), regionOfZip);
      expect(r.ok).toBe(true);
      const saved = await row(b.id);
      expect(saved).toMatchObject({ status: 'completed', notes: 'Gate code 1234' });
      expect(saved.detailsSubmittedAt).toBeInstanceOf(Date);
      expect(saved.customer).toEqual({
        firstName: 'Pat',
        lastName: 'Driver',
        phone: '951-555-0100',
        email: 'pat@example.com',
        address: addr('92881'),
      });
      expect(saved.pickupAddress).toEqual(addr('90001'));
      if (r.ok)
        expect(r.confirmation).toMatchObject({
          vehicle: '2021 Toyota RAV4',
          routeName: 'West → East',
          pickupPlace: 'Los Angeles, CA',
          deliveryPlace: 'Baltimore, MD',
          firstName: 'Pat',
          balanceCents: 112500,
        });
    });

    it('lets the ZIP be refined inside the quoted region', async () => {
      const b = await booking();
      expect(
        (
          await submitDetails(
            db,
            b.publicToken,
            input({ pickupAddress: addr('92881') }),
            regionOfZip,
          )
        ).ok,
      ).toBe(true);
      expect((await row(b.id)).pickupAddress?.zip).toBe('92881');
    });

    it('blocks a ZIP in the wrong region, or one we do not serve, and changes nothing', async () => {
      const b = await booking();
      const east = await submitDetails(
        db,
        b.publicToken,
        input({ pickupAddress: addr('21201') }),
        regionOfZip,
      );
      expect(east).toMatchObject({
        ok: false,
        status: 422,
        reason: 'pickup_region',
        field: 'pickupAddress.zip',
      });
      expect(!east.ok && east.error).toMatch(/must stay in our West region/);
      expect(
        await submitDetails(
          db,
          b.publicToken,
          input({ deliveryAddress: { ...addr('90001') } }),
          regionOfZip,
        ),
      ).toMatchObject({
        ok: false,
        status: 422,
        reason: 'delivery_region',
        field: 'deliveryAddress.zip',
      });
      expect(
        await submitDetails(
          db,
          b.publicToken,
          input({ pickupAddress: addr('10001') }),
          regionOfZip,
        ),
      ).toMatchObject({ ok: false, reason: 'pickup_region' });
      expect(await row(b.id)).toMatchObject({ status: 'paid', customer: null });
    });

    describe('address consistency', () => {
      const MOUNT_AIRY =
        "That city doesn't match ZIP 21771 (Mount Airy, MD). Please check your address.";

      it('derives the state from the ZIP: a forged state is ignored, so Maryland can never be saved as California', async () => {
        const b = await booking();
        // The reported case: delivery ZIP 21771 (Mount Airy, MD) with the state set to California.
        const r = await submitDetails(
          db,
          b.publicToken,
          input({ deliveryAddress: { ...addr('21771'), state: 'CA' } }),
          regionOfZip,
        );
        expect(r.ok).toBe(true);
        const saved = await row(b.id);
        expect(saved.deliveryAddress).toMatchObject({
          city: 'Mount Airy',
          state: 'MD',
          zip: '21771',
        });
        expect(saved.pickupAddress?.state).toBe('CA'); // derived for every address
        expect(saved.customer?.address?.state).toBe('CA');
        expect(saved.needsReview).toBe(false);
      });

      it('derives the state even when the browser sends none', async () => {
        const b = await booking();
        const noState = { street: '1 Main St', city: 'Mount Airy', zip: '21771' };
        const r = await submitDetails(
          db,
          b.publicToken,
          input({ deliveryAddress: noState }),
          regionOfZip,
        );
        expect(r.ok).toBe(true);
        expect((await row(b.id)).deliveryAddress?.state).toBe('MD');
      });

      it('blocks a city that does not match the ZIP, with the agreed message, and changes nothing', async () => {
        const b = await booking();
        const r = await submitDetails(
          db,
          b.publicToken,
          input({ deliveryAddress: { ...addr('21771'), city: 'Los Angeles', state: 'CA' } }),
          regionOfZip,
        );
        expect(r).toMatchObject({
          ok: false,
          status: 422,
          reason: 'city_zip_mismatch',
          field: 'deliveryAddress.city',
          error: MOUNT_AIRY,
          mismatches: [{ field: 'deliveryAddress.city', message: MOUNT_AIRY }],
        });
        expect(await row(b.id)).toMatchObject({
          status: 'paid',
          customer: null,
          needsReview: false,
        });
      });

      it('lists every mismatching address at once', async () => {
        const b = await booking();
        const r = await submitDetails(
          db,
          b.publicToken,
          input({
            address: { ...addr('92881'), city: 'Springfield' },
            deliveryAddress: { ...addr('21771'), city: 'Elsewhere' },
          }),
          regionOfZip,
        );
        expect(!r.ok && r.mismatches?.map((m) => m.field)).toEqual([
          'address.city',
          'deliveryAddress.city',
        ]);
      });

      it('accepts spelling variants of the same city (Mt. and Mount, any case)', async () => {
        const b = await booking();
        const r = await submitDetails(
          db,
          b.publicToken,
          input({ deliveryAddress: { ...addr('21771'), city: 'mt. airy' } }),
          regionOfZip,
        );
        expect(r.ok).toBe(true);
        expect((await row(b.id)).needsReview).toBe(false);
      });

      it('lets a confirmed city through, flags the booking for review, and keeps the derived state', async () => {
        const b = await booking();
        const r = await submitDetails(
          db,
          b.publicToken,
          input({
            deliveryAddress: { ...addr('21771'), city: 'Parrs Ridge', state: 'CA' },
            confirmAddresses: true,
          }),
          regionOfZip,
        );
        expect(r.ok).toBe(true);
        const saved = await row(b.id);
        expect(saved).toMatchObject({
          status: 'completed',
          needsReview: true,
          reviewReason: 'city/ZIP mismatch',
        });
        expect(saved.deliveryAddress).toMatchObject({ city: 'Parrs Ridge', state: 'MD' });
        expect(saved.addressFlags).toEqual([
          'Delivery address: city "Parrs Ridge" does not match ZIP 21771 (Mount Airy, MD). The customer confirmed it is correct.',
        ]);
      });

      it('adds to an existing review reason instead of replacing it', async () => {
        const b = await booking('paid', {
          needsReview: true,
          reviewReason: "vehicle not recognized: 'zzz thing'",
        });
        await submitDetails(
          db,
          b.publicToken,
          input({
            pickupAddress: { ...addr('90001'), city: 'Somewhere' },
            confirmAddresses: true,
          }),
          regionOfZip,
        );
        expect((await row(b.id)).reviewReason).toBe(
          "vehicle not recognized: 'zzz thing'; city/ZIP mismatch",
        );
      });

      it('does nothing special when "confirm" is sent but every city matches', async () => {
        const b = await booking();
        await submitDetails(db, b.publicToken, input({ confirmAddresses: true }), regionOfZip);
        expect(await row(b.id)).toMatchObject({
          status: 'completed',
          needsReview: false,
          reviewReason: null,
          addressFlags: null,
        });
      });

      it('still rejects a ZIP that is not in the quoted region, whatever else is sent', async () => {
        const b = await booking();
        expect(
          await submitDetails(
            db,
            b.publicToken,
            input({ deliveryAddress: addr('90210'), confirmAddresses: true }),
            regionOfZip,
          ),
        ).toMatchObject({ ok: false, reason: 'delivery_region' });
        expect(
          await submitDetails(
            db,
            b.publicToken,
            input({ pickupAddress: addr('21771'), confirmAddresses: true }),
            regionOfZip,
          ),
        ).toMatchObject({ ok: false, reason: 'pickup_region' });
        expect((await row(b.id)).status).toBe('paid');
      });
    });

    it('rejects a booking that is not paid, and one that does not exist', async () => {
      for (const status of ['held', 'cancelled'] as const) {
        const b = await booking(status);
        expect(await submitDetails(db, b.publicToken, input(), regionOfZip)).toMatchObject({
          ok: false,
          status: 409,
          reason: 'not_paid',
        });
        expect((await row(b.id)).status).toBe(status);
      }
      expect(
        await submitDetails(db, 'no-such-token-0000000000', input(), regionOfZip),
      ).toMatchObject({ ok: false, status: 404, reason: 'not_found' });
    });

    it('rejects a second submit', async () => {
      const b = await booking();
      expect((await submitDetails(db, b.publicToken, input(), regionOfZip)).ok).toBe(true);
      const again = await submitDetails(
        db,
        b.publicToken,
        input({ firstName: 'Other' }),
        regionOfZip,
      );
      expect(again).toMatchObject({ ok: false, status: 409, reason: 'already_submitted' });
      expect((await row(b.id)).customer?.firstName).toBe('Pat');
    });

    it('lets exactly one of two simultaneous submits win', async () => {
      const b = await booking();
      const results = await Promise.all([
        submitDetails(db, b.publicToken, input({ firstName: 'First' }), regionOfZip),
        submitDetails(db, b.publicToken, input({ firstName: 'Second' }), regionOfZip),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        status: 409,
        reason: 'already_submitted',
      });
      const winner = results.find((r) => r.ok);
      expect((await row(b.id)).customer?.firstName).toBe(
        winner && winner.ok ? winner.booking.customer?.firstName : '?',
      );
    });
  });

  describe('spotNumber', () => {
    it('numbers bookings by payment time', async () => {
      const t = Date.now();
      const early = await booking('paid', { paidAt: new Date(t - 3000) });
      const late = await booking('paid', { paidAt: new Date(t - 1000) });
      const mid = await booking('completed', { paidAt: new Date(t - 2000) });
      expect(await spotNumber(db, late)).toBeGreaterThan(await spotNumber(db, mid));
      expect(await spotNumber(db, mid)).toBeGreaterThan(await spotNumber(db, early));
      expect(await spotNumber(db, { ...early, paidAt: null })).toBe(1);
    });
  });

  describe('sendBookingEmails', () => {
    async function completed(over: Partial<typeof bookings.$inferInsert> = {}) {
      const b = await booking('paid', over);
      await submitDetails(db, b.publicToken, input(), regionOfZip);
      return b;
    }

    it('sends the team email and the confirmation, and records both', async () => {
      const b = await completed({ topDeck: true });
      const f = fakeSend();
      const out = await sendBookingEmails(db, b.id, { send: f.send, env, pause });
      expect(out).toMatchObject({ team: { sent: true }, customer: { sent: true } });
      expect(f.sent).toHaveLength(2);
      const [team, customer] = f.sent;
      expect(team.to).toEqual([TEAM, 'other@example.com']);
      expect(team.subject).toMatch(
        /^New Booking: 2021 Toyota RAV4 · West → East · Week of .+ · Deposit Paid$/,
      );
      expect(team.replyTo).toBe('pat@example.com');
      expect(team.text).toMatch(/Pickup week: .+ \(spot \d+ of 12\)/);
      expect(team.text).toContain('Load type: TOP DECK LOAD');
      expect(customer.to).toBe('pat@example.com');
      expect(customer.replyTo).toEqual([TEAM, 'other@example.com']); // replies reach the dispatcher
      expect(customer.subject).toMatch(/^Your 951 Express booking is confirmed · Week of /);
      expect(customer.text).toContain('Eliminates the possibility of oil leaks');
      const saved = await row(b.id);
      expect(saved.teamEmailSentAt).toBeInstanceOf(Date);
      expect(saved.customerEmailSentAt).toBeInstanceOf(Date);
      expect(saved.emailError).toBeNull();
      expect(saved.status).toBe('completed');
    });

    it('attaches the dispatch sheet to the team email only, named for the booking and vehicle', async () => {
      const b = await booking('paid');
      await submitDetails(
        db,
        b.publicToken,
        input({
          vehicleColor: 'Midnight blue',
          vin: '1GNSKCKD5MR123456',
          deliveryContact: { name: 'Sam Receiver', phone: '301-555-0122' },
        }),
        regionOfZip,
      );
      const saved = await row(b.id);
      expect(saved).toMatchObject({
        vehicleColor: 'Midnight blue',
        vehicleVin: '1GNSKCKD5MR123456',
        pickupContact: null,
        deliveryContact: { name: 'Sam Receiver', phone: '301-555-0122' },
      });
      const f = fakeSend();
      await sendBookingEmails(db, b.id, { send: f.send, env, pause });
      const [team, customer] = f.sent;
      expect(team.attachments).toHaveLength(1);
      expect(team.attachments![0].filename).toBe(
        `951-Express-Dispatch-${b.id.replace(/-/g, '').slice(0, 8).toUpperCase()}-2021-Toyota-RAV4.pdf`,
      );
      expect(team.attachments![0].content.subarray(0, 5).toString()).toBe('%PDF-');
      expect(customer.attachments).toBeUndefined();
    });

    it('sends the team email without the sheet, and logs the error, when the sheet cannot be made', async () => {
      const b = await completed();
      const f = fakeSend();
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const out = await sendBookingEmails(db, b.id, {
        send: f.send,
        env,
        pause,
        makePdf: async () => {
          throw new Error('font exploded');
        },
      });
      expect(out).toMatchObject({ team: { sent: true }, customer: { sent: true } });
      expect(f.sent[0].attachments).toBeUndefined();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('[dispatch pdf]'));
      expect((await row(b.id)).emailError).toBeNull(); // the email itself went out
      log.mockRestore();
    });

    it('puts a Review needed banner on flagged bookings', async () => {
      const b = await completed({ needsReview: true, sizeClassSource: 'customer' });
      const f = fakeSend();
      await sendBookingEmails(db, b.id, { send: f.send, env, pause });
      expect(f.sent[0].text).toMatch(/^REVIEW NEEDED/);
      expect(f.sent[0].html).toContain('Review needed');
    });

    it('keeps the booking and records the error when the customer email is refused', async () => {
      const b = await completed();
      const f = fakeSend([
        { sent: true, id: 'em_1' },
        {
          sent: false,
          reason: 'failed',
          error: 'Resend 403: You can only send testing emails to your own email address.',
        },
      ]);
      const out = await sendBookingEmails(db, b.id, { send: f.send, env, pause });
      expect(out).toMatchObject({ team: { sent: true }, customer: { sent: false } });
      const saved = await row(b.id);
      expect(saved.status).toBe('completed');
      expect(saved.teamEmailSentAt).toBeInstanceOf(Date);
      expect(saved.customerEmailSentAt).toBeNull();
      expect(saved.emailError).toBe(
        'customer: Resend 403: You can only send testing emails to your own email address.',
      );
    });

    it('records both errors when everything fails', async () => {
      const b = await completed();
      const f = fakeSend([
        { sent: false, reason: 'failed', error: 'down' },
        { sent: false, reason: 'failed', error: 'down' },
      ]);
      await sendBookingEmails(db, b.id, { send: f.send, env, pause });
      expect(await row(b.id)).toMatchObject({
        status: 'completed',
        teamEmailSentAt: null,
        customerEmailSentAt: null,
        emailError: 'team: down | customer: down',
      });
    });

    it('never throws, even when the sender does', async () => {
      const b = await completed();
      const f = fakeSend([new Error('socket hang up')]);
      expect(await sendBookingEmails(db, b.id, { send: f.send, env, pause })).toBeNull();
      expect(await row(b.id)).toMatchObject({
        status: 'completed',
        emailError: 'Email step failed: socket hang up',
      });
    });

    it('records "not configured" and an unset team inbox', async () => {
      const b = await completed();
      const real = await sendBookingEmails(db, b.id, { env: {}, pause });
      expect(real).toMatchObject({
        team: { sent: false },
        customer: { sent: false, reason: 'not_configured' },
      });
      expect((await row(b.id)).emailError).toMatch(
        /team: BOOKINGS_EMAIL_TO is not set \| customer: Email is not configured/,
      );
      expect((await row(b.id)).status).toBe('completed');
    });

    it('reports a booking without details, and a missing booking', async () => {
      const b = await booking('paid');
      expect(await sendBookingEmails(db, b.id, { send: fakeSend().send, env, pause })).toBeNull();
      expect((await row(b.id)).emailError).toBe('Booking is missing its details');
      expect(
        await sendBookingEmails(db, '00000000-0000-4000-8000-000000000000', {
          send: fakeSend().send,
          env,
          pause,
        }),
      ).toBeNull();
    });
  });

  describe('sendLeadEmail', () => {
    async function lead() {
      const [l] = await db
        .insert(leads)
        .values({
          routeId,
          pickupZip: '90001',
          deliveryZip: '21201',
          vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' },
          operable: true,
          modified: true,
          highValue: false,
          quoteReasons: ['large_vehicle', 'modified'],
          modificationDetails: '5-inch lift, 35-inch tires',
          name: 'Lee Large',
          phone: '555-0100',
          email: 'lee@example.com',
          preferredWeekStart: week.start,
        })
        .returning();
      leadIds.push(l.id);
      return l;
    }
    const leadRow = async (id: string) =>
      (await db.select().from(leads).where(eq(leads.id, id)))[0];

    it('emails the team and records it', async () => {
      const l = await lead();
      const f = fakeSend();
      expect(await sendLeadEmail(db, l.id, { send: f.send, env })).toMatchObject({ sent: true });
      expect(f.sent[0]).toMatchObject({
        to: [TEAM, 'other@example.com'],
        subject: 'Quote request (large vehicle, modified): 2021 Chevrolet Tahoe · West → East',
        replyTo: 'lee@example.com',
      });
      expect(f.sent[0].text).toContain('Preferred pickup week:');
      expect(await leadRow(l.id)).toMatchObject({ emailError: null });
      expect((await leadRow(l.id)).emailSentAt).toBeInstanceOf(Date);
    });

    it('keeps the lead and records the error when sending fails or throws', async () => {
      const l = await lead();
      await sendLeadEmail(db, l.id, {
        send: fakeSend([{ sent: false, reason: 'failed', error: 'Resend 500: request failed' }])
          .send,
        env,
      });
      expect(await leadRow(l.id)).toMatchObject({
        emailSentAt: null,
        emailError: 'Resend 500: request failed',
        status: 'new',
      });
      expect(
        await sendLeadEmail(db, l.id, { send: fakeSend([new Error('boom')]).send, env }),
      ).toBeNull();
      expect((await leadRow(l.id)).emailError).toBe('Email step failed: boom');
      expect(
        await sendLeadEmail(db, l.id, { env: { RESEND_API_KEY: '', EMAIL_FROM: '' } }),
      ).toMatchObject({ sent: false });
      expect(
        await sendLeadEmail(db, '00000000-0000-4000-8000-000000000000', {
          send: fakeSend().send,
          env,
        }),
      ).toBeNull();
    });
  });
});
