export type RideMode = 'pikipiki' | 'matatu' | 'ride' | 'car';

export interface RideLane {
  points: readonly [number, number][];
  length: number;
}

export interface RideTrack {
  lane: number;
  distance: number;
}

export interface RideBody {
  w: number;
  h: number;
  d: number;
  color: string;
  seatX: number;
  seatY: number;
  seatZ: number;
}

/** Chassis stays below the head so the passenger remains in the follow view. */
export function rideBody(mode: RideMode): RideBody {
  switch (mode) {
    case 'pikipiki':
      return { w: 0.7, h: 0.55, d: 1.8, color: '#3d6b4f', seatX: 0, seatY: 0.62, seatZ: -0.15 };
    case 'matatu':
      return { w: 1.9, h: 1.15, d: 6.2, color: '#f4e6c4', seatX: 0.42, seatY: 0.2, seatZ: 0.35 };
    case 'ride':
      return { w: 1.7, h: 0.95, d: 4.1, color: '#f7f4ea', seatX: 0.32, seatY: 0.18, seatZ: 0.1 };
    case 'car':
      return { w: 1.7, h: 0.95, d: 4.1, color: '#d8d2c8', seatX: -0.32, seatY: 0.18, seatZ: 0.1 };
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}

interface Sample {
  x: number;
  z: number;
  heading: number;
  distance: number;
  gap: number;
}

function sampleAt(lane: RideLane, distance: number): Sample | null {
  if (lane.points.length < 2 || lane.length <= 0) return null;
  const along = Math.max(0, Math.min(lane.length - 0.05, distance));
  let walked = 0;
  for (let i = 1; i < lane.points.length; i += 1) {
    const start = lane.points[i - 1];
    const end = lane.points[i];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const span = Math.hypot(dx, dz);
    if (span < 0.001) continue;
    if (walked + span >= along || i === lane.points.length - 1) {
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, (along - walked) / span));
      return {
        x: start[0] + dx * t,
        z: start[1] + dz * t,
        heading: Math.atan2(dx, dz),
        distance: along,
        gap: 0,
      };
    }
    walked += span;
  }
  return null;
}

function closest(lane: RideLane, x: number, z: number): Sample | null {
  let walked = 0;
  let best: Sample | null = null;
  for (let i = 1; i < lane.points.length; i += 1) {
    const start = lane.points[i - 1];
    const end = lane.points[i];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const span = dx * dx + dz * dz;
    const length = Math.sqrt(span);
    if (length < 0.001) continue;
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / span));
    const px = start[0] + dx * t;
    const pz = start[1] + dz * t;
    const gap = Math.hypot(x - px, z - pz);
    if (!best || gap < best.gap) {
      best = { x: px, z: pz, heading: Math.atan2(dx, dz), distance: walked + length * t, gap };
    }
    walked += length;
  }
  return best;
}

function toward(sample: Sample, goalX: number, goalZ: number): number {
  return (goalX - sample.x) * Math.sin(sample.heading) + (goalZ - sample.z) * Math.cos(sample.heading);
}

/** The lane that already passes the passenger and heads toward the stop. */
export function beginRide(lanes: readonly RideLane[], x: number, z: number, goalX: number, goalZ: number): RideTrack | null {
  let best: RideTrack | null = null;
  let bestScore = Infinity;
  let nearest: RideTrack | null = null;
  let nearestGap = Infinity;
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index];
    if (!lane) continue;
    const hit = closest(lane, x, z);
    if (!hit) continue;
    if (hit.gap < nearestGap) {
      nearestGap = hit.gap;
      nearest = { lane: index, distance: hit.distance };
    }
    if (hit.gap > 28) continue;
    const score = hit.gap + (toward(hit, goalX, goalZ) > 0 ? 0 : 36);
    if (score < bestScore) {
      bestScore = score;
      best = { lane: index, distance: hit.distance };
    }
  }
  return best ?? nearest;
}

function handoff(lanes: readonly RideLane[], from: number, end: Sample, goalX: number, goalZ: number): RideTrack | null {
  let best: RideTrack | null = null;
  let bestScore = Infinity;
  for (let index = 0; index < lanes.length; index += 1) {
    if (index === from) continue;
    const lane = lanes[index];
    if (!lane) continue;
    const hit = closest(lane, end.x, end.z);
    if (!hit || hit.gap > 16) continue;
    const score = hit.gap + (toward(hit, goalX, goalZ) > 0 ? 0 : 36);
    if (score < bestScore) {
      bestScore = score;
      best = { lane: index, distance: hit.distance };
    }
  }
  return best;
}

/** Move along the same driven lanes the street traffic uses. */
export function advanceRide(
  lanes: readonly RideLane[],
  track: RideTrack,
  metres: number,
  goalX: number,
  goalZ: number,
): { track: RideTrack; x: number; z: number; heading: number } | null {
  let current = track;
  let lane = lanes[current.lane];
  if (!lane) return null;
  let distance = current.distance + Math.max(0, metres);
  if (distance >= lane.length - 0.4) {
    const end = sampleAt(lane, lane.length - 0.2);
    const next = end ? handoff(lanes, current.lane, end, goalX, goalZ) : null;
    if (next) {
      current = next;
      lane = lanes[current.lane];
      distance = current.distance;
    } else {
      distance = Math.max(0, lane.length - 0.2);
    }
  }
  if (!lane) return null;
  const pose = sampleAt(lane, distance);
  if (!pose) return null;
  return { track: { lane: current.lane, distance: pose.distance }, x: pose.x, z: pose.z, heading: pose.heading };
}
