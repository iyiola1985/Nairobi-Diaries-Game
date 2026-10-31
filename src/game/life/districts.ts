import { project } from '../world/project';

export interface DistrictStop {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
  x: number;
  z: number;
  km: number;
  /** What you can do on arrival. Food uses a game counter, not an invented restaurant brand. */
  food: boolean;
  job: string | null;
  note: string;
}

/** Area centres for travel. These are not building footprints and they are not in the walkable CBD mesh. */
const STOPS: Omit<DistrictStop, 'x' | 'z' | 'km'>[] = [
  {
    id: 'kilimani',
    name: 'Kilimani',
    area: 'Kilimani',
    lat: -1.2925,
    lon: 36.7865,
    food: true,
    job: 'Shop shift',
    note: 'A residential and shopping district west of the CBD. The walkable streets are the OpenStreetMap extract from Ngong Road through Argwings Kodhek Road, Wood Avenue, Lenana Road, and Kilimani Road.',
  },
  {
    id: 'lavington',
    name: 'Lavington',
    area: 'Lavington',
    lat: -1.279,
    lon: 36.7695,
    food: true,
    job: null,
    note: 'A residential district west of Kilimani. An OpenStreetMap extract window is catalogued, but those streets are not in the walkable mesh yet.',
  },
  {
    id: 'kileleshwa',
    name: 'Kileleshwa',
    area: 'Kileleshwa',
    lat: -1.2835,
    lon: 36.7875,
    food: false,
    job: null,
    note: 'A residential district north of Kilimani. An OpenStreetMap extract window is catalogued, but those streets are not in the walkable mesh yet.',
  },
  {
    id: 'ngong-road',
    name: 'Ngong Road',
    area: 'Ngong Road',
    lat: -1.3002,
    lon: 36.789,
    food: true,
    job: null,
    note: 'A point along Ngong Road, the road that runs southwest from the city.',
  },
  {
    id: 'trm',
    name: 'Thika Road Mall',
    area: 'TRM',
    lat: -1.2196,
    lon: 36.8888,
    food: true,
    job: 'Mall shift',
    note: 'Thika Road Mall, the mall known as TRM, along Thika Road. This is not a model of the real interior.',
  },
  {
    id: 'kiambu-road',
    name: 'Kiambu Road',
    area: 'Kiambu Road',
    lat: -1.2205,
    lon: 36.834,
    food: false,
    job: null,
    note: 'A point on Kiambu Road, north of the CBD. The road itself is not modelled.',
  },
  {
    id: 'jkia',
    name: 'Jomo Kenyatta International Airport',
    area: 'JKIA',
    lat: -1.3192,
    lon: 36.9278,
    food: true,
    job: 'Terminal shift',
    note: 'The airport east of the city. You arrive at the airport area, not inside a terminal model.',
  },
  {
    id: 'syokimau',
    name: 'Syokimau',
    area: 'Syokimau',
    lat: -1.3565,
    lon: 36.922,
    food: false,
    job: null,
    note: 'Syokimau, south of the airport. Arrival is the area, not a specific station interior.',
  },
];

export function districtStops(): DistrictStop[] {
  return STOPS.map((stop) => {
    const [x, z] = project(stop.lat, stop.lon);
    return { ...stop, x, z, km: Math.round(Math.hypot(x, z) / 100) / 10 };
  });
}

export function districtById(id: string): DistrictStop | null {
  return districtStops().find((stop) => stop.id === id) ?? null;
}
