// Minimal Resend sender for the "deposit received" link. Phase 7 replaces the body with React Email templates and
// adds the team and confirmation emails; the sending code here stays.
import { company } from '@/config/company';
import type { Vehicle } from '@/db/schema';
import { weekLabel } from '@/lib/weeks';

export type DepositEmailInput = {
  to: string;
  publicToken: string;
  vehicle: Vehicle;
  weekStart: string;
  baseUrl: string;
};

export type EmailResult =
  { sent: true; id: string | null } | { sent: false; reason: 'not_configured' | 'failed' };

export function depositEmailContent(i: DepositEmailInput) {
  const link = `${i.baseUrl.replace(/\/$/, '')}/booking/${i.publicToken}`;
  const car = `${i.vehicle.year} ${i.vehicle.make} ${i.vehicle.model}`;
  const week = weekLabel(i.weekStart);
  const subject = 'Deposit received. Finish your booking details';
  const text = `Thanks, we received your deposit and your spot is reserved.\n\nVehicle: ${car}\nPickup week: ${week}\n\nFinish your booking details here:\n${link}\n\nQuestions? Call ${company.phone}.\n${company.name}`;
  const html = `<p>Thanks, we received your deposit and your spot is reserved.</p><p><strong>Vehicle:</strong> ${esc(car)}<br><strong>Pickup week:</strong> ${esc(week)}</p><p><a href="${esc(link)}">Finish your booking details</a></p><p>Questions? Call ${esc(company.phone)}.<br>${esc(company.name)}</p>`;
  return { subject, text, html, link };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sendDepositReceivedEmail(
  input: DepositEmailInput,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false, reason: 'not_configured' };
  const { subject, text, html } = depositEmailContent(input);
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject, text, html }),
    });
    if (!res.ok) return { sent: false, reason: 'failed' };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: body.id ?? null };
  } catch {
    return { sent: false, reason: 'failed' };
  }
}
