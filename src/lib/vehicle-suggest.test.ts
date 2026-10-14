import { describe, expect, it } from 'vitest';
import names from '@/data/vehicle-names.json';
import { buildVehicleNames } from '@/lib/vehicle-names-build';
import { canonicalMake, canonicalModel, suggestMakes, suggestModels } from '@/lib/vehicle-suggest';

describe('names list', () => {
  it('is up to date with src/config/vehicle-classes.ts (run `npm run vehicle-names` if not)', () => {
    expect(names).toEqual(buildVehicleNames());
  });
  it('holds names only: no classes, prices or ids', () => {
    expect(Object.keys(names).sort()).toEqual(['makes', 'models']);
    for (const m of names.makes) expect(Object.keys(m).sort()).toEqual(['aliases', 'key', 'name']);
    expect(JSON.stringify(names)).not.toMatch(/small-|midsize|large-|cents|price|\$/i);
  });
});

describe('suggestMakes', () => {
  it('is empty until something is typed', () => {
    expect(suggestMakes('')).toEqual([]);
    expect(suggestMakes('   ')).toEqual([]);
  });
  it('lists name prefixes in alphabetical order', () => {
    expect(suggestMakes('c')).toEqual(['Cadillac', 'Chevrolet', 'Chrysler']);
  });
  it('finds short names: chevy -> Chevrolet, vw -> Volkswagen, merc -> Mercedes-Benz', () => {
    expect(suggestMakes('chevy')).toEqual(['Chevrolet']);
    expect(suggestMakes('vw')).toEqual(['Volkswagen']);
    expect(suggestMakes('merc')).toEqual(['Mercedes-Benz']);
  });
  it('ranks a name prefix above a short-name match above a later word', () => {
    // "d": Dodge and 'dodgeram' (Ram, short name) after the name prefix.
    expect(suggestMakes('d')).toEqual(['Dodge', 'Ram']);
    // "b": BMW, Buick (name prefixes), then Mercedes-Benz (later word / short name "benz").
    expect(suggestMakes('b')).toEqual(['BMW', 'Buick', 'Mercedes-Benz']);
  });
  it('ignores case, spaces and hyphens', () => {
    expect(suggestMakes('MERCEDES BENZ')).toEqual(['Mercedes-Benz']);
    expect(suggestMakes('mercedes-benz')).toEqual([]); // already the full name
    expect(suggestMakes('mercedesb')).toEqual(['Mercedes-Benz']);
  });
  it('matches the start of a later word', () => {
    expect(suggestMakes('benz')).toEqual(['Mercedes-Benz']);
  });
  it('never returns more than 8, and drops an exact match', () => {
    expect(suggestMakes('a', 1)).toEqual(['Acura']);
    expect(suggestMakes('m', 2)).toHaveLength(2);
    expect(suggestMakes('')).toEqual([]);
    expect(suggestMakes('Honda')).toEqual([]);
    for (const q of 'abcdefghijklmnopqrstuvwxyz')
      expect(suggestMakes(q).length).toBeLessThanOrEqual(8);
  });
  it('suggests nothing for text that matches nothing', () => {
    expect(suggestMakes('zzzz')).toEqual([]);
  });
});

describe('suggestModels', () => {
  it('uses the typed make, including short names', () => {
    expect(suggestModels('chevy', 't')).toEqual(
      ['Tahoe', 'Traverse', 'Trax', 'Trailblazer'].sort(),
    );
    expect(suggestModels('Chevrolet', 'tah')).toEqual(['Tahoe']);
  });
  it('ignores case, spaces and hyphens', () => {
    expect(suggestModels('honda', 'crv')).toEqual(['CR-V']);
    expect(suggestModels('honda', 'CR V')).toEqual(['CR-V']);
    expect(suggestModels('toyota', 'rav')).toEqual(['RAV4']);
  });
  it('matches a later word after prefixes', () => {
    expect(suggestModels('toyota', 'cruiser')).toEqual(['Land Cruiser']);
    const r = suggestModels('toyota', 'c');
    expect(r.indexOf('Camry')).toBeLessThan(r.indexOf('Land Cruiser'));
  });
  it('is empty for an unknown make, an empty make or no text', () => {
    expect(suggestModels('zzz', 'a')).toEqual([]);
    expect(suggestModels('', 'a')).toEqual([]);
    expect(suggestModels('honda', '')).toEqual([]);
    expect(suggestModels('ram', 'a')).toEqual([]);
  });
  it('drops an exact match and caps the list', () => {
    expect(suggestModels('honda', 'civic')).toEqual([]);
    expect(suggestModels('ford', 'e', 2)).toHaveLength(2);
  });
});

describe('canonical names on blur', () => {
  it('turns an exact make or short name into the proper name', () => {
    expect(canonicalMake('chevy')).toBe('Chevrolet');
    expect(canonicalMake(' VW ')).toBe('Volkswagen');
    expect(canonicalMake('mercedes benz')).toBe('Mercedes-Benz');
    expect(canonicalMake('bmw')).toBe('BMW');
  });
  it('never touches a make that is only a prefix or matches nothing', () => {
    expect(canonicalMake('chev r')).toBeNull();
    expect(canonicalMake('toy')).toBeNull();
    expect(canonicalMake('Zzz Motors')).toBeNull();
    expect(canonicalMake('')).toBeNull();
  });
  it('turns an exact model into the listed name, using the typed make', () => {
    expect(canonicalModel('honda', 'crv')).toBe('CR-V');
    expect(canonicalModel('chevy', 'tahoe')).toBe('Tahoe');
    expect(canonicalModel('Ford', 'f150')).toBe('F-150');
  });
  it('never touches a model that is partial, unknown, or has an unknown make', () => {
    expect(canonicalModel('honda', 'cr')).toBeNull();
    expect(canonicalModel('honda', 'civic lx')).toBeNull();
    expect(canonicalModel('nobody', 'crv')).toBeNull();
    expect(canonicalModel('honda', '')).toBeNull();
  });
});
