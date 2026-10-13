import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { zipInputAttrs } from '@/lib/zip-input';

describe('ZIP input attributes', () => {
  it('opts out of every password manager and keeps numeric input', () => {
    expect(zipInputAttrs).toEqual({
      inputMode: 'numeric',
      'data-1p-ignore': true,
      'data-lpignore': 'true',
      'data-bwignore': true,
      'data-form-type': 'other',
    });
  });
  // Each file below holds ZIP inputs; the spread count must match the number of inputs it renders.
  it.each([
    ['src/components/landing/ZipCheckBox.tsx', 1],
    ['src/components/booking/BookingModal.tsx', 2],
    ['src/components/booking/DetailsForm.tsx', 1],
  ])(
    '%s spreads the attributes onto %i ZIP input(s) and keeps postal-code autocomplete',
    (file, n) => {
      const src = readFileSync(file, 'utf8');
      expect(src.match(/\{\.\.\.zipInputAttrs\}/g)).toHaveLength(n);
      expect(src.match(/autoComplete=\{?[`"][^`"]*postal-code/g)).toHaveLength(n);
      expect(src).not.toMatch(/autoComplete="off"/);
    },
  );
});
