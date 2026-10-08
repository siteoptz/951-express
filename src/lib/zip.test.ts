import { describe, expect, it } from 'vitest';
import { normalizeZip } from '@/lib/zip';

describe('normalizeZip', () => {
  it('accepts 5-digit strings, keeping leading zeros', () => {
    expect(normalizeZip('92881')).toBe('92881');
    expect(normalizeZip(' 02108 ')).toBe('02108');
  });
  it('accepts ZIP+4 and returns the 5 digits', () => {
    expect(normalizeZip('92881-1234')).toBe('92881');
  });
  it('rejects everything else', () => {
    for (const v of ['2108', '921811', 'abcde', '', '92 881', 92881, null, undefined]) {
      expect(normalizeZip(v)).toBeNull();
    }
  });
});
