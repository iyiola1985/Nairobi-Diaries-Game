import { connectedRoute, type Graph, type RoadLine } from './pathfind';

export interface GuidePoint {
  x: number;
  z: number;
  name: string;
  id: string;
}

export type GuidePlan =
  | { kind: 'walk'; points: [number, number][]; metres: number }
  | { kind: 'none'; reason: 'street' | 'building' };

/** Stop when the character is this close to the last waypoint. */
export const ARRIVE_METRES = 3.2;

/** A blocked last step still counts as arrival inside this distance. */
export const CLOSE_METRES = 4.8;

export interface WalkLeg {
  index: number;
  dx: number;
  dz: number;
  heading: number;
  arrived: boolean;
}

/** Roads a person can follow. Motorways and their ramps are left out. */
export function pedestrianRoads<T extends { class?: string }>(roads: readonly T[]): T[] {
  return roads.filter((road) => road.class !== 'motorway' && road.class !== 'motorway_link');
}

/** Roads a person can follow. Motorways are left out. */
export function walkLines(roads: readonly { points: [number, number][]; class?: string }[]): RoadLine[] {
  const lines: RoadLine[] = [];
  for (const road of pedestrianRoads(roads)) {
    if (road.points.length < 2) continue;
    lines.push({ points: road.points, class: road.class });
  }
  return lines;
}

function pathMetres(points: readonly [number, number][]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (!previous || !point) continue;
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }
  return length;
}

/**
 * Route on the street graph. Footways are preferred by edge cost.
 * When a footway does not connect, the same graph follows the carriageway.
 * The first and last hops stay within a short reach so the path cannot cut across the city.
 * When `open` is set, the last step has to stay outside building colliders.
 */
export function planWalk(options: {
  graph: Graph;
  roads: readonly { name: string | null; points: [number, number][] }[];
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  open?: (x: number, z: number) => boolean;
}): GuidePlan {
  let toX = options.toX;
  let toZ = options.toZ;
  if (options.open) {
    const approach = clearApproach(options.roads, toX, toZ, options.open);
    if (!approach) {
      const snap = nearestRoadPoint(options.roads, options.toX, options.toZ, 30);
      return { kind: 'none', reason: snap ? 'building' : 'street' };
    }
    toX = approach.x;
    toZ = approach.z;
  }
  const goal = routeGoal(options.roads, toX, toZ);
  let path = connectedRoute(options.graph, options.fromX, options.fromZ, goal.x, goal.z, 48);
  if (!path) {
    const start = nearestRoadPoint(options.roads, options.fromX, options.fromZ, 22);
    if (start) {
      const along = connectedRoute(options.graph, start.x, start.z, goal.x, goal.z, 24);
      if (along) path = [[options.fromX, options.fromZ], ...along];
    }
  }
  if (!path) return { kind: 'none', reason: 'street' };
  const away = Math.hypot(goal.x - toX, goal.z - toZ);
  if (!goal.door && away > ARRIVE_METRES) return { kind: 'none', reason: 'street' };
  if (goal.door) {
    const last = path[path.length - 1];
    if (last && options.open && !lineIsOpen(last[0], last[1], goal.door[0], goal.door[1], options.open)) {
      return { kind: 'none', reason: 'building' };
    }
    if (!last || Math.hypot(last[0] - goal.door[0], last[1] - goal.door[1]) > 0.8) path.push(goal.door);
  }
  return { kind: 'walk', points: path, metres: pathMetres(path) };
}

/** Metres still to walk along the remaining waypoints. */
export function remainingMetres(x: number, z: number, points: readonly [number, number][], index: number): number {
  let total = 0;
  let px = x;
  let pz = z;
  for (let cursor = index; cursor < points.length; cursor += 1) {
    const point = points[cursor];
    if (!point) continue;
    total += Math.hypot(point[0] - px, point[1] - pz);
    px = point[0];
    pz = point[1];
  }
  return total;
}

/** True when a replacement route still heads through the same next corner. */
export function sameCorridor(previous: readonly [number, number][], next: readonly [number, number][]): boolean {
  const from = previous[Math.min(2, previous.length - 1)];
  const to = next[Math.min(2, next.length - 1)];
  if (!from || !to) return true;
  return Math.hypot(from[0] - to[0], from[1] - to[1]) < 4;
}

/** Step ahead, or one pavement-width to the side when the direct step is blocked. */
export function detourStep(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  distance: number,
  free: (x: number, z: number) => boolean,
): { x: number; z: number; moved: boolean } {
  const aheadX = x + dirX * distance;
  const aheadZ = z + dirZ * distance;
  if (free(aheadX, aheadZ)) return { x: aheadX, z: aheadZ, moved: true };
  for (const side of [1, -1]) {
    const sx = aheadX + dirZ * side * 1.15;
    const sz = aheadZ - dirX * side * 1.15;
    if (free(sx, sz)) return { x: sx, z: sz, moved: true };
  }
  return { x, z, moved: false };
}

/**
 * Shift intermediate corners onto the left-hand pavement.
 * A blocked side falls back to the other pavement, then the carriageway centre.
 */
export function shiftToPavement(
  points: readonly [number, number][],
  offset: number,
  blocked: (x: number, z: number) => boolean,
): [number, number][] {
  if (points.length < 3 || offset <= 0) return points.map((point) => [point[0], point[1]]);
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return [point[0], point[1]];
    const prev = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const length = Math.hypot(dx, dz) || 1;
    const leftX = point[0] + (dz / length) * offset;
    const leftZ = point[1] - (dx / length) * offset;
    if (!blocked(leftX, leftZ)) return [leftX, leftZ];
    const rightX = point[0] - (dz / length) * offset;
    const rightZ = point[1] + (dx / length) * offset;
    if (!blocked(rightX, rightZ)) return [rightX, rightZ];
    return [point[0], point[1]];
  });
}

export function nextLeg(x: number, z: number, points: readonly [number, number][], index: number): WalkLeg {
  if (points.length === 0) return { index: 0, dx: 0, dz: 0, heading: 0, arrived: true };
  const last = points[points.length - 1];
  if (last && Math.hypot(last[0] - x, last[1] - z) <= ARRIVE_METRES) {
    return { index: points.length, dx: 0, dz: 0, heading: Math.atan2(last[0] - x, last[1] - z), arrived: true };
  }
  let cursor = Math.max(0, Math.min(index, points.length));
  while (cursor < points.length) {
    const point = points[cursor];
    if (!point) break;
    if (Math.hypot(point[0] - x, point[1] - z) > 1.45) break;
    cursor += 1;
  }
  if (cursor >= points.length) return { index: points.length, dx: 0, dz: 0, heading: 0, arrived: true };
  const target = points[cursor];
  if (!target) return { index: cursor, dx: 0, dz: 0, heading: 0, arrived: true };
  const dx = target[0] - x;
  const dz = target[1] - z;
  return { index: cursor, dx, dz, heading: Math.atan2(dx, dz), arrived: false };
}

export function skipBlocked(moved: boolean, stuck: number, index: number, count: number): { stuck: number; index: number; giveUp: boolean } {
  if (moved) return { stuck: 0, index, giveUp: false };
  const nextStuck = stuck + 1;
  if (nextStuck < 14) return { stuck: nextStuck, index, giveUp: false };
  if (index + 1 < count) return { stuck: 0, index: index + 1, giveUp: false };
  return { stuck: nextStuck, index, giveUp: true };
}

export function nearestRoadPoint(
  roads: readonly { name: string | null; points: [number, number][] }[],
  x: number,
  z: number,
  limit = 40,
): { x: number; z: number; name: string | null } | null {
  let best = limit;
  let found: { x: number; z: number; name: string | null } | null = null;
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i += 1) {
      const start = road.points[i - 1];
      const end = road.points[i];
      if (!start || !end) continue;
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const span = dx * dx + dz * dz;
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / span));
      const px = start[0] + t * dx;
      const pz = start[1] + t * dz;
      const distance = Math.hypot(x - px, z - pz);
      if (distance < best) {
        best = distance;
        found = { x: px, z: pz, name: road.name };
      }
    }
  }
  return found;
}

/** Street point used for walking. A nearby door is appended; a point deep inside a block is not. */
export function routeGoal(
  roads: readonly { name: string | null; points: [number, number][] }[],
  x: number,
  z: number,
): { x: number; z: number; door: [number, number] | null } {
  const snap = nearestRoadPoint(roads, x, z, 120);
  if (!snap) return { x, z, door: null };
  if (Math.hypot(snap.x - x, snap.z - z) <= 30) return { x: snap.x, z: snap.z, door: [x, z] };
  return { x: snap.x, z: snap.z, door: null };
}

/** True when the span between a street and a door stays in the open, ignoring a short graze at the kerb. */
export function lineIsOpen(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  open: (x: number, z: number) => boolean,
): boolean {
  const length = Math.hypot(bx - ax, bz - az);
  if (!open(bx, bz)) return false;
  if (length < 0.8) return true;
  const steps = Math.ceil(length / 0.4);
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const along = t * length;
    if (along < 0.9 || length - along < 0.9) continue;
    if (!open(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/**
 * The mapped approach when it meets a walkable road in the open.
 * Otherwise a nearby open point on the same side of the block.
 * Null when every candidate would cross a building.
 */
export function clearApproach(
  roads: readonly { name: string | null; points: [number, number][] }[],
  x: number,
  z: number,
  open: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const usable = (px: number, pz: number) => {
    if (!open(px, pz)) return null;
    const snap = nearestRoadPoint(roads, px, pz, 30);
    if (!snap || !lineIsOpen(snap.x, snap.z, px, pz, open)) return null;
    return Math.hypot(snap.x - px, snap.z - pz);
  };
  if (usable(x, z) !== null) return { x, z };
  let best: { x: number; z: number; score: number } | null = null;
  for (const radius of [2.4, 4, 6, 8, 12, 18, 24]) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      const road = usable(px, pz);
      if (road === null) continue;
      const score = radius * 4 + road;
      if (!best || score < best.score) best = { x: px, z: pz, score };
    }
    if (best) return { x: best.x, z: best.z };
  }
  return null;
}

export function nearestStreetName(
  roads: readonly { name: string | null; points: [number, number][] }[],
  x: number,
  z: number,
): string {
  return nearestRoadPoint(roads, x, z, 40)?.name ?? 'Selected point';
}
