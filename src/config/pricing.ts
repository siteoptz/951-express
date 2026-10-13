// All money is stored as integer cents. TODO(client): confirm every rate.
export const sizeClassIds = [
  'small-sedan',
  'large-sedan',
  'small-suv',
  'midsize-suv',
  'small-pickup',
  'midsize-pickup',
  'minivan',
] as const;
export type SizeClassId = (typeof sizeClassIds)[number];

export type SizeClassConfig = {
  id: SizeClassId;
  label: string;
  example: string;
  baseCents: number;
};

export const sizeClasses: readonly SizeClassConfig[] = [
  { id: 'small-sedan', label: 'Small sedan', example: 'Honda Civic', baseCents: 140000 },
  { id: 'large-sedan', label: 'Large sedan', example: 'Toyota Avalon', baseCents: 150000 },
  { id: 'small-suv', label: 'Small SUV', example: 'Honda HR-V', baseCents: 150000 },
  { id: 'midsize-suv', label: 'Midsize SUV', example: 'BMW X5', baseCents: 170000 },
  {
    id: 'small-pickup',
    label: 'Small pickup',
    example: 'Older Ford Ranger or Toyota Tacoma',
    baseCents: 170000,
  },
  {
    id: 'midsize-pickup',
    label: 'Midsize pickup',
    example: 'Newer Ford Ranger or Toyota Tacoma',
    baseCents: 190000,
  },
  { id: 'minivan', label: 'Minivan', example: 'Honda Odyssey', baseCents: 190000 },
];

// Large SUVs, pickups and vans have no online price: the customer requests a personalized quote.
export const largeVehicle = {
  label: 'Large SUV / Full-size pickup / Van',
  example: 'Chevrolet Tahoe, Ford F-150, Ram ProMaster',
} as const;

export type DepositConfig =
  { type: 'flat'; amountCents: number } | { type: 'percent'; value: number };
export type PricingConfig = { deposit: DepositConfig };

export const pricing: PricingConfig = {
  // A flat $100 on every booking (Cal, 2026-10-13). Percent is still supported: { type: 'percent', value: 25 }.
  deposit: { type: 'flat', amountCents: 10000 },
};

export const topDeck = {
  surchargeCents: 15000, // TODO(client)
  label: 'Top Deck Load',
  standardLabel: 'Standard',
  benefits: [
    'Eliminates the possibility of oil leaks from other vehicles',
    'Protects the vehicle from road debris due to its elevated position on the trailer',
  ],
} as const;

/**
 * Top Deck Load limits per route per week (Cal, 2026-10-13). A top-deck booking uses one of the week's main spots
 * as well as one of these slots. All of this is TODO(client) to confirm.
 */
export const topDeckLimits = {
  suvSlots: 3,
  carSlots: 1,
  // A sedan may use a free SUV slot when the car slot is taken.
  carMayUseSuvSlot: true,
  suvClasses: ['small-suv', 'midsize-suv', 'minivan', 'small-pickup', 'midsize-pickup'],
  carClasses: ['small-sedan', 'large-sedan'],
} as const;
