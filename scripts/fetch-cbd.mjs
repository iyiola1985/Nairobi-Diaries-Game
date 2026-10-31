/**
 * Downloads one catalogued Nairobi window from OpenStreetMap (ODbL)
 * and writes a local JSON extract. The game never calls Overpass itself.
 *
 * Usage: node scripts/fetch-cbd.mjs <neighbourhood-id>
 * The CBD extract is left untouched unless you pass --force.
 *
 * Horizontal positions come from OSM. Heights use height or building:levels
 * tags when present, otherwise an estimate. KICC and Times Tower keep their
 * published roof heights when a named footprint is found. Named facilities
 * keep the OpenStreetMap name. Unnamed points are not given a business name.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = JSON.parse(readFileSync(resolve(HERE, '../src/game/world/neighbourhoods.json'), 'utf8'));
const ORIGIN = CATALOGUE.origin;
const LAT_M = 110540;
const LON_M = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const requested = process.argv[2];
const JOB = CATALOGUE.neighbourhoods.find((item) => item.id === requested);
if (!JOB) {
  console.error(`Usage: node scripts/fetch-cbd.mjs <${CATALOGUE.neighbourhoods.map((item) => item.id).join('|')}>`);
  process.exit(1);
}
if ((JOB.id === 'nairobi-cbd' || JOB.id === 'kilimani') && process.argv[3] !== '--force') {
  console.error(`Refusing to overwrite the ${JOB.name} extract. Pass --force to regenerate it.`);
  process.exit(1);
}
const BBOX = JOB.bbox;

const QUERY = `
[out:json][timeout:180];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|pedestrian|living_street|footway|path|steps|service|cycleway)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["leisure"~"^(park|garden|playground)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["amenity"="parking"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["amenity"~"^(hospital|clinic|doctors|school|kindergarten|university|college|restaurant|cafe|fast_food|place_of_worship|marketplace|police|library|community_centre|bank|pharmacy|fuel|townhall|courthouse)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["shop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["tourism"~"^(hotel|guest_house|museum)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["office"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["barrier"~"^(wall|fence|gate)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["barrier"="gate"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["amenity"~"^(hospital|clinic|doctors|school|kindergarten|university|college|restaurant|cafe|fast_food|place_of_worship|marketplace|police|library|community_centre|bank|pharmacy|fuel|townhall|courthouse)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["shop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["tourism"~"^(hotel|guest_house|museum)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["office"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out tags geom;
`;

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const r = (n) => Math.round(n * 100) / 100;

function toWorld(lat, lon) {
  const x = (lon - ORIGIN.lon) * LON_M;
  const z = -(lat - ORIGIN.lat) * LAT_M;
  return [r(x), r(z)];
}

function toLatLon(x, z) {
  return {
    lat: r6(ORIGIN.lat - z / LAT_M),
    lon: r6(ORIGIN.lon + x / LON_M),
  };
}

function r6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function ringOf(el) {
  if (!el.geometry) return [];
  const pts = el.geometry.map((p) => toWorld(p.lat, p.lon));
  const cleaned = [];
  for (const p of pts) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    cleaned.push(p);
  }
  if (cleaned.length > 2) {
    const a = cleaned[0];
    const b = cleaned[cleaned.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) cleaned.pop();
  }
  return decimate(cleaned, 36);
}

function barrierLine(el) {
  const pts = ringOf(el);
  const geometry = el.geometry;
  if (!geometry || pts.length < 2) return pts;
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  if (first && last && first.lat === last.lat && first.lon === last.lon) {
    const start = pts[0];
    const end = pts[pts.length - 1];
    if (!end || end[0] !== start[0] || end[1] !== start[1]) pts.push(start);
  }
  return pts;
}

function decimate(pts, max) {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out = pts.filter((_, i) => i % step === 0);
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

function centroid(poly) {
  let x = 0;
  let z = 0;
  for (const p of poly) {
    x += p[0];
    z += p[1];
  }
  return [r(x / poly.length), r(z / poly.length)];
}

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 0.0000001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function specialOf(name) {
  const n = name.toLowerCase();
  if (n.includes('kenyatta international') || n === 'kicc' || n.includes('k.i.c.c')) return 'kicc';
  if (n.includes('times tower')) return 'times-tower';
  return null;
}

function useOf(tags, name) {
  const n = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (n === 'yaya centre' || n === 'yaya center' || n === 'prestige plaza' || n === 'adams arcade') return 'mall';
  if (tags.tourism === 'hotel' || tags.tourism === 'guest_house' || tags.building === 'hotel') return 'hotel';
  const kind = tags.building;
  if (kind === 'house' || kind === 'detached' || kind === 'semidetached_house' || kind === 'terrace' || kind === 'bungalow') return 'house';
  if (kind === 'apartments' || kind === 'residential') return 'apartments';
  if (kind === 'office' || tags.office) return 'office';
  if (kind === 'commercial' || kind === 'retail' || kind === 'supermarket' || kind === 'kiosk' || tags.shop) return 'commercial';
  return 'other';
}

function parseHeight(tags, name) {
  if (tags.height) {
    const m = String(tags.height).match(/[\d.]+/);
    if (m) return { height: clamp(parseFloat(m[0]), 3, 180), source: 'osm-height' };
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (Number.isFinite(levels)) return { height: clamp(levels * 3.15, 3, 180), source: 'osm-levels' };
  }
  const special = specialOf(name);
  if (special === 'times-tower') return { height: 140, source: 'published' };
  if (special === 'kicc') return { height: 105, source: 'published' };
  if (tags.building === 'kiosk' || tags.building === 'hut' || tags.building === 'roof') {
    return { height: 3.5, source: 'estimate' };
  }
  if (JOB.profile === 'residential') {
    const kind = tags.building;
    if (kind === 'house' || kind === 'detached' || kind === 'semidetached_house' || kind === 'terrace' || kind === 'bungalow') {
      return { height: 6.4, source: 'estimate' };
    }
    if (kind === 'apartments' || kind === 'residential') return { height: 12, source: 'estimate' };
    if (kind === 'commercial' || kind === 'retail' || kind === 'office') return { height: 9, source: 'estimate' };
    return { height: 7.5, source: 'estimate' };
  }
  return { height: 14, source: 'estimate' };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function worldLimit() {
  const corners = [
    toWorld(BBOX.south, BBOX.west),
    toWorld(BBOX.south, BBOX.east),
    toWorld(BBOX.north, BBOX.west),
    toWorld(BBOX.north, BBOX.east),
  ];
  return {
    minX: Math.min(...corners.map((p) => p[0])),
    maxX: Math.max(...corners.map((p) => p[0])),
    minZ: Math.min(...corners.map((p) => p[1])),
    maxZ: Math.max(...corners.map((p) => p[1])),
  };
}

function outside(point, limit, pad) {
  return point[0] < limit.minX - pad || point[0] > limit.maxX + pad || point[1] < limit.minZ - pad || point[1] > limit.maxZ + pad;
}

function clipLine(points, limit) {
  const runs = [];
  let current = [];
  for (const point of points) {
    if (outside(point, limit, 12)) {
      if (current.length > 1) runs.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

const WIDTH = {
  motorway: 16,
  motorway_link: 10,
  trunk: 16,
  trunk_link: 10,
  primary: 14,
  primary_link: 9,
  secondary: 11,
  secondary_link: 8,
  tertiary: 8,
  tertiary_link: 7,
  residential: 6.5,
  unclassified: 6,
  pedestrian: 8,
  living_street: 5,
  footway: 2.2,
  path: 1.6,
  steps: 1.6,
  service: 4.5,
  cycleway: 2.2,
};

function surfaceClass(cls) {
  switch (cls) {
    case 'motorway_link':
      return 'motorway';
    case 'trunk_link':
      return 'trunk';
    case 'primary_link':
      return 'primary';
    case 'secondary_link':
      return 'secondary';
    case 'tertiary_link':
      return 'tertiary';
    default:
      return cls;
  }
}
const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian']);
const QUIET = new Set(['footway', 'path', 'steps', 'cycleway']);

async function download() {
  let last = 'no attempt';
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'NairobiDiaries-dev/0.1 (local prototype)',
        },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(200000),
      });
      if (!res.ok) {
        last = `${url} HTTP ${res.status}`;
        continue;
      }
      const json = await res.json();
      if (!json.elements) {
        last = `${url} missing elements`;
        continue;
      }
      return json;
    } catch (error) {
      last = `${url} ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  throw new Error(last);
}

function facilityOf(tags) {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const tourism = tags.tourism;
  const office = tags.office;
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return { kind: 'hospital', osm: `amenity=${amenity}` };
  if (amenity === 'school' || amenity === 'kindergarten' || amenity === 'university' || amenity === 'college') return { kind: 'school', osm: `amenity=${amenity}` };
  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') return { kind: 'restaurant', osm: `amenity=${amenity}` };
  if (amenity === 'place_of_worship') {
    if (tags.religion === 'christian') return { kind: 'church', osm: 'amenity=place_of_worship' };
    const religion = tags.religion ? `;religion=${tags.religion}` : '';
    return { kind: 'worship', osm: `amenity=place_of_worship${religion}` };
  }
  if (tourism === 'hotel' || tourism === 'guest_house') return { kind: 'hotel', osm: `tourism=${tourism}` };
  if (shop || amenity === 'marketplace') return { kind: 'shopping', osm: shop ? `shop=${shop}` : 'amenity=marketplace' };
  if (office) return { kind: 'office', osm: `office=${office}` };
  if (amenity === 'police' || amenity === 'library' || amenity === 'community_centre' || amenity === 'bank' || amenity === 'pharmacy' || amenity === 'fuel' || amenity === 'townhall' || amenity === 'courthouse' || tourism === 'museum') {
    return { kind: 'public', osm: tourism === 'museum' ? 'tourism=museum' : `amenity=${amenity}` };
  }
  return null;
}

function intersectionsOf(roads) {
  const buckets = new Map();
  const keyOf = (x, z) => `${Math.round(x / 8) * 8}:${Math.round(z / 8) * 8}`;
  for (const road of roads) {
    if (QUIET.has(road.class) || road.points.length < 2) continue;
    for (const [x, z] of [road.points[0], road.points[road.points.length - 1]]) {
      const key = keyOf(x, z);
      const bucket = buckets.get(key) ?? { x: 0, z: 0, n: 0, names: new Set() };
      bucket.x += x;
      bucket.z += z;
      bucket.n += 1;
      if (road.name) bucket.names.add(road.name);
      buckets.set(key, bucket);
    }
  }
  const out = [];
  for (const [key, bucket] of buckets) {
    if (bucket.n < 2) continue;
    out.push({
      id: `j${key.replace(':', '-')}`,
      x: r(bucket.x / bucket.n),
      z: r(bucket.z / bucket.n),
      roads: [...bucket.names],
    });
  }
  return out;
}

function nearestRoadPoint(x, z, roads) {
  let best = null;
  let bestD = Infinity;
  for (const road of roads) {
    for (const p of road.points) {
      const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

function entranceOf(poly, roads) {
  const c = centroid(poly);
  const road = nearestRoadPoint(c[0], c[1], roads) ?? poly[0];
  let dx = road[0] - c[0];
  let dz = road[1] - c[1];
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  let x = c[0];
  let z = c[1];
  for (let i = 0; i < 80; i++) {
    x += dx * 1.4;
    z += dz * 1.4;
    if (!pointInPoly(x, z, poly)) return [r(x + dx * 1.6), r(z + dz * 1.6)];
  }
  return [r(c[0] + dx * 10), r(c[1] + dz * 10)];
}

function build() {
  return download().then((raw) => {
    const elements = raw.elements ?? [];
    const limit = worldLimit();
    const roadElements = elements.filter((el) => el.tags?.highway && el.geometry);
    const roads = [];
    for (const el of roadElements) {
      const runs = clipLine(ringOf(el), limit);
      const tagged = el.tags.highway;
      const cls = surfaceClass(tagged);
      runs.forEach((points, index) => {
        roads.push({
          id: `w${el.id}-${index}`,
          name: el.tags.name ?? null,
          class: cls,
          width: WIDTH[tagged] ?? WIDTH[cls] ?? 6,
          points,
        });
      });
    }

    const buildings = [];
    for (const el of elements.filter((item) => item.tags?.building && item.geometry)) {
      const polygon = ringOf(el);
      if (polygon.length < 3 || polygon.some((point) => outside(point, limit, 30))) continue;
      const area = Math.abs(signedArea(polygon));
      if (area < 18) continue;
      const name = el.tags.name ?? null;
      const parsed = parseHeight(el.tags, name ?? '');
      const special = name ? specialOf(name) : null;
      const center = centroid(polygon);
      let renderHeight = parsed.height;
      let accent = null;
      if (special === 'kicc') {
        renderHeight = Math.min(parsed.height, 22);
        accent = { kind: 'kicc', height: 105, cx: center[0], cz: center[1] };
      } else if (special === 'times-tower') {
        if (area > 3500) {
          renderHeight = Math.min(parsed.height, 18);
          accent = { kind: 'times-shaft', height: 140, cx: center[0], cz: center[1] };
        } else {
          renderHeight = 140;
        }
      }
      buildings.push({
        id: `b${el.id}`,
        name,
        height: parsed.height,
        renderHeight: r(renderHeight),
        heightSource: parsed.source,
        polygon,
        special,
        accent,
        use: useOf(el.tags, name),
      });
    }

    const parks = [];
    for (const el of elements.filter((item) => item.tags?.leisure && item.geometry && ['park', 'garden', 'playground'].includes(item.tags.leisure))) {
      const polygon = ringOf(el);
      if (polygon.length < 3 || polygon.some((point) => outside(point, limit, 30))) continue;
      parks.push({ id: `p${el.id}`, name: el.tags.name ?? null, leisure: el.tags.leisure, polygon });
    }

    const parking = [];
    for (const el of elements.filter((item) => item.tags?.amenity === 'parking' && item.geometry)) {
      const polygon = ringOf(el);
      if (polygon.length < 3 || polygon.some((point) => outside(point, limit, 30))) continue;
      parking.push({ id: `k${el.id}`, name: el.tags.name ?? null, polygon });
    }

    const facilities = [];
    const seenFacilities = new Set();
    for (const el of elements) {
      if (!el.tags?.name) continue;
      const facility = facilityOf(el.tags);
      if (!facility) continue;
      let point = null;
      if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) point = toWorld(el.lat, el.lon);
      else if (el.geometry) {
        const polygon = ringOf(el);
        if (polygon.length > 0) point = centroid(polygon);
      }
      if (!point || outside(point, limit, 20)) continue;
      const key = `${facility.kind}|${el.tags.name}|${Math.round(point[0] / 18)}|${Math.round(point[1] / 18)}`;
      if (seenFacilities.has(key)) continue;
      seenFacilities.add(key);
      const geo = toLatLon(point[0], point[1]);
      facilities.push({
        id: el.type === 'node' ? `n${el.id}` : `f${el.id}`,
        name: el.tags.name,
        kind: facility.kind,
        osm: facility.osm,
        x: point[0],
        z: point[1],
        lat: geo.lat,
        lon: geo.lon,
      });
    }

    const intersections = intersectionsOf(roads);

    const barriers = [];
    for (const el of elements.filter((item) => item.tags?.barrier && item.geometry && ['wall', 'fence', 'gate'].includes(item.tags.barrier))) {
      const runs = clipLine(barrierLine(el), limit);
      runs.forEach((points, index) => {
        if (points.length < 2) return;
        barriers.push({ id: `r${el.id}-${index}`, kind: el.tags.barrier, points });
      });
    }
    const gates = [];
    for (const el of elements.filter((item) => item.type === 'node' && item.tags?.barrier === 'gate' && Number.isFinite(item.lat))) {
      const point = toWorld(el.lat, el.lon);
      if (outside(point, limit, 8)) continue;
      gates.push({ id: `g${el.id}`, x: point[0], z: point[1] });
    }

    const destinations = [];
    for (const building of buildings) {
      if (!building.name) continue;
      const [x, z] = entranceOf(building.polygon, roads);
      const geo = toLatLon(x, z);
      const geometryNote = building.use === 'mall'
        ? 'Footprint and name follow OpenStreetMap. The mass is a simplified shopping-centre stand-in, not a measured facade.'
        : building.accent
          ? 'Footprint and position follow OpenStreetMap. The tower silhouette is a simplified landmark, not a measured architectural model.'
          : building.heightSource === 'estimate'
            ? 'Footprint follows OpenStreetMap. Height is an estimate because this building has no height or level tag.'
            : 'Footprint follows OpenStreetMap. Height comes from OSM height or level data.';
      destinations.push({
        id: building.id,
        name: building.name,
        x,
        z,
        lat: geo.lat,
        lon: geo.lon,
        summary: building.special === 'kicc'
          ? 'Kenyatta International Convention Centre, City Square. Published roof height is about 105 metres.'
          : building.special === 'times-tower'
            ? 'Times Tower on Haile Selassie Avenue. Published roof height is about 140 metres.'
            : `${building.name} in the ${JOB.name} extract.`,
        geometryNote,
        interior: false,
      });
    }

    for (const park of parks) {
      if (!park.name) continue;
      const c = centroid(park.polygon);
      const geo = toLatLon(c[0], c[1]);
      destinations.push({
        id: park.id,
        name: park.name,
        x: c[0],
        z: c[1],
        lat: geo.lat,
        lon: geo.lon,
        summary: `${park.name}. ${park.leisure === 'garden' ? 'Garden' : park.leisure === 'playground' ? 'Playground' : 'Park'} boundary from OpenStreetMap.`,
        geometryNote: 'Park polygon follows OpenStreetMap. Planting and furniture are not modelled.',
        interior: false,
      });
    }

    const kiccDest = destinations.find((d) => /kenyatta international|kicc/i.test(d.name));
    const near = JOB.near ? toWorld(JOB.near.lat, JOB.near.lon) : null;
    const roadSpawn = near
      ? nearestRoadPoint(near[0], near[1], roads.filter((road) => DRIVE.has(road.class) && road.name))
      : null;
    const spawn = roadSpawn
      ? { x: roadSpawn[0], z: roadSpawn[1] }
      : kiccDest
        ? { x: kiccDest.x, z: kiccDest.z }
        : near
          ? { x: near[0], z: near[1] }
          : { x: 0, z: 8 };

    let board = { x: spawn.x + 16, z: spawn.z + 6, yaw: 0 };
    const primary = roads.find((road) => road.class === 'primary' && road.points.length > 4);
    if (primary) {
      const mid = primary.points[Math.floor(primary.points.length / 2)];
      const next = primary.points[Math.min(primary.points.length - 1, Math.floor(primary.points.length / 2) + 1)];
      const dx = next[0] - mid[0];
      const dz = next[1] - mid[1];
      const len = Math.hypot(dx, dz) || 1;
      const yaw = Math.atan2(dx / len, dz / len);
      board = { x: r(mid[0] + (-dz / len) * (primary.width * 0.5 + 3)), z: r(mid[1] + (dx / len) * (primary.width * 0.5 + 3)), yaw: r(yaw) };
    }

    const bounds = {
      minX: r(limit.minX - 12),
      maxX: r(limit.maxX + 12),
      minZ: r(limit.minZ - 12),
      maxZ: r(limit.maxZ + 12),
    };

    const data = {
      source: 'openstreetmap',
      attribution: '© OpenStreetMap contributors',
      license: 'ODbL',
      retrieved: new Date().toISOString().slice(0, 10),
      districtId: JOB.id,
      origin: ORIGIN,
      bbox: BBOX,
      bounds,
      spawn,
      buildings,
      roads,
      parks,
      parking,
      facilities,
      intersections,
      barriers,
      gates,
      destinations,
      placements: JOB.placementId
        ? [
            {
              id: JOB.placementId,
              kind: 'billboard',
              x: board.x,
              z: board.z,
              yaw: board.yaw,
            },
          ]
        : [],
    };

    const here = HERE;
    const out = resolve(here, `../src/game/world/${JOB.file}`);
    writeFileSync(out, JSON.stringify(data));
    console.log(
      JSON.stringify(
        {
          buildings: buildings.length,
          roads: roads.length,
          parks: parks.length,
          parking: parking.length,
          facilities: facilities.length,
          intersections: intersections.length,
          barriers: barriers.length,
          gates: gates.length,
          destinations: destinations.length,
          facilityKinds: [...new Set(facilities.map((item) => item.kind))],
          named: destinations.slice(0, 12).map((d) => d.name),
          spawn,
        },
        null,
        2,
      ),
    );
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
