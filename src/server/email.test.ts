import { describe, expect, it, vi } from 'vitest';
import { customerReplyTo, teamInbox } from '@/config/email';
import {
  depositEmailContent,
  sendDepositReceivedEmail,
  sendEmail,
  teamRecipients,
} from '@/server/email';

const env = { RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'onboarding@resend.dev' };
const msg = {
  to: 'a@example.com',
  subject: 'Hi',
  html: '<p>Hi</p>',
  text: 'Hi',
  replyTo: 'r@example.com',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('sendEmail', () => {
  it('does nothing when Resend is not configured', async () => {
    const f = vi.fn();
    expect(await sendEmail(msg, {}, f as never)).toMatchObject({
      sent: false,
      reason: 'not_configured',
    });
    expect(await sendEmail(msg, { RESEND_API_KEY: 'x' }, f as never)).toMatchObject({
      sent: false,
      reason: 'not_configured',
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('posts the message to Resend and returns its id', async () => {
    const f = vi.fn(async () => json({ id: 'em_1' }));
    expect(await sendEmail(msg, env, f as never)).toEqual({ sent: true, id: 'em_1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: 'onboarding@resend.dev',
      to: ['a@example.com'],
      subject: 'Hi',
      reply_to: 'r@example.com',
    });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
  });
  it('sends attachments to Resend as base64, and none when there are none', async () => {
    const f = vi.fn(async () => json({ id: 'em_2' }));
    await sendEmail(
      { ...msg, attachments: [{ filename: 'a.pdf', content: Buffer.from('%PDF-1.7') }] },
      env,
      f as never,
    );
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.attachments).toEqual([
      { filename: 'a.pdf', content: Buffer.from('%PDF-1.7').toString('base64') },
    ]);
    await sendEmail({ ...msg, attachments: [] }, env, f as never);
    expect(
      JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body)),
    ).not.toHaveProperty('attachments');
  });
  it('accepts several recipients and a response without an id', async () => {
    const f = vi.fn(async () => new Response('not json', { status: 200 }));
    expect(
      await sendEmail({ ...msg, to: ['a@example.com', 'b@example.com'] }, env, f as never),
    ).toEqual({ sent: true, id: null });
    expect(
      JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).to,
    ).toEqual(['a@example.com', 'b@example.com']);
  });
  it('retries once after a rate limit, then gives up', async () => {
    const pause = vi.fn(async () => undefined);
    const ok = vi
      .fn()
      .mockResolvedValueOnce(json({ message: 'slow down' }, 429))
      .mockResolvedValueOnce(json({ id: 'em_2' }));
    expect(await sendEmail(msg, env, ok as never, pause)).toEqual({ sent: true, id: 'em_2' });
    expect(pause).toHaveBeenCalledTimes(1);
    const always = vi.fn(async () => json({ message: 'slow down' }, 429));
    expect(await sendEmail(msg, env, always as never, pause)).toMatchObject({
      sent: false,
      reason: 'failed',
      error: expect.stringContaining('429'),
    });
  });
  it('reports Resend errors without leaking the key', async () => {
    const f = vi.fn(async () =>
      json({ message: 'You can only send testing emails to your own email address.' }, 403),
    );
    const r = await sendEmail(msg, env, f as never);
    expect(r).toMatchObject({ sent: false, reason: 'failed' });
    expect(r.sent === false && r.error).toBe(
      'Resend 403: You can only send testing emails to your own email address.',
    );
    expect(JSON.stringify(r)).not.toContain('re_test_key');
    expect(await sendEmail(msg, env, (async () => json({}, 500)) as never)).toMatchObject({
      error: 'Resend 500: request failed',
    });
  });
  it('turns a network failure into a result, never a throw', async () => {
    const r = await sendEmail(msg, env, (async () =>
      Promise.reject(new Error('offline'))) as never);
    expect(r).toMatchObject({ sent: false, reason: 'failed', error: 'Network error: offline' });
    expect(await sendEmail(msg, env, (async () => Promise.reject('boom')) as never)).toMatchObject({
      error: 'Network error: boom',
    });
  });
});

describe('helpers', () => {
  it('splits the team inbox list', () => {
    expect(teamRecipients({ BOOKINGS_EMAIL_TO: 'a@x.com, b@x.com ,' })).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
    expect(teamRecipients({})).toEqual([]);
    expect(teamInbox({ BOOKINGS_EMAIL_TO: '951.dispatcher@gmail.com' })).toEqual([
      '951.dispatcher@gmail.com',
    ]);
  });
  it('sends replies to customers to the dispatcher inbox, and to nobody when none is set', () => {
    expect(customerReplyTo({ BOOKINGS_EMAIL_TO: '951.dispatcher@gmail.com' })).toEqual([
      '951.dispatcher@gmail.com',
    ]);
    expect(customerReplyTo({ BOOKINGS_EMAIL_TO: 'a@x.com, b@x.com' })).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
    expect(customerReplyTo({})).toBeUndefined();
  });
  it('builds the deposit email link and text', async () => {
    const i = {
      to: 'c@example.com',
      publicToken: 'tok123',
      vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
      weekStart: '2026-10-19',
      baseUrl: 'https://example.com/',
    };
    const c = depositEmailContent(i);
    expect(c.link).toBe('https://example.com/booking/tok123');
    expect(c.subject).toBe('Deposit received. Finish your booking details');
    expect(c.text).toContain('Oct 19 – 25');
    const f = vi.fn(async () => json({ id: 'em_3' }));
    const withInbox = { ...env, BOOKINGS_EMAIL_TO: '951.dispatcher@gmail.com' };
    expect(await sendDepositReceivedEmail(i, withInbox, f as never)).toEqual({
      sent: true,
      id: 'em_3',
    });
    // replies to the deposit email reach the dispatcher
    expect(
      JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).reply_to,
    ).toEqual(['951.dispatcher@gmail.com']);
    await sendDepositReceivedEmail(i, env, f as never);
    expect(
      JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body)).reply_to,
    ).toBeUndefined();
  });
});
