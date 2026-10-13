import { describe, expect, it } from 'vitest';
import { classifyVehicle } from '@/lib/size-class';
import {
  collapseSpaces,
  isValidYear,
  normalizeMakeName,
  normalizeModelName,
  normalizeVehicle,
  notRecognizedReason,
  parseYear,
  tidyCase,
  typedMakeModel,
} from '@/lib/vehicle-normalize';

const now = new Date('2026-10-13T12:00:00Z');
const cls = (make: string, model: string, year = 2021) => classifyVehicle({ year, make, model });

describe('spaces and case', () => {
  it('trims and collapses spaces', () => {
    expect(collapseSpaces('  chevy   tahoe  ')).toBe('chevy tahoe');
  });
  it('capitalizes all-lowercase text and keeps mixed case as typed', () => {
    expect(tidyCase('silverado 1500')).toBe('Silverado 1500');
    expect(tidyCase('grand-cherokee')).toBe('Grand-Cherokee');
    expect(tidyCase('F-150 XLT')).toBe('F-150 XLT');
    expect(tidyCase('  CR-V ')).toBe('CR-V');
  });
});

describe('make aliases', () => {
  it.each([
    ['chevy', 'Chevrolet'],
    ['CHEVY', 'Chevrolet'],
    ['  Chevy ', 'Chevrolet'],
    ['chev', 'Chevrolet'],
    ['vw', 'Volkswagen'],
    ['VW', 'Volkswagen'],
    ['mercedes', 'Mercedes-Benz'],
    ['benz', 'Mercedes-Benz'],
    ['Merc', 'Mercedes-Benz'],
    ['mercedes benz', 'Mercedes-Benz'],
    ['mercedes-benz', 'Mercedes-Benz'],
    ['bmw', 'BMW'],
    ['gmc', 'GMC'],
    ['lambo', 'Lamborghini'],
    ['rolls royce', 'Rolls-Royce'],
    ['land rover', 'Land Rover'],
    ['toyota', 'Toyota'],
    ['honda', 'Honda'],
    ['ferarri', 'Ferarri'], // a misspelling we do not know is kept as typed
  ])('%s -> %s', (typed, want) => expect(normalizeMakeName(typed)).toBe(want));

  it('classifies by the alias, not the typed spelling', () => {
    expect(cls('chevy', 'tahoe')).toBe('large');
    expect(cls('VW', 'Jetta')).toBe('small-sedan');
    expect(cls('merc', 'GLC')).toBe('small-suv');
  });
});

describe('models ignore case, spaces and hyphens', () => {
  it.each([
    ['ford', 'F150', 'large'],
    ['ford', 'f-150', 'large'],
    ['Ford', 'F 150', 'large'],
    ['toyota', 'RAV 4', 'small-suv'],
    ['toyota', 'rav-4', 'small-suv'],
    ['toyota', 'Rav4', 'small-suv'],
    ['honda', 'CRV', 'small-suv'],
    ['honda', 'cr v', 'small-suv'],
    ['Honda', 'CR-V', 'small-suv'],
    ['chevrolet', 'Silverado1500', 'large'],
    ['chevrolet', 'Silverado 1500', 'large'],
    ['chevrolet', 'silverado   1500 LT', 'large'],
    ['honda', 'civic lx', 'small-sedan'],
    ['Honda', '  CIVIC  ', 'small-sedan'],
  ] as const)('%s %s -> %s', (make, model, want) => expect(cls(make, model)).toBe(want));

  it('writes the list name when the typed model is the same ignoring spaces and hyphens', () => {
    expect(normalizeModelName('ford', 'f150', 2021)).toBe('F-150');
    expect(normalizeModelName('toyota', 'rav 4', 2021)).toBe('RAV4');
    expect(normalizeModelName('honda', 'crv', 2021)).toBe('CR-V');
    expect(normalizeModelName('chevy', 'tahoe', 2021)).toBe('Tahoe');
  });
  it('keeps a longer typed model, tidied', () => {
    expect(normalizeModelName('chevrolet', 'silverado 1500 lt', 2021)).toBe('Silverado 1500 Lt');
    expect(normalizeModelName('honda', 'Civic LX', 2021)).toBe('Civic LX');
  });
});

describe('normalizeVehicle', () => {
  it('cleans make and model and keeps the year', () => {
    expect(normalizeVehicle({ year: 2021, make: ' chevy ', model: 'TAHOE' })).toEqual({
      year: 2021,
      make: 'Chevrolet',
      model: 'Tahoe',
    });
    expect(normalizeVehicle({ year: 2020, make: 'toyota', model: 'rav 4' })).toEqual({
      year: 2020,
      make: 'Toyota',
      model: 'RAV4',
    });
  });
  it('reads back the typed words for the review reason', () => {
    expect(typedMakeModel({ make: ' Zzz ', model: 'Thing   X' })).toBe('Zzz Thing X');
    expect(notRecognizedReason({ make: 'Zzz', model: 'Thing' })).toBe(
      "vehicle not recognized: 'Zzz Thing'",
    );
  });
});

describe('year validation', () => {
  it('accepts 1950 up to next year, four digits only', () => {
    expect(parseYear('1950', now)).toBe(1950);
    expect(parseYear('2026', now)).toBe(2026);
    expect(parseYear('2027', now)).toBe(2027); // current year + 1
    expect(parseYear(' 2021 ', now)).toBe(2021);
  });
  it.each(['1949', '2028', '0000', '99', '202', '20211', '20a1', '', '2021.5', '-2021'])(
    'rejects %s',
    (text) => expect(parseYear(text, now)).toBeNull(),
  );
  it('isValidYear checks the same range', () => {
    expect(isValidYear(1950, now)).toBe(true);
    expect(isValidYear(1949, now)).toBe(false);
    expect(isValidYear(2027, now)).toBe(true);
    expect(isValidYear(2028, now)).toBe(false);
    expect(isValidYear(2021.5, now)).toBe(false);
  });
});
