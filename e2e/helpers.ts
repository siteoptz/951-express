import AxeBuilder from '@axe-core/playwright';
import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';

/**
 * The vehicle is three plain typed fields (no dropdowns). The form waits a moment after typing stops before it
 * classifies the vehicle, so the next section appears on its own.
 */
export async function typeVehicle(root: Page | Locator, year: string, make: string, model: string) {
  await root.getByLabel("Type your vehicle's year").fill(year);
  await root.getByLabel(/^Type the make/).fill(make);
  await root.getByLabel(/^Type the model/).fill(model);
}

let n = 0;

/**
 * The ZIP check is rate limited per IP, so each test pretends to be a different visitor. The header goes only to
 * our own origin: sending it to Stripe's domains would fail their CORS checks.
 */
export async function asNewVisitor(page: Page, baseURL: string) {
  const ip = `10.20.${Math.floor(++n / 250)}.${n % 250}`;
  await page.route(`${new URL(baseURL).origin}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
  );
}

export const dialog = (page: Page) => page.getByRole('dialog', { name: 'Get My Instant Quote' });

export async function openModal(page: Page) {
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Get My Quote' }).click();
  await expect(dialog(page)).toBeVisible();
}

/** Answers "Is your vehicle worth more than $100,000?" */
export async function answerHighValue(root: Page | Locator, answer: 'Yes' | 'No') {
  await root
    .getByRole('group', { name: 'Is your vehicle worth more than $100,000?' })
    .getByText(answer, { exact: true })
    .click();
}

/** Fills Step 1 for a West -> East 2020 Honda Civic quote and returns on the Step 2 summary. */
export async function reachSummary(page: Page, opts: { week?: string } = {}) {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await typeVehicle(d, '2020', 'Honda', 'Civic');
  await answerHighValue(d, 'No');
  await d.getByRole('radio', { name: 'Yes, it runs and drives' }).check({ force: true });
  await d.getByRole('radio', { name: 'No, factory stock' }).check({ force: true });
  await d.getByRole('radio', { name: 'Standard' }).check({ force: true });
  await d
    .getByRole('group', { name: 'Any personal items in the vehicle?' })
    .getByText('No', { exact: true })
    .click();
  await d
    .getByRole('radio', { name: new RegExp(`${opts.week ?? ''}.*spots? left`) })
    .first()
    .click();
  await d.getByRole('checkbox', { name: /I agree to the Terms/ }).check();
  await d.getByRole('button', { name: 'See My Price & Deposit →' }).click();
  await expect(d.getByRole('heading', { name: 'Your quote' })).toBeVisible();
}

/** Fills a valid Step 3 form (in the modal or on the /booking page). The email is whatever was prefilled unless given. */
export async function fillDetails(root: Page | Locator, opts: { email?: string } = {}) {
  await root.getByLabel('First name').fill('Pat');
  await root.getByLabel('Last name').fill('Driver');
  await root.getByLabel('Phone').fill('951-555-0100');
  if (opts.email) await root.getByLabel('Email').fill(opts.email);
  const home = root.getByRole('group', { name: 'Your address' });
  await home.getByLabel('Street address').fill('1 Main St');
  await home.getByLabel('ZIP').fill('92881');
  // The city fills in from the ZIP and the state is read-only, so there is nothing else to type here.
  await expect(home.getByLabel('City')).toHaveValue('Corona');
  await root
    .getByRole('group', { name: 'Pickup address' })
    .getByLabel('Street address')
    .fill('77 Sunset Blvd');
  await root
    .getByRole('group', { name: 'Delivery address' })
    .getByLabel('Street address')
    .fill('9 Pier Rd');
  await root.getByLabel('Notes for the driver (optional)').fill('Gate code 1234');
}

/**
 * WCAG 2.1 A and AA (including color contrast) on the page, or only inside `scope`. Stripe's own iframe is excluded:
 * it is a third-party document axe cannot see into.
 */
export async function expectAccessible(page: Page, label: string, scope?: string) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe');
  if (scope) builder = builder.include(scope);
  const results = await builder.analyze();
  const found = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
  );
  expect(found, `axe violations (${label})`).toEqual([]);
}

/**
 * Stripe's Link "save my information" checkbox is on by default and then asks for a phone number, so untick it.
 * Matched by role and a name containing "Link", so wording changes on Stripe's side do not break the suite.
 * Stripe can re-tick it while it looks up the email in Link, so retry until it sticks.
 */
export async function untickSaveWithLink(frame: FrameLocator) {
  const box = frame.getByRole('checkbox', { name: /link/i, includeHidden: true });
  await expect(async () => {
    // A DOM click, because Stripe visually hides the real input behind its own styled box.
    if (await box.isChecked()) await box.evaluate((el: HTMLInputElement) => el.click());
    await expect(box).not.toBeChecked({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}
