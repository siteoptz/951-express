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

export type SizeClassConfig = { id: SizeClassId; label: string; example: string; baseCents: number };

export const sizeClasses: readonly SizeClassConfig[] = [
  { id: 'small-sedan', label: 'Small sedan', example: 'Honda Civic', baseCents: 140000 },
  { id: 'large-sedan', label: 'Large sedan', example: 'Toyota Avalon', baseCents: 150000 },
  { id: 'small-suv', label: 'Small SUV', example: 'Honda HR-V', baseCents: 150000 },
  { id: 'midsize-suv', label: 'Midsize SUV', example: 'BMW X5', baseCents: 170000 },
  { id: 'small-pickup', label: 'Small pickup', example: 'Older Ford Ranger or Toyota Tacoma', baseCents: 170000 },
  { id: 'midsize-pickup', label: 'Midsize pickup', example: 'Newer Ford Ranger or Toyota Tacoma', baseCents: 190000 },
  { id: 'minivan', label: 'Minivan', example: 'Honda Odyssey', baseCents: 190000 },
];

// Large SUVs and large pickups have no online price: the customer requests a personalized quote.
export const largeVehicle = {
  label: 'Large SUV or pickup',
  example: 'Chevrolet Tahoe, Chevrolet Silverado 1500 and larger',
} as const;

export const pricing = {
  inoperableSurchargeCents: 15000, // TODO(client)
  modifiedSurchargeCents: 10000, // TODO(client)
  modifiedPolicy: 'surcharge' as 'surcharge' | 'review', // TODO(client)
  deposit: { type: 'percent' as const, value: 25 }, // TODO(client)
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
