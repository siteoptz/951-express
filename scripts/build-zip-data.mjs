// Builds src/data/zips/{west,east,coverage}.json from the raw client files in data/raw/.
// Run: node scripts/build-zip-data.mjs [--report-only]
// Refuses to write anything if a ZIP appears in both regions.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { unzipSync, strFromU8 } from 'fflate';

const require = createRequire(import.meta.url);
const zipcodes = require('zipcodes');

const root = new URL('..', import.meta.url).pathname;
const rawDir = `${root}data/raw/`;
const outDir = `${root}src/data/zips/`;
const reportOnly = process.argv.includes('--report-only');

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Returns the text cells of the first column of the first sheet, in row order. */
function readXlsxCells(path) {
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
      )
    : [];
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  const cells = [];
  for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const v = m[4]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    if (v === undefined) continue;
    cells.push({ ref: m[1] + m[2], numeric: !/t="s"/.test(m[3]) && !/t="str"/.test(m[3]), text: /t="s"/.test(m[3]) ? shared[Number(v)] : decode(v) });
  }
  return cells;
}

function parseTokens(texts) {
  return texts.flatMap((t) => t.split(/[\s,;]+/)).filter(Boolean);
}

function normalize(tokens) {
  const zips = new Set();
  const stats = { tokens: tokens.length, padded: [], invalid: [], duplicates: 0 };
  for (const raw of tokens) {
    const t = raw.replace(/^'|'$/g, '');
    if (!/^\d{1,5}$/.test(t)) {
      stats.invalid.push(raw);
      continue;
    }
    const z = t.padStart(5, '0');
    if (z !== t) stats.padded.push(`${t}→${z}`);
    if (zips.has(z)) stats.duplicates++;
    zips.add(z);
  }
  return { zips: [...zips].sort(), stats };
}

const westCells = readXlsxCells(`${rawDir}west_zip_codes.xlsx`);
const westTexts = westCells.map((c) => c.text);
const eastText = readFileSync(`${rawDir}east_zip_codes.txt`, 'utf8');

const west = normalize(parseTokens(westTexts));
const east = normalize(parseTokens([eastText]));

function lookup(zips) {
  const byState = {};
  const unknown = [];
  const points = [];
  for (const z of zips) {
    const info = zipcodes.lookup(z);
    if (!info) {
      unknown.push(z);
      continue;
    }
    byState[info.state] = (byState[info.state] ?? 0) + 1;
    points.push({ zip: z, lat: info.latitude, lng: info.longitude });
  }
  return { byState: Object.fromEntries(Object.entries(byState).sort()), unknown, points };
}

const w = lookup(west.zips);
const e = lookup(east.zips);
const eastSet = new Set(east.zips);
const both = west.zips.filter((z) => eastSet.has(z));

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log('=== ZIP REPORT ===');
console.log(`west_zip_codes.xlsx: ${westCells.length} non-empty cells in column A (rows ${westCells[0]?.ref}–${westCells.at(-1)?.ref}), all text: ${westCells.every((c) => !c.numeric)}, header row: ${/^\d/.test(westTexts[0] ?? '') ? 'none' : 'YES: ' + westTexts[0]}`);
console.log(`east_zip_codes.txt: ${eastText.length} chars, ${eastText.split('\n').length} line(s), comma-separated, header row: ${/^\d/.test(eastText.trim()) ? 'none' : 'YES'}`);
for (const [name, r, l] of [['WEST', west, w], ['EAST', east, e]]) {
  console.log(`\n${name}: ${r.stats.tokens} raw tokens → ${r.zips.length} unique ZIPs (${r.stats.duplicates} duplicates removed)`);
  console.log(`  leading-zero repairs: ${r.stats.padded.length}${r.stats.padded.length ? ' e.g. ' + r.stats.padded.slice(0, 8).join(', ') : ''}`);
  console.log(`  invalid tokens: ${r.stats.invalid.length}${r.stats.invalid.length ? ' ' + JSON.stringify(r.stats.invalid) : ''}`);
  console.log(`  unrecognized by zipcodes pkg: ${l.unknown.length}${l.unknown.length ? ' ' + l.unknown.join(', ') : ''}`);
  console.log(`  states (${Object.keys(l.byState).length}, ${sum(l.byState)} ZIPs recognized): ${Object.entries(l.byState).map(([s, n]) => `${s}:${n}`).join(' ')}`);
}
console.log(`\nZIPs in BOTH lists: ${both.length}${both.length ? ' ' + both.join(', ') : ''}`);

if (both.length) {
  console.error('\nSTOP: overlap between West and East lists. Nothing written.');
  process.exit(1);
}
if (reportOnly) process.exit(0);

// Coverage: per-state counts plus a thinned point set for the map (0.25° grid, with a count per cell).
function grid(points) {
  const cells = new Map();
  for (const p of points) {
    const lat = Math.round(p.lat * 4) / 4;
    const lng = Math.round(p.lng * 4) / 4;
    const k = `${lat},${lng}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  return [...cells].map(([k, n]) => [...k.split(',').map(Number), n]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}west.json`, JSON.stringify(west.zips) + '\n');
writeFileSync(`${outDir}east.json`, JSON.stringify(east.zips) + '\n');
writeFileSync(
  `${outDir}coverage.json`,
  JSON.stringify({
    // points are [lat, lng, zipCount] per 0.25° cell
    west: { total: west.zips.length, states: w.byState, points: grid(w.points) },
    east: { total: east.zips.length, states: e.byState, points: grid(e.points) },
  }) + '\n',
);
console.log(`\nWrote west.json (${west.zips.length}), east.json (${east.zips.length}), coverage.json to src/data/zips/`);
