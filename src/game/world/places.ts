import { shownHeight } from './architecture';
import { circleHitsPolygon } from './collision';
import { cbd, hurlingham, kilimani, type BuildingRecord, type CbdData, type FacilityKind, type FacilityRecord } from './data';

export type PlaceCategory = 'landmark' | 'building' | 'park' | FacilityKind;

/** A named place from the current OpenStreetMap extract. Unnamed footprints are omitted. */
export interface PlaceInfo {
  id: string;
  name: string;
  x: number;
  z: number;
  labelY: number;
  lat: number;
  lon: number;
  category: PlaceCategory;
  /** The name is the OpenStreetMap name. It was not invented here. */
  verified: true;
  /** The mesh is a simplified stand-in, not a surveyed model. */
  placeholder: boolean;
  description: string;
  geometryNote: string;
  district: 'Nairobi CBD' | 'Kilimani' | 'Hurlingham';
}

function labelHeight(building: BuildingRecord): number {
  if (building.special === 'kicc' || building.special === 'times-tower') return 28;
  const height = shownHeight(building);
  if (height < 16) return height + 4;
  if (building.heightSource === 'estimate') return height + 3;
  return 18;
}

/** The name as stored, with OpenStreetMap's semicolon between alternate names shown as a break. */
export function placeTitle(name: string): string {
  return name
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** How far a floating label stays readable. Other categories stay off the street view. */
export function streetLabelRange(category: PlaceCategory): number {
  switch (category) {
    case 'landmark':
      return 220;
    case 'hospital':
      return 150;
    case 'restaurant':
      return 72;
    case 'shopping':
    case 'hotel':
    case 'office':
    case 'church':
    case 'worship':
    case 'public':
    case 'school':
    case 'park':
    case 'building':
      return 0;
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

export function streetLabel(name: string, category: PlaceCategory): string {
  const title = placeTitle(name);
  switch (category) {
    case 'hospital':
      return `${title} · Hospital`;
    case 'restaurant':
      return `${title} · Restaurant`;
    case 'landmark':
    case 'shopping':
    case 'hotel':
    case 'office':
    case 'church':
    case 'worship':
    case 'public':
    case 'school':
    case 'park':
    case 'building':
      return title;
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

function facilityPhrase(kind: FacilityKind): string {
  switch (kind) {
    case 'shopping':
      return 'Shopping place';
    case 'hospital':
      return 'Health facility';
    case 'school':
      return 'School';
    case 'restaurant':
      return 'Food place';
    case 'hotel':
      return 'Hotel';
    case 'office':
      return 'Office';
    case 'church':
      return 'Church';
    case 'worship':
      return 'Place of worship';
    case 'public':
      return 'Public facility';
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function facilityPlace(facility: FacilityRecord, district: PlaceInfo['district']): PlaceInfo {
  return {
    id: facility.id,
    name: facility.name,
    x: facility.x,
    z: facility.z,
    labelY: 6,
    lat: facility.lat,
    lon: facility.lon,
    category: facility.kind,
    verified: true,
    placeholder: true,
    description: `${facilityPhrase(facility.kind)} named in OpenStreetMap (${facility.osm}). This is the mapped point, not a surveyed building.`,
    geometryNote: 'OpenStreetMap name and coordinates. No facade or interior was reconstructed.',
    district,
  };
}

function placesIn(data: CbdData, district: PlaceInfo['district']): PlaceInfo[] {
  const buildings = new Map(data.buildings.map((building) => [building.id, building]));
  const parks = new Set(data.parks.map((park) => park.id));
  const places: PlaceInfo[] = [];
  for (const destination of data.destinations) {
    const name = destination.name.trim();
    if (!name) continue;
    const building = buildings.get(destination.id);
    const park = parks.has(destination.id);
    let category: PlaceCategory = 'building';
    if (building?.special === 'kicc' || building?.special === 'times-tower') category = 'landmark';
    else if (park) category = 'park';
    const anchor = building ? labelAnchor(building, destination.x, destination.z) : { x: destination.x, z: destination.z };
    places.push({
      id: destination.id,
      name,
      x: anchor.x,
      z: anchor.z,
      labelY: building ? labelHeight(building) : 5,
      lat: destination.lat,
      lon: destination.lon,
      category,
      verified: true,
      placeholder: true,
      description: destination.summary,
      geometryNote: destination.geometryNote,
      district,
    });
  }
  for (const facility of data.facilities ?? []) {
    const name = facility.name.trim();
    if (!name) continue;
    places.push(facilityPlace(facility, district));
  }
  return places;
}

function labelAnchor(building: BuildingRecord, preferredX: number, preferredZ: number): { x: number; z: number } {
  const polygon = building.polygon;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of polygon) {
    cx += x;
    cz += z;
  }
  cx /= polygon.length;
  cz /= polygon.length;
  let dx = preferredX - cx;
  let dz = preferredZ - cz;
  if (building.accent) {
    dx = preferredX - building.accent.cx;
    dz = preferredZ - building.accent.cz;
    cx = building.accent.cx;
    cz = building.accent.cz;
  }
  if (Math.hypot(dx, dz) < 0.4) {
    dx = 0;
    dz = 1;
  }
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;
  const clearance = building.accent?.kind === 'kicc' ? 18 : building.special === 'times-tower' ? 8 : 3.2;
  for (let distance = clearance; distance < 90; distance += 1.25) {
    const x = cx + dx * distance;
    const z = cz + dz * distance;
    if (!circleHitsPolygon(x, z, 2.4, polygon)) return { x, z };
  }
  return { x: preferredX, z: preferredZ };
}

let cached: readonly PlaceInfo[] | null = null;

export function placeRegistry(): readonly PlaceInfo[] {
  if (cached) return cached;
  const places = [...placesIn(cbd, 'Nairobi CBD'), ...placesIn(kilimani, 'Kilimani'), ...placesIn(hurlingham, 'Hurlingham')];
  cached = places;
  return places;
}

export function placeById(id: string): PlaceInfo | null {
  return placeRegistry().find((place) => place.id === id) ?? null;
}
