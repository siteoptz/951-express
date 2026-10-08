import { describe, expect, it } from 'vitest';
import west from '@/data/zips/west.json';
import east from '@/data/zips/east.json';
import { coverage, homeTerminal } from '@/config/service-area';
import {
  tintFor,
  buildArc,
  buildDots,
  buildMap,
  dotRadius,
  must,
  project,
  regionSummaries,
} from '@/lib/service-map';

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('coverage.json', () => {
  it('totals equal the ZIP list lengths', () => {
    expect(coverage.west.total).toBe(west.length);
    expect(coverage.east.total).toBe(east.length);
  });
  it('accounts for every ZIP: recognized per state plus unrecognized', () => {
    for (const r of ['west', 'east'] as const) {
      expect(sum(coverage[r].states) + coverage[r].unrecognized).toBe(coverage[r].total);
      expect(coverage[r].points.reduce((a, p) => a + p[2], 0)).toBe(sum(coverage[r].states));
    }
  });
  it('never lists a state in both regions', () => {
    const both = Object.keys(coverage.west.states).filter((s) => s in coverage.east.states);
    expect(both).toEqual([]);
  });
});

describe('buildMap', () => {
  const map = buildMap();
  const byAbbr = Object.fromEntries(map.states.map((s) => [s.abbr, s]));

  it('tints every covered state with the right region, and nothing else', () => {
    for (const r of ['west', 'east'] as const) {
      for (const [abbr, count] of Object.entries(coverage[r].states)) {
        expect(byAbbr[abbr]?.region).toBe(r);
        expect(byAbbr[abbr]?.count).toBe(count);
      }
    }
    const covered = map.states.filter((s) => s.region).length;
    expect(covered).toBe(
      Object.keys(coverage.west.states).length + Object.keys(coverage.east.states).length,
    );
  });
  it('writes the tooltip text', () => {
    expect(byAbbr.GA.tooltip).toBe('Georgia · East region · 462 ZIP codes served');
    expect(byAbbr.TX.tooltip).toMatch(/^Texas · West region · \d+ ZIP codes served$/);
    expect(byAbbr.OR.tooltip).toBeNull();
  });
  it('omits Alaska and Hawaii', () => {
    expect(byAbbr.AK).toBeUndefined();
    expect(byAbbr.HI).toBeUndefined();
  });
  it('lines the projected points up with the state shapes', () => {
    const margin = 12;
    for (const r of ['west', 'east'] as const) {
      expect(map.dots[r]).toHaveLength(coverage[r].points.length);
      const boxes = Object.keys(coverage[r].states).map((a) => byAbbr[a].bounds);
      for (const d of map.dots[r]) {
        const inside = boxes.some(
          ([[x0, y0], [x1, y1]]) =>
            d.x >= x0 - margin && d.x <= x1 + margin && d.y >= y0 - margin && d.y <= y1 + margin,
        );
        expect(inside).toBe(true);
      }
    }
  });
  it('pins the Corona terminal inside California', () => {
    const [[x0, y0], [x1, y1]] = byAbbr.CA.bounds;
    expect(map.terminal!.x).toBeGreaterThan(x0);
    expect(map.terminal!.x).toBeLessThan(x1);
    expect(map.terminal!.y).toBeGreaterThan(y0);
    expect(map.terminal!.y).toBeLessThan(y1);
  });
  it('places a label for every configured metro and East state', () => {
    expect(map.metroLabels.map((m) => m.name)).toEqual([
      'Southern California',
      'Phoenix',
      'Tucson',
      'El Paso',
    ]);
    expect(map.stateLabels.map((s) => s.abbr)).toEqual([
      'AL',
      'GA',
      'SC',
      'NC',
      'VA',
      'MD',
      'DE',
      'DC',
    ]);
  });
  it('keeps the serialized map small', () => {
    expect(JSON.stringify(map).length).toBeLessThan(150_000);
  });
});

describe('state tint', () => {
  const byAbbr = Object.fromEntries(buildMap().states.map((s) => [s.abbr, s]));
  it('is gray for uncovered states and the full tint at 60% coverage or more', () => {
    expect(tintFor(null, 0)).toBe('#E4E8EE');
    expect(tintFor('east', 0.6)).toBe('#F8CE80');
    expect(tintFor('east', 1)).toBe('#F8CE80');
    expect(tintFor('west', 0.6)).toBe('#9FB5D1');
  });
  it('keeps a minimum tint so a covered state is never gray', () => {
    expect(tintFor('west', 0)).not.toBe('#E4E8EE');
    expect(tintFor('east', 0.001)).not.toBe('#E4E8EE');
  });
  it('darkens as coverage grows', () => {
    const lum = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(tintFor('west', 0.3))).toBeGreaterThan(lum(tintFor('west', 0.5)));
  });
  it('computes shares from the zipcodes totals', () => {
    for (const s of Object.values(byAbbr).filter((x) => x.region)) {
      expect(s.share).toBeGreaterThan(0);
      expect(s.share).toBeLessThanOrEqual(1);
    }
    expect(byAbbr.TX.share).toBeLessThan(0.02);
    expect(byAbbr.NM.share).toBeLessThan(0.02);
    expect(byAbbr.GA.share).toBeGreaterThan(0.45);
    expect(byAbbr.OR.fill).toBe('#E4E8EE');
  });
  it('adds mobile region labels', () => {
    expect(buildMap().regionLabels.map((l) => l.text)).toEqual(['WEST', 'EAST']);
  });
});

describe('helpers', () => {
  it('scales dot radius by sqrt(count)', () => {
    expect(dotRadius(1)).toBeLessThan(dotRadius(4));
    expect(dotRadius(16)).toBeCloseTo(1.1 + 1.25 * 4, 1);
  });
  it('builds an arc from West to East', () => {
    const arc = buildArc();
    expect(arc.d).toMatch(/^M[\d. -]+Q[\d. -]+$/);
  });
  it('skips off-map dots', () => {
    expect(
      buildDots([
        [0, 0, 1],
        [homeTerminal.lat, homeTerminal.lng, 4],
      ]),
    ).toHaveLength(1);
  });
  it('fails loudly on off-map config', () => {
    expect(must(5, 'x')).toBe(5);
    expect(() => must(null, 'the terminal')).toThrow(/off the map/);
    expect(() => must(undefined, 'x')).toThrow();
  });
  it('knows every state abbreviation', () => {
    expect(buildMap().states.every((s) => /^[A-Z]{2}$/.test(s.abbr))).toBe(true);
  });
  it('projects off-map points to null', () => {
    expect(project(0, 0)).toBeNull();
    expect(project(homeTerminal.lat, homeTerminal.lng)).not.toBeNull();
  });
  it('summarizes regions for screen readers', () => {
    const [w, e] = regionSummaries();
    expect(w.states).toContain('California');
    expect(e.states).toContain('Georgia');
  });
});
