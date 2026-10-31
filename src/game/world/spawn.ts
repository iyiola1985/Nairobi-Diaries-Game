import { blocked } from './collision';
import { cbd, colliders, type DestinationRecord } from './data';

const RADIUS = 0.46;

export interface StreetSpawn {
  x: number;
  z: number;
  yaw: number;
  heading: number;
  road: string;
}

function kiccTarget(): { x: number; z: number } {
  const building = cbd.buildings.find((item) => item.special === 'kicc' && item.accent);
  if (building?.accent) return { x: building.accent.cx, z: building.accent.cz };
  return { x: cbd.spawn.x, z: cbd.spawn.z };
}

function wallsBetween(x: number, z: number, tx: number, tz: number): number {
  let count = 0;
  const steps = 18;
  for (let i = 3; i < steps - 3; i++) {
    const t = i / steps;
    if (blocked(x + (tx - x) * t, z + (tz - z) * t, 0.2, colliders, cbd.bounds)) count += 1;
  }
  return count;
}

function computeStreetSpawn(): StreetSpawn {
  const target = kiccTarget();
  let best: { x: number; z: number; road: string; score: number } | null = null;
  for (const road of cbd.roads) {
    if (!road.name || road.class === 'footway' || road.class === 'path' || road.class === 'steps') continue;
    const preferred = /harambee|kenyatta avenue|haile selassie|city hall/i.test(road.name) ? 0 : 12;
    for (const [x, z] of road.points) {
      const distance = Math.hypot(x - target.x, z - target.z);
      if (distance < 45 || distance > 140) continue;
      if (blocked(x, z, RADIUS, colliders, cbd.bounds)) continue;
      const score = wallsBetween(x, z, target.x, target.z) * 24 + preferred + distance * 0.03;
      if (!best || score < best.score) best = { x, z, road: road.name, score };
    }
  }
  const x = best?.x ?? cbd.spawn.x;
  const z = best?.z ?? cbd.spawn.z;
  const dx = target.x - x;
  const dz = target.z - z;
  return {
    x,
    z,
    yaw: Math.atan2(-dx, -dz),
    heading: Math.atan2(dx, dz),
    road: best?.road ?? 'Nairobi CBD',
  };
}

let cached: StreetSpawn | null = null;

/** Open point on a named OSM road, facing the KICC tower. */
export function streetSpawn(): StreetSpawn {
  if (!cached) cached = computeStreetSpawn();
  return cached;
}

export function geometryHonesty(destination: DestinationRecord): string {
  if (/times tower/i.test(destination.name)) {
    return 'OpenStreetMap footprint extruded to the published height of about 140 m. This is not a surveyed facade.';
  }
  if (/kenyatta international convention/i.test(destination.name)) {
    return 'OpenStreetMap footprint and position. The cylindrical tower is a simplified stand-in for the published 105 m roof, not a measured model.';
  }
  return destination.geometryNote;
}
