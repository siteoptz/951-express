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
  // How the dispatch sheet names the balance payment so Super Dispatch reads it as Cash (one method
  // only; the full list above stays in the instructions). TODO(client): confirm with Cal's Super Dispatch account.
  dispatchPaymentTerms: 'Cash upon delivery',
  // "Location Type" on the dispatch sheet for the pickup and delivery addresses (customers' homes and offices).
  dispatchLocationType: 'Residential',
  // The short form is for places that already sit under a "Balance due at delivery" label (the cart).
  balanceMessageShort,
  balanceMessage: `Balance due at delivery: ${balanceMessageShort}`,
  // Standard delivery is an estimate of days after pickup, not a guarantee.
  deliveryWindowDays: { min: 7, max: 10 },
  personalItemsNotice: 'Up to 100 lbs of personal items, in the trunk only.',
  // The one-line answer in the emails' "Personal items" field.
  personalItemsYes: 'Yes (up to 100 lbs, trunk only)',
  // Bumped whenever the terms text changes. It is saved with every booking. Date format: the day the text was published.
  termsVersion: '2026-10-17.1',
  termsLastUpdated: 'October 17, 2026',
} as const;
