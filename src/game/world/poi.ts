import { pointInPolygon } from './collision';
import { cbd, hurlingham, kilimani, type BuildingRecord, type BuildingUse, type CbdData, type DestinationRecord, type FacilityRecord, type GateRecord } from './data';
import { placeById, placeTitle } from './places';
import { geometryHonesty } from './spawn';

export type PoiCategory =
  | 'hospital'
  | 'restaurant'
  | 'shopping'
  | 'hotel'
  | 'nightlife'
  | 'school'
  | 'church'
  | 'public'
  | 'office'
  | 'residential'
  | 'park'
  | 'entertainment'
  | 'landmark'
  | 'building';

export type PoiAction = 'venue' | 'info' | 'route';

/** A verified OpenStreetMap place the player can approach. Interiors are not modelled. */
export interface PointOfInterest {
  id: string;
  name: string;
  category: PoiCategory;
  label: string;
  x: number;
  z: number;
  lat: number;
  lon: number;
  /** Where the player stands to interact. A mapped point inside a footprint is moved to the outside edge. */
  approach: { x: number; z: number };
  /** An OpenStreetMap gate beside the place, when one is mapped. */
  entrance: { x: number; z: number } | null;
  actions: PoiAction[];
  prompt: string;
  summary: string;
  note: string;
  district: 'Nairobi CBD' | 'Kilimani' | 'Hurlingham';
  interior: false;
}

function tag(osm: string, key: string): string | null {
  const part = osm.split(';').find((item) => item.startsWith(`${key}=`));
  return part ? part.slice(key.length + 1) : null;
}

function normalName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function actionsFor(category: PoiCategory): PoiAction[] {
  switch (category) {
    case 'restaurant':
    case 'shopping':
    case 'hotel':
    case 'nightlife':
    case 'entertainment':
      return ['venue', 'route'];
    case 'hospital':
    case 'school':
    case 'church':
    case 'public':
    case 'office':
    case 'residential':
    case 'park':
    case 'landmark':
    case 'building':
      return ['info', 'route'];
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

function displayLabel(category: PoiCategory, osm: string, name: string): string {
  const amenity = tag(osm, 'amenity');
  const shop = tag(osm, 'shop');
  if (amenity === 'cafe') return 'Café';
  if (amenity === 'restaurant' || amenity === 'fast_food') return 'Restaurant';
  if (amenity === 'pharmacy' || shop === 'pharmacy') return 'Pharmacy';
  if (shop === 'hairdresser' || shop === 'beauty') return 'Salon';
  if (shop === 'convenience') return 'Convenience shop';
  if (shop === 'supermarket') return 'Supermarket';
  if (shop === 'mall' || (category === 'shopping' && /^(Yaya Centre|Adams Arcade|Prestige Plaza)$/.test(name))) return 'Shopping mall';
  if (amenity === 'hospital') return 'Hospital';
  if (amenity === 'clinic') return 'Clinic';
  if (amenity === 'bar' || amenity === 'pub' || amenity === 'nightclub') return 'Nightlife';
  if (amenity === 'bank') return 'Bank';
  if (amenity === 'fuel') return 'Fuel station';
  if (amenity === 'place_of_worship') return 'Place of worship';
  if (amenity === 'cinema' || amenity === 'theatre') return 'Entertainment';
  switch (category) {
    case 'hospital':
      return 'Hospital';
    case 'restaurant':
      return 'Restaurant';
    case 'shopping':
      return 'Shopping';
    case 'hotel':
      return 'Hotel';
    case 'nightlife':
      return 'Nightlife';
    case 'school':
      return 'School';
    case 'church':
      return 'Church';
    case 'public':
      return 'Public institution';
    case 'office':
      return 'Office';
    case 'residential':
      return 'Residential building';
    case 'park':
      return 'Park';
    case 'entertainment':
      return 'Entertainment';
    case 'landmark':
      return 'Landmark';
    case 'building':
      return 'Building';
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

function promptFor(name: string, label: string, actions: PoiAction[]): string {
  const verb = actions.includes('venue') ? 'Open the venue panel' : 'See location details';
  return `${placeTitle(name)} · ${label} · ${verb}`;
}

function facilityCategory(facility: FacilityRecord): PoiCategory {
  const amenity = tag(facility.osm, 'amenity');
  if (amenity === 'bar' || amenity === 'pub' || amenity === 'nightclub') return 'nightlife';
  if (amenity === 'cinema' || amenity === 'theatre' || amenity === 'arts_centre') return 'entertainment';
  switch (facility.kind) {
    case 'hospital':
      return 'hospital';
    case 'restaurant':
      return 'restaurant';
    case 'shopping':
      return 'shopping';
    case 'hotel':
      return 'hotel';
    case 'school':
      return 'school';
    case 'church':
      return 'church';
    case 'worship':
      return 'public';
    case 'office':
      return 'office';
    case 'public':
      return 'public';
    default: {
      const unexpected: never = facility.kind;
      return unexpected;
    }
  }
}

function useCategory(use: BuildingUse): PoiCategory {
  switch (use) {
    case 'house':
    case 'apartments':
      return 'residential';
    case 'commercial':
    case 'mall':
      return 'shopping';
    case 'office':
      return 'office';
    case 'hotel':
      return 'hotel';
    case 'other':
      return 'building';
    default: {
      const unexpected: never = use;
      return unexpected;
    }
  }
}

function destinationCategory(destination: DestinationRecord, building: BuildingRecord | undefined, park: boolean): PoiCategory {
  if (building?.special === 'kicc' || building?.special === 'times-tower') return 'landmark';
  if (park) return 'park';
  const name = destination.name.toLowerCase();
  if (/\bhospital\b|\bclinic\b|medical centre|medical center/.test(name)) return 'hospital';
  if (/\b(university|college|school|kindergarten)\b/.test(name)) return 'school';
  if (/\b(church|cathedral|chapel)\b/.test(name)) return 'church';
  if (/\bmosque\b/.test(name)) return 'public';
  if (/\b(hotel|guest house)\b/.test(name)) return 'hotel';
  if (building?.use) return useCategory(building.use);
  return 'building';
}

function standPoint(
  x: number,
  z: number,
  buildings: readonly { building: BuildingRecord; minX: number; maxX: number; minZ: number; maxZ: number }[],
): { x: number; z: number } {
  const host = buildings.find(
    (item) => x >= item.minX && x <= item.maxX && z >= item.minZ && z <= item.maxZ && item.building.polygon.length > 2 && pointInPolygon(x, z, item.building.polygon),
  );
  if (!host) return { x, z };
  const polygon = host.building.polygon;
  let cx = 0;
  let cz = 0;
  for (const [px, pz] of polygon) {
    cx += px;
    cz += pz;
  }
  cx /= polygon.length;
  cz /= polygon.length;
  let dx = x - cx;
  let dz = z - cz;
  if (Math.hypot(dx, dz) < 0.2) {
    dx = 0;
    dz = 1;
  }
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;
  for (let distance = 1; distance < 90; distance += 1) {
    const sx = cx + dx * distance;
    const sz = cz + dz * distance;
    if (!pointInPolygon(sx, sz, polygon)) return { x: sx + dx * 2.4, z: sz + dz * 2.4 };
  }
  return { x, z };
}

function nearestGate(x: number, z: number, polygon: [number, number][] | null, gates: readonly GateRecord[]): { x: number; z: number } | null {
  let best: GateRecord | null = null;
  let bestDistance = 18;
  for (const gate of gates) {
    let near = Math.hypot(gate.x - x, gate.z - z);
    if (polygon) {
      for (const [px, pz] of polygon) near = Math.min(near, Math.hypot(gate.x - px, gate.z - pz));
    }
    if (near < bestDistance) {
      best = gate;
      bestDistance = near;
    }
  }
  if (!best) return null;
  return { x: best.x, z: best.z };
}

function makePoi(
  source: { id: string; name: string; x: number; z: number; lat: number; lon: number },
  category: PoiCategory,
  osm: string,
  summary: string,
  note: string,
  entrance: { x: number; z: number } | null,
  approach: { x: number; z: number },
  district: PointOfInterest['district'],
): PointOfInterest {
  const label = displayLabel(category, osm, source.name);
  const actions = actionsFor(category);
  return {
    id: source.id,
    name: source.name,
    category,
    label,
    x: source.x,
    z: source.z,
    lat: source.lat,
    lon: source.lon,
    entrance,
    approach,
    actions,
    prompt: promptFor(source.name, label, actions),
    summary,
    note,
    district,
    interior: false,
  };
}

function placesIn(data: CbdData, district: PointOfInterest['district']): PointOfInterest[] {
  const buildingById = new Map(data.buildings.map((building) => [building.id, building]));
  const parks = new Set(data.parks.map((park) => park.id));
  const gates = data.gates ?? [];
  const footprints = data.buildings.map((building) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of building.polygon) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    return { building, minX, maxX, minZ, maxZ };
  });
  const places: PointOfInterest[] = [];
  for (const destination of data.destinations) {
    const name = destination.name.trim();
    if (!name) continue;
    const building = buildingById.get(destination.id);
    const park = parks.has(destination.id);
    const category = destinationCategory(destination, building, park);
    places.push(
      makePoi(
        destination,
        category,
        '',
        destination.summary,
        geometryHonesty(destination),
        nearestGate(destination.x, destination.z, building?.polygon ?? null, gates),
        standPoint(destination.x, destination.z, footprints),
        district,
      ),
    );
  }
  for (const facility of data.facilities ?? []) {
    const name = facility.name.trim();
    if (!name) continue;
    const key = normalName(name);
    const duplicate = places.some((place) => normalName(place.name) === key && Math.hypot(place.x - facility.x, place.z - facility.z) < 40);
    if (duplicate) continue;
    const category = facilityCategory(facility);
    places.push(
      makePoi(
        facility,
        category,
        facility.osm,
        `${displayLabel(category, facility.osm, name)} named in OpenStreetMap (${facility.osm}). This is the mapped point, not a surveyed building.`,
        'OpenStreetMap name and coordinates. No facade or interior was reconstructed.',
        nearestGate(facility.x, facility.z, null, gates),
        standPoint(facility.x, facility.z, footprints),
        district,
      ),
    );
  }
  return places;
}

let cached: readonly PointOfInterest[] | null = null;
let byId: Map<string, PointOfInterest> | null = null;

export function poiRegistry(): readonly PointOfInterest[] {
  if (cached) return cached;
  cached = [...placesIn(cbd, 'Nairobi CBD'), ...placesIn(kilimani, 'Kilimani'), ...placesIn(hurlingham, 'Hurlingham')];
  byId = new Map(cached.map((place) => [place.id, place]));
  return cached;
}

export function poiById(id: string): PointOfInterest | null {
  poiRegistry();
  return byId?.get(id) ?? null;
}

export function approachOf(place: PointOfInterest): { x: number; z: number } {
  return place.entrance ?? place.approach;
}

/** The point used by the map, the highlight, and navigation for one place. */
export function selectionPoint(id: string): { x: number; z: number } | null {
  const place = poiById(id);
  if (place) return approachOf(place);
  const label = placeById(id);
  if (label) return { x: label.x, z: label.z };
  return null;
}

export type DestinationFilter =
  | 'nearby'
  | 'shopping'
  | 'restaurant'
  | 'hospital'
  | 'school'
  | 'worship'
  | 'hotel'
  | 'office'
  | 'park'
  | 'landmark'
  | 'buildings';

export const DESTINATION_FILTERS: readonly { id: DestinationFilter; label: string }[] = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'shopping', label: 'Malls' },
  { id: 'restaurant', label: 'Food' },
  { id: 'hospital', label: 'Health' },
  { id: 'school', label: 'Schools' },
  { id: 'worship', label: 'Worship' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'office', label: 'Offices' },
  { id: 'park', label: 'Parks' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'buildings', label: 'Buildings' },
];

export function matchesDestination(place: PointOfInterest, filter: DestinationFilter): boolean {
  switch (filter) {
    case 'nearby':
      return true;
    case 'shopping':
      return place.category === 'shopping';
    case 'restaurant':
      return place.category === 'restaurant';
    case 'hospital':
      return place.category === 'hospital';
    case 'school':
      return place.category === 'school';
    case 'worship':
      return place.category === 'church' || place.label === 'Place of worship';
    case 'hotel':
      return place.category === 'hotel';
    case 'office':
      return place.category === 'office';
    case 'park':
      return place.category === 'park';
    case 'landmark':
      return place.category === 'landmark' || place.category === 'public' || place.category === 'entertainment' || place.category === 'nightlife';
    case 'buildings':
      return place.category === 'building' || place.category === 'residential';
    default: {
      const unexpected: never = filter;
      return unexpected;
    }
  }
}

export function browseDestinations(x: number, z: number, filter: DestinationFilter, limit = 16): PointOfInterest[] {
  const ranked = poiRegistry()
    .filter((place) => matchesDestination(place, filter))
    .map((place) => {
      const point = approachOf(place);
      return { place, distance: Math.hypot(point.x - x, point.z - z) };
    })
    .sort((a, b) => a.distance - b.distance);
  if (filter !== 'nearby') return ranked.slice(0, limit).map((item) => item.place);
  const picked: PointOfInterest[] = [];
  const seen = new Set<string>();
  const groups: { category: PoiCategory; worship: boolean }[] = [
    { category: 'landmark', worship: false },
    { category: 'shopping', worship: false },
    { category: 'restaurant', worship: false },
    { category: 'hospital', worship: false },
    { category: 'school', worship: false },
    { category: 'church', worship: true },
    { category: 'hotel', worship: false },
    { category: 'office', worship: false },
    { category: 'park', worship: false },
  ];
  for (const group of groups) {
    const next = ranked.find((item) => {
      if (seen.has(item.place.id)) return false;
      if (item.place.category === group.category) return true;
      return group.worship && item.place.label === 'Place of worship';
    });
    if (!next) continue;
    seen.add(next.place.id);
    picked.push(next.place);
  }
  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (seen.has(item.place.id)) continue;
    seen.add(item.place.id);
    picked.push(item.place);
  }
  return picked.slice(0, limit);
}

export function nearbyGuides(x: number, z: number, limit = 8): PointOfInterest[] {
  return browseDestinations(x, z, 'nearby', limit);
}
