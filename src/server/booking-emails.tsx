import { render } from '@react-email/render';
import { and, count, eq, inArray, lt, or } from 'drizzle-orm';
import type { Db } from '@/db';
import { bookings, leads, routes } from '@/db/schema';
import { CustomerConfirmationEmail } from '@/emails/CustomerConfirmationEmail';
import { NewBookingEmail } from '@/emails/NewBookingEmail';
import { NewLeadEmail } from '@/emails/NewLeadEmail';
import {
  buildBookingEmailData,
  buildLeadEmailData,
  customerSubject,
  leadSubject,
  teamSubject,
  type BookingForEmail,
} from '@/lib/email-data';
import { customerReplyTo } from '@/config/email';
import { sizeClasses } from '@/config/pricing';
import { customerText, leadText, teamText } from '@/emails/text';
import { renderDispatchPdf, type DispatchPdf } from '@/server/dispatch-pdf';
import { sendEmail, teamRecipients, type EmailResult } from '@/server/email';
import { weekCapacity } from '@/server/capacity';

type Env = Record<string, string | undefined>;
export type EmailDeps = {
  send?: typeof sendEmail;
  /** Builds the dispatch sheet; tests swap it to force a failure. */
  makePdf?: typeof renderDispatchPdf;
  env?: Env;
  pause?: (ms: number) => Promise<unknown>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const describe = (r: EmailResult) => (r.sent ? null : r.error);

/** Where this booking landed in the week, by payment time: "spot 3 of 12". */
export async function spotNumber(
  db: Db,
  b: { id: string; routeId: number; weekStart: string; paidAt: Date | null },
): Promise<number> {
  if (!b.paidAt) return 1;
  const [row] = await db
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.routeId, b.routeId),
        eq(bookings.weekStart, b.weekStart),
        inArray(bookings.status, ['paid', 'completed']),
        or(
          lt(bookings.paidAt, b.paidAt),
          and(eq(bookings.paidAt, b.paidAt), lt(bookings.id, b.id)),
        ),
      ),
    );
  return row.n + 1;
}

const rendered = async (el: React.ReactElement, text: string) => ({ html: await render(el), text });

/**
 * Sends the team email and the customer confirmation for a completed booking, then records what happened on the row
 * (sent times, or the error). It never throws: a failed email must not undo or hide a booking.
 */
export async function sendBookingEmails(
  db: Db,
  bookingId: string,
  deps: EmailDeps = {},
): Promise<{ team: EmailResult; customer: EmailResult } | null> {
  const env = deps.env ?? process.env;
  const send = deps.send ?? sendEmail;
  const pause = deps.pause ?? sleep;
  const fail = async (message: string) => {
    console.error(`[booking email] ${bookingId}: ${message}`);
    await db
      .update(bookings)
      .set({ emailError: message.slice(0, 500) })
      .where(eq(bookings.id, bookingId))
      .catch(() => undefined);
    return null;
  };

  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!b || !b.customer || !b.pickupAddress || !b.deliveryAddress)
      return await fail('Booking is missing its details');
    const [route] = await db.select().from(routes).where(eq(routes.id, b.routeId));
    const { capacity } = await weekCapacity(db, route, b.weekStart);
    const input: BookingForEmail = {
      ...b,
      customer: b.customer,
      pickupAddress: b.pickupAddress,
      deliveryAddress: b.deliveryAddress,
    };
    const ctx = {
      routeName: route.name,
      sizeClassLabel: sizeClasses.find((c) => c.id === b.sizeClass)?.label ?? b.sizeClass,
      spot: { n: await spotNumber(db, b), of: capacity },
      stripeTestMode: !/_live_/.test(env.STRIPE_SECRET_KEY ?? ''),
    };
    const d = buildBookingEmailData(input, ctx);

    // The dispatch sheet rides along with the team email. If it cannot be made, the email still goes out without it.
    let pdf: DispatchPdf | null = null;
    try {
      pdf = await (deps.makePdf ?? renderDispatchPdf)(input, ctx, env);
    } catch (e) {
      console.error(`[dispatch pdf] ${bookingId}: ${e instanceof Error ? e.message : String(e)}`);
    }

    const team = teamRecipients(env);
    const teamMail = await rendered(<NewBookingEmail d={d} />, teamText(d));
    const teamResult: EmailResult = team.length
      ? await send(
          {
            to: team,
            subject: teamSubject(d),
            ...teamMail,
            replyTo: d.customer.email,
            ...(pdf ? { attachments: [pdf] } : {}),
          },
          env,
        )
      : { sent: false, reason: 'not_configured', error: 'BOOKINGS_EMAIL_TO is not set' };

    await pause(700); // stay under Resend's 2 requests a second
    const customerMail = await rendered(<CustomerConfirmationEmail d={d} />, customerText(d));
    const customerResult = await send(
      {
        to: d.customer.email,
        subject: customerSubject(d),
        ...customerMail,
        replyTo: customerReplyTo(env),
      },
      env,
    );

    const errors = [
      teamResult.sent ? null : `team: ${describe(teamResult)}`,
      customerResult.sent ? null : `customer: ${describe(customerResult)}`,
    ].filter(Boolean);
    if (errors.length) console.error(`[booking email] ${bookingId}: ${errors.join(' | ')}`);
    await db
      .update(bookings)
      .set({
        teamEmailSentAt: teamResult.sent ? new Date() : null,
        customerEmailSentAt: customerResult.sent ? new Date() : null,
        emailError: errors.length ? errors.join(' | ').slice(0, 500) : null,
      })
      .where(eq(bookings.id, bookingId));
    return { team: teamResult, customer: customerResult };
  } catch (e) {
    return await fail(`Email step failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Tells the team about a personalized-quote request. Same rule: log it, record it, never throw. */
export async function sendLeadEmail(
  db: Db,
  leadId: string,
  deps: EmailDeps = {},
): Promise<EmailResult | null> {
  const env = deps.env ?? process.env;
  const send = deps.send ?? sendEmail;
  try {
    const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!l) return null;
    const [route] = await db.select().from(routes).where(eq(routes.id, l.routeId));
    const d = buildLeadEmailData(l, route.name);
    const team = teamRecipients(env);
    const mail = await rendered(<NewLeadEmail d={d} />, leadText(d));
    const result: EmailResult = team.length
      ? await send({ to: team, subject: leadSubject(d), ...mail, replyTo: l.email }, env)
      : { sent: false, reason: 'not_configured', error: 'BOOKINGS_EMAIL_TO is not set' };
    if (!result.sent) console.error(`[lead email] ${leadId}: ${result.error}`);
    await db
      .update(leads)
      .set({
        emailSentAt: result.sent ? new Date() : null,
        emailError: result.sent ? null : result.error.slice(0, 500),
      })
      .where(eq(leads.id, leadId));
    return result;
  } catch (e) {
    const message = `Email step failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[lead email] ${leadId}: ${message}`);
    await db
      .update(leads)
      .set({ emailError: message.slice(0, 500) })
      .where(eq(leads.id, leadId))
      .catch(() => undefined);
    return null;
  }
}
