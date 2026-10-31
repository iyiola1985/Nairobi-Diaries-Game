import catalogue from './neighbourhoods.json';

export type ExtractStatus = 'extracted' | 'catalogued';

export interface NeighbourhoodWindow {
  id: string;
  name: string;
  file: string;
  status: ExtractStatus;
  profile: 'cbd' | 'residential';
  bbox: { south: number; west: number; north: number; east: number };
  near: { lat: number; lon: number } | null;
  placementId: string | null;
  /** What this window is. A catalogued window is not a walkable mesh. */
  note: string;
}

export const NEIGHBOURHOODS = catalogue.neighbourhoods as NeighbourhoodWindow[];

export function neighbourhoodById(id: string): NeighbourhoodWindow | null {
  return NEIGHBOURHOODS.find((item) => item.id === id) ?? null;
}

export function extractStatusLabel(status: ExtractStatus): string {
  switch (status) {
    case 'extracted':
      return 'Cached OpenStreetMap extract';
    case 'catalogued':
      return 'Extract window only. Not loaded into the walkable city.';
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}
