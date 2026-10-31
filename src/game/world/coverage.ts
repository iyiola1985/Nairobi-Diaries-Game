import { CHUNK_METRES, VIEW_REACH } from './chunks';

/** One chunk past the draw distance, so a road does not pop in only after the player crosses a cell. */
export const DRAW_REACH = VIEW_REACH + CHUNK_METRES;

/**
 * Order in which a cached extract may join the walkable city.
 * Nairobi CBD, Hurlingham, and Kilimani are first because they already share streets.
 * A later window stays out until its own file is loaded and meets this chain.
 */
export const EXPANSION_IDS = [
  'nairobi-cbd',
  'hurlingham',
  'kilimani',
  'upper-hill',
  'kileleshwa',
  'lavington',
  'westlands',
  'karen',
] as const;

export type ExpansionId = (typeof EXPANSION_IDS)[number];

const STREET = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']);
const WALK = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'living_street']);

/** Same gap the road graph is allowed to close between extracts. */
export const COVERAGE_JOIN_METRES = 18;

export interface CoverageRoad {
  class: string;
  points: readonly [number, number][];
}

export interface CoverageBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A district is playable when it has streets, a pedestrian way, and — after the first — a real join to one already accepted. */
export function coverageReady(roads: readonly CoverageRoad[], earlier: readonly CoverageRoad[]): boolean {
  let streets = false;
  let walking = false;
  for (const road of roads) {
    if (road.points.length < 2) continue;
    if (STREET.has(road.class)) streets = true;
    if (WALK.has(road.class)) walking = true;
    if (streets && walking) break;
  }
  if (!streets || !walking) return false;
  if (earlier.length === 0) return true;
  return endsMeet(roads, earlier, COVERAGE_JOIN_METRES);
}

function endpoints(roads: readonly CoverageRoad[]): [number, number][] {
  const points: [number, number][] = [];
  for (const road of roads) {
    const first = road.points[0];
    const last = road.points[road.points.length - 1];
    if (first) points.push([first[0], first[1]]);
    if (last && (last[0] !== first?.[0] || last[1] !== first?.[1])) points.push([last[0], last[1]]);
  }
  return points;
}

function endsMeet(roads: readonly CoverageRoad[], earlier: readonly CoverageRoad[], join: number): boolean {
  const cell = 24;
  const buckets = new Map<string, [number, number][]>();
  for (const [x, z] of endpoints(earlier)) {
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const list = buckets.get(key);
    if (list) list.push([x, z]);
    else buckets.set(key, [[x, z]]);
  }
  const ring = Math.ceil(join / cell) + 1;
  for (const [x, z] of endpoints(roads)) {
    const ix = Math.floor(x / cell);
    const iz = Math.floor(z / cell);
    for (let ox = -ring; ox <= ring; ox += 1) {
      for (let oz = -ring; oz <= ring; oz += 1) {
        const list = buckets.get(`${ix + ox},${iz + oz}`);
        if (!list) continue;
        for (const [ax, az] of list) {
          if (Math.hypot(x - ax, z - az) <= join) return true;
        }
      }
    }
  }
  return false;
}

function nearSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number, reach: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= reach;
}

function roadInReach(points: readonly [number, number][], x: number, z: number, reach: number): boolean {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    if (Math.hypot(point[0] - x, point[1] - z) <= reach) return true;
    const next = points[index + 1];
    if (next && nearSegment(x, z, point[0], point[1], next[0], next[1], reach)) return true;
  }
  return false;
}

/** Whole road lines that pass through the player's view. The walk graph still uses every playable road. */
export function roadsInView<T extends { points: readonly [number, number][] }>(roads: readonly T[], x: number, z: number, reach = DRAW_REACH): T[] {
  return roads.filter((road) => roadInReach(road.points, x, z, reach));
}

/** A district mesh is mounted when the player is inside it or one of its roads enters the view. */
export function districtVisible(
  bounds: CoverageBounds,
  roads: readonly { points: readonly [number, number][] }[],
  x: number,
  z: number,
): boolean {
  if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) return true;
  return roads.some((road) => roadInReach(road.points, x, z, DRAW_REACH));
}
