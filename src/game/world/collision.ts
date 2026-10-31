export interface Collider {
  id: string;
  polygon: [number, number][];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function makeCollider(id: string, polygon: [number, number][]): Collider {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { id, polygon, minX, maxX, minZ, maxZ };
}

export function pointInPolygon(x: number, z: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len));
  const px = ax + t * dx;
  const pz = az + t * dz;
  return Math.hypot(x - px, z - pz);
}

export function circleHitsPolygon(x: number, z: number, radius: number, polygon: [number, number][]): boolean {
  if (pointInPolygon(x, z, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, az] = polygon[i];
    const [bx, bz] = polygon[(i + 1) % polygon.length];
    if (distanceToSegment(x, z, ax, az, bx, bz) < radius) return true;
  }
  return false;
}

export function hitsBuilding(x: number, z: number, radius: number, colliders: Collider[]): boolean {
  for (const collider of colliders) {
    if (x < collider.minX - radius || x > collider.maxX + radius || z < collider.minZ - radius || z > collider.maxZ + radius) {
      continue;
    }
    if (circleHitsPolygon(x, z, radius, collider.polygon)) return true;
  }
  return false;
}

function insideRect(x: number, z: number, radius: number, bounds: Bounds): boolean {
  return x >= bounds.minX + radius && x <= bounds.maxX - radius && z >= bounds.minZ + radius && z <= bounds.maxZ - radius;
}

/** One rectangle, or any of several district rectangles. A step may cross from one extract into the next. */
export function outOfBounds(x: number, z: number, radius: number, bounds: Bounds | readonly Bounds[]): boolean {
  const rects = Array.isArray(bounds) ? bounds : [bounds];
  return !rects.some((rect) => insideRect(x, z, radius, rect));
}

/** A solid compound wall. Gates stay out of this list so a mapped opening can be walked through. */
export interface WallBlock {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const WALL_REACH = 0.18;

export function makeWallBlocks(lines: { points: [number, number][] }[]): WallBlock[] {
  const blocks: WallBlock[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.points.length - 1; i += 1) {
      const start = line.points[i];
      const end = line.points[i + 1];
      if (!start || !end) continue;
      const [ax, az] = start;
      const [bx, bz] = end;
      if (Math.hypot(bx - ax, bz - az) < 0.35) continue;
      blocks.push({
        ax,
        az,
        bx,
        bz,
        minX: Math.min(ax, bx) - WALL_REACH,
        maxX: Math.max(ax, bx) + WALL_REACH,
        minZ: Math.min(az, bz) - WALL_REACH,
        maxZ: Math.max(az, bz) + WALL_REACH,
      });
    }
  }
  return blocks;
}

export function hitsWall(x: number, z: number, radius: number, walls: WallBlock[]): boolean {
  const reach = radius + WALL_REACH;
  for (const wall of walls) {
    if (x < wall.minX - radius || x > wall.maxX + radius || z < wall.minZ - radius || z > wall.maxZ + radius) continue;
    if (distanceToSegment(x, z, wall.ax, wall.az, wall.bx, wall.bz) < reach) return true;
  }
  return false;
}

export function blocked(
  x: number,
  z: number,
  radius: number,
  colliders: Collider[],
  bounds: Bounds | readonly Bounds[],
  walls: WallBlock[] = [],
): boolean {
  return outOfBounds(x, z, radius, bounds) || hitsBuilding(x, z, radius, colliders) || hitsWall(x, z, radius, walls);
}

export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  colliders: Collider[],
  bounds: Bounds | readonly Bounds[],
  walls: WallBlock[] = [],
): [number, number] {
  const tries: [number, number][] = [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ];
  const length = Math.hypot(dx, dz);
  if (length > 0) {
    const angle = Math.atan2(dz, dx);
    for (const turn of [0.55, -0.55]) {
      tries.push([Math.cos(angle + turn) * length, Math.sin(angle + turn) * length]);
    }
  }
  for (const [sx, sz] of tries) {
    if (!blocked(x + sx, z + sz, radius, colliders, bounds, walls)) return [x + sx, z + sz];
  }
  return [x, z];
}

export function findOpen(
  x: number,
  z: number,
  radius: number,
  colliders: Collider[],
  bounds: Bounds | readonly Bounds[],
  walls: WallBlock[] = [],
): [number, number] {
  if (!blocked(x, z, radius, colliders, bounds, walls)) return [x, z];
  for (let ring = 1; ring <= 24; ring++) {
    for (let step = 0; step < 10; step++) {
      const angle = (step / 10) * Math.PI * 2;
      const nx = x + Math.cos(angle) * ring * 1.8;
      const nz = z + Math.sin(angle) * ring * 1.8;
      if (!blocked(nx, nz, radius, colliders, bounds, walls)) return [nx, nz];
    }
  }
  return [x, z];
}
