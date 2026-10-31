export const KICC_ORIGIN = { lat: -1.28861, lon: 36.82306, name: 'KICC' };
const LAT_M = 110540;

export function metersPerLon(lat: number): number {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

/** East is +X. North is -Z, so Three's default view looks north from the south. */
export function project(lat: number, lon: number, origin = KICC_ORIGIN): [number, number] {
  const x = (lon - origin.lon) * metersPerLon(origin.lat);
  const z = -(lat - origin.lat) * LAT_M;
  return [x, z];
}

export function unproject(x: number, z: number, origin = KICC_ORIGIN): { lat: number; lon: number } {
  return {
    lat: origin.lat - z / LAT_M,
    lon: origin.lon + x / metersPerLon(origin.lat),
  };
}
