import type { BuildingRecord, CbdData } from './data';

/** Metres. One chunk is a city block large enough to cull, small enough to rebuild. */
export const CHUNK_METRES = 220;
/** Balconies, shopfronts and street props, plus the full window façade. */
export const NEAR_METRES = 380;
/** Storeys and window pattern, without the instanced props. */
export const MID_METRES = 620;
/** Silhouette with a coarse floor line. Same footprints and heights. */
export const FAR_METRES = 760;
/** How far from the player a chunk or a road is still drawn. */
export const VIEW_REACH = FAR_METRES + CHUNK_METRES * 0.55;
/** Keep the previous detail band this close to a boundary so a chunk does not flicker. */
export const LOD_HOLD_METRES = 36;

export type ChunkLod = 'near' | 'mid' | 'far';

export interface ChunkCell {
  ix: number;
  iz: number;
  lod: ChunkLod;
  id: string;
}

export function chunkOf(x: number, z: number): { ix: number; iz: number } {
  return { ix: Math.floor(x / CHUNK_METRES), iz: Math.floor(z / CHUNK_METRES) };
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

const groups = new Map<string, Map<string, BuildingRecord[]>>();

/** Every building is filed once, by the centroid of its footprint. */
export function buildingsInChunk(data: CbdData, ix: number, iz: number): BuildingRecord[] {
  let index = groups.get(data.districtId);
  if (!index) {
    index = new Map();
    for (const building of data.buildings) {
      const [x, z] = centroid(building.polygon);
      const cell = chunkOf(x, z);
      const key = `${cell.ix}:${cell.iz}`;
      const list = index.get(key);
      if (list) list.push(building);
      else index.set(key, [building]);
    }
    groups.set(data.districtId, index);
  }
  return index.get(`${ix}:${iz}`) ?? [];
}

export function chunkCount(data: CbdData): { buildings: number; chunks: number } {
  const seen = new Set<string>();
  for (const building of data.buildings) {
    const [x, z] = centroid(building.polygon);
    const cell = chunkOf(x, z);
    seen.add(`${cell.ix}:${cell.iz}`);
  }
  return { buildings: data.buildings.length, chunks: seen.size };
}

export function lodAt(distance: number): ChunkLod {
  if (distance <= NEAR_METRES) return 'near';
  if (distance <= MID_METRES) return 'mid';
  return 'far';
}

function lodEdge(current: ChunkLod, next: ChunkLod): number | null {
  if ((current === 'near' && next === 'mid') || (current === 'mid' && next === 'near')) return NEAR_METRES;
  if ((current === 'mid' && next === 'far') || (current === 'far' && next === 'mid')) return MID_METRES;
  return null;
}

/** Stay on the previous band while the chunk centre is still crossing the boundary. */
export function heldLod(distance: number, previous: ChunkLod | undefined): ChunkLod {
  const next = lodAt(distance);
  if (previous === undefined || previous === next) return next;
  const edge = lodEdge(previous, next);
  if (edge === null || Math.abs(distance - edge) >= LOD_HOLD_METRES) return next;
  return previous;
}

/** Chunks the camera can use. Farther cells stay out of the scene. */
export function visibleChunks(x: number, z: number): ChunkCell[] {
  const origin = chunkOf(x, z);
  const span = Math.ceil(FAR_METRES / CHUNK_METRES);
  const reach = VIEW_REACH;
  const cells: ChunkCell[] = [];
  for (let ix = origin.ix - span; ix <= origin.ix + span; ix += 1) {
    for (let iz = origin.iz - span; iz <= origin.iz + span; iz += 1) {
      const cx = (ix + 0.5) * CHUNK_METRES;
      const cz = (iz + 0.5) * CHUNK_METRES;
      const distance = Math.hypot(cx - x, cz - z);
      if (distance > reach) continue;
      const lod = lodAt(distance);
      cells.push({ ix, iz, lod, id: `${ix}:${iz}:${lod}` });
    }
  }
  cells.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return cells;
}

/** Same cells as visibleChunks, holding a band for LOD_HOLD_METRES around each edge. */
export function chunksAround(x: number, z: number, previous: readonly ChunkCell[] = []): ChunkCell[] {
  const prior = new Map<string, ChunkLod>();
  for (const cell of previous) prior.set(`${cell.ix}:${cell.iz}`, cell.lod);
  const cells = visibleChunks(x, z).map((cell) => {
    const distance = Math.hypot((cell.ix + 0.5) * CHUNK_METRES - x, (cell.iz + 0.5) * CHUNK_METRES - z);
    const lod = heldLod(distance, prior.get(`${cell.ix}:${cell.iz}`));
    if (lod === cell.lod) return cell;
    return { ix: cell.ix, iz: cell.iz, lod, id: `${cell.ix}:${cell.iz}:${lod}` };
  });
  cells.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return cells;
}
