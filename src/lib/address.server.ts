import 'server-only';
import zipcodes from 'zipcodes';

export type ZipPlace = {
  /** The ZIP's city, or null when the ZIP is not in the address data and only the state is known. */
  city: string | null;
  state: string;
  /** True when this came from the ZIP's first three digits rather than the ZIP itself. */
  approximate: boolean;
};

let byPrefix: Map<string, string> | null = null;

/** The state most ZIPs share for a three-digit prefix, for real ZIPs the address data does not list. */
function stateForPrefix(prefix: string): string | null {
  if (!byPrefix) {
    const counts = new Map<string, Map<string, number>>();
    for (const info of Object.values(zipcodes.codes)) {
      const p = info.zip.slice(0, 3);
      const m = counts.get(p) ?? new Map<string, number>();
      m.set(info.state, (m.get(info.state) ?? 0) + 1);
      counts.set(p, m);
    }
    byPrefix = new Map(
      [...counts].map(([p, m]) => [p, [...m].sort((a, b) => b[1] - a[1])[0][0]] as const),
    );
  }
  return byPrefix.get(prefix) ?? null;
}

/** City and state for a ZIP. The state is derived here and nowhere else. Null when nothing is known about the ZIP. */
export function zipPlace(zip: string): ZipPlace | null {
  const five = zip.slice(0, 5);
  if (!/^\d{5}$/.test(five)) return null;
  const info = zipcodes.lookup(five);
  if (info) return { city: info.city, state: info.state, approximate: false };
  const state = stateForPrefix(five.slice(0, 3));
  return state ? { city: null, state, approximate: true } : null;
}
