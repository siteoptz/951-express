import { expect, test, type Page } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../src/db';
import { bookings, leads } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import {
  answerHighValue,
  asNewVisitor,
  dialog,
  expectAccessible,
  mockVpic,
  openModal,
} from './helpers';

// Vehicles that cannot be booked online go to the personalized quote form. Each trigger switches the form,
// switching back restores it, and the server refuses to hold a spot or open Stripe whatever the browser sends.
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const NAME = 'E2E Quote Routing';
const week = bookableWeeks()[0];
const MESSAGES = {
  inoperable:
    "Vehicles that don't run need a personalized quote. Send us the details and we'll get back to you with a price.",
  modified: 'Modified vehicles need a personalized quote so we can confirm it fits our trailer.',
  exotic:
    'High-value and exotic vehicles need a personalized quote so we can arrange the right coverage.',
};

test.beforeAll(async () => {
  await db.delete(leads).where(eq(leads.name, NAME));
});
test.afterAll(async () => {
  await db.delete(leads).where(eq(leads.name, NAME));
  await pool.end();
});
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await mockVpic(page);
  await openModal(page);
});

async function startRoute(page: Page, make = 'Honda', model = 'Civic') {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await d.getByLabel('Year').selectOption('2020');
  for (const [label, text] of [
    ['Make', make],
    ['Model', model],
  ] as const) {
    const box = d.getByRole('combobox', { name: label });
    await box.fill(text);
    await box.press('Tab');
  }
}

const quoteHeading = (page: Page) =>
  dialog(page).getByRole('heading', { name: 'Request a personalized quote' });
const bookingOnly = (page: Page) => [
  dialog(page).getByRole('radiogroup').first(), // pickup weeks
  dialog(page).getByRole('checkbox', { name: /I agree to the Terms/ }),
  dialog(page).getByRole('button', { name: 'See My Price & Deposit →' }),
  dialog(page).getByText('Top Deck Load'),
  dialog(page).getByText('Any personal items in the vehicle?'),
];

async function answerAll(
  page: Page,
  over: { highValue?: 'Yes' | 'No'; operable?: boolean; modified?: boolean } = {},
) {
  const d = dialog(page);
  const choose = (legend: string, text: string) =>
    d.getByRole('group', { name: legend }).getByText(text, { exact: true }).click();
  await answerHighValue(d, over.highValue ?? 'No');
  await choose(
    'Is the vehicle operable?',
    over.operable === false ? 'No' : 'Yes, it runs and drives',
  );
  await choose('Has it been modified in any way?', over.modified ? 'Yes' : 'No, factory stock');
}

test('the high-value question is required before the booking can continue', async ({ page }) => {
  const d = dialog(page);
  await startRoute(page);
  await expect(d.getByText('Is your vehicle worth more than $100,000?')).toBeVisible();
  await d.getByRole('radio', { name: 'Yes, it runs and drives' }).check({ force: true });
  await d.getByRole('radio', { name: 'No, factory stock' }).check({ force: true });
  await d.getByRole('radio', { name: 'Standard' }).check({ force: true });
  await d
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d
    .getByRole('radio', { name: /spots left/ })
    .first()
    .click();
  await d.getByRole('checkbox', { name: /I agree to the Terms/ }).check({ force: true });
  await expect(d.getByRole('button', { name: 'See My Price & Deposit →' })).toBeDisabled();
  await answerHighValue(d, 'No');
  await expect(d.getByRole('button', { name: 'See My Price & Deposit →' })).toBeEnabled();
});

for (const [label, message, apply] of [
  ['inoperable (operable = No)', MESSAGES.inoperable, { operable: false }],
  ['modified (modified = Yes)', MESSAGES.modified, { modified: true }],
  ['high value (worth over $100,000 = Yes)', MESSAGES.exotic, { highValue: 'Yes' as const }],
] as const) {
  test(`${label} switches to the quote form, and switching back restores the booking flow`, async ({
    page,
  }) => {
    const d = dialog(page);
    await startRoute(page);
    await answerAll(page);
    await d
      .getByRole('radio', { name: /spots left/ })
      .first()
      .click();
    for (const el of bookingOnly(page)) await expect(el).toBeVisible();
    await expect(quoteHeading(page)).toHaveCount(0);

    // Trigger: the rest of the booking steps disappear at once and the quote form shows.
    await answerAll(page, apply);
    await expect(quoteHeading(page)).toBeVisible();
    await expect(d.getByTestId('quote-reasons')).toContainText(message);
    for (const el of bookingOnly(page)) await expect(el).toHaveCount(0);
    await expect(d.getByLabel('Pickup ZIP')).toHaveValue('90001'); // ZIPs and vehicle are kept
    await expect(d.getByRole('combobox', { name: 'Model' })).toHaveValue('Civic');

    // Back: the normal flow returns with the earlier answers kept.
    await answerAll(page);
    await expect(quoteHeading(page)).toHaveCount(0);
    for (const el of bookingOnly(page)) await expect(el).toBeVisible();
    await expect(d.getByRole('radio', { name: /spots left/ }).first()).toBeVisible();
  });
}

test('an exotic make goes straight to the quote form, with no size question', async ({ page }) => {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await d.getByLabel('Year').selectOption('2021');
  for (const [label, text] of [
    ['Make', 'Ferrari'],
    ['Model', 'Roma'],
  ] as const) {
    const box = d.getByRole('combobox', { name: label });
    await box.fill(text);
    await box.press('Tab');
  }
  await expect(quoteHeading(page)).toBeVisible();
  await expect(d.getByTestId('quote-reasons')).toContainText(MESSAGES.exotic);
  await expect(d.getByText("We couldn't match your vehicle")).toHaveCount(0);
  await expect(d.getByRole('button', { name: 'See My Price & Deposit →' })).toHaveCount(0);
});

test('a modified vehicle must describe the modifications, and the lead stores the reasons', async ({
  page,
}) => {
  const d = dialog(page);
  await startRoute(page);
  await answerAll(page, { modified: true, operable: false, highValue: 'No' });
  await expect(d.getByTestId('quote-reasons')).toContainText(MESSAGES.inoperable);
  await expect(d.getByTestId('quote-reasons')).toContainText(MESSAGES.modified);
  const details = d.getByLabel('Describe the modifications');
  await expect(details).toHaveAttribute(
    'placeholder',
    'e.g. 5-inch lift, 35-inch tires, lowered 2 inches, roof rack',
  );
  await expect(details).toHaveAttribute('maxlength', '500');
  await d.getByLabel('Full name').fill(NAME);
  await d.getByLabel('Phone').fill('951-555-0100');
  await d.getByLabel('Email').fill('e2e-routing@example.com');
  await d.getByLabel('Preferred pickup week (optional)').selectOption(week.start);
  const send = d.getByRole('button', { name: 'Request my quote' });
  await expect(send).toBeDisabled(); // the description is required
  await details.fill('5-inch lift, 35-inch tires');
  await expectAccessible(page, 'quote form with modifications', 'dialog[open]');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(d.getByText('Thank you!')).toBeVisible();

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.name, NAME)));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    operable: false,
    modified: true,
    highValue: false,
    quoteReasons: ['inoperable', 'modified'],
    modificationDetails: '5-inch lift, 35-inch tires',
    preferredWeekStart: week.start,
  });
});

test.describe('the server refuses a forged request', () => {
  const body = (over: Record<string, unknown>) => ({
    pickupZip: '90001',
    deliveryZip: '21201',
    vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
    operable: true,
    modified: false,
    highValue: false,
    topDeck: false,
    personalItems: false,
    weekStart: week.start,
    termsAccepted: true,
    ...over,
  });
  const cases = [
    ['inoperable', { operable: false }],
    ['modified', { modified: true, modificationDetails: '5-inch lift' }],
    ['high_value', { highValue: true }],
    ['exotic', { vehicle: { year: 2021, make: 'Lamborghini', model: 'Huracan' } }],
    ['exotic', { vehicle: { year: 2021, make: 'Mercedes-Benz', model: 'S 680 Maybach' } }],
    ['large_vehicle', { vehicle: { year: 2021, make: 'Ford', model: 'Transit' } }],
  ] as const;
  for (const [reason, over] of cases) {
    test(`${reason}: no price, no hold, no Stripe session (${JSON.stringify(over).slice(0, 40)})`, async ({
      request,
    }, info) => {
      const headers = {
        'x-forwarded-for': `10.77.${info.workerIndex}.${info.repeatEachIndex + 1 + cases.findIndex((c) => c[1] === over)}`,
      };
      const before = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.pickupZip, '85004'));
      const forged = body({ pickupZip: '85004', ...over });
      const quote = await request.post('/api/quote', { data: forged, headers });
      expect(quote.status()).toBe(200);
      const q = await quote.json();
      expect(q).toMatchObject({ quoteRequired: true });
      expect(q.quoteReasons).toContain(reason);
      expect(q.totalCents).toBeUndefined();
      const checkout = await request.post('/api/checkout', { data: forged, headers });
      expect(checkout.status()).toBe(422);
      const c = await checkout.json();
      expect(c).toMatchObject({ quoteRequired: true });
      expect(c.quoteReasons).toContain(reason);
      expect(c.clientSecret).toBeUndefined();
      const after = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.pickupZip, '85004'));
      expect(after).toHaveLength(before.length);
    });
  }

  test('a lead for a vehicle with an online price is refused', async ({ request }) => {
    const res = await request.post('/api/leads', {
      headers: { 'x-forwarded-for': '10.77.200.1' },
      data: {
        name: NAME,
        phone: '951-555-0100',
        email: 'e2e-routing@example.com',
        pickupZip: '90001',
        deliveryZip: '21201',
        vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
        operable: true,
        modified: false,
        highValue: false,
      },
    });
    expect(res.status()).toBe(422);
  });
  test('a modified lead without a description is refused', async ({ request }) => {
    const res = await request.post('/api/leads', {
      headers: { 'x-forwarded-for': '10.77.200.2' },
      data: {
        name: NAME,
        phone: '951-555-0100',
        email: 'e2e-routing@example.com',
        pickupZip: '90001',
        deliveryZip: '21201',
        vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
        operable: true,
        modified: true,
        highValue: false,
      },
    });
    expect(res.status()).toBe(400);
  });
});

test('the Terms say which vehicles need a personalized quote', async ({ page }) => {
  await page.goto('/terms');
  await expect(
    page.getByText(
      "Vehicles that don't run, modified vehicles, exotic or high-value vehicles (over $100,000), and large SUVs, pickups and vans require a personalized quote.",
    ),
  ).toBeVisible();
});
