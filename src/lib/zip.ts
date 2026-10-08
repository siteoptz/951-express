/** Returns the 5-digit ZIP string, or null if the input is not a valid ZIP. Leading zeros are preserved. */
export function normalizeZip(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const m = /^(\d{5})(?:-\d{4})?$/.exec(input.trim());
  return m ? m[1] : null;
}
