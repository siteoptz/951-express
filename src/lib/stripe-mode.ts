export type StripeMode = 'live' | 'test';

/** Which Stripe mode a key belongs to, from its prefix (pk_/sk_/rk_ + live/test). Anything else is unknown. */
export function stripeKeyMode(key: string | undefined): StripeMode | null {
  const m = /^(?:pk|sk|rk)_(live|test)_/.exec(key ?? '');
  return m ? (m[1] as StripeMode) : null;
}

/**
 * Checks that the publishable key (browser) and the secret key (server) are from the same Stripe mode. A mismatch would
 * open a checkout the browser cannot complete, or worse, mix test and live data. Returns a message for the logs, or null
 * when the keys agree (or one is missing or unrecognized, which other checks already report).
 */
export function stripeKeyMismatch(
  publishableKey: string | undefined,
  secretKey: string | undefined,
): string | null {
  const pk = stripeKeyMode(publishableKey);
  const sk = stripeKeyMode(secretKey);
  if (pk && sk && pk !== sk) {
    return `Stripe keys are from different modes: the publishable key is ${pk} and the secret key is ${sk}.`;
  }
  return null;
}
