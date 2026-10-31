/**
 * Caches traffic lights, bus stops, crossings, speed bumps, roundabouts,
 * stop signs, and give-way signs from OpenStreetMap for the walkable extracts.
 * Does not rewrite the building extracts.
 *
 * Usage: node scripts/fetch-streets.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = JSON.parse(readFileSync(resolve(HERE, '../src/game/world/neighbourhoods.json'), 'utf8'));
const ORIGIN = CATALOGUE.origin;
const LAT_M = 110540;
const LON_M = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const IDS = ['nairobi-cbd', 'kilimani'];
const JOBS = IDS.map((id) => {
  const job = CATALOGUE.neighbourhoods.find((item) => item.id === id);
  if (!job) throw new Error(`Missing catalogue entry ${id}`);
  return job;
});

const clauses = JOBS.flatMap((job) => {
  const box = `${job.bbox.south},${job.bbox.west},${job.bbox.north},${job.bbox.east}`;
  return [
    `node["highway"~"^(traffic_signals|bus_stop|crossing|mini_roundabout|stop|give_way)$"](${box});`,
    `node["traffic_calming"~"^(bump|hump|table|cushion)$"](${box});`,
    `way["junction"="roundabout"](${box});`,
  ];
});

const QUERY = `
[out:json][timeout:60];
(
  ${clauses.join('\n  ')}
);
out geom;
`;

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

function toWorld(lat, lon) {
  return [round2((lon - ORIGIN.lon) * LON_M), round2(-(lat - ORIGIN.lat) * LAT_M)];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function kindOf(tags) {
  if (!tags) return null;
  if (tags.junction === 'roundabout') return 'roundabout';
  if (tags.highway === 'traffic_signals') return 'signal';
  if (tags.highway === 'bus_stop') return 'bus_stop';
  if (tags.highway === 'crossing') return 'crossing';
  if (tags.highway === 'mini_roundabout') return 'mini_roundabout';
  if (tags.highway === 'stop') return 'stop';
  if (tags.highway === 'give_way') return 'give_way';
  if (tags.traffic_calming === 'bump' || tags.traffic_calming === 'hump' || tags.traffic_calming === 'table' || tags.traffic_calming === 'cushion') {
    return 'bump';
  }
  return null;
}

function pointOf(el) {
  if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat, lon: el.lon };
  const geometry = el.geometry ?? [];
  if (geometry.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const point of geometry) {
    lat += point.lat;
    lon += point.lon;
  }
  return { lat: lat / geometry.length, lon: lon / geometry.length, geometry };
}

function radiusOf(geometry, lat, lon) {
  if (!geometry) return 0;
  const [cx, cz] = toWorld(lat, lon);
  let radius = 0;
  for (const point of geometry) {
    const [x, z] = toWorld(point.lat, point.lon);
    radius = Math.max(radius, Math.hypot(x - cx, z - cz));
  }
  return round2(radius);
}

function districtOf(lat, lon) {
  for (const job of JOBS) {
    const box = job.bbox;
    if (lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east) return job.id;
  }
  return null;
}

let last = 'no mirror responded';
let json = null;
for (const url of MIRRORS) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'NairobiDiaries-dev/0.1 (local prototype)',
      },
      body: `data=${encodeURIComponent(QUERY)}`,
      signal: AbortSignal.timeout(70000),
    });
    if (!res.ok) {
      last = `${url} HTTP ${res.status}`;
      continue;
    }
    json = await res.json();
    if (!json.elements) {
      last = `${url} missing elements`;
      json = null;
      continue;
    }
    break;
  } catch (error) {
    last = `${url} ${error instanceof Error ? error.message : String(error)}`;
  }
}
if (!json) throw new Error(last);

const districts = { 'nairobi-cbd': [], kilimani: [] };
for (const el of json.elements) {
  const kind = kindOf(el.tags);
  const point = pointOf(el);
  if (!kind || !point) continue;
  const district = districtOf(point.lat, point.lon);
  if (!district) continue;
  const [x, z] = toWorld(point.lat, point.lon);
  districts[district].push({
    id: `${el.type === 'way' ? 'w' : 'n'}${el.id}`,
    kind,
    x,
    z,
    radius: kind === 'roundabout' ? radiusOf(point.geometry, point.lat, point.lon) : 0,
  });
}

const output = {
  source: 'openstreetmap',
  attribution: '© OpenStreetMap contributors',
  license: 'ODbL',
  retrieved: new Date().toISOString().slice(0, 10),
  note: 'Only features tagged in OpenStreetMap inside the walkable extract windows. Signs have no invented wording.',
  districts,
};
writeFileSync(resolve(HERE, '../src/game/world/street-furniture.json'), JSON.stringify(output));
for (const id of IDS) console.log(`${id}: ${districts[id].length}`);
