import { expect, test, type Page } from '@playwright/test';
import { asNewVisitor, dialog, expectAccessible, openModal } from './helpers';

// Make and model are plain text boxes that also offer type-ahead suggestions (names only, no network calls).
// Typing anything is always allowed; picking a suggestion is optional.
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await openModal(page);
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await d.getByLabel("Type your vehicle's year").fill('2022');
});

const d = (page: Page) => dialog(page);
const makeField = (page: Page) => d(page).getByLabel(/^Type the make/);
const modelField = (page: Page) => d(page).getByLabel(/^Type the model/);
const options = (page: Page) => d(page).getByRole('option');

test('typing "chevy tah" and picking Tahoe fills Chevrolet and Tahoe', async ({ page }) => {
  await makeField(page).pressSequentially('chevy');
  await expect(options(page)).toHaveText(['Chevrolet']);
  await options(page).first().click();
  await expect(makeField(page)).toHaveValue('Chevrolet');
  await expect(d(page).getByRole('listbox')).toBeHidden();

  await modelField(page).pressSequentially('tah');
  await expect(options(page)).toHaveText(['Tahoe']);
  await options(page).first().click();
  await expect(modelField(page)).toHaveValue('Tahoe');
  // Chevrolet Tahoe is a full-size SUV: no online price, so the form turns into the personalized quote request.
  await expect(
    d(page).getByRole('heading', { name: 'Request a personalized quote' }),
  ).toBeVisible();
});

test('"vw" suggests Volkswagen, with up to 8 suggestions after one character', async ({ page }) => {
  await makeField(page).pressSequentially('vw');
  await expect(options(page)).toHaveText(['Volkswagen']);
  await makeField(page).fill('');
  await makeField(page).pressSequentially('m');
  const n = await options(page).count();
  expect(n).toBeGreaterThan(1);
  expect(n).toBeLessThanOrEqual(8);
});

test('keyboard only: arrows, Enter picks, Escape closes without closing the window, Tab keeps the typed text', async ({
  page,
}) => {
  const make = makeField(page);
  await make.focus();
  await page.keyboard.type('to');
  await expect(make).toHaveAttribute('aria-expanded', 'true');
  await expect(make).toHaveAttribute('aria-autocomplete', 'list');
  const listId = await make.getAttribute('aria-controls');
  expect(listId).toBeTruthy();
  await expect(d(page).locator(`[id="${listId}"]`)).toHaveAttribute('role', 'listbox');
  await expect(make).not.toHaveAttribute('aria-activedescendant', /./); // nothing highlighted yet

  await page.keyboard.press('ArrowDown');
  const first = await make.getAttribute('aria-activedescendant');
  await expect(d(page).locator(`[id="${first}"]`)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp'); // wraps to the last
  await expect(make).toHaveAttribute('aria-activedescendant', /.+/);
  await page.keyboard.press('ArrowDown'); // back to the first
  await page.keyboard.press('Enter');
  await expect(make).toHaveValue('Toyota');
  await expect(make).toHaveAttribute('aria-expanded', 'false');

  // Escape closes just the list: the booking window stays open and the text stays.
  await make.fill('hon');
  await expect(make).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(make).toHaveAttribute('aria-expanded', 'false');
  await expect(make).toHaveValue('hon');
  await expect(d(page)).toBeVisible();

  // Tab moves on and keeps what was typed, even with a highlighted suggestion.
  await make.fill('hond');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(make).toHaveValue('hond');
  await expect(modelField(page)).toBeFocused();
});

test('model suggestions follow the make, and need no network calls', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (/vehicle|suggest|autocomplete/i.test(new URL(r.url()).pathname)) calls.push(r.url());
  });
  await makeField(page).fill('Honda');
  await modelField(page).pressSequentially('c');
  await expect(options(page)).toContainText(['Civic', 'CR-V']);
  await modelField(page).fill('crv');
  await expect(options(page)).toHaveText(['CR-V']);
  await makeField(page).fill('Nobody Motors');
  await modelField(page).fill('c');
  await expect(d(page).getByRole('listbox')).toBeHidden();
  expect(calls).toEqual([]);
});

test('browser autofill and password managers are off on both inputs', async ({ page }) => {
  for (const f of [makeField(page), modelField(page)]) {
    await expect(f).toHaveAttribute('autocomplete', 'off');
    await expect(f).toHaveAttribute('data-1p-ignore', 'true');
    await expect(f).toHaveAttribute('data-lpignore', 'true');
    await expect(f).toHaveAttribute('data-bwignore', 'true');
    await expect(f).toHaveAttribute('data-form-type', 'other');
  }
});

test('free text that matches nothing still goes on to the vehicle-type cards', async ({ page }) => {
  await makeField(page).pressSequentially('Zzzmake');
  await expect(d(page).getByRole('listbox')).toBeHidden();
  await modelField(page).pressSequentially('Thing');
  await expect(
    d(page).getByText("We couldn't match your vehicle. Pick the closest size."),
  ).toBeVisible();
});

test('"mase" suggests Maserati, and "saab" (no model table) gets no model suggestions but still reaches the type cards', async ({
  page,
}) => {
  await makeField(page).pressSequentially('mase');
  await expect(options(page)).toHaveText(['Maserati']);
  await makeField(page).fill('');
  await makeField(page).pressSequentially('rolls royce');
  await expect(options(page)).toHaveText(['Rolls-Royce']);
  await makeField(page).fill('');
  await makeField(page).pressSequentially('saa');
  await expect(options(page)).toHaveText(['Saab']);
  await options(page).first().click();
  await expect(makeField(page)).toHaveValue('Saab');
  await modelField(page).pressSequentially('9-3');
  await expect(d(page).getByRole('listbox')).toBeHidden();
  await expect(
    d(page).getByText("We couldn't match your vehicle. Pick the closest size."),
  ).toBeVisible();
});

test('the list is 44px+ per row, 16px text, never wider than the box, and passes the accessibility check', async ({
  page,
}) => {
  await makeField(page).pressSequentially('c');
  await expect(options(page).first()).toBeVisible();
  const m = await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>('#vehicle-make')!;
    const list = document.querySelector<HTMLElement>('[role="listbox"]:not([hidden])')!;
    const opt = list.querySelector<HTMLElement>('[role="option"]')!;
    return {
      input: input.getBoundingClientRect().width,
      list: list.getBoundingClientRect().width,
      row: opt.getBoundingClientRect().height,
      font: parseFloat(getComputedStyle(opt).fontSize),
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(m.row).toBeGreaterThanOrEqual(44);
  expect(m.font).toBeGreaterThanOrEqual(16);
  expect(m.list).toBeLessThanOrEqual(m.input + 0.5);
  expect(m.pageScroll).toBeLessThanOrEqual(0);
  await expectAccessible(page, 'make suggestions open', 'dialog[open]');
});

test('with the phone keyboard up (a short window) the whole list stays on screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 440 });
  await makeField(page).scrollIntoViewIfNeeded();
  await makeField(page).pressSequentially('c');
  await expect(options(page)).toHaveCount(3);
  const box = await d(page).getByRole('listbox').boundingBox();
  const dlg = await d(page).boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(dlg!.y);
  expect(box!.y + box!.height).toBeLessThanOrEqual(440);
  await expect(d(page).getByRole('listbox')).toHaveAttribute('data-placement', 'above');
  for (const o of await options(page).all()) await expect(o).toBeInViewport();
});

test('leaving a box tidies an exact match, and never touches text that matches nothing', async ({
  page,
}) => {
  await makeField(page).fill('chevy');
  await modelField(page).focus(); // blur on make
  await expect(makeField(page)).toHaveValue('Chevrolet');
  await modelField(page).fill('crv');
  await makeField(page).focus(); // blur on model: Chevrolet has no CR-V, so it stays as typed
  await expect(modelField(page)).toHaveValue('crv');
  await makeField(page).fill('vw');
  await modelField(page).focus();
  await expect(makeField(page)).toHaveValue('Volkswagen');
  await makeField(page).fill('honda');
  await modelField(page).fill('crv');
  await makeField(page).focus();
  await expect(modelField(page)).toHaveValue('CR-V');
  await makeField(page).fill('Zzz Motors');
  await modelField(page).fill('thing');
  await makeField(page).focus();
  await modelField(page).focus();
  await expect(makeField(page)).toHaveValue('Zzz Motors');
  await expect(modelField(page)).toHaveValue('thing');
  await makeField(page).fill('hond'); // a prefix is not an exact match
  await modelField(page).focus();
  await expect(makeField(page)).toHaveValue('hond');
});
