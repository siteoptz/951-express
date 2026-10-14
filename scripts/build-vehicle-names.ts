// Writes src/data/vehicle-names.json from the size tables (names only). Run: npm run vehicle-names
import { writeFileSync } from 'node:fs';
import { buildVehicleNames } from '../src/lib/vehicle-names-build';

const out = new URL('../src/data/vehicle-names.json', import.meta.url);
writeFileSync(out, JSON.stringify(buildVehicleNames(), null, 2) + '\n');
console.log('wrote src/data/vehicle-names.json');
