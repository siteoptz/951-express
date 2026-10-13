import { expect, test, type Page } from '@playwright/test';
import { and, desc, eq, gte } from 'drizzle-orm';
import { createDb } from '../src/db';
import { bookings, leads, routes } from '../src/db/schema';
import { bookableWeeks } from '../src/lib/weeks';
import {
  answerHighValue,
  asNewVisitor,
  dialog,
  fillDetails,
  mockVpic,
  openModal,
  reachSummary,
  untickSaveWithLink,
} from './helpers';

// REAL emails. Run it on purpose:  npm run e2e:email   (sends 4: deposit received, new booking, confirmation, new lead)
//   team side     -> BOOKINGS_EMAIL_TO (the dispatcher inbox)
//   customer side -> E2E_EMAIL_CUSTOMER (an inbox you can check; set it in .env.local)
// It then asks Resend itself for each email's delivery status.
const TEAM = process.env.BOOKINGS_EMAIL_TO?.split(',')[0].trim() ?? '';
const CUSTOMER = process.env.E2E_EMAIL_CUSTOMER?.trim() ?? '';
const KEY = process.env.RESEND_API_KEY ?? '';
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const startedAt = new Date();
const week = bookableWeeks()[7];
const LEAD_NAME = 'E2E Email Lead';
let routeId = 0;

test.describe.configure({ mode: 'serial' });
test.skip(
  !TEAM || !CUSTOMER || !KEY,
  'needs RESEND_API_KEY, BOOKINGS_EMAIL_TO, and E2E_EMAIL_CUSTOMER',
);

test.beforeAll(async () => {
  const [r] = await db.select().from(routes).where(eq(routes.slug, 'west-to-east'));
  routeId = r.id;
});
test.afterAll(async () => {
  await db
    .delete(bookings)
    .where(and(eq(bookings.routeId, routeId), gte(bookings.createdAt, startedAt)));
  await db.delete(leads).where(eq(leads.name, LEAD_NAME));
  await pool.end();
});
test.beforeEach(async ({ page, baseURL }) => {
  await asNewVisitor(page, baseURL!);
  await mockVpic(page);
  await openModal(page);
});

async function pay(page: Page, email: string) {
  const d = dialog(page);
  await d.getByRole('button', { name: 'Continue to secure payment' }).click();
  const frame = d.getByTestId('embedded-checkout').frameLocator('iframe').first();
  await frame.getByPlaceholder('1234 1234 1234 1234').waitFor({ timeout: 30_000 });
  await frame.getByPlaceholder('email@example.com').fill(email);
  await frame.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242');
  await frame.getByPlaceholder('MM / YY').fill('12 / 34');
  await frame.getByPlaceholder('CVC').fill('123');
  await frame.getByPlaceholder('Full name on card').fill('E2E Buyer');
  await frame.getByPlaceholder('ZIP').fill('90001');
  await untickSaveWithLink(frame);
  await frame.getByTestId('hosted-payment-submit-button').click();
}

test('pays, completes details, and the team email and the customer confirmation are sent @stripe @email', async ({
  page,
}) => {
  await reachSummary(page, { week: week.label });
  const d = dialog(page);
  await pay(page, CUSTOMER);
  await expect(d.getByText(/Deposit received/)).toBeVisible({ timeout: 60_000 });
  await expect(d.getByLabel('Email')).toHaveValue(CUSTOMER);
  await fillDetails(d);
  await d.getByRole('button', { name: 'Finish my booking' }).click();
  await expect(d.getByText("✓ You're booked!")).toBeVisible();
  await expect(d.getByText(`A confirmation is on its way to ${CUSTOMER}.`)).toBeVisible();

  // Wait until both emails are recorded as sent, or until one is recorded as failed, then check which.
  const latest = async () =>
    (
      await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.routeId, routeId), gte(bookings.createdAt, startedAt)))
        .orderBy(desc(bookings.createdAt))
    )[0];
  await expect
    .poll(
      async () => {
        const r = await latest();
        return Boolean((r.teamEmailSentAt && r.customerEmailSentAt) || r.emailError);
      },
      { timeout: 45_000, message: 'the emails should be sent (or fail with a recorded error)' },
    )
    .toBe(true);
  const b = await latest();
  expect(b.emailError, 'Resend refused an email').toBeNull();
  expect(b.teamEmailSentAt).toBeInstanceOf(Date);
  expect(b.customerEmailSentAt).toBeInstanceOf(Date);
  expect(b.status).toBe('completed');
});

test('a personalized-quote request emails the team @email', async ({ page }) => {
  const d = dialog(page);
  await d.getByLabel('Pickup ZIP').fill('90001');
  await d.getByLabel('Delivery ZIP').fill('21201');
  await d.getByText('✓ Great news, we service this route.').waitFor();
  await d.getByLabel('Year').selectOption('2021');
  for (const [label, text] of [
    ['Make', 'Chevrolet'],
    ['Model', 'Tahoe'],
  ] as const) {
    const box = d.getByRole('combobox', { name: label });
    await box.fill(text);
    await box.press('Tab');
  }
  await answerHighValue(d, 'No');
  await d.getByRole('radio', { name: 'Yes, it runs and drives' }).check({ force: true });
  await d.getByRole('radio', { name: 'No, factory stock' }).check({ force: true });
  await d.getByLabel('Full name').fill(LEAD_NAME);
  await d.getByLabel('Phone').fill('951-555-0100');
  await d.getByLabel('Email').fill(CUSTOMER);
  await d.getByLabel('Preferred pickup week (optional)').selectOption(week.start);
  await d.getByLabel('Notes (optional)').fill('Lifted, 35 inch tires');
  await d.getByRole('button', { name: 'Request my quote' }).click();
  await expect(d.getByText('Thank you!')).toBeVisible();

  const row = async () => (await db.select().from(leads).where(eq(leads.name, LEAD_NAME)))[0];
  await expect
    .poll(async () => Boolean((await row())?.emailSentAt || (await row())?.emailError), {
      timeout: 45_000,
    })
    .toBe(true);
  expect((await row()).emailError, 'Resend refused the lead email').toBeNull();
  expect((await row()).emailSentAt).toBeInstanceOf(Date);
});

// Ask Resend what happened to each email (the app only knows it handed them over).
test('Resend accepted all four emails and shows their delivery status @email', async ({
  request,
}) => {
  test.setTimeout(150_000);
  const api = (path: string) =>
    request.get(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const wanted = [
    { name: 'Deposit received', subject: /^Deposit received/, to: CUSTOMER },
    { name: 'New booking (team)', subject: /^New Booking: 2020 Honda Civic/, to: TEAM },
    {
      name: 'Booking confirmation',
      subject: /^Your 951 Express booking is confirmed/,
      to: CUSTOMER,
    },
    {
      name: 'New lead (team)',
      subject: /^Quote request \(large vehicle\): 2021 Chevrolet Tahoe/,
      to: TEAM,
    },
  ];
  type Row = { id: string; created_at: string; subject: string; to: string[]; last_event: string };
  const find = (rows: Row[], w: (typeof wanted)[number]) =>
    rows.find(
      (r) =>
        w.subject.test(r.subject) &&
        r.to.map((t) => t.toLowerCase()).includes(w.to.toLowerCase()) &&
        new Date(r.created_at) >= new Date(startedAt.getTime() - 15_000),
    );
  const done = new Set(['delivered', 'opened', 'clicked']);
  const bad = new Set(['bounced', 'complained', 'failed', 'suppressed']);

  let rows: Row[] = [];
  const end = Date.now() + 100_000;
  for (;;) {
    const res = await api('/emails?limit=50');
    expect(res.ok(), `Resend list failed (${res.status()})`).toBe(true);
    rows = ((await res.json()) as { data: Row[] }).data;
    const found = wanted.map((w) => find(rows, w));
    if (
      found.every((r) => r && (done.has(r.last_event) || bad.has(r.last_event))) ||
      Date.now() > end
    )
      break;
    await new Promise((r) => setTimeout(r, 4000));
  }

  const table: string[] = [];
  for (const w of wanted) {
    const r = find(rows, w);
    expect(r, `Resend has no record of: ${w.name}`).toBeTruthy();
    let replyTo = 'n/a';
    if (r && /customer|deposit|confirmation/i.test(w.name)) {
      const one = await api(`/emails/${r.id}`);
      if (one.ok()) {
        const body = (await one.json()) as { reply_to?: string[] | string | null };
        replyTo = Array.isArray(body.reply_to)
          ? body.reply_to.join(', ')
          : (body.reply_to ?? 'none');
      }
      await new Promise((x) => setTimeout(x, 600));
    }
    table.push(
      `${w.name.padEnd(22)} to ${w.to.padEnd(28)} status: ${(r?.last_event ?? '?').padEnd(10)} reply-to: ${replyTo}`,
    );
    expect(bad.has(r!.last_event), `${w.name} came back ${r!.last_event}`).toBe(false);
  }
  console.log(`\nRESEND DELIVERY STATUS\n${table.join('\n')}\n`);
  for (const w of wanted)
    expect(
      done.has(find(rows, w)!.last_event),
      `${w.name} is still ${find(rows, w)!.last_event}`,
    ).toBe(true);
});
