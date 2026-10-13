import { describe, expect, it } from 'vitest';
import { sizeClassIds, topDeckLimits } from '@/config/pricing';
import { routes } from '@/config/routes';
import {
  defaultTopDeckCapacity,
  topDeckFits,
  topDeckRemaining,
  topDeckSlotFor,
  usedFromClasses,
} from '@/lib/top-deck';

describe('capacity defaults', () => {
  it('is 6 spots per direction per week', () => {
    expect(routes.map((r) => [r.id, r.weeklyCapacity])).toEqual([
      ['west-to-east', 6],
      ['east-to-west', 6],
    ]);
  });
  it('has 3 SUV slots and 1 car slot', () => {
    expect(defaultTopDeckCapacity()).toEqual({ suv: 3, car: 1 });
  });
});

describe('slot types', () => {
  it('puts every size class in exactly one slot type', () => {
    const suv = topDeckLimits.suvClasses as readonly string[];
    const car = topDeckLimits.carClasses as readonly string[];
    expect([...suv, ...car].sort()).toEqual([...sizeClassIds].sort());
    for (const id of suv) expect(topDeckSlotFor(id)).toBe('suv');
    for (const id of car) expect(topDeckSlotFor(id)).toBe('car');
  });
  it('lists minivans and small and midsize pickups as SUV slots', () => {
    for (const id of ['minivan', 'small-pickup', 'midsize-pickup', 'small-suv', 'midsize-suv'])
      expect(topDeckSlotFor(id)).toBe('suv');
    for (const id of ['small-sedan', 'large-sedan']) expect(topDeckSlotFor(id)).toBe('car');
  });
});

describe('topDeckRemaining', () => {
  it('starts with everything free; a sedan can use the car slot or any SUV slot', () => {
    expect(topDeckRemaining({ suv: 0, car: 0 })).toEqual({ suv: 3, car: 4 });
  });
  it('fills SUV slots one by one', () => {
    expect(topDeckRemaining({ suv: 2, car: 0 })).toEqual({ suv: 1, car: 2 });
    expect(topDeckRemaining({ suv: 3, car: 0 })).toEqual({ suv: 0, car: 1 });
    expect(topDeckFits('suv', { suv: 3, car: 0 })).toBe(false);
    expect(topDeckFits('car', { suv: 3, car: 0 })).toBe(true); // the car slot is still free
  });
  it('lets a second sedan take a free SUV slot, which reduces the SUV slots', () => {
    expect(topDeckRemaining({ suv: 0, car: 1 })).toEqual({ suv: 3, car: 3 });
    expect(topDeckRemaining({ suv: 0, car: 2 })).toEqual({ suv: 2, car: 2 });
    expect(topDeckRemaining({ suv: 2, car: 2 })).toEqual({ suv: 0, car: 0 });
  });
  it('sells out both types once 3 SUVs and the car slot are used', () => {
    const r = topDeckRemaining({ suv: 3, car: 1 });
    expect(r).toEqual({ suv: 0, car: 0 });
    expect(topDeckFits('suv', { suv: 3, car: 1 })).toBe(false);
    expect(topDeckFits('car', { suv: 3, car: 1 })).toBe(false);
  });
  it('honors a per-week override', () => {
    expect(topDeckRemaining({ suv: 1, car: 0 }, { suv: 1, car: 0 })).toEqual({ suv: 0, car: 0 });
    expect(topDeckRemaining({ suv: 0, car: 0 }, { suv: 5, car: 2 })).toEqual({ suv: 5, car: 7 });
  });
  it('never goes negative', () => {
    expect(topDeckRemaining({ suv: 9, car: 9 })).toEqual({ suv: 0, car: 0 });
  });
});

describe('usedFromClasses', () => {
  it('groups size classes into slot counts', () => {
    expect(
      usedFromClasses([
        { sizeClass: 'small-suv', n: 2 },
        { sizeClass: 'minivan', n: 1 },
        { sizeClass: 'large-sedan', n: 1 },
      ]),
    ).toEqual({ suv: 3, car: 1 });
  });
});
