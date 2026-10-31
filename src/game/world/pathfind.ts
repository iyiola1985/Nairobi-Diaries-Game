export interface RoadLine {
  points: [number, number][];
  /** OpenStreetMap highway class, when the caller wants pavement preferred over carriageways. */
  class?: string;
}

export interface Graph {
  nodes: { x: number; z: number }[];
  adj: number[][];
  /** Parallel to adj. A multiplier on the straight-line length of that edge. */
  cost: number[][];
  cell: number;
  buckets: Map<string, number[]>;
}

class MinHeap {
  private ids: number[] = [];
  private scores: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, score: number): void {
    this.ids.push(id);
    this.scores.push(score);
    this.bubble(this.ids.length - 1);
  }

  pop(): number {
    const id = this.ids[0] ?? -1;
    const lastId = this.ids.pop();
    const lastScore = this.scores.pop();
    if (this.ids.length > 0 && lastId !== undefined && lastScore !== undefined) {
      this.ids[0] = lastId;
      this.scores[0] = lastScore;
      this.sink(0);
    }
    return id;
  }

  private bubble(index: number): void {
    let cursor = index;
    while (cursor > 0) {
      const parent = (cursor - 1) >> 1;
      if ((this.scores[parent] ?? 0) <= (this.scores[cursor] ?? 0)) break;
      this.swap(parent, cursor);
      cursor = parent;
    }
  }

  private sink(index: number): void {
    const count = this.ids.length;
    let cursor = index;
    for (;;) {
      const left = cursor * 2 + 1;
      const right = left + 1;
      let smallest = cursor;
      if (left < count && (this.scores[left] ?? 0) < (this.scores[smallest] ?? 0)) smallest = left;
      if (right < count && (this.scores[right] ?? 0) < (this.scores[smallest] ?? 0)) smallest = right;
      if (smallest === cursor) break;
      this.swap(smallest, cursor);
      cursor = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const id = this.ids[a] ?? 0;
    const score = this.scores[a] ?? 0;
    this.ids[a] = this.ids[b] ?? 0;
    this.scores[a] = this.scores[b] ?? 0;
    this.ids[b] = id;
    this.scores[b] = score;
  }
}

function travelCost(kind: string | undefined): number {
  switch (kind) {
    case 'footway':
    case 'path':
    case 'steps':
    case 'pedestrian':
    case 'living_street':
      return 0.9;
    case 'cycleway':
      return 1;
    case 'residential':
    case 'unclassified':
      return 1.05;
    case 'service':
      return 1.55;
    case 'tertiary':
    case 'secondary':
    case 'primary':
    case 'trunk':
      return 1.2;
    default:
      return 1.1;
  }
}

export function buildRoadGraph(roads: RoadLine[], spacing = 16, join = 10): Graph {
  const nodes: { x: number; z: number }[] = [];
  const adj: number[][] = [];
  const cost: number[][] = [];
  const sidewalk: boolean[] = [];
  const index = new Map<string, number>();

  const add = (x: number, z: number) => {
    const key = `${x.toFixed(1)},${z.toFixed(1)}`;
    const existing = index.get(key);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    nodes.push({ x, z });
    adj.push([]);
    cost.push([]);
    sidewalk.push(false);
    index.set(key, id);
    return id;
  };

  const link = (a: number, b: number, mul = 1) => {
    if (a === b) return;
    const left = adj[a];
    const right = adj[b];
    if (!left || !right || left.includes(b)) return;
    left.push(b);
    right.push(a);
    cost[a]?.push(mul);
    cost[b]?.push(mul);
  };

  for (const road of roads) {
    if (road.points.length < 2) continue;
    const mul = travelCost(road.class);
    const side =
      road.class === 'footway' ||
      road.class === 'path' ||
      road.class === 'steps' ||
      road.class === 'cycleway' ||
      road.class === 'pedestrian';
    let prev = add(road.points[0][0], road.points[0][1]);
    if (side) sidewalk[prev] = true;
    let carried = 0;
    let anchor = road.points[0];
    for (let i = 1; i < road.points.length; i++) {
      const point = road.points[i];
      const span = Math.hypot(point[0] - anchor[0], point[1] - anchor[1]);
      carried += span;
      anchor = point;
      if (carried >= spacing || i === road.points.length - 1) {
        const next = add(point[0], point[1]);
        if (side) sidewalk[next] = true;
        link(prev, next, mul);
        prev = next;
        carried = 0;
      }
    }
  }

  const cell = 12;
  const buckets = new Map<string, number[]>();
  const keyOf = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  nodes.forEach((node, id) => {
    const key = keyOf(node.x, node.z);
    const list = buckets.get(key);
    if (list) list.push(id);
    else buckets.set(key, [id]);
  });
  const degree = adj.map((list) => new Set(list).size);
  const tangent = nodes.map((node, id) => {
    const neighbors = [...new Set(adj[id] ?? [])];
    if (!node || neighbors.length === 0 || neighbors.length > 2) return null;
    const first = nodes[neighbors[0] ?? -1];
    const second = nodes[neighbors[1] ?? id];
    if (!first || !second) return null;
    const dx = neighbors.length === 1 ? node.x - first.x : second.x - first.x;
    const dz = neighbors.length === 1 ? node.z - first.z : second.z - first.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: dx / length, z: dz / length };
  });
  const joinable = (i: number, j: number, dist: number) => {
    const left = tangent[i];
    const right = tangent[j];
    const parallel = left && right ? Math.abs(left.x * right.x + left.z * right.z) > 0.75 : false;
    if ((degree[i] ?? 0) >= 2 && (degree[j] ?? 0) >= 2) return !parallel;
    if (!parallel) return true;
    if ((sidewalk[i] ?? false) !== (sidewalk[j] ?? false)) return true;
    const node = nodes[i];
    const other = nodes[j];
    if (!node || !other) return false;
    const dx = other.x - node.x;
    const dz = other.z - node.z;
    const aimed = (id: number, sign: number) => {
      const head = tangent[id];
      if (!head || degree[id] !== 1) return false;
      return (head.x * dx * sign + head.z * dz * sign) / dist > 0.84;
    };
    return aimed(i, 1) || aimed(j, -1);
  };
  const reach = Math.max(1, Math.ceil(join / cell));
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const cx = Math.floor(node.x / cell);
    const cz = Math.floor(node.z / cell);
    for (let ox = -reach; ox <= reach; ox++) {
      for (let oz = -reach; oz <= reach; oz++) {
        const list = buckets.get(`${cx + ox},${cz + oz}`);
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const other = nodes[j];
          if (!other) continue;
          const dist = Math.hypot(node.x - other.x, node.z - other.z);
          if (dist < join && dist > 0.2 && joinable(i, j, dist)) link(i, j, 1.05);
        }
      }
    }
  }

  return { nodes, adj, cost, cell, buckets };
}

export function nearestWithin(graph: Graph, x: number, z: number, max: number): number {
  if (graph.nodes.length === 0) return -1;
  const cell = graph.cell;
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  let best = -1;
  let bestD = max;
  const rings = Math.min(800, Math.ceil(max / cell) + 1);
  for (let ring = 0; ring <= rings; ring += 1) {
    const ringMin = ring === 0 ? 0 : (ring - 1) * cell;
    if (best >= 0 && ringMin > bestD) break;
    for (let ox = -ring; ox <= ring; ox += 1) {
      for (let oz = -ring; oz <= ring; oz += 1) {
        if (ring !== 0 && Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
        const list = graph.buckets.get(`${cx + ox},${cz + oz}`);
        if (!list) continue;
        for (const id of list) {
          const node = graph.nodes[id];
          if (!node) continue;
          const distance = Math.hypot(node.x - x, node.z - z);
          if (distance < bestD) {
            bestD = distance;
            best = id;
          }
        }
      }
    }
  }
  return best;
}

export function nearestNode(graph: Graph, x: number, z: number): number {
  const found = nearestWithin(graph, x, z, 1e7);
  return found < 0 ? 0 : found;
}

export function shortestPath(graph: Graph, start: number, goal: number): [number, number][] {
  const count = graph.nodes.length;
  if (count === 0 || start < 0 || goal < 0 || start >= count || goal >= count) return [];
  const score = new Float64Array(count);
  score.fill(Infinity);
  const prev = new Int32Array(count);
  prev.fill(-1);
  const settled = new Uint8Array(count);
  score[start] = 0;
  const heap = new MinHeap();
  const heuristic = (id: number) => {
    const node = graph.nodes[id];
    const end = graph.nodes[goal];
    if (!node || !end) return 0;
    return Math.hypot(node.x - end.x, node.z - end.z);
  };
  heap.push(start, heuristic(start));
  while (heap.size > 0) {
    const current = heap.pop();
    if (current < 0 || settled[current]) continue;
    settled[current] = 1;
    if (current === goal) break;
    const edges = graph.adj[current] ?? [];
    const weights = graph.cost[current] ?? [];
    const from = graph.nodes[current];
    if (!from) continue;
    for (let i = 0; i < edges.length; i += 1) {
      const next = edges[i];
      if (next === undefined) continue;
      const to = graph.nodes[next];
      if (!to) continue;
      const weight = Math.hypot(from.x - to.x, from.z - to.z) * (weights[i] ?? 1);
      const total = (score[current] ?? Infinity) + weight;
      if (total < (score[next] ?? Infinity)) {
        score[next] = total;
        prev[next] = current;
        heap.push(next, total + heuristic(next));
      }
    }
  }
  if (!Number.isFinite(score[goal])) return [];
  const path: [number, number][] = [];
  let cursor = goal;
  while (cursor !== -1) {
    const node = graph.nodes[cursor];
    if (!node) break;
    path.push([node.x, node.z]);
    if (cursor === start) break;
    cursor = prev[cursor] ?? -1;
  }
  path.reverse();
  return path;
}

export function routeBetween(graph: Graph, fromX: number, fromZ: number, toX: number, toZ: number): [number, number][] {
  if (graph.nodes.length === 0) return [[fromX, fromZ], [toX, toZ]];
  const start = nearestNode(graph, fromX, fromZ);
  const goal = nearestNode(graph, toX, toZ);
  const path = shortestPath(graph, start, goal);
  if (path.length === 0) return [[fromX, fromZ], [toX, toZ]];
  return [[fromX, fromZ], ...path, [toX, toZ]];
}

/** A route that stays on the graph. Returns null when the streets do not connect within reach. */
export function connectedRoute(
  graph: Graph,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  reach = 80,
): [number, number][] | null {
  if (graph.nodes.length === 0) return null;
  const start = nearestWithin(graph, fromX, fromZ, reach);
  const goal = nearestWithin(graph, toX, toZ, reach);
  if (start < 0 || goal < 0) return null;
  const path = shortestPath(graph, start, goal);
  if (path.length === 0) return null;
  const points: [number, number][] = [[fromX, fromZ]];
  for (const point of path) {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last[0] - point[0], last[1] - point[1]) > 0.4) points.push(point);
  }
  const last = points[points.length - 1];
  if (!last || Math.hypot(last[0] - toX, last[1] - toZ) > 0.4) points.push([toX, toZ]);
  return points;
}
