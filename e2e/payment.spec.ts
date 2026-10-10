import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { and, desc, eq, gte } from 'drizzle-orm';
import Stripe from 'stripe';
import { createDb } from '../src/db';
import { bookings, routes, weekOverrides } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import { asNewVisitor, dialog, mockVpic, openModal, reachSummary } from './helpers';

// Real Stripe test mode, with `stripe listen` forwarding webhooks to the app. Run: npm run e2e:stripe
// Uses the DATABASE_URL in .env.local: a Neon dev branch only.
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const weeks = bookableWeeks();
const startedAt = new Date();
let routeId = 0;

const latestBooking = async (weekStart: string) =>
  (
    await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.routeId, routeId),
          eq(bookings.weekStart, weekStart),
          gte(bookings.createdAt, startedAt),
        ),
      )
      .orderBy(desc(bookings.createdAt))
  )[0];

async function waitForStatus(weekStart: string, status: string, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const b = await latestBooking(weekStart);
    if (b?.status === status) return b;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`booking never became ${status}: ${(await latestBooking(weekStart))?.status}`);
}

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
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await mockVpic(page);
  await openModal(page);
});

const checkoutFrame = (page: Page): FrameLocator =>
  dialog(page).getByTestId('embedded-checkout').frameLocator('iframe').first();

async function startPayment(page: Page, week: string) {
  await reachSummary(page, { week });
  await dialog(page).getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Pay your deposit' })).toBeVisible();
  await checkoutFrame(page).getByPlaceholder('1234 1234 1234 1234').waitFor({ timeout: 30_000 });
}

/** Link's "Save my information" is on by default and then asks for a phone number, so untick it (it can reset). */
async function untickSaveMyInfo(f: FrameLocator) {
  const box = f.locator('#enableStripePass');
  // Stripe can re-tick it while it looks up the email in Link, so retry until it sticks.
  await expect(async () => {
    if (await box.isChecked()) await f.getByText('Save my information for faster checkout').click();
    await expect(box).not.toBeChecked({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

async function payWith(page: Page, card: string) {
  const f = checkoutFrame(page);
  await f.getByPlaceholder('email@example.com').fill('e2e-buyer@example.com');
  await f.getByPlaceholder('1234 1234 1234 1234').fill(card);
  await f.getByPlaceholder('MM / YY').fill('12 / 34');
  await f.getByPlaceholder('CVC').fill('123');
  await f.getByPlaceholder('Full name on card').fill('E2E Buyer');
  await f.getByPlaceholder('ZIP').fill('90001');
  await untickSaveMyInfo(f);
  await f.getByTestId('hosted-payment-submit-button').click();
}

test('the cart shows the vehicle, totals, deposit, hold countdown, and embedded checkout @stripe', async ({
  page,
}) => {
  const week = weeks[1];
  await startPayment(page, week.label);
  const d = dialog(page);
  await expect(d.getByText('2020 Honda Civic')).toBeVisible();
  await expect(d.getByText('Transport total').locator('..')).toContainText('$1,400');
  await expect(d.getByText('Balance due at delivery').locator('..')).toContainText('$1,050');
  await expect(d.getByText('Deposit due today').locator('..')).toContainText('$350');
  await expect(d.getByText('Secure checkout · processed by Stripe')).toBeVisible();
  const timer = await d.getByRole('timer').innerText();
  const [m, s] = timer
    .match(/(\d+):(\d{2})/)!
    .slice(1)
    .map(Number);
  expect(m * 60 + s).toBeGreaterThan(29 * 60); // 30:10 at the start, minus a few seconds
  expect(m * 60 + s).toBeLessThanOrEqual(30 * 60 + 11); // session expiry is 30:10 out, shown rounded up

  const b = await latestBooking(week.start);
  expect(b).toMatchObject({ status: 'held', depositCents: 35000 });
  const session = await stripe.checkout.sessions.retrieve(b.stripeSessionId!);
  expect(session).toMatchObject({
    ui_mode: 'embedded_page',
    mode: 'payment',
    amount_total: 35000,
    metadata: { bookingId: b.id },
  });
  expect(session.expires_at).toBe(Math.floor(b.holdExpiresAt!.getTime() / 1000));
});

test('4242 pays: the booking is marked paid, the modal advances, and a replayed webhook changes nothing @stripe', async ({
  page,
  request,
}) => {
  const week = weeks[2];
  await startPayment(page, week.label);
  await payWith(page, '4242424242424242');
  await expect(
    dialog(page).getByText(`✓ Deposit received. Your spot for ${week.label} is reserved.`),
  ).toBeVisible({ timeout: 60_000 });

  const paid = await waitForStatus(week.start, 'paid');
  expect(paid).toMatchObject({ payerEmail: 'e2e-buyer@example.com', needsReview: false });
  expect(paid.paidAt).toBeInstanceOf(Date);
  expect(paid.stripePaymentIntent).toMatch(/^pi_/);

  const avail = await (await request.get('/api/availability?route=west-to-east')).json();
  expect(avail.weeks.find((w: { start: string }) => w.start === week.start)).toMatchObject({
    taken: 1,
    remaining: 11,
  });

  // Replay the real event, correctly signed, straight at the endpoint.
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 20 });
  const event = events.data.find(
    (e) => (e.data.object as { id: string }).id === paid.stripeSessionId,
  )!;
  expect(event).toBeTruthy();
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  const replay = await request.post('/api/stripe/webhook', {
    data: payload,
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
  });
  expect(await replay.json()).toMatchObject({ received: true, handled: 'paid', changed: false });
  const after = await latestBooking(week.start);
  expect(after.paidAt).toEqual(paid.paidAt);
  expect(after.status).toBe('paid');
});

test('4000 0000 0000 0002 is declined and the hold is kept (session open, booking held) @stripe', async ({
  page,
}) => {
  const week = weeks[3];
  await startPayment(page, week.label);
  await payWith(page, '4000000000000002');
  await expect(
    checkoutFrame(page)
      .getByText(/declined/i)
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  const d = dialog(page);
  await expect(d.getByRole('heading', { name: 'Pay your deposit' })).toBeVisible();
  await expect(d.getByRole('timer')).toBeVisible();
  const held = await latestBooking(week.start);
  expect(held.status).toBe('held');
  expect(held.holdExpiresAt!.getTime()).toBeGreaterThan(Date.now());

  // The session is still open and unpaid, so the customer can try another card.
  const session = await stripe.checkout.sessions.retrieve(held.stripeSessionId!);
  expect(session).toMatchObject({ status: 'open', payment_status: 'unpaid' });
  expect((await latestBooking(week.start)).status).toBe('held');
});

test('an expired session releases the spot (via the real expired webhook) @stripe', async ({
  page,
  request,
}) => {
  const week = weeks[4];
  await startPayment(page, week.label);
  const held = await latestBooking(week.start);
  const before = await (await request.get('/api/availability?route=west-to-east')).json();
  expect(before.weeks.find((w: { start: string }) => w.start === week.start)).toMatchObject({
    taken: 1,
    remaining: 11,
  });

  await stripe.checkout.sessions.expire(held.stripeSessionId!); // what happens at the end of the hold
  const expired = await waitForStatus(week.start, 'expired');
  expect(expired.id).toBe(held.id);

  const after = await (await request.get('/api/availability?route=west-to-east')).json();
  expect(after.weeks.find((w: { start: string }) => w.start === week.start)).toMatchObject({
    taken: 0,
    remaining: 12,
  });
});

test('closing the window mid-payment releases the hold at once @stripe', async ({
  page,
  request,
}) => {
  const week = weeks[5];
  await startPayment(page, week.label);
  const held = await latestBooking(week.start);
  await page.keyboard.press('Escape');
  await expect(dialog(page).getByRole('alertdialog')).toContainText(
    'Your spot is only held while you finish paying',
  );
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(dialog(page)).toBeHidden();

  const released = await waitForStatus(week.start, 'cancelled');
  expect(released.id).toBe(held.id);
  expect((await stripe.checkout.sessions.retrieve(held.stripeSessionId!)).status).toBe('expired');
  const avail = await (await request.get('/api/availability?route=west-to-east')).json();
  expect(avail.weeks.find((w: { start: string }) => w.start === week.start)).toMatchObject({
    taken: 0,
    remaining: 12,
  });
});

test('a week that fills between the quote and the hold offers the next week @stripe', async ({
  page,
}) => {
  const week = weeks[6];
  const next = weeks[7];
  await db.insert(weekOverrides).values({ routeId, weekStart: week.start, capacityOverride: 1 });
  await reachSummary(page, { week: week.label });
  // someone else takes the last spot after the quote was shown
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
    depositCents: 35000,
    balanceCents: 105000,
    termsVersion: 'e2e',
    termsAcceptedAt: new Date(),
  });
  const d = dialog(page);
  await d.getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(d.getByRole('alert')).toContainText('That pickup week just filled up.');
  await expect(d.getByRole('alert')).toContainText(`The next available week is ${next.label}.`);
  await d.getByRole('button', { name: `Use ${next.label}` }).click();
  await expect(d.getByText(next.label).first()).toBeVisible();
  await expect(d.getByRole('button', { name: 'Continue to secure payment' })).toBeEnabled();
  await d.getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(d.getByRole('heading', { name: 'Pay your deposit' })).toBeVisible();
  expect((await latestBooking(next.start)).status).toBe('held');
});

// Stripe's embedded checkout stalled when the modal was tall (phones and big monitors), so pay in those sizes too.
for (const size of [
  { width: 390, height: 844 },
  { width: 390, height: 932 },
  { width: 1280, height: 1000 },
]) {
  test(`4242 pays in a ${size.width}x${size.height} window @stripe`, async ({ page }) => {
    await page.setViewportSize(size);
    const week = weeks[3];
    await startPayment(page, week.label);
    await payWith(page, '4242424242424242');
    await expect(dialog(page).getByText(/Deposit received/)).toBeVisible({ timeout: 60_000 });
    await waitForStatus(week.start, 'paid');
  });
}
