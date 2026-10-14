// Type-ahead for the Make and Model boxes. It reads only the names list (src/data/vehicle-names.json): no size
// classes, no prices, no network. Matching ignores case, spaces and hyphens ("crv" finds "CR-V").
import names from '@/data/vehicle-names.json';

export const maxSuggestions = 8;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

type Ranked = { text: string; rank: number };

/** Lower rank is better: 0 starts with the text, 1 a short name starts with it, 2 a later word starts with it. */
function rankAll(items: { text: string; rank: number }[]): string[] {
  const seen = new Set<string>();
  return (items as Ranked[])
    .sort((a, b) => a.rank - b.rank || a.text.localeCompare(b.text))
    .filter((i) => !seen.has(i.text) && !!seen.add(i.text))
    .map((i) => i.text);
}

/** Does any word of `name` (split on spaces and hyphens) start with the query? */
const wordStarts = (name: string, q: string) =>
  name
    .toLowerCase()
    .split(/[\s-]+/)
    .some((w) => squash(w).startsWith(q));

/** Up to 8 makes for what was typed: name prefixes first, then short names ("chevy", "vw"). */
export function suggestMakes(typed: string, limit = maxSuggestions): string[] {
  const q = squash(typed);
  if (!q) return [];
  const found: Ranked[] = [];
  for (const m of names.makes) {
    if (squash(m.name).startsWith(q)) found.push({ text: m.name, rank: 0 });
    else if (m.aliases.some((a) => squash(a).startsWith(q))) found.push({ text: m.name, rank: 1 });
  }
  return finish(rankAll(found), typed, limit);
}

/** The make behind what was typed: its name, or one of its short names. */
function findMake(typed: string) {
  const q = squash(typed);
  return q
    ? names.makes.find((x) => squash(x.name) === q || x.aliases.some((a) => squash(a) === q))
    : undefined;
}

/** Up to 8 models of the typed make ("chevy" counts as Chevrolet). Nothing when the make is not one we list. */
export function suggestModels(make: string, typed: string, limit = maxSuggestions): string[] {
  const q = squash(typed);
  const found = findMake(make);
  if (!q || !found) return [];
  const ranked: Ranked[] = [];
  for (const model of (names.models as Record<string, string[]>)[found.key]) {
    if (squash(model).startsWith(q)) ranked.push({ text: model, rank: 0 });
    else if (wordStarts(model, q)) ranked.push({ text: model, rank: 2 });
  }
  return finish(rankAll(ranked), typed, limit);
}

/** An entry that is already what was typed (ignoring case) has nothing to offer, so it is dropped. "crv" still offers "CR-V". */
const finish = (list: string[], typed: string, limit: number) =>
  list.filter((s) => s.toLowerCase() !== typed.trim().toLowerCase()).slice(0, limit);

/** The make's proper name when the text is exactly a make or one of its short names ("chevy" -> "Chevrolet"). */
export const canonicalMake = (typed: string): string | null => findMake(typed)?.name ?? null;

/** The listed model name when the text matches it exactly, ignoring case, spaces and hyphens ("crv" -> "CR-V"). */
export function canonicalModel(make: string, typed: string): string | null {
  const found = findMake(make);
  const q = squash(typed);
  if (!found || !q) return null;
  return (names.models as Record<string, string[]>)[found.key].find((m) => squash(m) === q) ?? null;
}
