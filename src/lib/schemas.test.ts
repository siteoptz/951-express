import { describe, expect, it } from 'vitest';
import { quoteRequestSchema, selectableClass } from '@/lib/schemas';

const valid = {
  name: 'Pat Driver', phone: '951-555-0100', email: 'pat@example.com', pickupZip: '90001', deliveryZip: '30301',
  vehicle: { year: 2021, make: 'Chevrolet', model: 'Tahoe' }, operable: true, modified: false,
};

describe('quoteRequestSchema', () => {
  it('accepts a valid request, with or without notes', () => {
    expect(quoteRequestSchema.safeParse(valid).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...valid, notes: 'Lifted' }).success).toBe(true);
  });
  it('rejects bad email, ZIP, and year', () => {
    expect(quoteRequestSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, pickupZip: '9000' }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...valid, vehicle: { ...valid.vehicle, year: 1800 } }).success).toBe(false);
  });
  it('allows large as a selectable class', () => {
    expect(selectableClass.safeParse('large').success).toBe(true);
    expect(selectableClass.safeParse('huge').success).toBe(false);
  });
});
