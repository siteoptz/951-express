// Vehicles that cannot be booked online. They go to the "Request a personalized quote" form instead:
// the lead is stored and emailed, with no deposit and no hold. All values here are defaults.

export const quoteReasonIds = [
  'large_vehicle',
  'inoperable',
  'modified',
  'exotic',
  'high_value',
] as const;
export type QuoteReason = (typeof quoteReasonIds)[number];

// Matched case-insensitively, ignoring spaces and punctuation ("Rolls Royce" = "Rolls-Royce").
// TODO(client): confirm Maserati and Lotus stay on this list.
export const exoticMakes = [
  'Ferrari',
  'Lamborghini',
  'McLaren',
  'Rolls-Royce',
  'Bentley',
  'Aston Martin',
  'Bugatti',
  'Pagani',
  'Koenigsegg',
  'Maserati',
  'Lotus',
] as const;

/** Any model containing one of these is exotic, whatever the make (for example Mercedes-Maybach). */
export const exoticModelContains = ['Maybach'] as const;

/** "Is your vehicle worth more than $X?" Answering Yes sends the customer to the quote form. */
export const highValueThresholdUsd = 100_000;

export const modificationDetailsMaxLength = 500;
