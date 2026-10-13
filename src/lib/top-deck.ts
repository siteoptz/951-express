// Top Deck Load limits. Each route and week has a few top-deck slots: some for SUV-sized vehicles, one for a car.
// A top-deck booking also uses one of the week's main spots. Pure, so the browser and the server agree.
import { topDeckLimits } from '@/config/pricing';

export type TopDeckSlot = 'suv' | 'car';
export type SlotCounts = { suv: number; car: number };

/** Which kind of slot a size class needs. Anything not listed as a car is treated as an SUV-sized load. */
export function topDeckSlotFor(sizeClass: string): TopDeckSlot {
  return (topDeckLimits.carClasses as readonly string[]).includes(sizeClass) ? 'car' : 'suv';
}

export const defaultTopDeckCapacity = (): SlotCounts => ({
  suv: topDeckLimits.suvSlots,
  car: topDeckLimits.carSlots,
});

/**
 * Slots still free. `used` counts top-deck bookings by the slot they need. A sedan takes the car slot first and
 * then, if allowed, a free SUV slot, so extra sedans reduce the SUV slots left.
 */
export function topDeckRemaining(
  used: SlotCounts,
  capacity: SlotCounts = defaultTopDeckCapacity(),
): SlotCounts {
  const carOverflow = topDeckLimits.carMayUseSuvSlot ? Math.max(0, used.car - capacity.car) : 0;
  const suv = Math.max(0, capacity.suv - used.suv - carOverflow);
  const car = Math.max(0, capacity.car - used.car) + (topDeckLimits.carMayUseSuvSlot ? suv : 0);
  return { suv, car };
}

export const topDeckFits = (slot: TopDeckSlot, used: SlotCounts, capacity?: SlotCounts): boolean =>
  topDeckRemaining(used, capacity)[slot] >= 1;

export function usedFromClasses(classCounts: { sizeClass: string; n: number }[]): SlotCounts {
  const used: SlotCounts = { suv: 0, car: 0 };
  for (const { sizeClass, n } of classCounts) used[topDeckSlotFor(sizeClass)] += n;
  return used;
}
