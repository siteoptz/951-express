import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/db';
import { bookings, leads, routes } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';

// vPIC answers are mocked at our own /api/vehicles boundary, so these tests never depend on NHTSA.
// The real API is covered by the separate @live smoke test (e2e/vpic-live.spec.ts).
const MAKES = ['Chevrolet', 'Ford', 'Honda', 'Toyota'];
const MODELS: Record<string, string[]> = {
  honda: ['Accord', 'Civic', 'CR-V'],
  toyota: ['Camry', 'RAV4', 'Tacoma'],
  chevrolet: ['Silverado 1500', 'Tahoe'],
  ford: ['F-150', 'Ranger'],
};

async function mockVpic(page: Page) {
  await page.route('**/api/vehicles/makes*', (route) =>
    route.fulfill({ json: { makes: MAKES.map((m) => ({ value: m.toUpperCase(), label: m })) } }),
  );
  await page.route('**/api/vehicles/models*', (route) => {
    const make = new URL(route.request().url()).searchParams.get('make')?.toLowerCase() ?? '';
    return route.fulfill({ json: { models: MODELS[make] ?? [] } });
  });
}

const WEST = '90001';
const WEST2 = '90002';
const EAST = '21201';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const weeks = bookableWeeks();
const fullWeek = weeks[2];
let seededIds: string[] = [];
let n = 0;

test.beforeAll(async () => {
  // A run that was killed before afterAll can leave rows behind.
  await db.delete(bookings).where(eq(bookings.termsVersion, 'e2e'));
  await db.delete(leads).where(eq(leads.name, 'E2E Lead'));
  const [route] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  const now = new Date();
  const rows = await db
    .insert(bookings)
    .values(
      Array.from({ length: 12 }, (_, i) => ({
        publicToken: `e2e-full-${Date.now()}-${i}`,
        status: 'paid' as const,
        routeId: route.id,
        weekStart: fullWeek.start,
        pickupZip: WEST,
        deliveryZip: EAST,
        pickupRegion: 'west' as const,
        deliveryRegion: 'east' as const,
        vehicle: { year: 2020, make: 'Honda', model: 'Civic' },
        operable: true,
        modified: false,
        personalItems: false,
        sizeClass: 'small-sedan',
        sizeClassSource: 'table' as const,
        totalCents: 140000,
        depositCents: 35000,
        balanceCents: 105000,
        termsVersion: 'e2e',
        termsAcceptedAt: now,
      })),
    )
    .returning({ id: bookings.id });
  seededIds = rows.map((r) => r.id);
});

test.afterAll(async () => {
  if (seededIds.length) await db.delete(bookings).where(inArray(bookings.id, seededIds));
  await db.delete(leads).where(eq(leads.name, 'E2E Lead'));
  await pool.end();
});

test.beforeEach(async ({ page }) => {
  // The ZIP check is rate limited per IP, so each test pretends to be a different visitor.
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.20.${Math.floor(++n / 250)}.${n % 250}`,
  });
  await mockVpic(page);
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Get My Quote' }).click();
  await expect(page.getByRole('dialog', { name: 'Get My Instant Quote' })).toBeVisible();
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Get My Instant Quote' });

async function axeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .include('dialog[open]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((x) => x.target.join(' ')).join(' | ')}`,
  );
  expect(summary, `axe violations (${label})`).toEqual([]);
}

async function enterRoute(page: Page, pickup: string, delivery: string) {
  await dialog(page).getByLabel('Pickup ZIP').fill(pickup);
  await dialog(page).getByLabel('Delivery ZIP').fill(delivery);
}

/** Types into a make/model combobox and commits what was typed (picking the list entry when there is one). */
async function pick(page: Page, label: 'Make' | 'Model', text: string) {
  const box = dialog(page).getByRole('combobox', { name: label });
  await box.fill(text);
  await box.press('Tab');
}

async function chooseVehicle(page: Page, year: string, make: string, model: string) {
  await dialog(page).getByLabel('Year').selectOption(year);
  await pick(page, 'Make', make);
  await pick(page, 'Model', model);
}

async function fillOptions(page: Page, opts: { topDeck?: boolean } = {}) {
  const d = dialog(page);
  await d.getByRole('radio', { name: 'Yes, it runs and drives' }).check({ force: true });
  await d.getByRole('radio', { name: 'No, factory stock' }).check({ force: true });
  if (opts.topDeck) await d.getByRole('radio', { name: /Top Deck Load/ }).check({ force: true });
  else await d.getByRole('radio', { name: 'Standard' }).check({ force: true });
  await d
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d
    .getByRole('radio', { name: /spots left/ })
    .first()
    .click();
  await d.getByRole('checkbox', { name: /I agree to the Terms/ }).check({ force: true });
}

const seePrice = (page: Page) =>
  dialog(page).getByRole('button', { name: 'See My Price & Deposit →' });

test('West → East happy path ends on the Step 2 summary', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await expect(d.getByText('Shipping West → East')).toBeVisible();
  await expect(d.getByText('✓ Great news, we service this route.')).toBeVisible();

  await d.getByLabel('Year').selectOption('2020');
  const make = d.getByRole('combobox', { name: 'Make' });
  await make.fill('hond');
  await d.getByRole('option', { name: 'Honda', exact: true }).click(); // from the vPIC list
  const model = d.getByRole('combobox', { name: 'Model' });
  await model.fill('civ');
  await d.getByRole('option', { name: 'Civic', exact: true }).click();
  await expect(d.getByTestId('size-chip')).toHaveText('Vehicle size: Small sedan');

  await expect(seePrice(page)).toBeDisabled(); // until every answer is in
  await fillOptions(page);
  await expect(seePrice(page)).toBeEnabled();
  await axeClean(page, 'completed form');

  await seePrice(page).click();
  await expect(d.getByRole('heading', { name: 'Your quote' })).toBeVisible();
  await expect(d.getByText('2020 Honda Civic (Small sedan)')).toBeVisible();
  await expect(d.getByText('West → East').first()).toBeVisible();
  await expect(d.getByText('Small sedan transport')).toBeVisible();
  const lines = d.getByRole('list', { name: 'Price breakdown' });
  await expect(lines).toContainText('$1,400');
  await expect(d.getByText('Deposit due today').locator('..')).toContainText('$350');
  await expect(d.getByText('Balance due at delivery').locator('..')).toContainText('$1,050');
  await expect(d.getByRole('button', { name: 'Continue to secure payment' })).toBeDisabled();
  await axeClean(page, 'step 2 summary');
});

test('East → West happy path', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, EAST, WEST);
  await expect(d.getByText('Shipping East → West')).toBeVisible();
  await chooseVehicle(page, '2021', 'Toyota', 'RAV4');
  await expect(d.getByTestId('size-chip')).toHaveText('Vehicle size: Small SUV');
  await fillOptions(page);
  await seePrice(page).click();
  await expect(d.getByText('East → West').first()).toBeVisible();
  await expect(d.getByRole('list', { name: 'Price breakdown' })).toContainText('$1,500');
});

test('same-region ZIPs are rejected with the agreed copy', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, WEST, WEST2);
  await expect(d.getByRole('alert')).toContainText(
    'We haul between the West and the East. Both of these ZIP codes are in our West region.',
  );
  await expect(d.getByRole('combobox', { name: 'Make' })).toHaveCount(0);
  await expect(d.getByLabel('Year')).toHaveCount(0);
  await axeClean(page, 'same-region error');
});

test('an unserved ZIP shows the message and the call button', async ({ page }) => {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('10001');
  await expect(d.getByRole('alert')).toContainText(
    "We don't currently pick up or deliver in 10001.",
  );
  await expect(d.getByRole('link', { name: /Call \(951\)/ })).toBeVisible();
  await expect(d.getByLabel('Delivery ZIP')).toBeDisabled();
  await axeClean(page, 'unserved ZIP');
  // And the delivery side, with a served pickup.
  await d.getByLabel('Pickup ZIP').fill(WEST);
  await d.getByLabel('Delivery ZIP').fill('10001');
  await expect(d.getByRole('alert')).toContainText(
    "We don't currently pick up or deliver in 10001.",
  );
});

test('an unknown vehicle asks the customer to pick a size, and the booking needs review', async ({
  page,
}) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await chooseVehicle(page, '2020', 'Zzzmake', 'Thing');
  await expect(d.getByText("We couldn't match your vehicle. Pick the closest size.")).toBeVisible();
  await expect(d.getByText('e.g., Honda HR-V')).toBeVisible();
  await expect(
    d.getByText('e.g., Chevrolet Tahoe, Chevrolet Silverado 1500 and larger'),
  ).toBeVisible();
  await axeClean(page, 'size class cards');
  await d.getByRole('radio', { name: /Small SUV/ }).check({ force: true });
  await fillOptions(page);
  await seePrice(page).click();
  await expect(d.getByText('(Small SUV)')).toBeVisible();
  await expect(d.getByText('We will confirm a few details with you before pickup.')).toBeVisible();
});

test('a large vehicle replaces the form with a personalized quote request and stores a lead', async ({
  page,
}) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await chooseVehicle(page, '2021', 'Chevrolet', 'Tahoe');
  await expect(d.getByTestId('size-chip')).toHaveText('Vehicle size: Large SUV or pickup');
  await expect(d.getByRole('heading', { name: 'Request a personalized quote' })).toBeVisible();
  await expect(d.getByText('Top Deck Load')).toHaveCount(0);
  await expect(d.getByRole('checkbox', { name: /Terms/ })).toHaveCount(0);
  await d.getByRole('radio', { name: 'Yes, it runs and drives' }).check({ force: true });
  await d.getByRole('radio', { name: 'No, factory stock' }).check({ force: true });
  await d.getByLabel('Full name').fill('E2E Lead');
  await d.getByLabel('Phone').fill('951-555-0100');
  await d.getByLabel('Email').fill('e2e-lead@example.com');
  const weekSelect = d.getByLabel('Preferred pickup week (optional)');
  await expect(weekSelect.locator('option')).toHaveCount(weeks.length + 1); // plus "No preference"
  await expect(weekSelect).not.toContainText('spots'); // no capacity counts
  await expect(weekSelect).not.toContainText('FULL');
  await weekSelect.selectOption(weeks[0].start);
  await d.getByLabel('Notes (optional)').fill('Lifted, 35 inch tires');
  await axeClean(page, 'personalized quote form');
  await d.getByRole('button', { name: 'Request my quote' }).click();
  await expect(d.getByText('Thank you!')).toBeVisible();
  await axeClean(page, 'lead thank-you');

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.name, 'E2E Lead'), eq(leads.email, 'e2e-lead@example.com')));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    pickupZip: WEST,
    deliveryZip: EAST,
    operable: true,
    modified: false,
    status: 'new',
    notes: 'Lifted, 35 inch tires',
  });
  expect(rows[0].vehicle).toEqual({ year: 2021, make: 'Chevrolet', model: 'Tahoe' });
  expect(rows[0].preferredWeekStart).toBe(weeks[0].start);
  // A lead never holds a spot.
  const [route] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  const held = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.routeId, route.id), eq(bookings.weekStart, weeks[0].start)));
  expect(held).toHaveLength(0);
});

test('a full week is struck through and cannot be selected', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await chooseVehicle(page, '2020', 'Honda', 'Civic');
  await fillOptions(page);
  const full = d.getByRole('radio', { name: new RegExp(`${fullWeek.label}, FULL 12/12`) });
  await expect(full).toHaveAttribute('aria-disabled', 'true');
  await full.click({ force: true });
  await expect(full).toHaveAttribute('aria-checked', 'false');
  await expect(full.getByText(fullWeek.label)).toHaveClass(/line-through/);
  await d.getByRole('radiogroup').scrollIntoViewIfNeeded();
  await axeClean(page, 'week calendar with a full week');
});

test('Top Deck Load adds exactly $150', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await chooseVehicle(page, '2020', 'Honda', 'Civic');
  await expect(
    d.getByText('Eliminates the possibility of oil leaks from other vehicles'),
  ).toBeVisible();
  await expect(
    d.getByText(
      'Protects the vehicle from road debris due to its elevated position on the trailer',
    ),
  ).toBeVisible();

  await fillOptions(page);
  await seePrice(page).click();
  await expect(d.getByRole('list', { name: 'Price breakdown' })).toContainText('$1,400');
  await expect(d.getByRole('list', { name: 'Price breakdown' })).not.toContainText('Top Deck');
  await d.getByRole('button', { name: '← Edit my answers' }).click();

  await d.getByRole('radio', { name: /Top Deck Load/ }).check({ force: true });
  await d.getByRole('checkbox', { name: /I agree to the Terms/ }).check({ force: true });
  await seePrice(page).click();
  const lines = d.getByRole('list', { name: 'Price breakdown' });
  await expect(lines).toContainText('Top Deck Load');
  await expect(lines).toContainText('$150');
  await expect(lines).toContainText('$1,550');
  await expect(d.getByText('Deposit due today').locator('..')).toContainText('$387.50'); // 25% of $1,550
});

test('personal items show the 100 lb notice', async ({ page }) => {
  const d = dialog(page);
  await enterRoute(page, WEST, EAST);
  await chooseVehicle(page, '2020', 'Honda', 'Civic');
  await d
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('Yes', { exact: true })
    .click();
  await expect(d.getByRole('note')).toHaveText(
    "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
  );
});

test('closing a partly filled form asks first, and answers survive a refresh', async ({ page }) => {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill(WEST);
  await expect(d.getByText('Shipping West → East')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(d.getByRole('alertdialog')).toContainText('Close this quote?');
  await axeClean(page, 'close confirmation');
  await d.getByRole('button', { name: 'Keep editing' }).click();
  await expect(d.getByRole('alertdialog')).toHaveCount(0);
  await expect(d).toBeVisible();

  await page.reload();
  await page.getByRole('banner').getByRole('button', { name: 'Get My Quote' }).click();
  await expect(dialog(page).getByLabel('Pickup ZIP')).toHaveValue(WEST);

  await page.keyboard.press('Escape');
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(dialog(page)).toBeHidden();
});

test('an empty form closes on Escape without asking, and the initial state passes axe', async ({
  page,
}) => {
  await axeClean(page, 'initial form');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('the map ZIP box opens the modal with the pickup ZIP filled in', async ({ page }) => {
  await page.keyboard.press('Escape');
  const box = page.locator('#service-area form');
  await box.getByLabel('ZIP code').fill(EAST);
  await box.getByRole('button', { name: 'Check' }).click();
  await box.getByRole('button', { name: 'Get My Instant Quote' }).click();
  await expect(dialog(page).getByLabel('Pickup ZIP')).toHaveValue(EAST);
  await expect(dialog(page).getByText('Shipping East → West')).toBeVisible();
});
