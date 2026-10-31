import type { Group } from 'three';

export type AssetStatus = 'absent' | 'placeholder' | 'procedural' | 'review' | 'ready';

export type AssetRole =
  | 'pipeline-probe'
  | 'character-body'
  | 'character-hair'
  | 'character-clothing'
  | 'character-shoes'
  | 'character-accessory'
  | 'animation'
  | 'landmark'
  | 'building'
  | 'prop'
  | 'vehicle'
  | 'furniture'
  | 'texture'
  | 'environment';

export type AssetFormat = 'glb' | 'gltf' | 'ktx2' | 'osm-json' | null;

export interface AssetPlacement {
  x: number;
  z: number;
  lat: number;
  lon: number;
  /** Published or OSM height in metres. Null when the mesh, not the site, is missing. */
  heightM: number | null;
}

export interface AssetRecord {
  id: string;
  role: AssetRole;
  status: AssetStatus;
  title: string;
  /** Public URL. Null means nothing should be fetched. */
  file: string | null;
  format: AssetFormat;
  license: string;
  provenance: string;
  lod: 0 | 1 | 2 | null;
  /** Skeleton this mesh must fit. Null for world meshes and the probe. */
  rigId: string | null;
  /** CharacterConfig fields this mesh is allowed to represent. */
  slots: readonly string[];
  placement: AssetPlacement | null;
  notes: string;
}

export interface MeshFacts {
  meshCount: number;
  triangleCount: number;
  skinned: boolean;
  boneNames: string[];
  clipNames: string[];
  materialNames: string[];
  size: [number, number, number];
  byteLength: number;
}

export interface ValidationCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export type LoadResult =
  | { status: 'loading'; id: string }
  | { status: 'error'; id: string; message: string }
  | { status: 'ready'; id: string; checks: ValidationCheck[]; facts: MeshFacts; scene: Group };
