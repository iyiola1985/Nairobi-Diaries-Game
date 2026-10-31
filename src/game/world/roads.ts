export type RoadPoint = [number, number];

export interface RoadSpan {
  class: string;
  width: number;
  points: RoadPoint[];
  name?: string | null;
}

export interface RoadLine {
  points: RoadPoint[];
  width: number;
}

export interface JunctionPad {
  x: number;
  z: number;
  radius: number;
}

const STREET = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian']);
const QUIET = new Set(['footway', 'path', 'steps', 'cycleway']);
const MARKED = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);

interface CarriageSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function hypot(x: number, z: number): number {
  return Math.hypot(x, z);
}

function direction(ax: number, az: number, bx: number, bz: number): RoadPoint {
  const dx = bx - ax;
  const dz = bz - az;
  const length = hypot(dx, dz) || 1;
  return [dx / length, dz / length];
}

/** Left of the direction of travel. Facing east, left is north, which is -Z. */
export function leftHandOffset(dx: number, dz: number, lane: number): RoadPoint {
  const length = hypot(dx, dz) || 1;
  return [(dz / length) * lane, (-dx / length) * lane];
}

function dedupe(points: RoadPoint[]): RoadPoint[] {
  const out: RoadPoint[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (!previous || hypot(point[0] - previous[0], point[1] - previous[1]) > 0.2) out.push(point);
  }
  return out;
}

export function miterEdges(points: RoadPoint[], half: number): { left: RoadPoint; right: RoadPoint }[] {
  const clean = dedupe(points);
  const dirs: RoadPoint[] = [];
  for (let i = 0; i < clean.length - 1; i++) {
    dirs.push(direction(clean[i][0], clean[i][1], clean[i + 1][0], clean[i + 1][1]));
  }
  return clean.map((point, index) => {
    const previous = index > 0 ? dirs[index - 1] : null;
    const next = index < dirs.length ? dirs[index] : null;
    let lx = 0;
    let lz = 0;
    if (previous && next) {
      const [p1x, p1z] = leftHandOffset(previous[0], previous[1], 1);
      const [p2x, p2z] = leftHandOffset(next[0], next[1], 1);
      let mx = p1x + p2x;
      let mz = p1z + p2z;
      const length = hypot(mx, mz);
      if (length < 0.25) {
        mx = p2x;
        mz = p2z;
      } else {
        mx /= length;
        mz /= length;
      }
      const denom = Math.abs(mx * p2x + mz * p2z) || 1;
      const scale = Math.max(half * 0.75, Math.min(half * 2.4, half / denom));
      lx = mx * scale;
      lz = mz * scale;
    } else {
      const basis = next ?? previous ?? [1, 0];
      const offset = leftHandOffset(basis[0], basis[1], half);
      lx = offset[0];
      lz = offset[1];
    }
    return {
      left: [point[0] + lx, point[1] + lz],
      right: [point[0] - lx, point[1] - lz],
    };
  });
}

export function dashSpans(points: RoadPoint[], dash = 2.8, gap = 2.6): RoadPoint[][] {
  const clean = dedupe(points);
  if (clean.length < 2) return [];
  const spans: RoadPoint[][] = [];
  let drawing = true;
  let filled = 0;
  let current: RoadPoint[] = [clean[0]];
  for (let i = 0; i < clean.length - 1; i++) {
    const start = clean[i];
    const end = clean[i + 1];
    const [dx, dz] = direction(start[0], start[1], end[0], end[1]);
    let remain = hypot(end[0] - start[0], end[1] - start[1]);
    let x = start[0];
    let z = start[1];
    while (remain > 0.05) {
      const budget = (drawing ? dash : gap) - filled;
      const step = Math.min(remain, budget);
      x += dx * step;
      z += dz * step;
      remain -= step;
      filled += step;
      if (drawing) current.push([x, z]);
      if (filled >= (drawing ? dash : gap) - 0.001) {
        if (drawing && current.length > 1) spans.push(current);
        drawing = !drawing;
        filled = 0;
        current = drawing ? [[x, z]] : [];
      }
    }
  }
  if (drawing && current.length > 1) spans.push(current);
  return spans;
}

export function offsetLane(points: RoadPoint[], lane: number): RoadPoint[] {
  const clean = dedupe(points);
  return clean.map((point, index) => {
    const previous = clean[Math.max(0, index - 1)];
    const next = clean[Math.min(clean.length - 1, index + 1)];
    const [dx, dz] = direction(previous[0], previous[1], next[0], next[1]);
    const [ox, oz] = leftHandOffset(dx, dz, lane);
    return [point[0] + ox, point[1] + oz];
  });
}

export function polylineLength(points: RoadPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  return total;
}

export interface DriveLane {
  points: RoadPoint[];
  length: number;
  width: number;
}

/** Both directions of a street, each kept to the left side of travel. */
export function driveLanes(roads: RoadSpan[]): DriveLane[] {
  const lanes: DriveLane[] = [];
  for (const road of roads) {
    if (!STREET.has(road.class) || road.class === 'pedestrian' || road.points.length < 2) continue;
    const lane = Math.max(1.15, road.width * 0.22);
    for (const points of [road.points, [...road.points].reverse()]) {
      const shifted = offsetLane(points, lane);
      const length = polylineLength(shifted);
      if (length > 22) lanes.push({ points: shifted, length, width: road.width });
    }
  }
  return lanes;
}

/** Pull a dangling street end onto a road it is heading toward. Parallel carriageways stay apart. */
export function connectEnds(roads: RoadSpan[]): RoadSpan[] {
  const hosts = roads.filter((road) => STREET.has(road.class) && road.class !== 'pedestrian' && road.points.length > 1);
  const segments: { id: string; ax: number; az: number; bx: number; bz: number }[] = [];
  hosts.forEach((road, index) => {
    const id = `${index}`;
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const start = road.points[i];
      const end = road.points[i + 1];
      if (!start || !end) continue;
      segments.push({ id, ax: start[0], az: start[1], bx: end[0], bz: end[1] });
    }
  });
  const hostIndex = new Map(hosts.map((road, index) => [road, `${index}`]));
  return roads.map((road) => {
    const joinable = (STREET.has(road.class) && road.class !== 'pedestrian') || road.class === 'service';
    if (!joinable || road.points.length < 2) return road;
    const points = road.points.map((point) => [point[0], point[1]] as RoadPoint);
    const self = hostIndex.get(road) ?? '';
    const extend = (atStart: boolean) => {
      const end = atStart ? points[0] : points[points.length - 1];
      const prev = atStart ? points[1] : points[points.length - 2];
      if (!end || !prev) return;
      const [ox, oz] = direction(prev[0], prev[1], end[0], end[1]);
      let best: { d: number; x: number; z: number; parallel: number; along: number } | null = null;
      for (const segment of segments) {
        if (segment.id === self) continue;
        const dx = segment.bx - segment.ax;
        const dz = segment.bz - segment.az;
        const len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((end[0] - segment.ax) * dx + (end[1] - segment.az) * dz) / len2));
        const x = segment.ax + dx * t;
        const z = segment.az + dz * t;
        const d = hypot(end[0] - x, end[1] - z);
        const segLen = Math.sqrt(len2);
        const parallel = Math.abs(ox * (dx / segLen) + oz * (dz / segLen));
        const along = (x - end[0]) * ox + (z - end[1]) * oz;
        if (!best || d < best.d) best = { d, x, z, parallel, along };
      }
      if (!best || best.d < 2.4 || best.d > 12 || best.parallel > 0.55 || best.along < 2.5) return;
      if (atStart) points.unshift([best.x, best.z]);
      else points.push([best.x, best.z]);
    };
    extend(true);
    extend(false);
    return points.length === road.points.length ? road : { ...road, points };
  });
}

export function junctionPads(roads: RoadSpan[]): JunctionPad[] {
  const buckets = new Map<string, { x: number; z: number; n: number; street: number; radius: number }>();
  const keyOf = (x: number, z: number) => `${Math.round(x / 4) * 4}:${Math.round(z / 4) * 4}`;
  for (const road of roads) {
    if (QUIET.has(road.class) || road.points.length < 2) continue;
    const street = STREET.has(road.class);
    for (const [x, z] of [road.points[0], road.points[road.points.length - 1]]) {
      const key = keyOf(x, z);
      const bucket = buckets.get(key) ?? { x: 0, z: 0, n: 0, street: 0, radius: 0 };
      bucket.x += x;
      bucket.z += z;
      bucket.n += 1;
      if (street) bucket.street += 1;
      bucket.radius = Math.max(bucket.radius, road.width / 2 + 0.7);
      buckets.set(key, bucket);
    }
  }
  const pads: JunctionPad[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.n < 2 || bucket.street < 1) continue;
    pads.push({ x: bucket.x / bucket.n, z: bucket.z / bucket.n, radius: bucket.radius });
  }
  return pads;
}

export interface RoadLayers {
  pavement: RoadLine[];
  kerb: RoadLine[];
  drain: RoadLine[];
  asphalt: RoadLine[];
  service: RoadLine[];
  footway: RoadLine[];
  center: RoadLine[];
  edges: RoadLine[];
  junctions: JunctionPad[];
}

function linesOf(roads: RoadSpan[], classes: Set<string>, widen: number): RoadLine[] {
  return roads
    .filter((road) => classes.has(road.class) && road.points.length > 1)
    .map((road) => ({ points: road.points, width: Math.max(0.8, road.width + widen) }));
}

function edgeStrips(roads: RoadSpan[], classes: Set<string>, inset: number, strip: number): RoadLine[] {
  const lines: RoadLine[] = [];
  for (const road of roads) {
    if (!classes.has(road.class) || road.points.length < 2) continue;
    const shift = road.width / 2 + inset;
    lines.push({ points: offsetLane(road.points, shift), width: strip });
    lines.push({ points: offsetLane(road.points, -shift), width: strip });
  }
  return lines;
}

export function roadLayers(roads: RoadSpan[]): RoadLayers {
  const joined = connectEnds(roads);
  const streets = new Set(STREET);
  streets.delete('pedestrian');
  const marked = joined.filter((road) => MARKED.has(road.class));
  const center: RoadLine[] = [];
  for (const road of marked) {
    for (const span of dashSpans(road.points)) center.push({ points: span, width: 0.14 });
  }
  const edges: RoadLine[] = [];
  for (const road of marked) {
    const shift = Math.max(0.4, road.width / 2 - 0.35);
    edges.push({ points: offsetLane(road.points, shift), width: 0.1 });
    edges.push({ points: offsetLane(road.points, -shift), width: 0.1 });
  }
  return {
    pavement: linesOf(joined, streets, 2.2),
    kerb: edgeStrips(joined, streets, 0.08, 0.22),
    drain: edgeStrips(joined, streets, 0.28, 0.14),
    asphalt: linesOf(joined, streets, 0),
    service: linesOf(joined, new Set(['service']), 0),
    footway: linesOf(joined, new Set(['footway', 'path', 'steps', 'cycleway', 'pedestrian']), 0),
    center,
    edges,
    junctions: junctionPads(joined),
  };
}

function closestOnSegment(x: number, z: number, segment: CarriageSegment): RoadPoint {
  const dx = segment.bx - segment.ax;
  const dz = segment.bz - segment.az;
  const length = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - segment.ax) * dx + (z - segment.az) * dz) / length));
  return [segment.ax + dx * t, segment.az + dz * t];
}

export function carriageClearer(roads: RoadSpan[]): (polygon: RoadPoint[]) => RoadPoint[] {
  const segments: CarriageSegment[] = [];
  for (const road of roads) {
    if (QUIET.has(road.class) || road.points.length < 2) continue;
    const half = road.width / 2;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      segments.push({
        ax,
        az,
        bx,
        bz,
        half,
        minX: Math.min(ax, bx) - half,
        maxX: Math.max(ax, bx) + half,
        minZ: Math.min(az, bz) - half,
        maxZ: Math.max(az, bz) + half,
      });
    }
  }
  const cell = 36;
  const grid = new Map<string, number[]>();
  const add = (key: string, index: number) => {
    const list = grid.get(key);
    if (list) list.push(index);
    else grid.set(key, [index]);
  };
  segments.forEach((segment, index) => {
    const minCx = Math.floor(segment.minX / cell);
    const maxCx = Math.floor(segment.maxX / cell);
    const minCz = Math.floor(segment.minZ / cell);
    const maxCz = Math.floor(segment.maxZ / cell);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) add(`${cx}:${cz}`, index);
    }
  });
  return (polygon) => {
    if (polygon.length < 3) return polygon;
    let moved = 0;
    const next = polygon.map(([x, z]) => {
      const indexes = grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`);
      if (!indexes) return [x, z] as RoadPoint;
      let best: CarriageSegment | null = null;
      let bestGap = 0;
      let nearest: RoadPoint = [x, z];
      for (const index of indexes) {
        const segment = segments[index];
        if (!segment) continue;
        if (x < segment.minX || x > segment.maxX || z < segment.minZ || z > segment.maxZ) continue;
        const point = closestOnSegment(x, z, segment);
        const gap = segment.half - hypot(x - point[0], z - point[1]);
        if (gap > bestGap) {
          bestGap = gap;
          best = segment;
          nearest = point;
        }
      }
      if (!best || bestGap < 0.2 || bestGap > 4.5) return [x, z] as RoadPoint;
      let ax = x - nearest[0];
      let az = z - nearest[1];
      const away = hypot(ax, az);
      if (away < 0.08) {
        const [dx, dz] = direction(best.ax, best.az, best.bx, best.bz);
        const left = leftHandOffset(dx, dz, 1);
        ax = left[0];
        az = left[1];
      } else {
        ax /= away;
        az /= away;
      }
      moved += 1;
      const reach = best.half + 0.4;
      return [nearest[0] + ax * reach, nearest[1] + az * reach] as RoadPoint;
    });
    if (moved === 0 || moved > polygon.length * 0.45) return polygon;
    return next;
  };
}

export function nearestCarriage(x: number, z: number, roads: RoadSpan[]): { dx: number; dz: number; width: number } | null {
  let best = Infinity;
  let found: { dx: number; dz: number; width: number } | null = null;
  for (const road of roads) {
    if (QUIET.has(road.class) || road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const length = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const distance = hypot(x - px, z - pz);
      if (distance < best) {
        best = distance;
        found = { dx, dz, width: road.width };
      }
    }
  }
  return found;
}

export function crossingStripes(x: number, z: number, roads: RoadSpan[]): RoadLine[] {
  const carriage = nearestCarriage(x, z, roads);
  if (!carriage) return [];
  const [dx, dz] = direction(0, 0, carriage.dx, carriage.dz);
  const [px, pz] = leftHandOffset(dx, dz, 1);
  const span = Math.max(3.2, carriage.width - 0.4);
  const lines: RoadLine[] = [];
  for (let stripe = -2; stripe <= 2; stripe++) {
    const along = stripe * 0.95;
    const cx = x + dx * along;
    const cz = z + dz * along;
    lines.push({
      points: [
        [cx - px * (span / 2), cz - pz * (span / 2)],
        [cx + px * (span / 2), cz + pz * (span / 2)],
      ],
      width: 0.42,
    });
  }
  return lines;
}
