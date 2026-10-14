import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db';
import { leads } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import {
  answerHighValue,
  asNewVisitor,
  dialog,
  expectAccessible,
  openModal,
  typeVehicle,
} from './helpers';

// The vehicle is three plain typed fields (no dropdowns). Make and model also offer optional type-ahead suggestions
// (see vehicle-suggest.spec.ts). Aliases and spellings are fixed on
// the server; the typed text and the normalized vehicle are both stored. These run at a phone width.
test.use({ viewport: { width: 390, height: 844 } });

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const NAME = 'E2E Vehicle Entry';
const week = bookableWeeks()[0];

test.beforeAll(async () => {
  await db.delete(leads).where(eq(leads.name, NAME));
});
test.afterAll(async () => {
  await db.delete(leads).where(eq(leads.name, NAME));
  await pool.end();
});
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await openModal(page);
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
});

const d = (page: Page) => dialog(page);
const yearField = (page: Page) => d(page).getByLabel("Type your vehicle's year");
const makeField = (page: Page) => d(page).getByLabel(/^Type the make/);
const modelField = (page: Page) => d(page).getByLabel(/^Type the model/);
const chip = (page: Page) => d(page).getByTestId('size-chip');
const quoteHeading = (page: Page) =>
  d(page).getByRole('heading', { name: 'Request a personalized quote' });
async function answers(page: Page, opts: { highValue?: 'Yes' | 'No' } = {}) {
  await answerHighValue(d(page), opts.highValue ?? 'No');
  await d(page)
    .getByRole('group', { name: 'Is the vehicle operable?' })
    .getByText('Yes, it runs and drives', { exact: true })
    .click();
  await d(page)
    .getByRole('group', { name: 'Has it been modified in any way?' })
    .getByText('No, factory stock', { exact: true })
    .click();
}

test('three plain labeled text boxes, no dropdowns, 48px tall with 16px text', async ({ page }) => {
  await expect(d(page).getByRole('heading', { name: 'Tell us about your vehicle' })).toBeVisible();
  for (const field of [yearField(page), makeField(page), modelField(page)]) {
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('type', 'text');
    const { height, fontSize } = await field.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(height).toBeGreaterThanOrEqual(48);
    expect(fontSize).toBeGreaterThanOrEqual(16);
  }
  await expect(yearField(page)).toHaveAttribute('inputmode', 'numeric');
  await expect(yearField(page)).toHaveAttribute('maxlength', '4');
  await expect(d(page).locator('select')).toHaveCount(0);
  // Make and model are still typed text; they just offer suggestions as you type. The year never does.
  await expect(d(page).getByRole('combobox')).toHaveCount(2);
  await expect(yearField(page)).not.toHaveAttribute('role', 'combobox');
  await yearField(page).fill('2021');
  await expect(d(page).getByRole('listbox')).toBeHidden();
});

test('the next empty field gets the orange ring', async ({ page }) => {
  const ringed = (loc: ReturnType<typeof yearField>) => expect(loc).toHaveClass(/ring-accent/);
  const plain = (loc: ReturnType<typeof yearField>) => expect(loc).not.toHaveClass(/ring-accent/);
  await ringed(yearField(page));
  await plain(makeField(page));
  await plain(modelField(page));
  await yearField(page).fill('2021');
  await plain(yearField(page));
  await ringed(makeField(page));
  await makeField(page).fill('Toyota');
  await plain(makeField(page));
  await ringed(modelField(page));
  await modelField(page).fill('Camry');
  await plain(modelField(page));
  await expectAccessible(page, 'vehicle fields', 'dialog[open]');
});

test('year must be four digits from 1950 to next year', async ({ page }) => {
  const error = d(page).locator('#vehicle-year-error');
  const nextYear = new Date().getFullYear() + 1;
  await yearField(page).fill('20');
  await expect(error).toHaveCount(0); // still typing
  await yearField(page).fill('1949');
  await expect(error).toHaveText(`Enter a 4-digit year from 1950 to ${nextYear}.`);
  await expect(yearField(page)).toHaveAttribute('aria-invalid', 'true');
  await yearField(page).fill(String(nextYear + 1));
  await expect(error).toBeVisible();
  await yearField(page).fill('20x2');
  await expect(yearField(page)).toHaveValue('202'); // digits only
  await yearField(page).fill('1950');
  await expect(error).toHaveCount(0);
  await yearField(page).fill(String(nextYear));
  await expect(error).toHaveCount(0);
  // A bad year never classifies the vehicle.
  await makeField(page).fill('Honda');
  await modelField(page).fill('Civic');
  await yearField(page).fill('1949');
  await expect(chip(page)).toHaveCount(0);
});

test('"chevy tahoe" goes to the personalized quote form', async ({ page }) => {
  await typeVehicle(d(page), '2021', 'chevy', 'tahoe');
  await expect(chip(page)).toHaveText('Vehicle size: Large SUV / Full-size pickup / Van');
  await answers(page);
  await expect(quoteHeading(page)).toBeVisible();
  await expect(d(page).getByRole('button', { name: 'See My Price & Deposit →' })).toHaveCount(0);
});

test('"f150" goes to the personalized quote form', async ({ page }) => {
  await typeVehicle(d(page), '2022', 'ford', 'f150');
  await expect(chip(page)).toHaveText('Vehicle size: Large SUV / Full-size pickup / Van');
  await answers(page);
  await expect(quoteHeading(page)).toBeVisible();
});

test('"rav 4" is a small SUV and books online at the small SUV price', async ({ page }) => {
  await typeVehicle(d(page), '2021', 'toyota', 'rav 4');
  await expect(chip(page)).toHaveText('Vehicle size: Small SUV');
  await answers(page);
  await d(page).getByRole('radio', { name: 'Standard', exact: true }).check({ force: true });
  await d(page)
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d(page)
    .getByRole('radio', { name: /spots left/ })
    .first()
    .click();
  await d(page)
    .getByRole('checkbox', { name: /I agree to the Terms/ })
    .check({ force: true });
  await d(page).getByRole('button', { name: 'See My Price & Deposit →' }).click();
  await expect(d(page).getByText('2021 Toyota RAV4 (Small SUV)')).toBeVisible(); // normalized text
  await expect(d(page).getByRole('list', { name: 'Price breakdown' })).toContainText('$1,500');
});

test('a misspelled exotic with "worth over $100,000" = Yes goes to the quote form', async ({
  page,
}) => {
  await typeVehicle(d(page), '2021', 'ferarri', 'roma');
  await expect(d(page).getByText("We couldn't match your vehicle")).toBeVisible(); // not recognized
  await d(page)
    .getByRole('radio', { name: /Small sedan/ })
    .check({ force: true });
  await answers(page, { highValue: 'Yes' });
  await expect(quoteHeading(page)).toBeVisible();
  await expect(d(page).getByTestId('quote-reasons')).toContainText(
    'High-value and exotic vehicles need a personalized quote',
  );
});

test('lowercase text shows as the cleaned-up vehicle in the summary and the cart', async ({
  page,
}) => {
  await typeVehicle(d(page), '2021', 'chevy', 'malibu');
  await expect(chip(page)).toHaveText('Vehicle size: Large sedan');
  await answers(page);
  await d(page).getByRole('radio', { name: 'Standard', exact: true }).check({ force: true });
  await d(page)
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d(page)
    .getByRole('radio', { name: /spots left/ })
    .first()
    .click();
  await d(page)
    .getByRole('checkbox', { name: /I agree to the Terms/ })
    .check({ force: true });
  await d(page).getByRole('button', { name: 'See My Price & Deposit →' }).click();
  await expect(d(page).getByText('2021 Chevrolet Malibu (Large sedan)')).toBeVisible();
  await expect(d(page).getByText(/chevy|malibu$/)).toHaveCount(0); // the raw typed text is not echoed
});

test('an unrecognized vehicle shows the type cards, then books with a review note', async ({
  page,
}) => {
  await typeVehicle(d(page), '2020', 'zzzmake', 'thing');
  await expect(
    d(page).getByText("We couldn't match your vehicle. Pick the closest size."),
  ).toBeVisible();
  await expect(d(page).getByText('e.g., Honda HR-V')).toBeVisible();
  await expect(
    d(page).getByRole('radio', { name: /Large SUV \/ Full-size pickup \/ Van/ }),
  ).toBeVisible();
  await expect(chip(page)).toHaveCount(0);
  await expectAccessible(page, 'vehicle type cards', 'dialog[open]');
  await d(page)
    .getByRole('radio', { name: /Small SUV/ })
    .check({ force: true });
  await answers(page);
  await d(page).getByRole('radio', { name: 'Standard', exact: true }).check({ force: true });
  await d(page)
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d(page)
    .getByRole('radio', { name: /spots left/ })
    .first()
    .click();
  await d(page)
    .getByRole('checkbox', { name: /I agree to the Terms/ })
    .check({ force: true });
  await d(page).getByRole('button', { name: 'See My Price & Deposit →' }).click();
  await expect(d(page).getByText('2020 Zzzmake Thing (Small SUV)')).toBeVisible();
  await expect(
    d(page).getByText('We will confirm a few details with you before pickup.'),
  ).toBeVisible();
});

test('picking "Large SUV / Full-size pickup / Van" for an unrecognized vehicle opens the quote form', async ({
  page,
}) => {
  await typeVehicle(d(page), '2020', 'Zzzmake', 'Hauler');
  await d(page)
    .getByRole('radio', { name: /Large SUV \/ Full-size pickup \/ Van/ })
    .check({ force: true });
  await answers(page);
  await expect(quoteHeading(page)).toBeVisible();
});

test('a quote request stores the raw typed text and the normalized vehicle, even though the boxes got tidied', async ({
  page,
}) => {
  await typeVehicle(d(page), '2021', ' chevy ', 'TAHOE');
  await answers(page);
  // Leaving each box tidied what is shown...
  await expect(makeField(page)).toHaveValue('Chevrolet');
  await expect(modelField(page)).toHaveValue('Tahoe');
  await d(page).getByLabel('Full name').fill(NAME);
  await d(page).getByLabel('Phone').fill('951-555-0100');
  await d(page).getByLabel('Email').fill('e2e-vehicle@example.com');
  await d(page).getByLabel('Preferred pickup week (optional)').selectOption(week.start);
  const sent = page.waitForRequest((r) => r.url().endsWith('/api/leads') && r.method() === 'POST');
  await d(page).getByRole('button', { name: 'Request my quote' }).click();
  // ...but what is sent and stored is exactly what was typed.
  expect((await sent).postDataJSON().vehicle).toEqual({
    year: 2021,
    make: ' chevy ',
    model: 'TAHOE',
  });
  await expect(d(page).getByText('Thank you!')).toBeVisible();
  const [row] = await db.select().from(leads).where(eq(leads.name, NAME));
  expect(row.vehicle).toEqual({ year: 2021, make: 'Chevrolet', model: 'Tahoe' });
  expect(row.vehicleTyped).toEqual({ year: '2021', make: ' chevy ', model: 'TAHOE' });
});

test('nothing is classified while the customer is still typing', async ({ page }) => {
  await yearField(page).fill('2021');
  await makeField(page).fill('Toyota');
  await modelField(page).pressSequentially('Cam', { delay: 60 });
  await expect(chip(page)).toHaveCount(0);
  await expect(d(page).getByText("We couldn't match your vehicle")).toHaveCount(0);
  await modelField(page).pressSequentially('ry', { delay: 60 });
  await expect(chip(page)).toHaveText('Vehicle size: Large sedan');
});
