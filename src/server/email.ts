// Resend sender (REST, no SDK). It never throws: callers record the result and carry on, because a failed email must
// never break a booking.
import { company } from '@/config/company';
import { customerReplyTo, teamInbox } from '@/config/email';
import type { Vehicle } from '@/db/schema';
import { weekLabel } from '@/lib/weeks';

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | string[];
};
export type EmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: 'not_configured' | 'failed'; error: string };
type Env = Record<string, string | undefined>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resend allows 2 requests a second. One retry after a short pause covers back-to-back sends. */
export async function sendEmail(
  msg: EmailMessage,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
  pause: (ms: number) => Promise<unknown> = wait,
): Promise<EmailResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
    return {
      sent: false,
      reason: 'not_configured',
      error: 'Email is not configured (RESEND_API_KEY / EMAIL_FROM)',
    };
  const body = JSON.stringify({
    from: env.EMAIL_FROM,
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    reply_to: msg.replyTo,
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body,
      });
      if (res.status === 429 && attempt === 0) {
        await pause(1200);
        continue;
      }
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { message?: string };
        return {
          sent: false,
          reason: 'failed',
          error: `Resend ${res.status}: ${(detail.message ?? 'request failed').slice(0, 200)}`,
        };
      }
      const ok = (await res.json().catch(() => ({}))) as { id?: string };
      return { sent: true, id: ok.id ?? null };
    }
    return { sent: false, reason: 'failed', error: 'Resend rate limit' };
  } catch (e) {
    return {
      sent: false,
      reason: 'failed',
      error: `Network error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200),
    };
  }
}

/** The dispatcher inbox(es). Defined in src/config/email.ts. */
export const teamRecipients = teamInbox;

export type DepositEmailInput = {
  to: string;
  publicToken: string;
  vehicle: Vehicle;
  weekStart: string;
  baseUrl: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Deposit received. Finish your booking details": the link for customers who closed the window after paying. */
export function depositEmailContent(i: DepositEmailInput) {
  const link = `${i.baseUrl.replace(/\/$/, '')}/booking/${i.publicToken}`;
  const car = `${i.vehicle.year} ${i.vehicle.make} ${i.vehicle.model}`;
  const week = weekLabel(i.weekStart);
  const subject = 'Deposit received. Finish your booking details';
  const text = `Thanks, we received your deposit and your spot is reserved.\n\nVehicle: ${car}\nPickup week: ${week}\n\nFinish your booking details here:\n${link}\n\nQuestions? Reply to this email or write to ${company.contactEmail}.\n${company.name}`;
  const html = `<p>Thanks, we received your deposit and your spot is reserved.</p><p><strong>Vehicle:</strong> ${esc(car)}<br><strong>Pickup week:</strong> ${esc(week)}</p><p><a href="${esc(link)}">Finish your booking details</a></p><p>Questions? Reply to this email or write to ${esc(company.contactEmail)}.<br>${esc(company.name)}</p>`;
  return { subject, text, html, link };
}

export async function sendDepositReceivedEmail(
  input: DepositEmailInput,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  const { subject, text, html } = depositEmailContent(input);
  return sendEmail(
    { to: input.to, subject, text, html, replyTo: customerReplyTo(env) },
    env,
    fetchImpl,
  );
}
