import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { and, desc, eq, gte } from 'drizzle-orm';
import Stripe from 'stripe';
import { createDb } from '../src/db';
import { bookings, routes, weekOverrides } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import {
  asNewVisitor,
  dialog,
  expectAccessible,
  fillDetails,
  openModal,
  reachSummary,
  untickSaveWithLink,
} from './helpers';

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

async function payWith(page: Page, card: string, email = 'e2e-buyer@example.com') {
  const f = checkoutFrame(page);
  await f.getByPlaceholder('email@example.com').fill(email);
  await f.getByPlaceholder('1234 1234 1234 1234').fill(card);
  await f.getByPlaceholder('MM / YY').fill('12 / 34');
  await f.getByPlaceholder('CVC').fill('123');
  await f.getByPlaceholder('Full name on card').fill('E2E Buyer');
  await f.getByPlaceholder('ZIP').fill('90001');
  await untickSaveWithLink(f);
  await f.getByTestId('hosted-payment-submit-button').click();
}

// Only two tests use Stripe's real embedded checkout (an iframe we do not control, which sometimes stalls in
// automated browsers). Everything else about payments runs without the iframe in e2e/stripe-api.spec.ts, with signed
// webhook events. These two run one after the other, never in parallel, with one retry.
test.describe.configure({ mode: 'serial', retries: 1 });

test.describe('phone, 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('4242 pays: cart, payment, Step 3 and the confirmation, in one pass @stripe-ui', async ({
    page,
    request,
  }) => {
    const week = weeks[1];
    await startPayment(page, week.label);

    // The cart, before paying.
    const d = dialog(page);
    await expect(d.getByText('2020 Honda Civic')).toBeVisible();
    await expect(d.getByText('Transport total').locator('..')).toContainText('$1,400');
    await expect(
      d.getByText('Balance due at delivery', { exact: true }).locator('..'),
    ).toContainText('$1,300');
    await expect(d.getByText('Deposit due today').locator('..')).toContainText('$100');
    await expect(d.getByText('Secure checkout · processed by Stripe')).toBeVisible();
    await expect(page.getByTestId('balance-message')).toHaveText(
      "Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
    );
    await expect(page.getByTestId('delivery-estimate')).toHaveText(
      'Estimated delivery: 7–10 days after pickup',
    );
    const timer = await d.getByRole('timer').innerText();
    const [m, s] = timer
      .match(/(\d+):(\d{2})/)!
      .slice(1)
      .map(Number);
    expect(m * 60 + s).toBeGreaterThan(29 * 60);
    expect(m * 60 + s).toBeLessThanOrEqual(30 * 60 + 11);
    // No axe scan here: scanning the page while Stripe's frame is live makes the payment stall more often.
    // The payment step's accessibility is checked in the last test, which never pays.
    const held = await latestBooking(week.start);
    expect(held).toMatchObject({ status: 'held', depositCents: 10000 });

    // Pay.
    await payWith(page, '4242424242424242');
    await expect(
      d.getByText(`✓ Deposit received. Your spot for ${week.label} is reserved.`),
    ).toBeVisible({ timeout: 60_000 });
    const paid = await waitForStatus(week.start, 'paid');
    expect(paid.paidAt).toBeInstanceOf(Date);
    expect(paid.stripePaymentIntent).toMatch(/^pi_/);
    const avail = await (await request.get('/api/availability?route=west-to-east')).json();
    expect(avail.weeks.find((w: { start: string }) => w.start === week.start)).toMatchObject({
      taken: 1,
      remaining: 5,
    });

    // Step 3, inside the modal.
    await expect(d.getByLabel('Email')).toHaveValue('e2e-buyer@example.com'); // prefilled from Stripe
    await expect(d.getByRole('group', { name: 'Pickup address' }).getByLabel('ZIP')).toHaveValue(
      '90001',
    );
    await expectAccessible(page, 'step 3 in the modal', 'dialog[open]');
    await fillDetails(d);
    await d.getByRole('button', { name: 'Finish my booking' }).click();
    await expect(d.getByText("✓ You're booked!")).toBeVisible();
    await expect(d.getByTestId('balance-message')).toHaveText(
      "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
    );
    await expectAccessible(page, 'booked confirmation in the modal', 'dialog[open]');
    const done = await waitForStatus(week.start, 'completed');
    expect(done.customer).toMatchObject({ firstName: 'Pat', email: 'e2e-buyer@example.com' });
    expect(done.notes).toBe('Gate code 1234');
  });
});

test.describe('desktop, 1280x900', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('4000 0000 0000 0002 is declined and the hold is kept @stripe-ui', async ({ page }) => {
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
  });
});

// Last on purpose, and it never pays: axe walks into frames, and a scan while Stripe's checkout is live can upset
// Stripe's invisible captcha, which would make a real payment stall. Stripe's own frame is excluded from the scan.
test('the payment step (cart and countdown) is accessible @stripe-ui', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startPayment(page, weeks[2].label);
  await expectAccessible(page, 'payment step (cart and countdown)', 'dialog[open]');
});
