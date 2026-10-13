import { expect, test } from '@playwright/test';
import { asNewVisitor, dialog, openModal } from './helpers';

// Yuma, AZ ZIPs were added to the West region (client request 2026-10-13).
test('85364 is served as West, and the map and copy name Yuma', async ({
  request,
  page,
  baseURL,
}) => {
  const res = await request.post('/api/zip-check', { data: { zip: '85364' } });
  expect(await res.json()).toMatchObject({
    served: true,
    region: 'west',
    city: 'Yuma',
    state: 'AZ',
  });
  await asNewVisitor(page, baseURL!);
  await page.goto('/');
  await expect(page.locator('#service-area')).toContainText(
    'Southern California, Phoenix, Tucson, Yuma, and El Paso',
  );
  await expect(page.locator('#service-area svg').getByText('Yuma', { exact: true })).toBeVisible();
});

test('a Yuma pickup ships West → East, and Yuma → Corona is refused as same-region', async ({
  page,
  baseURL,
}) => {
  await asNewVisitor(page, baseURL!);
  await openModal(page);
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('85364');
  await expect(d.getByText('Shipping West → East')).toBeVisible();
  await d.getByLabel('Delivery ZIP').fill('30303');
  await expect(d.getByText('✓ Great news, we service this route.')).toBeVisible();
  await d.getByLabel('Delivery ZIP').fill('92879');
  await expect(d.getByText('✓ Great news, we service this route.')).toBeHidden();
  await expect(d.getByRole('alert').first()).toBeVisible();
});
