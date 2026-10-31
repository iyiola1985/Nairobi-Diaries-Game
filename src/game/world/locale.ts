import { shownHeight } from './architecture';
import { hitsBuilding } from './collision';
import { colliders, type BuildingRecord, type FacilityRecord } from './data';
import { leftHandOffset, polylineLength, type RoadPoint, type RoadSpan } from './roads';

export interface PlacedSign {
  text: string;
  x: number;
  z: number;
  yaw: number;
}

export interface YardMark {
  x: number;
  z: number;
  y: number;
  yaw: number;
  kind: 'tank' | 'balcony' | 'jacaranda' | 'shade' | 'light' | 'pole';
}

const MAIN_NAMES = /ngong road|argwings kodhek|dennis pritt|wood avenue|lenana road|kilimani road|kenyatta avenue|harambee|haile selassie|moi avenue|uhuru highway/i;

/** Keeps sign lettering to a real name. Symbols and empty labels are dropped. */
export function readableSign(name: string | null | undefined): string | null {
  if (!name) return null;
  const text = name.split(';')[0]?.trim() ?? '';
  if (text.length < 3 || text.length > 34) return null;
  if (!/^[\p{L}0-9][\p{L}0-9 '&.,-]*$/u.test(text)) return null;
  return text;
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 33 + text.charCodeAt(i)) >>> 0;
  return value;
}

function open(x: number, z: number, radius = 0.45): boolean {
  return !hitsBuilding(x, z, radius, colliders);
}

function lengthOf(points: RoadPoint[]): number {
  return polylineLength(points);
}

function sampleAt(points: RoadPoint[], distance: number): { x: number; z: number; dx: number; dz: number } | null {
  let remain = distance;
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const span = Math.hypot(dx, dz);
    if (span < 0.05) continue;
    if (remain <= span) {
      const t = remain / span;
      return { x: start[0] + dx * t, z: start[1] + dz * t, dx, dz };
    }
    remain -= span;
  }
  return null;
}

function kerbPoint(pose: { x: number; z: number; dx: number; dz: number }, shift: number): { x: number; z: number; yaw: number } {
  const [ox, oz] = leftHandOffset(pose.dx, pose.dz, shift);
  return { x: pose.x + ox, z: pose.z + oz, yaw: Math.atan2(pose.dx, pose.dz) };
}

/** One green name blade per mapped street, using the OpenStreetMap name. */
export function streetBlades(roads: readonly RoadSpan[], limit = 16): PlacedSign[] {
  const best = new Map<string, RoadSpan>();
  for (const road of roads) {
    const text = readableSign(road.name);
    if (!text || road.points.length < 2) continue;
    if (road.class === 'service' || road.class === 'footway' || road.class === 'path' || road.class === 'steps') continue;
    const current = best.get(text);
    if (!current || lengthOf(road.points) > lengthOf(current.points)) best.set(text, road);
  }
  const ranked = [...best.entries()].sort((a, b) => {
    const aMain = MAIN_NAMES.test(a[0]) ? 0 : 1;
    const bMain = MAIN_NAMES.test(b[0]) ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    return lengthOf(b[1].points) - lengthOf(a[1].points);
  });
  const signs: PlacedSign[] = [];
  for (const [text, road] of ranked) {
    const pose = sampleAt(road.points, lengthOf(road.points) * 0.45);
    if (!pose) continue;
    const placed = kerbPoint(pose, road.width / 2 + 1.35);
    if (!open(placed.x, placed.z, 0.3)) continue;
    signs.push({ text, x: placed.x, z: placed.z, yaw: placed.yaw });
    if (signs.length >= limit) break;
  }
  return signs;
}

function shopRank(facility: FacilityRecord): number {
  if (facility.osm.startsWith('shop=supermarket')) return 0;
  if (facility.osm.includes('pharmacy')) return 1;
  if (facility.osm.startsWith('amenity=cafe')) return 2;
  if (facility.kind === 'restaurant') return 3;
  if (facility.osm.includes('shop=convenience') || facility.osm.includes('hairdresser') || facility.osm.includes('shop=beauty')) return 4;
  return 5;
}

function shopfront(facility: FacilityRecord): boolean {
  if (facility.kind === 'restaurant' || facility.kind === 'shopping') return true;
  return facility.osm.includes('pharmacy') || facility.osm.includes('hairdresser') || facility.osm.includes('shop=beauty') || facility.osm.includes('shop=convenience');
}

/** Shop boards use the mapped business name and nothing else. */
export function shopSigns(facilities: readonly FacilityRecord[], roads: readonly RoadSpan[], limit = 12): PlacedSign[] {
  const cell = 40;
  const grid = new Map<string, { ax: number; az: number; bx: number; bz: number; width: number }[]>();
  const add = (x: number, z: number, segment: { ax: number; az: number; bx: number; bz: number; width: number }) => {
    const key = `${Math.floor(x / cell)}:${Math.floor(z / cell)}`;
    const list = grid.get(key);
    if (list) list.push(segment);
    else grid.set(key, [segment]);
  };
  for (const road of roads) {
    if (road.class === 'footway' || road.class === 'path' || road.class === 'steps' || road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const start = road.points[i];
      const end = road.points[i + 1];
      if (!start || !end) continue;
      const segment = { ax: start[0], az: start[1], bx: end[0], bz: end[1], width: road.width };
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 20));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        add(start[0] + dx * t, start[1] + dz * t, segment);
      }
    }
  }
  const ranked = facilities
    .filter((facility) => shopfront(facility) && readableSign(facility.name))
    .sort((a, b) => shopRank(a) - shopRank(b) || a.name.localeCompare(b.name));
  const signs: PlacedSign[] = [];
  for (const facility of ranked) {
    const text = readableSign(facility.name);
    if (!text) continue;
    const near = grid.get(`${Math.floor(facility.x / cell)}:${Math.floor(facility.z / cell)}`) ?? [];
    let pose: { x: number; z: number; dx: number; dz: number } | null = null;
    let width = 6;
    let best = 28;
    for (const segment of near) {
      const dx = segment.bx - segment.ax;
      const dz = segment.bz - segment.az;
      const span = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((facility.x - segment.ax) * dx + (facility.z - segment.az) * dz) / span));
      const x = segment.ax + dx * t;
      const z = segment.az + dz * t;
      const gap = Math.hypot(facility.x - x, facility.z - z);
      if (gap < best) {
        best = gap;
        width = segment.width;
        pose = { x, z, dx, dz };
      }
    }
    if (!pose || best > 26) continue;
    const placed = kerbPoint(pose, width / 2 + 1.15);
    if (!open(placed.x, placed.z, 0.35)) continue;
    if (signs.some((sign) => Math.hypot(sign.x - placed.x, sign.z - placed.z) < 48)) continue;
    signs.push({ text, x: placed.x, z: placed.z, yaw: placed.yaw });
    if (signs.length >= limit) break;
  }
  return signs;
}

function spaced(roads: readonly RoadSpan[], classes: Set<string>, step: number, shift: number, limit: number, kind: YardMark['kind']): YardMark[] {
  const marks: YardMark[] = [];
  for (const road of roads) {
    if (!classes.has(road.class) || road.points.length < 2) continue;
    const length = lengthOf(road.points);
    for (let distance = step * 0.5; distance < length; distance += step) {
      const pose = sampleAt(road.points, distance);
      if (!pose) continue;
      const placed = kerbPoint(pose, road.width / 2 + shift);
      if (!open(placed.x, placed.z, 0.35)) continue;
      marks.push({ x: placed.x, z: placed.z, y: 0, yaw: placed.yaw, kind });
      if (marks.length >= limit) return marks;
    }
  }
  return marks;
}

export function streetLights(roads: readonly RoadSpan[], limit = 56): YardMark[] {
  return spaced(roads, new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street']), 46, 1.55, limit, 'light');
}

/** Thin poles on the verge, outside the carriageway. They are skipped where a building already stands. */
export function utilityPoles(roads: readonly RoadSpan[], limit = 24): YardMark[] {
  return spaced(roads, new Set(['residential', 'living_street', 'unclassified']), 64, 1.8, limit, 'pole');
}

export function vergeTrees(roads: readonly RoadSpan[], parks: readonly { polygon: [number, number][] }[], limit = 42): YardMark[] {
  const trees = spaced(roads, new Set(['residential', 'living_street', 'tertiary']), 58, 2.5, limit, 'jacaranda');
  for (const park of parks) {
    if (trees.length >= limit + 4 || park.polygon.length < 3) continue;
    let x = 0;
    let z = 0;
    for (const [px, pz] of park.polygon) {
      x += px;
      z += pz;
    }
    x /= park.polygon.length;
    z /= park.polygon.length;
    if (!open(x, z, 0.8)) continue;
    trees.push({ x, z, y: 0, yaw: 0, kind: 'shade' });
  }
  return trees;
}

function centroid(polygon: [number, number][]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  const count = polygon.length || 1;
  return [x / count, z / count];
}

function longestEdge(polygon: [number, number][]): { x: number; z: number; dx: number; dz: number } | null {
  let best = 0;
  let found: { x: number; z: number; dx: number; dz: number } | null = null;
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const span = Math.hypot(dx, dz);
    if (span > best) {
      best = span;
      found = { x: (start[0] + end[0]) / 2, z: (start[1] + end[1]) / 2, dx, dz };
    }
  }
  return found;
}

export function roofTanks(buildings: readonly BuildingRecord[], limit = 24): YardMark[] {
  const tanks: YardMark[] = [];
  for (const building of buildings) {
    if (building.use !== 'apartments' || building.renderHeight < 8 || building.polygon.length < 3) continue;
    if (hash(building.id) % 3 !== 0) continue;
    const [x, z] = centroid(building.polygon);
    tanks.push({ x, z, y: shownHeight(building) + 0.45, yaw: 0, kind: 'tank' });
    if (tanks.length >= limit) break;
  }
  return tanks;
}

export function apartmentBalconies(buildings: readonly BuildingRecord[], limit = 18): YardMark[] {
  const slabs: YardMark[] = [];
  for (const building of buildings) {
    if (building.use !== 'apartments' || building.renderHeight < 7 || building.polygon.length < 3) continue;
    if (hash(building.id) % 2 !== 0) continue;
    const edge = longestEdge(building.polygon);
    if (!edge) continue;
    const [ox, oz] = leftHandOffset(edge.dx, edge.dz, 0.55);
    const floor = Math.max(1, Math.floor(shownHeight(building) / 3.15) - 1);
    slabs.push({ x: edge.x + ox, z: edge.z + oz, y: floor * 3.15 + 0.12, yaw: Math.atan2(edge.dx, edge.dz), kind: 'balcony' });
    if (slabs.length >= limit) break;
  }
  return slabs;
}

export function compoundTrees(buildings: readonly BuildingRecord[], limit = 14): YardMark[] {
  const trees: YardMark[] = [];
  for (const building of buildings) {
    if (building.use !== 'house' || building.polygon.length < 3) continue;
    if (hash(building.id) % 4 !== 0) continue;
    const edge = longestEdge(building.polygon);
    if (!edge) continue;
    const [ox, oz] = leftHandOffset(edge.dx, edge.dz, 2.4);
    const x = edge.x + ox;
    const z = edge.z + oz;
    if (!open(x, z, 0.5)) continue;
    trees.push({ x, z, y: 0, yaw: 0, kind: 'shade' });
    if (trees.length >= limit) break;
  }
  return trees;
}

export interface QueueSpot {
  x: number;
  z: number;
  yaw: number;
}

/**
 * People standing on the verge beside a mapped bus stop or shop board.
 * They are scenery. They are not placed on the carriageway and they are not gameplay characters.
 */
export function queueSpots(stops: readonly { x: number; z: number; yaw: number }[], shops: readonly PlacedSign[], limit = 8): QueueSpot[] {
  const spots: QueueSpot[] = [];
  const add = (x: number, z: number, yaw: number, along: number) => {
    const sx = x + Math.sin(yaw) * along;
    const sz = z + Math.cos(yaw) * along;
    if (!open(sx, sz, 0.35)) return;
    if (spots.some((spot) => Math.hypot(spot.x - sx, spot.z - sz) < 2.2)) return;
    spots.push({ x: sx, z: sz, yaw });
  };
  for (const stop of stops) {
    add(stop.x, stop.z, stop.yaw, 0.9);
    if (spots.length >= limit) return spots;
  }
  for (const shop of shops) {
    add(shop.x, shop.z, shop.yaw, 1.1);
    if (spots.length >= limit) return spots;
  }
  return spots;
}

export interface WalkRoute {
  points: RoadPoint[];
  length: number;
}

export function walkRoutes(roads: readonly RoadSpan[], limit = 10): WalkRoute[] {
  const routes: WalkRoute[] = [];
  for (const road of roads) {
    if (road.class !== 'footway' && road.class !== 'path' && road.class !== 'pedestrian' && road.class !== 'living_street') continue;
    const length = lengthOf(road.points);
    if (length < 28) continue;
    routes.push({ points: road.points, length });
    if (routes.length >= limit) return routes;
  }
  for (const road of roads) {
    if (road.class !== 'residential' || road.points.length < 2) continue;
    const shifted = road.points.map((point, index) => {
      const previous = road.points[Math.max(0, index - 1)];
      const next = road.points[Math.min(road.points.length - 1, index + 1)];
      if (!previous || !next) return point;
      const [ox, oz] = leftHandOffset(next[0] - previous[0], next[1] - previous[1], road.width / 2 + 1.3);
      return [point[0] + ox, point[1] + oz] as RoadPoint;
    });
    const length = lengthOf(shifted);
    if (length < 36) continue;
    routes.push({ points: shifted, length });
    if (routes.length >= limit) break;
  }
  return routes;
}
