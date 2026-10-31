import raw from './cbd-data.json';
import hurlinghamRaw from './hurlingham-data.json';
import kilimaniRaw from './kilimani-data.json';
import { makeCollider, makeWallBlocks, type Bounds, type Collider, type WallBlock } from './collision';
import { coverageReady, EXPANSION_IDS } from './coverage';
import { NEIGHBOURHOODS } from './neighbourhoods';
import { carriageClearer } from './roads';

export interface Accent {
  kind: 'kicc' | 'times-shaft';
  height: number;
  cx: number;
  cz: number;
}

export type BuildingUse = 'house' | 'apartments' | 'commercial' | 'office' | 'mall' | 'hotel' | 'other';

export interface BuildingRecord {
  id: string;
  name: string | null;
  height: number;
  renderHeight: number;
  heightSource: 'osm-height' | 'osm-levels' | 'estimate' | 'published';
  polygon: [number, number][];
  special: 'kicc' | 'times-tower' | null;
  accent: Accent | null;
  /** OpenStreetMap building use. Missing on older extracts, which keep the plain height bands. */
  use?: BuildingUse;
}

export interface DestinationRecord {
  id: string;
  name: string;
  x: number;
  z: number;
  lat: number;
  lon: number;
  summary: string;
  geometryNote: string;
  interior: false;
}

export type FacilityKind = 'shopping' | 'hospital' | 'school' | 'restaurant' | 'hotel' | 'office' | 'church' | 'worship' | 'public';

/** A named OpenStreetMap point. The name is the tag, not an invented business. */
export interface FacilityRecord {
  id: string;
  name: string;
  kind: FacilityKind;
  osm: string;
  x: number;
  z: number;
  lat: number;
  lon: number;
}

export interface IntersectionRecord {
  id: string;
  x: number;
  z: number;
  /** OpenStreetMap road names that meet here. Unnamed arms are omitted. */
  roads: string[];
}

export interface GateRecord {
  id: string;
  x: number;
  z: number;
}

export interface BarrierRecord {
  id: string;
  kind: 'wall' | 'fence' | 'gate';
  points: [number, number][];
}

export interface ParkingRecord {
  id: string;
  name: string | null;
  polygon: [number, number][];
}

export interface CbdData {
  source: 'openstreetmap';
  attribution: string;
  license: string;
  retrieved: string;
  districtId: string;
  origin: { lat: number; lon: number; name: string };
  bbox: { south: number; west: number; north: number; east: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number };
  buildings: BuildingRecord[];
  roads: { id: string; name: string | null; class: string; width: number; points: [number, number][] }[];
  parks: { id: string; name: string | null; polygon: [number, number][]; leisure?: string }[];
  parking?: ParkingRecord[];
  facilities?: FacilityRecord[];
  intersections?: IntersectionRecord[];
  barriers?: BarrierRecord[];
  gates?: GateRecord[];
  destinations: DestinationRecord[];
  placements: { id: string; kind: 'billboard'; x: number; z: number; yaw: number }[];
}

export const cbd = raw as CbdData;
export const kilimani = kilimaniRaw as unknown as CbdData;

function centroidOf(polygon: readonly [number, number][]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  const count = polygon.length || 1;
  return [x / count, z / count];
}

function insideBounds(x: number, z: number, bounds: Bounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** Earlier-extract centre-lines, so a later extract can drop a copied carriageway. */
function earlierCentreLines(earlier: readonly CbdData[]) {
  const cell = 24;
  const buckets = new Map<string, [number, number, number, number][]>();
  const add = (ax: number, az: number, bx: number, bz: number) => {
    const minX = Math.floor(Math.min(ax, bx) / cell);
    const maxX = Math.floor(Math.max(ax, bx) / cell);
    const minZ = Math.floor(Math.min(az, bz) / cell);
    const maxZ = Math.floor(Math.max(az, bz) / cell);
    for (let ix = minX; ix <= maxX; ix += 1) {
      for (let iz = minZ; iz <= maxZ; iz += 1) {
        const key = `${ix},${iz}`;
        const list = buckets.get(key);
        const segment: [number, number, number, number] = [ax, az, bx, bz];
        if (list) list.push(segment);
        else buckets.set(key, [segment]);
      }
    }
  };
  for (const district of earlier) {
    for (const road of district.roads) {
      for (let index = 1; index < road.points.length; index += 1) {
        const start = road.points[index - 1];
        const end = road.points[index];
        if (start && end) add(start[0], start[1], end[0], end[1]);
      }
    }
  }
  return {
    near(x: number, z: number, limit: number) {
      const ix = Math.floor(x / cell);
      const iz = Math.floor(z / cell);
      const ring = Math.ceil(limit / cell) + 1;
      for (let ox = -ring; ox <= ring; ox += 1) {
        for (let oz = -ring; oz <= ring; oz += 1) {
          const list = buckets.get(`${ix + ox},${iz + oz}`);
          if (!list) continue;
          for (const [ax, az, bx, bz] of list) {
            if (distanceToSegment(x, z, ax, az, bx, bz) <= limit) return true;
          }
        }
      }
      return false;
    },
  };
}

/** A copied overlap line is one whose every vertex already lies on an earlier road. */
function copiedFromEarlier(
  points: readonly [number, number][],
  earlier: readonly CbdData[],
  lines: ReturnType<typeof earlierCentreLines>,
): boolean {
  if (points.length === 0) return true;
  return points.every((point) => {
    const covered = earlier.some((district) => insideBounds(point[0], point[1], district.bounds));
    return covered && lines.near(point[0], point[1], 1.5);
  });
}

/** Drop footprints and copied road lines the CBD or Kilimani extract already owns. A road that continues past those rectangles stays, so the extracts can join. */
function withoutEarlier(data: CbdData, earlier: readonly CbdData[]): CbdData {
  const covered = (x: number, z: number) => earlier.some((district) => insideBounds(x, z, district.bounds));
  const lines = earlierCentreLines(earlier);
  return {
    ...data,
    roads: data.roads.filter((road) => !copiedFromEarlier(road.points, earlier, lines)),
    buildings: data.buildings.filter((building) => {
      const [x, z] = centroidOf(building.polygon);
      return !covered(x, z);
    }),
    parks: data.parks.filter((park) => {
      const [x, z] = centroidOf(park.polygon);
      return !covered(x, z);
    }),
    parking: (data.parking ?? []).filter((lot) => {
      const [x, z] = centroidOf(lot.polygon);
      return !covered(x, z);
    }),
    facilities: (data.facilities ?? []).filter((place) => !covered(place.x, place.z)),
    destinations: data.destinations.filter((place) => !covered(place.x, place.z)),
    barriers: (data.barriers ?? []).filter((barrier) => {
      const mid = barrier.points[Math.floor(barrier.points.length / 2)];
      return mid ? !covered(mid[0], mid[1]) : false;
    }),
    gates: (data.gates ?? []).filter((gate) => !covered(gate.x, gate.z)),
  };
}

export const hurlingham = withoutEarlier(hurlinghamRaw as unknown as CbdData, [cbd, kilimani]);

const EXTRACT_FILES: Record<string, CbdData> = {
  'cbd-data.json': cbd,
  'kilimani-data.json': kilimani,
  'hurlingham-data.json': hurlingham,
};

/** Cached extracts. A catalogued window is skipped even when a file is handed in. */
export function extractsFromCatalogue(files: Record<string, CbdData> = EXTRACT_FILES): CbdData[] {
  const loaded: CbdData[] = [];
  for (const window of NEIGHBOURHOODS) {
    if (window.status !== 'extracted') continue;
    const data = files[window.file];
    if (data) loaded.push(data);
  }
  return loaded;
}

/**
 * Extracts that may be walked. Catalogue order is kept.
 * A file joins only when its streets and footways exist and, after the CBD, meet a district already accepted.
 */
export function playableExtracts(files: Record<string, CbdData> = EXTRACT_FILES): CbdData[] {
  const ready = new Set<string>();
  const earlier: CbdData['roads'] = [];
  for (const id of EXPANSION_IDS) {
    const window = NEIGHBOURHOODS.find((item) => item.id === id);
    if (!window || window.status !== 'extracted') continue;
    const data = files[window.file];
    if (!data) continue;
    if (!coverageReady(data.roads, earlier)) continue;
    ready.add(window.id);
    earlier.push(...data.roads);
  }
  const loaded: CbdData[] = [];
  for (const window of NEIGHBOURHOODS) {
    if (!ready.has(window.id)) continue;
    const data = files[window.file];
    if (data) loaded.push(data);
  }
  return loaded;
}

export const districts: CbdData[] = playableExtracts();

export const clearKilimaniFootprint = carriageClearer(kilimani.roads);
const clearHurlinghamFootprint = carriageClearer(hurlingham.roads);

export function footprintFor(districtId: string, polygon: [number, number][]): [number, number][] {
  if (districtId === 'kilimani') return clearKilimaniFootprint(polygon);
  if (districtId === 'hurlingham') return clearHurlinghamFootprint(polygon);
  return polygon;
}

export const colliders: Collider[] = districts.flatMap((district) =>
  district.buildings.map((building) => makeCollider(building.id, footprintFor(district.districtId, building.polygon))),
);

export const wallColliders: WallBlock[] = districts.flatMap((district) =>
  makeWallBlocks((district.barriers ?? []).filter((item) => item.kind === 'wall').map((item) => ({ points: item.points }))),
);

export type DistrictId = 'nairobi-cbd' | 'kilimani' | 'hurlingham';

/** Every loaded street, in catalogue order. The walk uses this one graph. */
export function cityRoads(): CbdData['roads'] {
  return districts.flatMap((district) => district.roads);
}

/** Rectangles a person may stand in. A step is legal when it lands in any of them. */
export function cityBounds(): Bounds[] {
  return districts.map((district) => district.bounds);
}

/** The walkable rectangle the player is standing in. */
export function boundsAt(x: number, z: number): Bounds {
  return districtAt(x, z)?.bounds ?? cbd.bounds;
}

export function districtAt(x: number, z: number): CbdData | null {
  for (const district of districts) {
    const bounds = district.bounds;
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) return district;
  }
  return null;
}

export function districtLabel(id: DistrictId): string {
  switch (id) {
    case 'nairobi-cbd':
      return 'Nairobi CBD';
    case 'kilimani':
      return 'Kilimani';
    case 'hurlingham':
      return 'Hurlingham';
    default: {
      const unexpected: never = id;
      return unexpected;
    }
  }
}
