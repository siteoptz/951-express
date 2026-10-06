// TODO(client): confirm booking rules and replace the terms version when final text arrives.
export const booking = {
  timezone: 'America/Los_Angeles',
  weekStartsOn: 1, // Monday
  leadDays: 3,
  weeksShown: 8,
  holdMinutes: 30,
  personalItemsNotice: "100 lbs included. Anything over 100 lbs is at the driver's discretion.",
  termsVersion: '0.0-placeholder',
} as const;
