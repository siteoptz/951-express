import { expect, test } from '@playwright/test';

// Batch 8: the black-and-white truck is the hero, and the red Cascadia profile is gallery item 2.
test('the hero is the black-and-white truck, loaded with priority and no layout shift', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.getByRole('img', {
    name: 'A 951 Express truck hauling eight vehicles, in black and white.',
  });
  await expect(hero).toBeVisible();
  await expect
    .poll(() => hero.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThanOrEqual(1000);
  await expect(hero).not.toHaveAttribute('loading', 'lazy');
  expect(await hero.getAttribute('src')).toContain('hauler-black-white');
  const shift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[])
            if (!e.hadRecentInput) total += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 800);
      }),
  );
  expect(shift).toBeLessThan(0.02);
});

test('the red Cascadia profile is gallery item 2, and the old hero file is gone from the page', async ({
  page,
}) => {
  await page.goto('/');
  const items = page.locator('#gallery img');
  await expect(items).toHaveCount(6);
  await expect(items.nth(1)).toHaveAttribute(
    'alt',
    /red 951 Express car hauler loaded with six vehicles/,
  );
  expect(await items.nth(1).getAttribute('src')).toContain('red-cascadia-profile');
  expect(await page.content()).not.toContain('hero/red-cascadia-profile');
});
