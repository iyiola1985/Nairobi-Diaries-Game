export interface TrafficBody {
  x: number;
  z: number;
  radius: number;
}

const moving: TrafficBody[] = [];
const parked: TrafficBody[] = [];

export function beginTrafficFrame(): void {
  moving.length = 0;
}

export function noteTraffic(x: number, z: number, radius: number): void {
  moving.push({ x, z, radius });
}

export function setParkedTraffic(bodies: readonly TrafficBody[]): void {
  parked.splice(0, parked.length, ...bodies);
}

export function clearTraffic(): void {
  moving.length = 0;
  parked.length = 0;
}

export function hitsTraffic(x: number, z: number, reach: number): boolean {
  for (const body of parked) {
    if (Math.hypot(body.x - x, body.z - z) < body.radius + reach) return true;
  }
  for (const body of moving) {
    if (Math.hypot(body.x - x, body.z - z) < body.radius + reach) return true;
  }
  return false;
}
