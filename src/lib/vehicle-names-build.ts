// Builds the names-only list behind the Make and Model suggestions (src/data/vehicle-names.json). The browser gets
// make names, their short names and model names, and nothing else from the size tables: no classes, no prices.
// Makes come from three places: the size tables, the exotic list (src/config/eligibility.ts) and the U.S.-market list
// (src/config/makes.ts). A make with no size table has no model suggestions. Regenerate with `npm run vehicle-names`
// after editing any of them (a test fails if it is stale).
import { exoticMakes } from '@/config/eligibility';
import { allMakes } from '@/config/makes';
import { classRules, makeAliases, unknownExceptions, yearRules } from '@/config/vehicle-classes';
import { normalizeMakeName } from '@/lib/vehicle-normalize';
import { squash } from '@/lib/size-class';

export type VehicleNames = {
  makes: { name: string; key: string; aliases: string[] }[];
  /** make key ("chevrolet") -> model names, in table order */
  models: Record<string, string[]>;
};

export function buildVehicleNames(): VehicleNames {
  const models: Record<string, string[]> = {};
  const add = (key: string, model: string) => {
    if (!model.trim()) return; // "" means every model of the make in the tables; it is not a name to suggest
    (models[key] ??= []).push(model);
  };
  for (const { models: byMake } of [...classRules, { models: unknownExceptions }])
    for (const [key, list] of Object.entries(byMake)) {
      models[key] ??= [];
      for (const m of list) add(key, m);
    }
  for (const y of yearRules) add(y.make, y.model);
  for (const name of [...allMakes, ...exoticMakes]) models[squash(name)] ??= [];

  const aliasesOf = (key: string) =>
    Object.entries(makeAliases)
      .filter(([alias, target]) => target === key && alias !== key)
      .map(([alias]) => alias)
      .sort();
  const makes = Object.keys(models)
    .map((key) => ({ name: normalizeMakeName(key), key, aliases: aliasesOf(key) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    makes,
    models: Object.fromEntries(makes.map((m) => [m.key, [...new Set(models[m.key])]])),
  };
}
