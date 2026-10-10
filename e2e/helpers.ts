import { expect, type Locator, type Page } from '@playwright/test';

// vPIC answers are mocked at our own /api/vehicles boundary, so tests never depend on NHTSA.
// The real API is covered by the separate @live smoke test (e2e/vpic-live.spec.ts).
export const MAKES = ['Chevrolet', 'Ford', 'Honda', 'Toyota'];
export const MODELS: Record<string, string[]> = {
  honda: ['Accord', 'Civic', 'CR-V'],
  toyota: ['Camry', 'RAV4', 'Tacoma'],
  chevrolet: ['Silverado 1500', 'Tahoe'],
  ford: ['F-150', 'Ranger'],
};

export async function mockVpic(page: Page) {
  await page.route('**/api/vehicles/makes*', (route) =>
    route.fulfill({ json: { makes: MAKES.map((m) => ({ value: m.toUpperCase(), label: m })) } }),
  );
  await page.route('**/api/vehicles/models*', (route) => {
    const make = new URL(route.request().url()).searchParams.get('make')?.toLowerCase() ?? '';
    return route.fulfill({ json: { models: MODELS[make] ?? [] } });
  });
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

/** Fills Step 1 for a West -> East 2020 Honda Civic quote and returns on the Step 2 summary. */
export async function reachSummary(page: Page, opts: { week?: string } = {}) {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await d.getByLabel('Year').selectOption('2020');
  for (const [label, text] of [
    ['Make', 'Honda'],
    ['Model', 'Civic'],
  ] as const) {
    const box = d.getByRole('combobox', { name: label });
    await box.fill(text);
    await box.press('Tab');
  }
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
  await home.getByLabel('City').fill('Corona');
  await home.getByLabel('State').fill('CA');
  await home.getByLabel('ZIP').fill('92881');
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
