import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/db';
import { bookings, routes } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import { asNewVisitor } from './helpers';

// Step 3 on the /booking/[token] page, with bookings seeded as already paid (no Stripe). Resend is off for this suite,
// so completing a booking also proves that a failed email never breaks it.
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const week = bookableWeeks()[1];
const ids: string[] = [];
let routeId = 0;

async function seed(status: 'paid' | 'held' | 'completed' = 'paid') {
  const token = `e2e-details-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [b] = await db
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
      topDeck: true,
      personalItems: true,
      sizeClass: 'small-suv',
      sizeClassSource: 'table',
      totalCents: 165000,
      depositCents: 10000,
      balanceCents: 155000,
      termsVersion: 'e2e',
      termsAcceptedAt: new Date(),
      paidAt: status === 'held' ? null : new Date(),
      payerEmail: 'payer@example.com',
      ...(status === 'completed'
        ? {
            customer: {
              firstName: 'Pat',
              lastName: 'Driver',
              phone: '951-555-0100',
              email: 'pat@example.com',
            },
            pickupAddress: { street: '1 A', city: 'Corona', state: 'CA', zip: '92881' },
            deliveryAddress: { street: '2 B', city: 'Baltimore', state: 'MD', zip: '21201' },
          }
        : {}),
    })
    .returning();
  ids.push(b.id);
  return b;
}
const row = async (id: string) => (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

test.beforeAll(async () => {
  const [r] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  routeId = r.id;
});
test.afterAll(async () => {
  if (ids.length) await db.delete(bookings).where(inArray(bookings.id, ids));
  await pool.end();
});
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
});

const group = (page: Page, name: string) => page.getByRole('group', { name });
async function axeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `axe violations (${label})`,
  ).toEqual([]);
}

async function fillValid(page: Page) {
  await page.getByLabel('First name').fill('Pat');
  await page.getByLabel('Last name').fill('Driver');
  await page.getByLabel('Phone').fill('951-555-0100');
  const home = group(page, 'Your address');
  await home.getByLabel('Street address').fill('1 Main St');
  await home.getByLabel('ZIP').fill('92881');
  await expect(home.getByLabel('City')).toHaveValue('Corona'); // from the ZIP
  const pick = group(page, 'Pickup address');
  await pick.getByLabel('Street address').fill('77 Sunset Blvd');
  const del = group(page, 'Delivery address');
  await del.getByLabel('Street address').fill('9 Pier Rd');
  await page.getByLabel('Notes for the driver (optional)').fill('Gate code 1234');
}

test('the fallback page shows Step 3 with the email prefilled and the ZIPs locked to the quote', async ({
  page,
}) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await expect(
    page.getByText(`✓ Deposit received. Your spot for ${week.label} is reserved.`),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('payer@example.com');
  await expect(group(page, 'Pickup address').getByLabel('ZIP')).toHaveValue('90001');
  await expect(group(page, 'Delivery address').getByLabel('ZIP')).toHaveValue('21201');
  await expect(
    page.getByText('Quoted for 90001. You can refine it within our West region.'),
  ).toBeVisible();
  await expect(
    page.getByText('Quoted for 21201. You can refine it within our East region.'),
  ).toBeVisible();
  // The city is suggested from the ZIP, and the state comes from the ZIP and cannot be typed.
  await expect(group(page, 'Pickup address').getByLabel('City')).toHaveValue('Los Angeles');
  await expect(group(page, 'Pickup address').getByLabel('State')).toHaveValue(
    'California, from your ZIP',
  );
  await expect(group(page, 'Pickup address').getByLabel('State')).toHaveAttribute('readonly', '');
  await expect(page.getByTestId('pickup-place')).toHaveText(
    'Pickup: Los Angeles, CA · West region',
  );
  await expect(page.getByTestId('delivery-place')).toHaveText(
    'Delivery: Baltimore, MD · East region',
  );
  await expect(group(page, 'Delivery address').getByLabel('City')).toHaveValue('Baltimore');
  await axeClean(page, 'step 3 form');
});

test('required fields and bad input are flagged and nothing is saved', async ({ page }) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await page.getByLabel('Phone').fill('555');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please fix the highlighted fields.' }),
  ).toBeVisible();
  await expect(page.getByText('Enter a phone number with area code.')).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveAttribute('aria-invalid', 'true');
  await axeClean(page, 'step 3 form with errors');
  expect((await row(b.id)).status).toBe('paid');
});

test('a pickup ZIP in the other region is blocked, and so is a ZIP we do not serve', async ({
  page,
}) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  const pickZip = group(page, 'Pickup address').getByLabel('ZIP');
  await pickZip.fill('21201');
  await expect(
    page.getByText(
      'This ZIP is in our East region. Your pickup must stay in our West region, the one you got your quote for.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Please fix the highlighted fields.' }),
  ).toBeVisible();
  expect((await row(b.id)).status).toBe('paid');

  await pickZip.fill('10001');
  await expect(
    page.getByText(
      "We don't currently pick up or deliver in 10001. Your pickup must be in our West region.",
    ),
  ).toBeVisible();
  await pickZip.fill('90001');
  await expect(page.getByText(/must stay in our West region|don't currently/)).toHaveCount(0);

  const delZip = group(page, 'Delivery address').getByLabel('ZIP');
  await delZip.fill('90002');
  await expect(
    page.getByText(
      'This ZIP is in our West region. Your delivery must stay in our East region, the one you got your quote for.',
    ),
  ).toBeVisible();
});

test('completing Step 3 books it, survives a failed email, and cannot be submitted twice', async ({
  page,
  request,
}) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  // refine the pickup ZIP inside the West region
  await group(page, 'Pickup address').getByLabel('ZIP').fill('90210');
  await page.getByRole('button', { name: 'Finish my booking' }).click();

  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  await expect(page.getByTestId('balance-message')).toHaveText(
    "Balance due at delivery: Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.",
  );
  await expect(page.getByTestId('delivery-estimate')).toHaveText(
    'Estimated delivery: 7–10 days after pickup',
  );

  await expect(page.getByText(/Booking reference:/)).toBeVisible();
  await expect(page.getByText('2021 Toyota RAV4')).toBeVisible();
  await expect(page.getByText('Top Deck Load')).toBeVisible();
  await expect(page.getByText('$1,550')).toBeVisible();
  await expect(page.getByText('A confirmation is on its way to payer@example.com.')).toBeVisible();
  await axeClean(page, 'booked confirmation');

  const saved = await row(b.id);
  expect(saved).toMatchObject({ status: 'completed', notes: 'Gate code 1234' });
  expect(saved.customer).toMatchObject({
    firstName: 'Pat',
    email: 'payer@example.com',
    address: { zip: '92881' },
  });
  expect(saved.pickupAddress).toMatchObject({ street: '77 Sunset Blvd', zip: '90210' });
  expect(saved.detailsSubmittedAt).toBeInstanceOf(Date);

  // Resend is off here: the emails fail, and that is recorded without touching the booking.
  await expect
    .poll(async () => (await row(b.id)).emailError, { timeout: 20_000 })
    .toMatch(/not configured/i);
  expect((await row(b.id)).status).toBe('completed');

  // Reloading shows the confirmation; a second submit is refused.
  await page.reload();
  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  const again = await request.post(`/api/bookings/${b.publicToken}/details`, {
    data: {
      firstName: 'X',
      lastName: 'Y',
      phone: '951-555-0199',
      email: 'x@example.com',
      address: saved.pickupAddress,
      pickupAddress: saved.pickupAddress,
      deliveryAddress: saved.deliveryAddress,
    },
  });
  expect(again.status()).toBe(409);
  expect(await again.json()).toMatchObject({ reason: 'already_submitted' });
});

test('"Same as my address" copies the home address into pickup', async ({ page }) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  await page.getByRole('checkbox', { name: 'Same as my address' }).check();
  await expect(group(page, 'Pickup address').getByLabel('Street address')).toHaveValue('1 Main St');
  await expect(group(page, 'Pickup address').getByLabel('ZIP')).toHaveValue('92881');
  await expect(group(page, 'Pickup address').getByLabel('Street address')).toHaveAttribute(
    'readonly',
    '',
  );
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  expect((await row(b.id)).pickupAddress).toMatchObject({ street: '1 Main St', zip: '92881' });
});

test('an unpaid booking, a completed booking, and a bad link behave', async ({ page }) => {
  const held = await seed('held');
  await page.goto(`/booking/${held.publicToken}`);
  await expect(
    page.getByRole('heading', { name: "We haven't received your deposit yet" }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get My Instant Quote' })).toBeVisible();
  await axeClean(page, 'unpaid booking page');
  expect((await row(held.id)).status).toBe('held');

  const done = await seed('completed');
  await page.goto(`/booking/${done.publicToken}`);
  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  await expect(page.getByText('Corona, CA')).toBeVisible();
  await expect(page.getByText('A confirmation is on its way to pat@example.com.')).toBeVisible();

  await page.goto('/booking/not-a-real-token-xxxxxxxxxxxx');
  await expect(page.getByRole('heading', { name: 'Booking not found' })).toBeVisible();
  await axeClean(page, 'booking not found');
  await page.goto(`/booking/${done.publicToken}`);
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toMatch(/noindex/);
});

// The reported bug: a tester entered delivery ZIP 21771 (Mount Airy, MD) while the address said California, and the
// booking completed. The state now comes from the ZIP and cannot be typed.
test('the reported case is blocked: the state comes from the ZIP and cannot be typed', async ({
  page,
  request,
}) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  const del = group(page, 'Delivery address');
  await del.getByLabel('ZIP').fill('21771');
  await expect(del.getByLabel('City')).toHaveValue('Mount Airy');
  const state = del.getByLabel('State');
  await expect(state).toHaveValue('Maryland, from your ZIP');
  await expect(state).toHaveAttribute('readonly', '');
  await state.fill('California', { force: true }).catch(() => undefined); // typing is not possible
  await expect(state).toHaveValue('Maryland, from your ZIP');
  await expect(page.getByTestId('delivery-place')).toHaveText(
    'Delivery: Mount Airy, MD · East region',
  );
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  const saved = await row(b.id);
  expect(saved.deliveryAddress).toMatchObject({ city: 'Mount Airy', state: 'MD', zip: '21771' });
  expect(saved.needsReview).toBe(false);

  // Sending the old bad combination straight to the server changes nothing: the state is derived from the ZIP.
  const forged = await seed();
  const res = await request.post(`/api/bookings/${forged.publicToken}/details`, {
    data: {
      firstName: 'Tess',
      lastName: 'Tester',
      phone: '951-555-0100',
      email: 'tess@example.com',
      address: { street: '1 A', city: 'Corona', state: 'CA', zip: '92881' },
      pickupAddress: { street: '1 A', city: 'Los Angeles', state: 'CA', zip: '90001' },
      deliveryAddress: { street: '2 B', city: 'Mount Airy', state: 'CA', zip: '21771' },
    },
  });
  expect(res.status()).toBe(200);
  expect((await row(forged.id)).deliveryAddress).toMatchObject({ state: 'MD', zip: '21771' });
});

test('a city that does not match the ZIP is blocked with the agreed message, then fixed', async ({
  page,
}) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  const del = group(page, 'Delivery address');
  await del.getByLabel('ZIP').fill('21771');
  await expect(del.getByLabel('City')).toHaveValue('Mount Airy');
  await del.getByLabel('City').fill('Los Angeles');
  await page.getByRole('button', { name: 'Finish my booking' }).click();

  const message = "That city doesn't match ZIP 21771 (Mount Airy, MD). Please check your address.";
  await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
  await expect(page.getByTestId('confirm-address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes, this is correct' })).toBeVisible();
  await expect(del.getByLabel('City')).toHaveAttribute('aria-invalid', 'true');
  expect((await row(b.id)).status).toBe('paid'); // nothing saved
  await axeClean(page, 'step 3 city mismatch');

  // Fixing the city clears the message and the booking goes through unflagged.
  await del.getByLabel('City').fill('Mount Airy');
  await expect(page.getByTestId('confirm-address')).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(page.getByText("✓ You're booked!")).toBeVisible();
  expect(await row(b.id)).toMatchObject({ status: 'completed', needsReview: false });
});

test('"Yes, this is correct" completes the booking and flags it for the team', async ({ page }) => {
  const b = await seed();
  await page.goto(`/booking/${b.publicToken}`);
  await fillValid(page);
  const del = group(page, 'Delivery address');
  await del.getByLabel('ZIP').fill('21771');
  await del.getByLabel('City').fill('Parrs Ridge');
  await page.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(page.getByTestId('confirm-address')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, this is correct' }).click();
  await expect(page.getByText("✓ You're booked!")).toBeVisible();

  const saved = await row(b.id);
  expect(saved).toMatchObject({
    status: 'completed',
    needsReview: true,
    reviewReason: 'city/ZIP mismatch',
  });
  expect(saved.deliveryAddress).toMatchObject({ city: 'Parrs Ridge', state: 'MD', zip: '21771' });
  expect(saved.addressFlags).toEqual([
    'Delivery address: city "Parrs Ridge" does not match ZIP 21771 (Mount Airy, MD). The customer confirmed it is correct.',
  ]);
});

test('a region change in Step 3 is rejected by the server, whatever the browser says', async ({
  request,
}) => {
  const b = await seed();
  const ok = { street: '1 A', city: 'Los Angeles', zip: '90001' };
  const res = await request.post(`/api/bookings/${b.publicToken}/details`, {
    data: {
      firstName: 'Tess',
      lastName: 'Tester',
      phone: '951-555-0100',
      email: 'tess@example.com',
      address: ok,
      pickupAddress: ok,
      // The quote was West -> East, so a delivery in the West is refused.
      deliveryAddress: { street: '2 B', city: 'Beverly Hills', zip: '90210' },
      confirmAddresses: true,
    },
  });
  expect(res.status()).toBe(422);
  expect(await res.json()).toMatchObject({
    reason: 'delivery_region',
    field: 'deliveryAddress.zip',
  });
  expect((await row(b.id)).status).toBe('paid');
});
