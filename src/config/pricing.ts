// All money is stored as integer cents. TODO(client): confirm every rate.
export const sizeClasses = [
  { id: 'sedan', label: 'Sedan', baseCents: 85000 },
  { id: 'midsize-suv', label: 'Mid-size SUV', baseCents: 97500 },
  { id: 'pickup-fullsize-van', label: 'Pickup / Full-size SUV / Van', baseCents: 110000 },
  { id: 'oversized', label: 'Oversized', baseCents: 130000 },
] as const;

export const pricing = {
  inoperableSurchargeCents: 15000,
  modifiedSurchargeCents: 10000,
  modifiedPolicy: 'surcharge' as 'surcharge' | 'review', // TODO(client)
  deposit: { type: 'percent' as const, value: 25 }, // TODO(client)
};
