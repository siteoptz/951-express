// Where email goes. TODO(client): confirm the dispatcher inbox and who should receive replies.
type Env = Record<string, string | undefined>;

/** The dispatcher inbox(es): BOOKINGS_EMAIL_TO, comma separated. New booking and quote-request emails go here. */
export const teamInbox = (env: Env = process.env): string[] =>
  (env.BOOKINGS_EMAIL_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Reply-To for emails sent to customers (the deposit email and the booking confirmation): replies reach the dispatcher
 * inbox, because the From address (bookings@notify...) is not monitored. Undefined when no inbox is configured.
 */
export const customerReplyTo = (env: Env = process.env): string[] | undefined => {
  const inbox = teamInbox(env);
  return inbox.length ? inbox : undefined;
};
