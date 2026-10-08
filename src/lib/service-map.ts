// Builds the data for the server-rendered service-area map. Pure: no React, no ZIP lists.
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesTopology from 'us-atlas/states-albers-10m.json';
import type { Region } from '@/config/routes';
import {
  coverage,
  eastStateLabels,
  homeTerminal,
  mapCopy,
  regionLabels,
  regionStyle,
  stateNames,
  tintScale,
  westMetros,
} from '@/config/service-area';

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;
// Crop out the Alaska/Hawaii insets, which sit below the contiguous states.
export const VIEW_BOX = { x: 20, y: 20, w: 940, h: 500 };

const OMIT_FIPS = new Set(['02', '15', '72']);
export const projection = geoAlbersUsa()
  .scale(1300)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

export type MapState = {
  name: string;
  abbr: string;
  d: string;
  region: Region | null;
  count: number;
  /** Served ZIPs as a share of the state's ZIPs (0 when uncovered). */
  share: number;
  fill: string;
  tooltip: string | null;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
};

export type MapDot = { x: number; y: number; r: number };

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** Fill color for a state: gray, or a mix of gray and the region's full tint scaled by coverage share. */
export function tintFor(region: Region | null, share: number): string {
  if (!region) return tintScale.baseGray;
  const t = Math.min(share / tintScale.fullAtShare, 1);
  const mix = tintScale.minMix + (1 - tintScale.minMix) * t;
  const full = regionStyle[region].tint;
  const out = [0, 1, 2].map((i) =>
    Math.round(channel(tintScale.baseGray, i) * (1 - mix) + channel(full, i) * mix)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('').toUpperCase()}`;
}

const abbrByName = Object.fromEntries(
  Object.entries(stateNames).map(([abbr, name]) => [name, abbr]),
);

export const dotRadius = (count: number) => Math.round((1.1 + 1.25 * Math.sqrt(count)) * 10) / 10;

export function project(lat: number, lng: number): [number, number] | null {
  return projection([lng, lat]);
}

/** For map furniture defined in config: a point that falls off the map is a config error, so fail loudly. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined)
    throw new Error(`Map config error: ${what} is off the map`);
  return value;
}

function regionOfState(abbr: string): { region: Region; count: number; share: number } | null {
  for (const region of ['west', 'east'] as const) {
    const count = coverage[region].states[abbr];
    if (count)
      return { region, count, share: Math.min(count / coverage[region].stateTotals[abbr], 1) };
  }
  return null;
}

export function buildStates(): MapState[] {
  const topo = statesTopology as unknown as Topology;
  const states = feature(topo, topo.objects.states as GeometryCollection<{ name: string }>);
  const path = geoPath().digits(1);
  return states.features
    .filter((f) => !OMIT_FIPS.has(String(f.id)))
    .map((f) => {
      const name = f.properties.name;
      const abbr = abbrByName[name];
      const cov = regionOfState(abbr);
      return {
        name,
        abbr,
        d: path(f) as string,
        region: cov ? cov.region : null,
        count: cov ? cov.count : 0,
        share: cov ? cov.share : 0,
        fill: tintFor(cov ? cov.region : null, cov ? cov.share : 0),
        tooltip: cov
          ? mapCopy.tooltip
              .replace('{state}', name)
              .replace('{region}', cov.region === 'west' ? 'West' : 'East')
              .replace('{count}', String(cov.count))
          : null,
        centroid: path.centroid(f) as [number, number],
        bounds: path.bounds(f) as [[number, number], [number, number]],
      };
    });
}

/** Points that fall off the map (none today) are skipped. */
export function buildDots(points: readonly [number, number, number][]): MapDot[] {
  return points.flatMap(([lat, lng, n]) => {
    const p = project(lat, lng);
    return p ? [{ x: round(p[0]), y: round(p[1]), r: dotRadius(n) }] : [];
  });
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Weighted center of a region's dots, in map units. */
function center(region: Region): [number, number] {
  let sx = 0,
    sy = 0,
    sw = 0;
  for (const [lat, lng, n] of coverage[region].points) {
    const p = must(project(lat, lng), 'a coverage point');
    sx += p[0] * n;
    sy += p[1] * n;
    sw += n;
  }
  return [sx / sw, sy / sw];
}

/** A quadratic arc between the two clusters, bowed north, trimmed so the arrowheads clear the dots. */
export function buildArc() {
  const [wx, wy] = center('west');
  const [ex, ey] = center('east');
  const bow = 120;
  const cx = (wx + ex) / 2;
  const cy = Math.min(wy, ey) - bow;
  // Trim along the first/last tangent so the ends sit just outside the clusters.
  const trim = (px: number, py: number, qx: number, qy: number, by: number): [number, number] => {
    const len = Math.hypot(qx - px, qy - py) || 1;
    return [px + ((qx - px) / len) * by, py + ((qy - py) / len) * by];
  };
  const [sx, sy] = trim(wx, wy, cx, cy, 52);
  const [tx, ty] = trim(ex, ey, cx, cy, 52);
  return {
    d: `M${round(sx)} ${round(sy)} Q${round(cx)} ${round(cy)} ${round(tx)} ${round(ty)}`,
    labelAt: [round((sx + 2 * cx + tx) / 4), round((sy + 2 * cy + ty) / 4) - 10] as [
      number,
      number,
    ],
  };
}

export function buildMap() {
  const states = buildStates();
  const byAbbr = Object.fromEntries(states.map((s) => [s.abbr, s]));
  const terminal = must(project(homeTerminal.lat, homeTerminal.lng), 'the terminal');
  return {
    viewBox: `${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.w} ${VIEW_BOX.h}`,
    states,
    dots: { west: buildDots(coverage.west.points), east: buildDots(coverage.east.points) },
    arc: buildArc(),
    terminal: { x: round(terminal[0]), y: round(terminal[1]) },
    metroLabels: westMetros.map((m) => {
      const p = must(project(m.lat, m.lng), m.name);
      return {
        name: m.name,
        lines: m.lines,
        x: round(p[0] + m.dx),
        y: round(p[1] + m.dy),
        anchor: m.anchor,
      };
    }),
    regionLabels: regionLabels.map((l) => {
      const p = must(project(l.lat, l.lng), l.text);
      return { text: l.text, region: l.region, x: round(p[0]), y: round(p[1]) };
    }),
    stateLabels: eastStateLabels.map((l) => {
      const s = must(byAbbr[l.state], l.state);
      return { abbr: l.state, x: round(s.centroid[0] + l.dx), y: round(s.centroid[1] + l.dy) };
    }),
    style: regionStyle,
  };
}

/** Region summaries for the screen-reader list. */
export function regionSummaries() {
  return (['west', 'east'] as const).map((region) => ({
    region,
    label: regionStyle[region].label,
    states: Object.keys(coverage[region].states).map((abbr) => stateNames[abbr] ?? abbr),
  }));
}
