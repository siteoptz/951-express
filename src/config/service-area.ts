import coverageData from '@/data/zips/coverage.json';
import type { Region } from '@/config/routes';

// State ZIP counts and map points are derived from coverage.json (built from the client ZIP lists).
// Only this summary may reach the browser; the full lists stay server-side.
export type RegionCoverage = {
  total: number;
  unrecognized: number;
  states: Record<string, number>;
  stateTotals: Record<string, number>;
  points: [number, number, number][];
};
export const coverage = coverageData as unknown as Record<Region, RegionCoverage>;

export const homeTerminal = {
  name: 'Corona, CA',
  state: 'CA',
  lat: 33.8753,
  lng: -117.5664,
} as const;

export const stateNames: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

// Map presentation. TODO(client): confirm the metro list and wording.
export const regionStyle: Record<
  Region,
  { label: string; dot: string; tint: string; text: string }
> = {
  west: {
    label: 'West region (pickup & delivery)',
    dot: '#17304F',
    tint: '#9FB5D1',
    text: '#17304F',
  },
  east: {
    label: 'East region (pickup & delivery)',
    dot: '#F5A524',
    tint: '#F8CE80',
    text: '#8A5A00',
  },
};

// A covered state is tinted by the share of its ZIPs we serve: never less than minMix of the full tint,
// and the full tint at fullAtShare or more. Uncovered states stay gray.
export const tintScale = { baseGray: '#E4E8EE', minMix: 0.2, fullAtShare: 0.6 } as const;

// Under 640px the East state labels are hidden and these two region labels are shown instead.
export const regionLabels = [
  { region: 'west', text: 'WEST', lat: 39.2, lng: -117.5 },
  { region: 'east', text: 'EAST', lat: 31.6, lng: -77.2 },
] as const;

export const westMetros = [
  {
    name: 'Southern California',
    lines: ['Southern', 'California'],
    lat: 34.0,
    lng: -117.9,
    dx: -8,
    dy: 36,
    anchor: 'middle',
  },
  {
    name: 'Phoenix',
    lines: ['Phoenix'],
    lat: 33.45,
    lng: -112.07,
    dx: 0,
    dy: -22,
    anchor: 'middle',
  },
  { name: 'Tucson', lines: ['Tucson'], lat: 32.22, lng: -110.97, dx: 0, dy: 32, anchor: 'middle' },
  {
    name: 'El Paso',
    lines: ['El Paso'],
    lat: 31.76,
    lng: -106.49,
    dx: 6,
    dy: 32,
    anchor: 'middle',
  },
] as const;

// East states are labeled with their postal code. dx/dy nudge crowded labels toward open water.
export const eastStateLabels = [
  { state: 'AL', dx: 0, dy: 0 },
  { state: 'GA', dx: 0, dy: 0 },
  { state: 'SC', dx: 6, dy: 4 },
  { state: 'NC', dx: 6, dy: 0 },
  { state: 'VA', dx: 6, dy: 4 },
  { state: 'MD', dx: 36, dy: -20 },
  { state: 'DE', dx: 38, dy: 2 },
  { state: 'DC', dx: 36, dy: 24 },
] as const;

export const mapCopy = {
  arcLabel: 'Weekly runs · West ⇄ East',
  terminalLabel: 'Corona, CA terminal',
  legendNote: 'Every shipment runs between the two regions.',
  mapLabel: 'Service area map: West and East regions',
  westMetroSummary: 'Southern California, Phoenix, Tucson, and El Paso',
  tooltip: '{state} · {region} region · {count} ZIP codes served',
} as const;
