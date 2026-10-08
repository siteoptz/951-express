import { describe, expect, it } from 'vitest';
import {
  clearForm,
  decidedClass,
  digitsOnly,
  formReducer,
  initialForm,
  isDirty,
  isZip,
  leadPayload,
  loadForm,
  saveForm,
  step1Payload,
  yearOptions,
  type FormState,
} from '@/lib/booking-form';

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};
const filled: FormState = {
  ...initialForm,
  pickupZip: '90001',
  deliveryZip: '21201',
  year: '2020',
  make: 'HONDA',
  model: 'Civic',
  operable: true,
  modified: false,
  personalItems: false,
  weekStart: '2026-10-19',
  terms: true,
};
const set = (s: FormState, field: keyof FormState, value: string | boolean | null) =>
  formReducer(s, { type: 'set', field, value });

describe('formReducer', () => {
  it('clears dependent answers when a parent changes', () => {
    const f = { ...filled, selectedClass: 'small-suv' };
    expect(set(f, 'year', '2019')).toMatchObject({ make: '', model: '', selectedClass: '' });
    expect(set(f, 'make', 'FORD')).toMatchObject({ make: 'FORD', model: '', selectedClass: '' });
    expect(set(f, 'model', 'Fiesta')).toMatchObject({ model: 'Fiesta', selectedClass: '' });
    expect(set({ ...f, leadWeek: '2026-10-19' }, 'pickupZip', '85001')).toMatchObject({
      deliveryZip: '',
      weekStart: '',
      leadWeek: '',
    });
    expect(set(f, 'deliveryZip', '30301')).toMatchObject({ weekStart: '' });
    expect(set(f, 'operable', false).make).toBe('HONDA');
  });
  it('hydrates and resets', () => {
    expect(formReducer(initialForm, { type: 'hydrate', state: { make: 'X' } }).make).toBe('X');
    expect(formReducer(filled, { type: 'reset' })).toEqual(initialForm);
  });
});

describe('helpers', () => {
  it('detects dirty forms and cleans ZIP input', () => {
    expect(isDirty(initialForm)).toBe(false);
    expect(isDirty(set(initialForm, 'pickupZip', '9'))).toBe(true);
    expect(digitsOnly('90a0-01 7')).toBe('90001');
    expect(isZip('90001')).toBe(true);
    expect(isZip('9000')).toBe(false);
  });
  it('lists model years newest first', () => {
    const y = yearOptions(new Date('2026-10-08'));
    expect(y[0]).toBe(2027);
    expect(y.at(-1)).toBe(1980);
  });
});

describe('decidedClass', () => {
  it('uses the table, then the customer pick for unknown vehicles', () => {
    expect(decidedClass(filled)).toEqual({ classified: 'small-sedan', decided: 'small-sedan' });
    expect(decidedClass({ ...filled, make: 'Zzz', model: 'X' })).toEqual({
      classified: null,
      decided: null,
    });
    expect(decidedClass({ ...filled, make: 'Zzz', model: 'X', selectedClass: 'minivan' })).toEqual({
      classified: null,
      decided: 'minivan',
    });
    expect(
      decidedClass({ ...filled, make: 'Zzz', model: 'X', selectedClass: 'large' }).decided,
    ).toBe('large');
    expect(
      decidedClass({ ...filled, make: 'Zzz', model: 'X', selectedClass: 'bogus' }).decided,
    ).toBeNull();
    expect(decidedClass({ ...filled, model: '' })).toEqual({ classified: null, decided: null });
  });
});

describe('payloads', () => {
  it('builds the Step 1 body with no prices', () => {
    const p = step1Payload(filled)!;
    expect(p).toMatchObject({
      pickupZip: '90001',
      vehicle: { year: 2020, make: 'HONDA', model: 'Civic' },
      topDeck: false,
      termsAccepted: true,
    });
    expect(Object.keys(p)).not.toContain('totalCents');
  });
  it('is null while anything is missing, and for large vehicles', () => {
    expect(step1Payload({ ...filled, terms: false })).toBeNull();
    expect(step1Payload({ ...filled, weekStart: '' })).toBeNull();
    expect(step1Payload({ ...filled, operable: null })).toBeNull();
    expect(step1Payload({ ...filled, deliveryZip: '2120' })).toBeNull();
    expect(step1Payload({ ...filled, make: 'Chevrolet', model: 'Tahoe' })).toBeNull();
    expect(step1Payload({ ...filled, make: 'Zzz', model: 'X' })).toBeNull();
  });
  it('builds the lead body only for large vehicles with contact details', () => {
    const large = {
      ...filled,
      make: 'Chevrolet',
      model: 'Tahoe',
      name: ' Pat ',
      phone: '951-555-0100',
      email: 'p@x.com',
      notes: ' hi ',
    };
    expect(leadPayload(large)).toMatchObject({
      name: 'Pat',
      notes: 'hi',
      vehicle: { make: 'Chevrolet' },
    });
    expect(leadPayload({ ...large, notes: '' })!.notes).toBeUndefined();
    expect(leadPayload(large)!.preferredWeekStart).toBeUndefined();
    expect(leadPayload({ ...large, leadWeek: '2026-10-19' })!.preferredWeekStart).toBe(
      '2026-10-19',
    );
    expect(leadPayload({ ...large, name: '' })).toBeNull();
    expect(leadPayload({ ...large, modified: null })).toBeNull();
    expect(leadPayload({ ...large, pickupZip: '9' })).toBeNull();
    expect(leadPayload(filled)).toBeNull();
  });
});

describe('persistence', () => {
  it('round-trips answers but never terms', () => {
    const s = mem();
    saveForm(filled, s);
    const loaded = loadForm(s);
    expect(loaded).toMatchObject({
      pickupZip: '90001',
      operable: true,
      personalItems: false,
      terms: false,
    });
    clearForm(s);
    expect(loadForm(s)).toEqual({});
  });
  it('survives missing, bad, or blocked storage', () => {
    expect(loadForm(null)).toEqual({});
    const bad = mem();
    bad.setItem('booking-form-v1', '{nope');
    expect(loadForm(bad)).toEqual({});
    const wrong = mem();
    wrong.setItem(
      'booking-form-v1',
      JSON.stringify({ pickupZip: 5, operable: 'yes', topDeck: true, year: '2020' }),
    );
    expect(loadForm(wrong)).toEqual({ topDeck: true, year: '2020', terms: false });
    const nullable = mem();
    nullable.setItem('booking-form-v1', JSON.stringify({ operable: null }));
    expect(loadForm(nullable).operable).toBeNull();
    const boom = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadForm(boom)).toEqual({});
    expect(() => saveForm(filled, boom)).not.toThrow();
    expect(() => clearForm(boom)).not.toThrow();
  });
});
