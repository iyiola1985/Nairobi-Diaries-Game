export const WORLD_PIPELINE = {
  district: 'nairobi-cbd',
  alsoWalkable: 'kilimani',
  horizontal: 'openstreetmap-footprints',
  vertical: 'osm-height-level-or-estimate',
  landmarks: 'simplified-accents-at-osm-positions',
  interiors: 'not-modelled',
  terrain: 'flat',
  liveRequests: 'none',
  catalogue: 'neighbourhood-extract-windows',
  streaming: 'validated-extracts-and-player-chunks',
} as const;
