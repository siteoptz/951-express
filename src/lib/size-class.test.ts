import { describe, expect, it } from 'vitest';
import { classifyVehicle, resolveSizeClass } from '@/lib/size-class';

const c = (year: number, make: string, model: string) => classifyVehicle({ year, make, model });

describe('year cutoffs', () => {
  it.each([
    [2012, 'Ford', 'Ranger', 'small-pickup'],
    [2005, 'Ford', 'Ranger', 'small-pickup'],
    [2019, 'Ford', 'Ranger', 'midsize-pickup'],
    [2024, 'Ford', 'Ranger', 'midsize-pickup'],
    [2004, 'Toyota', 'Tacoma', 'small-pickup'],
    [2005, 'Toyota', 'Tacoma', 'midsize-pickup'],
    [2004, 'Nissan', 'Frontier', 'small-pickup'],
    [2005, 'Nissan', 'Frontier', 'midsize-pickup'],
  ])('%i %s %s → %s', (y, mk, md, want) => expect(c(y, mk, md)).toBe(want));

  it('returns null for a Ranger in the gap years and for a bad year', () => {
    for (const y of [2013, 2016, 2018]) expect(c(y, 'Ford', 'Ranger')).toBeNull();
    expect(c(Number.NaN, 'Toyota', 'Tacoma')).toBeNull();
  });
});

describe('model lists', () => {
  it.each([
    ['Chevrolet', 'S-10', 'small-pickup'],
    ['GMC', 'Sonoma', 'small-pickup'],
    ['Mazda', 'B2300', 'small-pickup'],
    ['Ford', 'Maverick', 'small-pickup'],
    ['Hyundai', 'Santa Cruz', 'small-pickup'],
    ['Chevrolet', 'Colorado', 'midsize-pickup'],
    ['GMC', 'Canyon', 'midsize-pickup'],
    ['Honda', 'Ridgeline', 'midsize-pickup'],
    ['Jeep', 'Gladiator', 'midsize-pickup'],
    ['Dodge', 'Dakota', 'midsize-pickup'],
    ['Honda', 'Odyssey', 'minivan'],
    ['Toyota', 'Sienna', 'minivan'],
    ['Chrysler', 'Pacifica', 'minivan'],
    ['Kia', 'Carnival', 'minivan'],
    ['Dodge', 'Grand Caravan', 'minivan'],
    ['Nissan', 'Quest', 'minivan'],
    ['Honda', 'Civic', 'small-sedan'],
    ['Toyota', 'Corolla', 'small-sedan'],
    ['Toyota', 'Camry', 'large-sedan'],
    ['Toyota', 'Avalon', 'large-sedan'],
    ['Dodge', 'Charger', 'large-sedan'],
    ['Honda', 'HR-V', 'small-suv'],
    ['Toyota', 'RAV4', 'small-suv'],
    ['Toyota', 'Corolla Cross', 'small-suv'],
    ['Ford', 'Bronco Sport', 'small-suv'],
    ['Ford', 'Bronco', 'midsize-suv'],
    ['BMW', 'X5', 'midsize-suv'],
    ['Toyota', 'Highlander', 'midsize-suv'],
    ['Jeep', 'Grand Cherokee', 'midsize-suv'],
  ])('%s %s → %s', (mk, md, want) => expect(c(2020, mk, md)).toBe(want));

  it.each([
    ['Ford', 'F-150'], ['Ford', 'F-250 Super Duty'], ['Ford', 'F150 Lightning'], ['Ford', 'Expedition'],
    ['Ford', 'Transit'], ['Chevrolet', 'Silverado 1500'], ['Chevrolet', 'Silverado 2500HD'],
    ['GMC', 'Sierra 1500'], ['Ram', '1500'], ['RAM', 'ProMaster'], ['Dodge', 'Ram 1500'],
    ['Toyota', 'Tundra'], ['Toyota', 'Sequoia'], ['Toyota', 'Land Cruiser'], ['Nissan', 'Titan'],
    ['Nissan', 'Armada'], ['Infiniti', 'QX80'], ['Lexus', 'LX 600'], ['Chevrolet', 'Tahoe'],
    ['Chevrolet', 'Suburban'], ['GMC', 'Yukon XL'], ['Cadillac', 'Escalade'], ['Lincoln', 'Navigator'],
    ['Jeep', 'Grand Wagoneer'], ['Jeep', 'Wagoneer'], ['Mercedes-Benz', 'Sprinter'], ['Chevrolet', 'Express'],
  ])('%s %s → large', (mk, md) => expect(c(2021, mk, md)).toBe('large'));
});

describe('normalization and unknowns', () => {
  it('handles make aliases, case, and punctuation', () => {
    expect(c(2020, 'CHEVY', 'tahoe')).toBe('large');
    expect(c(2020, 'Chevrolet', 'Silverado-1500')).toBe('large');
    expect(c(2020, 'MERCEDES-BENZ', 'GLE 350')).toBe('midsize-suv');
    expect(c(2020, 'VW', 'Jetta')).toBe('small-sedan');
  });
  it('returns null for unknown vehicles, blanks, and Transit Connect', () => {
    expect(c(2020, 'Zzz', 'Whatever')).toBeNull();
    expect(c(2020, '', 'Civic')).toBeNull();
    expect(c(2020, 'Honda', '')).toBeNull();
    expect(c(2020, 'Ford', 'Transit Connect')).toBeNull();
    expect(c(2020, 'Honda', 'Zzz')).toBeNull();
  });
});

describe('resolveSizeClass (server decision)', () => {
  const civic = { year: 2020, make: 'Honda', model: 'Civic' };
  const unknown = { year: 2020, make: 'Zzz', model: 'Thing' };
  it('ignores a cheaper class chosen for a known vehicle', () => {
    const tahoe = { year: 2020, make: 'Chevrolet', model: 'Tahoe' };
    expect(resolveSizeClass(tahoe, 'small-sedan')).toEqual({ ok: true, sizeClass: 'large', needsReview: false });
    expect(resolveSizeClass(civic, 'minivan')).toEqual({ ok: true, sizeClass: 'small-sedan', needsReview: false });
  });
  it('uses the selected class for unknown vehicles and flags review', () => {
    expect(resolveSizeClass(unknown, 'small-suv')).toEqual({ ok: true, sizeClass: 'small-suv', needsReview: true });
    expect(resolveSizeClass(unknown, 'large')).toEqual({ ok: true, sizeClass: 'large', needsReview: true });
  });
  it('requires a valid class for unknown vehicles', () => {
    expect(resolveSizeClass(unknown)).toEqual({ ok: false, reason: 'class_required' });
    expect(resolveSizeClass(unknown, 'bogus')).toEqual({ ok: false, reason: 'invalid_class' });
  });
});
