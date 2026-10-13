import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './helpers';

const EMAIL = '951.dispatcher@gmail.com';

async function axeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `axe violations (${label})`,
  ).toEqual([]);
}

test('the landing page shows the logo, the confirmed facts, and no phone number', async ({
  page,
}) => {
  await page.goto('/');
  // Logo in the header and the footer, with the agreed alt text, actually loaded
  for (const area of ['banner', 'contentinfo'] as const) {
    const logo = page.getByRole(area).getByRole('img', { name: '951 Express Inc. logo' });
    await logo.scrollIntoViewIfNeeded(); // the footer logo loads lazily
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(100);
  }
  // Trust bar: only confirmed facts
  const trust = page.locator('dl').first();
  await expect(trust).toContainText('4020917');
  await expect(trust).toContainText('MC-1516594');
  await expect(trust).toContainText('Licensed & bonded');
  await expect(trust).toContainText('Cargo limit of $250,000 per occurrence');
  const body = await page.locator('body').innerText();
  for (const gone of [
    '$750K',
    '24 months',
    'Years in operation',
    'Credentials',
    'partners',
    'Secured booking',
  ])
    expect(body, gone).not.toContain(gone);
  await expect(
    page.getByText('Fully licensed and bonded with a cargo limit of $250,000 per occurrence'),
  ).toBeVisible();
  // No phone number and no tel: link anywhere; email links instead
  expect(body).not.toMatch(/427-9763|\(951\) 427/);
  expect(body).toMatch(/licensed & bonded auto transport/i); // the confirmed wording; "insured" is not claimed
  expect(body).not.toMatch(/insured/i);
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
  for (const name of ['Email us']) {
    const links = page.getByRole('link', { name });
    expect(await links.count()).toBeGreaterThanOrEqual(2); // hero and contact section
    await expect(links.first()).toHaveAttribute('href', `mailto:${EMAIL}`);
  }
  await expect(page.getByRole('contentinfo').getByRole('link', { name: EMAIL })).toHaveAttribute(
    'href',
    `mailto:${EMAIL}`,
  );
  await expect(page.getByRole('contentinfo')).toContainText('USDOT 4020917 · MC-1516594');
});

test('the map ZIP box offers email, not a phone call, for a ZIP we do not serve', async ({
  page,
}) => {
  await page.goto('/');
  const box = page.locator('#service-area form');
  await box.getByLabel('ZIP code').fill('10001');
  await box.getByRole('button', { name: 'Check' }).click();
  await expect(box.getByText("We don't currently serve 10001.")).toBeVisible();
  await expect(box.getByRole('link', { name: `Email ${EMAIL}` })).toHaveAttribute(
    'href',
    `mailto:${EMAIL}`,
  );
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
});

test('the icons and the social card are in place', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('link[rel~="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((els) => els.map((e) => `${e.getAttribute('rel')}|${e.getAttribute('href')}`));
  expect(hrefs.some((h) => h.startsWith('apple-touch-icon'))).toBe(true);
  expect(hrefs.some((h) => /icon\.png|favicon\.ico/.test(h))).toBe(true);
  for (const h of hrefs) {
    const res = await request.get(h.split('|')[1]);
    expect(res.status(), h).toBe(200);
    expect(res.headers()['content-type']).toMatch(/image\//);
  }
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/^https?:\/\/.+opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  const card = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toBe('image/png');
  expect((await card.body()).length).toBeGreaterThan(8_000);
  // The logo files the emails link to are public
  expect((await request.get('/images/logos/logo-email.png')).status()).toBe(200);
});

test('the Terms page has the real terms, with a last-updated date and no draft wording', async ({
  page,
}) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeVisible();
  await expect(
    page.getByText('Last updated October 13, 2026 · Version 2026-10-13.3'),
  ).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('img', { name: '951 Express Inc. logo' }),
  ).toBeVisible();
  expect(await page.locator('main section').count()).toBe(14);
  const text = await page.locator('main').innerText();
  for (const s of [
    'open carriers',
    'a flat deposit of $100',
    "Cash, Cashier's Check, or Zelle only",
    '7–10 days after pickup',
    '$150',
    "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
    'Bill of Lading',
    'toll tags',
    'one-quarter tank',
    'State of California',
    'USDOT 4020917',
    'MC-1516594',
    'cargo limit of $250,000 per occurrence',
    EMAIL,
  ])
    expect(text, s).toContain(s);
  expect(text).not.toMatch(/TODO|draft|placeholder/i);
  expect(text).not.toMatch(/427-9763/);
  await expect(page.getByRole('main').getByRole('link', { name: EMAIL })).toHaveAttribute(
    'href',
    `mailto:${EMAIL}`,
  );
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
  // The table of contents jumps to its section
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Cancellations and refunds' })
    .click();
  await expect(page).toHaveURL(/#cancellations-and-refunds$/);
  await expect(page.locator('#cancellations-and-refunds')).toBeInViewport();
  await axeClean(page, 'terms page');
});

test('the footer links to the terms page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms & Conditions' }).click();
  await expect(page).toHaveURL(/\/terms$/);
});

// The accent changed to the logo orange: every page and state is checked again, contrast included.
for (const size of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test.describe(`accessibility on the landing page (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('the whole page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page, `landing ${size.name}`);
    });

    test('the map ZIP box: served, not served, and invalid', async ({ page }) => {
      await page.goto('/');
      const box = page.locator('#service-area form');
      for (const [zip, expected] of [
        ['90001', /We serve Los Angeles/],
        ['10001', /don't currently serve/],
        ['123', /valid 5-digit/],
      ] as const) {
        await box.getByLabel('ZIP code').fill(zip);
        await box.getByRole('button', { name: 'Check' }).click();
        await expect(box.getByRole('status')).toContainText(expected);
        await expectAccessible(page, `ZIP box ${zip} ${size.name}`, '#service-area');
      }
    });

    test('the photo viewer', async ({ page }) => {
      await page.goto('/');
      await page
        .locator('#gallery')
        .getByRole('button', { name: /Enlarge photo/ })
        .first()
        .click();
      await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
      await expectAccessible(page, `photo viewer ${size.name}`, 'dialog[open]');
    });
  });
}

test('accessibility with the phone menu open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
  await expectAccessible(page, 'mobile menu');
});

test('the accent is the logo orange, with navy text on filled buttons', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('banner').getByRole('button', { name: 'Get My Quote' });
  const css = await button.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  expect(css.bg).toBe('rgb(240, 106, 26)'); // #F06A1A
  expect(css.color).toBe('rgb(14, 26, 43)'); // navy #0E1A2B, never white
});

test('every rendered ZIP input opts out of password managers and keeps postal-code autocomplete', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Get My Quote' }).click();
  const dialog = page.getByRole('dialog', { name: 'Get My Instant Quote' });
  await expect(dialog.getByLabel('Pickup ZIP')).toBeVisible();
  const inputs = [
    page.locator('#service-area input[name="zip"]'),
    dialog.getByLabel('Pickup ZIP'),
    dialog.getByLabel('Delivery ZIP'),
  ];
  for (const input of inputs) {
    await expect(input).toHaveAttribute('data-1p-ignore', /.*/);
    await expect(input).toHaveAttribute('data-lpignore', 'true');
    await expect(input).toHaveAttribute('data-bwignore', /.*/);
    await expect(input).toHaveAttribute('data-form-type', 'other');
    await expect(input).toHaveAttribute('autocomplete', 'postal-code');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
  }
});
