// The model years a customer may type: 1950 up to next year's model year (the current calendar year plus one).
export const vehicleYears = { min: 1950, maxAheadOfToday: 1 } as const; // TODO(client)

export const maxVehicleYear = (now: Date = new Date()): number =>
  now.getFullYear() + vehicleYears.maxAheadOfToday;
