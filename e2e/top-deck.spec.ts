import { expect, test, type Page } from '@playwright/test';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/db';
import { bookings, routes, weekOverrides } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import {
  answerHighValue,
  asNewVisitor,
  dialog,
  expectAccessible,
  openModal,
  typeVehicle,
} from './helpers';

// Top Deck Load is limited per route per week: 3 SUV slots and 1 car slot by default, on top of the 6 main spots.
// Week A has its SUV slots filled with paid bookings. Week B has every top-deck slot switched off by an override.
// The other weeks are untouched.
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const weeks = bookableWeeks();
const weekA = weeks[3];
const weekB = weeks[4];
const clean = weeks[5];
let routeId = 0;
let seeded: string[] = [];

test.beforeAll(async () => {
  const [r] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  routeId = r.id;
  await db.delete(bookings).where(eq(bookings.termsVersion, 'e2e-topdeck'));
  await db
    .delete(weekOverrides)
    .where(
      and(eq(weekOverrides.routeId, routeId), inArray(weekOverrides.weekStart, [weekB.start])),
    );
  const rows = await db
    .insert(bookings)
    .values(
      Array.from({ length: 3 }, (_, i) => ({
        publicToken: `e2e-topdeck-${Date.now()}-${i}`,
        status: 'paid' as const,
        routeId,
        weekStart: weekA.start,
        pickupZip: '90001',
        deliveryZip: '21201',
        pickupRegion: 'west' as const,
        deliveryRegion: 'east' as const,
        vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
        operable: true,
        modified: false,
        topDeck: true,
        personalItems: false,
        sizeClass: 'small-suv',
        sizeClassSource: 'table' as const,
        totalCents: 165000,
        depositCents: 10000,
        balanceCents: 155000,
        termsVersion: 'e2e-topdeck',
        termsAcceptedAt: new Date(),
      })),
    )
    .returning({ id: bookings.id });
  seeded = rows.map((x) => x.id);
  await db
    .insert(weekOverrides)
    .values({ routeId, weekStart: weekB.start, topDeckSuvOverride: 0, topDeckCarOverride: 0 });
});
test.afterAll(async () => {
  if (seeded.length) await db.delete(bookings).where(inArray(bookings.id, seeded));
  await db
    .delete(weekOverrides)
    .where(and(eq(weekOverrides.routeId, routeId), eq(weekOverrides.weekStart, weekB.start)));
  await pool.end();
});
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await openModal(page);
});

async function fillUntilWeeks(page: Page, make: string, model: string) {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await typeVehicle(d, '2021', make, model);
  await answerHighValue(d, 'No');
  await d
    .getByRole('group', { name: 'Is the vehicle operable?' })
    .getByText('Yes, it runs and drives', { exact: true })
    .click();
  await d
    .getByRole('group', { name: 'Has it been modified in any way?' })
    .getByText('No, factory stock', { exact: true })
    .click();
}
const pickWeek = (page: Page, label: string) =>
  dialog(page)
    .getByRole('radio', { name: new RegExp(`${label}, `) })
    .click();
const topDeckOption = (page: Page) => dialog(page).getByRole('radio', { name: /Top Deck Load/ });
const status = (page: Page) => dialog(page).getByTestId('top-deck-status');

test('the pickup weeks show how many main spots are left', async ({ page }) => {
  await fillUntilWeeks(page, 'Toyota', 'RAV4');
  const week = dialog(page).getByRole('radio', { name: new RegExp(`${clean.label}, `) });
  await expect(week).toHaveAccessibleName(/\d spots? left/);
  // Seeded top-deck bookings in week A each took one of the 6 main spots too.
  await expect(
    dialog(page).getByRole('radio', { name: new RegExp(`${weekA.label}, 3 spots left`) }),
  ).toBeVisible();
});

test('an SUV sees the remaining SUV slots, and a sold-out SUV slot is disabled with the agreed message', async ({
  page,
}) => {
  await fillUntilWeeks(page, 'Toyota', 'RAV4');
  await pickWeek(page, clean.label);
  await expect(status(page)).toHaveText('3 top-deck spots left');
  await expect(topDeckOption(page)).toBeEnabled();

  await pickWeek(page, weekA.label); // 3 SUV top-deck bookings already
  await expect(status(page)).toHaveText(
    'Top deck sold out for this week. Standard loading is available, or pick another week.',
  );
  await expect(topDeckOption(page)).toBeDisabled();
  await expect(dialog(page).getByRole('radio', { name: 'Standard', exact: true })).toBeEnabled();
  await expectAccessible(page, 'top deck sold out', 'dialog[open]');
});

test('a sedan can still use the car slot when the SUV slots are full', async ({ page }) => {
  await fillUntilWeeks(page, 'Honda', 'Civic');
  await pickWeek(page, weekA.label);
  await expect(status(page)).toHaveText('1 top-deck spot left');
  await expect(topDeckOption(page)).toBeEnabled();
  await pickWeek(page, clean.label);
  await expect(status(page)).toHaveText('4 top-deck spots left'); // the car slot plus 3 free SUV slots
});

test('moving to a week with no top-deck room switches back to standard loading', async ({
  page,
}) => {
  await fillUntilWeeks(page, 'Honda', 'Civic');
  await pickWeek(page, clean.label);
  await topDeckOption(page).check({ force: true });
  await expect(topDeckOption(page)).toBeChecked();
  await pickWeek(page, weekB.label); // every top-deck slot is switched off
  await expect(topDeckOption(page)).toBeDisabled();
  await expect(topDeckOption(page)).not.toBeChecked();
  await expect(dialog(page).getByRole('radio', { name: 'Standard', exact: true })).toBeChecked();
  // The switch is announced (a status region) and explains the price change.
  const notice = dialog(page).getByRole('status').filter({ hasText: "Top deck isn't available" });
  await expect(notice).toHaveText(
    "Top deck isn't available for this week, so we switched you to Standard loading (−$150).",
  );
  await expect(notice).toHaveAttribute('data-testid', 'top-deck-switched');
  await pickWeek(page, clean.label);
  await expect(topDeckOption(page)).toBeEnabled(); // rechecked when the week changes
  await expect(notice).toBeHidden(); // it belonged to the other week
});

test('the notice clears as soon as the customer picks a load type again', async ({ page }) => {
  await fillUntilWeeks(page, 'Honda', 'Civic');
  await pickWeek(page, clean.label);
  await topDeckOption(page).check({ force: true });
  await pickWeek(page, weekB.label);
  const notice = dialog(page).getByTestId('top-deck-switched');
  await expect(notice).toBeVisible();
  // Standard is already selected: clicking it again is still a pick and clears the notice.
  await dialog(page).getByRole('radio', { name: 'Standard', exact: true }).click({ force: true });
  await expect(notice).toBeHidden();
  await expectAccessible(page, 'top deck switched notice', 'dialog[open]');
});

test('changing the vehicle can take Top Deck away too, with the same notice', async ({ page }) => {
  await fillUntilWeeks(page, 'Honda', 'Civic');
  await pickWeek(page, weekA.label); // the SUV slots are full, but a sedan still has the car slot
  await topDeckOption(page).check({ force: true });
  await expect(topDeckOption(page)).toBeChecked();
  const model = dialog(page).getByLabel(/^Type the model/);
  await model.fill('CR-V'); // a small SUV: no SUV slot left in this week
  await model.press('Tab');
  await expect(dialog(page).getByTestId('top-deck-switched')).toHaveText(
    "Top deck isn't available for this week, so we switched you to Standard loading (−$150).",
  );
  await expect(topDeckOption(page)).toBeDisabled();
  await expect(dialog(page).getByRole('radio', { name: 'Standard', exact: true })).toBeChecked();
});

test.describe('the server refuses top deck when it is full, whatever the browser sends', () => {
  const body = (over: Record<string, unknown>) => ({
    pickupZip: '90001',
    deliveryZip: '21201',
    vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
    operable: true,
    modified: false,
    highValue: false,
    topDeck: true,
    personalItems: false,
    weekStart: weekA.start,
    termsAccepted: true,
    ...over,
  });
  const countFor = async () =>
    (
      await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.routeId, routeId), eq(bookings.pickupZip, '85004')))
    ).length;

  test('quote and checkout return 409 with the next week that has space for this vehicle', async ({
    request,
  }, info) => {
    const headers = { 'x-forwarded-for': `10.88.${info.workerIndex}.1` };
    const forged = body({ pickupZip: '85004' });
    const before = await countFor();
    const quote = await request.post('/api/quote', { data: forged, headers });
    expect(quote.status()).toBe(409);
    const q = await quote.json();
    expect(q).toMatchObject({ reason: 'top_deck_full' });
    expect(q.nextAvailableWeek.start).toBe(
      weeks[4].start === weekB.start ? weeks[5].start : weeks[4].start,
    );
    const checkout = await request.post('/api/checkout', { data: forged, headers });
    expect(checkout.status()).toBe(409);
    const c = await checkout.json();
    expect(c).toMatchObject({ reason: 'top_deck_full' });
    expect(c.clientSecret).toBeUndefined();
    expect(await countFor()).toBe(before);
  });

  test('standard loading in the same week is still quoted', async ({ request }, info) => {
    const quote = await request.post('/api/quote', {
      data: body({ topDeck: false }),
      headers: { 'x-forwarded-for': `10.88.${info.workerIndex}.2` },
    });
    expect(quote.status()).toBe(200);
    expect(await quote.json()).toMatchObject({ quoteRequired: false, totalCents: 150000 });
  });

  test('the availability API reports top-deck slots per type', async ({ request }) => {
    const res = await (await request.get('/api/availability?route=west-to-east')).json();
    const a = res.weeks.find((w: { start: string }) => w.start === weekA.start);
    expect(a).toMatchObject({
      capacity: 6,
      taken: 3,
      remaining: 3,
      topDeck: {
        capacity: { suv: 3, car: 1 },
        taken: { suv: 3, car: 0 },
        remaining: { suv: 0, car: 1 },
      },
    });
    const b = res.weeks.find((w: { start: string }) => w.start === weekB.start);
    expect(b.topDeck.capacity).toEqual({ suv: 0, car: 0 });
  });
});
