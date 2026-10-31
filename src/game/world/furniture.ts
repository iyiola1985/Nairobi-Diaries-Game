import raw from './street-furniture.json';
import { cbd, kilimani, type CbdData } from './data';
import { leftHandOffset, nearestCarriage, type RoadSpan } from './roads';

export type FurnitureKind = 'signal' | 'bus_stop' | 'crossing' | 'bump' | 'roundabout' | 'mini_roundabout' | 'stop' | 'give_way';

export interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  radius: number;
}

export interface PlacedProp {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  yaw: number;
  radius: number;
  across: number;
}

interface FurnitureFile {
  source: 'openstreetmap';
  attribution: string;
  license: string;
  districts: Record<string, FurnitureItem[]>;
}

const file = raw as FurnitureFile;

const KINDS: FurnitureKind[] = ['signal', 'bus_stop', 'crossing', 'bump', 'roundabout', 'mini_roundabout', 'stop', 'give_way'];

function isKind(value: string): value is FurnitureKind {
  return KINDS.some((kind) => kind === value);
}

function districtData(id: string): CbdData | null {
  switch (id) {
    case 'nairobi-cbd':
      return cbd;
    case 'kilimani':
      return kilimani;
    default:
      return null;
  }
}

export function furnitureIn(districtId: string): FurnitureItem[] {
  const list = file.districts[districtId] ?? [];
  return list.filter((item) => isKind(item.kind));
}

function place(item: FurnitureItem, roads: RoadSpan[]): PlacedProp {
  const carriage = nearestCarriage(item.x, item.z, roads);
  const dx = carriage?.dx ?? 1;
  const dz = carriage?.dz ?? 0;
  const yaw = Math.atan2(dx, dz);
  const across = carriage?.width ?? 6;
  switch (item.kind) {
    case 'crossing':
    case 'bump':
    case 'roundabout':
    case 'mini_roundabout':
      return { ...item, yaw, across };
    case 'signal':
    case 'bus_stop':
    case 'stop':
    case 'give_way': {
      const [ox, oz] = leftHandOffset(dx, dz, across / 2 + 0.85);
      return { ...item, x: item.x + ox, z: item.z + oz, yaw, across };
    }
    default: {
      const unexpected: never = item.kind;
      return unexpected;
    }
  }
}

export function placedProps(districtId: string): PlacedProp[] {
  const district = districtData(districtId);
  if (!district) return [];
  return furnitureIn(districtId).map((item) => place(item, district.roads));
}

export function kilimaniCrossings(): FurnitureItem[] {
  return furnitureIn('kilimani').filter((item) => item.kind === 'crossing');
}

export function cbdCrossings(): FurnitureItem[] {
  return furnitureIn('nairobi-cbd').filter((item) => item.kind === 'crossing');
}
