import type { SizeClassId } from '@/config/pricing';

// Every list in this file is a starting default. TODO(client): confirm all of it.
// Matching is by make plus a model prefix, ignoring case, spaces, and punctuation. The longest match wins,
// so "Bronco Sport" beats "Bronco". A model that matches nothing is unknown (null), and the customer
// picks a class, which flags the booking for review.

export type VehicleClass = SizeClassId | 'large';

/** make -> model prefixes. An empty string matches every model of that make. */
export type ModelsByMake = Record<string, string[]>;

export const makeAliases: Record<string, string> = {
  chevy: 'chevrolet',
  vw: 'volkswagen',
  mercedes: 'mercedesbenz',
  ramtrucks: 'ram',
};

// Year-dependent models. Each rule applies when the year is <= maxYear or >= minYear; other years are unknown.
export type YearRule = {
  make: string;
  model: string;
  small?: { maxYear: number };
  midsize?: { minYear: number };
};
export const yearRules: YearRule[] = [
  { make: 'ford', model: 'Ranger', small: { maxYear: 2012 }, midsize: { minYear: 2019 } },
  { make: 'toyota', model: 'Tacoma', small: { maxYear: 2004 }, midsize: { minYear: 2005 } },
  { make: 'nissan', model: 'Frontier', small: { maxYear: 2004 }, midsize: { minYear: 2005 } },
];

const large: ModelsByMake = {
  ford: ['F-150', 'F-250', 'F-350', 'F-450', 'F-550', 'F-650', 'F-750', 'Expedition', 'Transit'],
  chevrolet: ['Silverado', 'Tahoe', 'Suburban', 'Express'],
  gmc: ['Sierra', 'Yukon', 'Savana'], // Savana is the GMC twin of the Chevrolet Express
  ram: [''],
  dodge: ['Ram'],
  toyota: ['Tundra', 'Sequoia', 'Land Cruiser'],
  nissan: ['Titan', 'Armada'],
  infiniti: ['QX80'],
  lexus: ['LX'],
  cadillac: ['Escalade'],
  lincoln: ['Navigator'],
  jeep: ['Wagoneer', 'Grand Wagoneer'],
  mercedesbenz: ['Sprinter'],
  freightliner: ['Sprinter'],
};

const minivan: ModelsByMake = {
  honda: ['Odyssey'],
  toyota: ['Sienna'],
  chrysler: ['Pacifica', 'Town & Country', 'Voyager'],
  kia: ['Carnival', 'Sedona'],
  dodge: ['Grand Caravan', 'Caravan'],
  nissan: ['Quest'],
};

const smallPickup: ModelsByMake = {
  chevrolet: ['S-10'],
  gmc: ['Sonoma'],
  mazda: ['B-Series', 'B2000', 'B2200', 'B2300', 'B2500', 'B3000', 'B4000'],
  ford: ['Maverick'],
  hyundai: ['Santa Cruz'],
};

const midsizePickup: ModelsByMake = {
  chevrolet: ['Colorado'],
  gmc: ['Canyon'],
  honda: ['Ridgeline'],
  jeep: ['Gladiator'],
  dodge: ['Dakota'],
};

const midsizeSuv: ModelsByMake = {
  bmw: ['X5', 'X6', 'X7'],
  toyota: ['Highlander', 'Grand Highlander', '4Runner', 'Venza'],
  honda: ['Pilot', 'Passport'],
  ford: ['Explorer', 'Edge', 'Bronco', 'Flex'],
  jeep: ['Grand Cherokee', 'Cherokee', 'Wrangler'],
  hyundai: ['Santa Fe', 'Palisade'],
  kia: ['Telluride', 'Sorento'],
  chevrolet: ['Traverse', 'Blazer'],
  gmc: ['Acadia'],
  buick: ['Enclave'],
  volkswagen: ['Atlas'],
  nissan: ['Pathfinder', 'Murano'],
  dodge: ['Durango'],
  mazda: ['CX-9', 'CX-90'],
  subaru: ['Ascent'],
  mitsubishi: ['Outlander'],
  lexus: ['GX', 'RX', 'TX'],
  acura: ['MDX'],
  mercedesbenz: ['GLE', 'GLS', 'G-Class'],
  audi: ['Q7', 'Q8'],
  tesla: ['Model X'],
  volvo: ['XC90', 'XC60'],
  lincoln: ['Aviator', 'Nautilus'],
  cadillac: ['XT5', 'XT6'],
  rivian: ['R1S'],
};

const smallSuv: ModelsByMake = {
  honda: ['HR-V', 'CR-V'],
  toyota: ['RAV4', 'Corolla Cross', 'C-HR'],
  ford: ['Escape', 'Bronco Sport', 'EcoSport', 'Kuga'],
  nissan: ['Rogue', 'Kicks', 'Juke'],
  hyundai: ['Tucson', 'Kona', 'Venue'],
  mazda: ['CX-5', 'CX-30', 'CX-3', 'CX-50'],
  chevrolet: ['Equinox', 'Trax', 'Trailblazer'],
  kia: ['Sportage', 'Seltos', 'Soul', 'Niro'],
  subaru: ['Forester', 'Outback', 'Crosstrek', 'XV'],
  jeep: ['Compass', 'Renegade', 'Patriot'],
  buick: ['Encore', 'Envision'],
  gmc: ['Terrain'],
  volkswagen: ['Tiguan', 'Taos'],
  tesla: ['Model Y'],
  bmw: ['X1', 'X2', 'X3', 'X4'],
  audi: ['Q3', 'Q5'],
  mercedesbenz: ['GLA', 'GLB', 'GLC'],
  lexus: ['NX', 'UX'],
  acura: ['RDX'],
  volvo: ['XC40'],
  mini: ['Countryman'],
  mitsubishi: ['Outlander Sport', 'RVR'],
};

const largeSedan: ModelsByMake = {
  toyota: ['Camry', 'Avalon'],
  honda: ['Accord'],
  nissan: ['Altima', 'Maxima'],
  hyundai: ['Sonata', 'Azera'],
  kia: ['Optima', 'K5', 'Cadenza', 'Stinger'],
  chevrolet: ['Malibu', 'Impala', 'Camaro'],
  ford: ['Fusion', 'Taurus', 'Mustang'],
  dodge: ['Charger', 'Challenger'],
  chrysler: ['300'],
  volkswagen: ['Passat', 'Arteon'],
  subaru: ['Legacy'],
  mazda: ['Mazda6', '6'],
  tesla: ['Model S'],
  bmw: ['3 Series', '5 Series', '7 Series'],
  mercedesbenz: ['C-Class', 'E-Class', 'S-Class'],
  audi: ['A4', 'A6', 'A8'],
  lexus: ['ES', 'IS', 'GS', 'LS'],
  genesis: ['G70', 'G80', 'G90'],
};

const smallSedan: ModelsByMake = {
  honda: ['Civic', 'Fit', 'Insight', 'CR-Z'],
  toyota: ['Corolla', 'Yaris', 'Prius', 'Matrix'],
  hyundai: ['Elantra', 'Accent', 'Veloster', 'Ioniq'],
  nissan: ['Sentra', 'Versa', 'Leaf'],
  mazda: ['Mazda3', '3', 'Mazda2', 'MX-5'],
  volkswagen: ['Jetta', 'Golf', 'Beetle', 'GTI'],
  kia: ['Forte', 'Rio'],
  subaru: ['Impreza', 'WRX', 'BRZ'],
  chevrolet: ['Cruze', 'Spark', 'Sonic', 'Cobalt', 'Bolt'],
  ford: ['Focus', 'Fiesta'],
  dodge: ['Dart'],
  mitsubishi: ['Mirage', 'Lancer'],
  mini: ['Cooper', 'Hardtop', 'Clubman'],
  fiat: [''],
  smart: [''],
  scion: [''],
  tesla: ['Model 3'],
};

export const classRules: { result: VehicleClass; models: ModelsByMake }[] = [
  { result: 'large', models: large },
  { result: 'minivan', models: minivan },
  { result: 'small-pickup', models: smallPickup },
  { result: 'midsize-pickup', models: midsizePickup },
  { result: 'midsize-suv', models: midsizeSuv },
  { result: 'small-suv', models: smallSuv },
  { result: 'large-sedan', models: largeSedan },
  { result: 'small-sedan', models: smallSedan },
];

// Models that look like a larger match but are not (result: unknown).
export const unknownExceptions: ModelsByMake = {
  ford: ['Transit Connect'],
};
