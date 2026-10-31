import type { BuildingRecord, BuildingUse } from './data';

/** One Nairobi storey, matching the levels tag used when OpenStreetMap recorded it. */
export const STOREY_METRES = 3.15;

export type BuildingRole = 'landmark' | 'house' | 'apartments' | 'commercial' | 'office' | 'hotel' | 'mall' | 'older';

export interface Fitment {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
}

export interface NamedBoard {
  text: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DressSet {
  concrete: Fitment[];
  metal: Fitment[];
  cloth: Fitment[];
  glass: Fitment[];
  tanks: Fitment[];
  signs: NamedBoard[];
}

interface Edge {
  x: number;
  z: number;
  dx: number;
  dz: number;
  len: number;
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 33 + text.charCodeAt(i)) >>> 0;
  return value;
}

export function footprintArea(polygon: readonly [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    if (!start || !end) continue;
    sum += start[0] * end[1] - end[0] * start[1];
  }
  return Math.abs(sum) / 2;
}

function centroid(polygon: readonly [number, number][]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  const count = polygon.length || 1;
  return [x / count, z / count];
}

function longestEdge(polygon: readonly [number, number][]): Edge | null {
  let best = 0;
  let found: Edge | null = null;
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const len = Math.hypot(dx, dz);
    if (len > best) {
      best = len;
      found = { x: (start[0] + end[0]) / 2, z: (start[1] + end[1]) / 2, dx, dz, len };
    }
  }
  return found;
}

function outward(edge: Edge, cx: number, cz: number): [number, number] {
  const len = edge.len || 1;
  let nx = -edge.dz / len;
  let nz = edge.dx / len;
  if (nx * (edge.x - cx) + nz * (edge.z - cz) < 0) {
    nx = -nx;
    nz = -nz;
  }
  return [nx, nz];
}

/**
 * The CBD extract stored every untagged footprint as 14 m.
 * That figure is a placeholder, not a measured height. Residential extracts use other values.
 */
function centrePlaceholder(building: BuildingRecord): boolean {
  return building.heightSource === 'estimate' && building.renderHeight === 14 && !building.use;
}

/** A dense centre plot. Tiny footprints stay low. Larger ones read as street buildings, not suburban houses. */
function centreRole(area: number, pick: number): BuildingRole {
  if (area < 50) return 'house';
  if (area < 180) return pick % 2 === 0 ? 'commercial' : 'older';
  if (area < 700) {
    const mid = ['office', 'commercial', 'apartments'] as const;
    return mid[pick % mid.length] ?? 'commercial';
  }
  return pick % 2 === 0 ? 'office' : 'commercial';
}

function centreStoreys(area: number, pick: number): number {
  if (area < 50) return pick % 3 === 0 ? 2 : 1;
  if (area < 140) return 4 + (pick % 3);
  if (area < 500) return 5 + (pick % 4);
  if (area < 2000) return 6 + (pick % 4);
  return 8 + (pick % 3);
}

/** OpenStreetMap use when it exists. Untagged footprints are classed from their area, the same way every time. */
export function buildingRole(building: BuildingRecord): BuildingRole {
  if (building.special) return 'landmark';
  if (building.use) return roleFromUse(building.use, hash(building.id));
  if (centrePlaceholder(building)) return centreRole(footprintArea(building.polygon), hash(building.id));
  const area = footprintArea(building.polygon);
  const pick = hash(building.id);
  if (area < 70) return 'house';
  if (area < 220) {
    const small = ['house', 'older', 'commercial'] as const;
    return small[pick % small.length] ?? 'house';
  }
  if (area < 900) {
    const mid = ['apartments', 'older', 'commercial', 'office'] as const;
    return mid[pick % mid.length] ?? 'older';
  }
  return pick % 2 === 0 ? 'office' : 'commercial';
}

function roleFromUse(use: BuildingUse, pick: number): BuildingRole {
  switch (use) {
    case 'house':
      return 'house';
    case 'apartments':
      return 'apartments';
    case 'commercial':
      return 'commercial';
    case 'office':
      return 'office';
    case 'hotel':
      return 'hotel';
    case 'mall':
      return 'mall';
    case 'other':
      return pick % 2 === 0 ? 'older' : 'commercial';
    default: {
      const unexpected: never = use;
      return unexpected;
    }
  }
}

function estimatedStoreys(role: BuildingRole, area: number, pick: number): number {
  switch (role) {
    case 'landmark':
      return 4;
    case 'house':
      return area > 120 || pick % 3 === 0 ? 2 : 1;
    case 'apartments':
      return area > 600 ? 5 + (pick % 2) : 3 + (pick % 3);
    case 'commercial':
      return area > 800 ? 2 + (pick % 2) : 1 + (pick % 3);
    case 'office':
      return area > 1000 ? 6 + (pick % 3) : 4 + (pick % 2);
    case 'hotel':
      return 4 + (pick % 3);
    case 'mall':
      return 2 + (pick % 2);
    case 'older':
      return 2 + (pick % 3);
    default: {
      const unexpected: never = role;
      return unexpected;
    }
  }
}

/**
 * Measured and published heights stay put.
 * A missing height becomes a storey count for that building's type, stable for its id.
 */
export function shownHeight(building: BuildingRecord): number {
  if (building.special || building.heightSource !== 'estimate') return building.renderHeight;
  if (building.renderHeight <= 4) return building.renderHeight;
  const area = footprintArea(building.polygon);
  const pick = hash(building.id);
  const storeys = centrePlaceholder(building) ? centreStoreys(area, pick) : estimatedStoreys(buildingRole(building), area, pick);
  return Math.round(storeys * STOREY_METRES * 100) / 100;
}

/** Wall height plus the roof edge, so a distant mass matches the detailed building. */
export function massHeight(building: BuildingRecord): number {
  const height = shownHeight(building);
  const role = buildingRole(building);
  if (role === 'landmark' || role === 'house' || height <= 4) return height;
  return height + 0.72;
}

/** Shader style. Landmarks stay plain so the mesh does not invent a surveyed façade. */
export function facadeStyle(building: BuildingRecord): number {
  const role = buildingRole(building);
  switch (role) {
    case 'landmark':
      return 5;
    case 'house':
      return 4;
    case 'apartments':
      return 1;
    case 'commercial':
    case 'mall':
      return 2;
    case 'office':
    case 'hotel':
      return 3;
    case 'older':
      return 6;
    default: {
      const unexpected: never = role;
      return unexpected;
    }
  }
}

function place(edge: Edge, nx: number, nz: number, out: number, y: number, sx: number, sy: number, sz: number): Fitment {
  return {
    x: edge.x + nx * out,
    y,
    z: edge.z + nz * out,
    yaw: Math.atan2(nx, nz),
    sx,
    sy,
    sz,
  };
}

const FIT_CAP = 480;

/** Balconies, doors, awnings, fins and tanks for one chunk. The footprint itself is not moved. */
export function collectFitments(buildings: readonly BuildingRecord[], nameOf?: (building: BuildingRecord) => string | null): DressSet {
  const dress: DressSet = { concrete: [], metal: [], cloth: [], glass: [], tanks: [], signs: [] };
  let count = 0;
  const room = () => count < FIT_CAP;
  const add = (list: Fitment[], piece: Fitment) => {
    if (!room()) return;
    list.push(piece);
    count += 1;
  };
  for (const building of buildings) {
    if (!room()) break;
    const role = buildingRole(building);
    if (role === 'landmark' || building.polygon.length < 3) continue;
    const height = shownHeight(building);
    if (height < 3) continue;
    const edge = longestEdge(building.polygon);
    if (!edge || edge.len < 2.4) continue;
    const [cx, cz] = centroid(building.polygon);
    const [nx, nz] = outward(edge, cx, cz);
    const width = Math.min(edge.len * 0.45, role === 'mall' ? 6 : 3.4);
    const alongX = edge.dx / edge.len;
    const alongZ = edge.dz / edge.len;
    const half = Math.max(0.7, Math.min(width, 1.6) / 2);
    const door = Math.min(width, 1.6);
    add(dress.glass, place(edge, nx, nz, 0.06, 1.35, door, 2.3, 0.08));
    add(dress.concrete, {
      x: edge.x - alongX * half + nx * 0.4,
      y: 1.55,
      z: edge.z - alongZ * half + nz * 0.4,
      yaw: Math.atan2(nx, nz),
      sx: 0.22,
      sy: 2.9,
      sz: 0.28,
    });
    add(dress.concrete, {
      x: edge.x + alongX * half + nx * 0.4,
      y: 1.55,
      z: edge.z + alongZ * half + nz * 0.4,
      yaw: Math.atan2(nx, nz),
      sx: 0.22,
      sy: 2.9,
      sz: 0.28,
    });
    add(dress.concrete, place(edge, nx, nz, 0.4, 2.95, half * 2 + 0.22, 0.16, 0.36));
    if (role === 'commercial' || role === 'mall' || role === 'hotel') {
      add(dress.cloth, place(edge, nx, nz, 0.85, 3.05, width, 0.06, 1.2));
    }
    if (role === 'house') {
      add(dress.cloth, place(edge, nx, nz, 0.55, 2.4, Math.min(width, 1.8), 0.05, 0.7));
    }
    if (role === 'office' || role === 'hotel') {
      const fins = Math.min(3, Math.floor(edge.len / 4));
      for (let i = 0; i < fins; i += 1) {
        const along = (i - (fins - 1) / 2) * 2.4;
        const px = edge.dx / edge.len;
        const pz = edge.dz / edge.len;
        add(dress.concrete, {
          x: edge.x + px * along + nx * 0.28,
          y: 3.2 + (height - 3.6) / 2,
          z: edge.z + pz * along + nz * 0.28,
          yaw: Math.atan2(nx, nz),
          sx: 0.18,
          sy: Math.max(2.4, height - 4),
          sz: 0.42,
        });
      }
    }
    if ((role === 'commercial' || role === 'mall') && footprintArea(building.polygon) > 400 && edge.len > 8) {
      const shift = Math.min(edge.len * 0.28, 6);
      add(dress.glass, {
        x: edge.x + alongX * shift + nx * 0.06,
        y: 1.15,
        z: edge.z + alongZ * shift + nz * 0.06,
        yaw: Math.atan2(nx, nz),
        sx: 2.8,
        sy: 2.15,
        sz: 0.08,
      });
    }
    if (role === 'older') {
      add(dress.metal, place(edge, nx, nz, 0.32, Math.min(6.4, height - 1.1), 0.55, 0.38, 0.28));
    }
    if ((role === 'office' || role === 'hotel') && height > 12) {
      add(dress.concrete, { x: cx, y: height + 0.9, z: cz, yaw: 0, sx: 2.2, sy: 1.2, sz: 1.6 });
    }
    if (role === 'apartments' || role === 'older') {
      const floors = Math.min(3, Math.max(0, Math.floor(height / STOREY_METRES) - 1));
      const slab = Math.min(width, 2.6);
      for (let floor = 0; floor < floors; floor += 1) {
        const y = STOREY_METRES * (floor + 1) + 0.12;
        if (y > height - 0.8) break;
        add(dress.concrete, place(edge, nx, nz, 0.55, y, slab, 0.1, 0.9));
        add(dress.metal, place(edge, nx, nz, 0.98, y + 0.42, slab, 0.05, 0.04));
        add(dress.metal, place(edge, nx, nz, 0.98, y + 0.82, slab, 0.05, 0.04));
      }
    }
    if ((role === 'apartments' || role === 'older') && height > 6 && hash(building.id) % 3 !== 0) {
      const angle = ((hash(building.id) % 8) / 8) * Math.PI * 2;
      add(dress.tanks, {
        x: cx + Math.cos(angle) * 1.2,
        y: height + 1.15,
        z: cz + Math.sin(angle) * 1.2,
        yaw: 0,
        sx: 1.15,
        sy: 1.35,
        sz: 1.15,
      });
    }
    const label = nameOf?.(building);
    if (label && dress.signs.length < 4 && (role === 'commercial' || role === 'mall' || role === 'hotel')) {
      dress.signs.push({
        text: label,
        x: edge.x + nx * 0.35,
        y: 3.7,
        z: edge.z + nz * 0.35,
        yaw: Math.atan2(nx, nz),
      });
    }
  }
  return dress;
}
