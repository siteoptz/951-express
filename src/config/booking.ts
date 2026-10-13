// TODO(client): confirm booking rules and replace the terms version when final text arrives.
const balanceMessageShort =
  "Cash, Cashier's Check, or Zelle only. Credit cards are not accepted for the balance.";

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
  // How the customer pays the balance at delivery. Shown in the cart, the confirmation, the emails, the dispatch
  // sheet and the Terms, always from here. Credit cards are not accepted for the balance.
  balanceMethods: ['Cash', "Cashier's Check", 'Zelle'],
  // The short form is for places that already sit under a "Balance due at delivery" label (the cart).
  balanceMessageShort,
  balanceMessage: `Balance due at delivery: ${balanceMessageShort}`,
  // Standard delivery is an estimate of days after pickup, not a guarantee.
  deliveryWindowDays: { min: 7, max: 10 },
  personalItemsNotice: "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
  // Bumped whenever the terms text changes. It is saved with every booking. Date format: the day the text was published.
  termsVersion: '2026-10-13.4',
  termsLastUpdated: 'October 13, 2026',
} as const;
