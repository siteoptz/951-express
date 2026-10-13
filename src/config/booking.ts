// TODO(client): confirm booking rules and replace the terms version when final text arrives.
export const booking = {
  timezone: 'America/Los_Angeles',
  weekStartsOn: 1, // Monday
  leadDays: 3,
  weeksShown: 8,
  holdMinutes: 30,
  // Stripe will not accept a Checkout Session that expires sooner than 30 minutes from creation.
  stripeMinSessionSeconds: 30 * 60,
  stripeSessionBufferSeconds: 10,
  // Tags our Checkout Sessions in the Stripe Dashboard.
  stripeIntegrationIdentifier: '951-express-deposit-kxqfzmwd',
  personalItemsNotice: "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
  // Bumped whenever the terms text changes. It is saved with every booking. Date format: the day the text was published.
  termsVersion: '2026-10-13',
  termsLastUpdated: 'October 13, 2026',
} as const;
