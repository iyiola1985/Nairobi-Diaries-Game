import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildingRole, facadeStyle, massHeight, shownHeight } from './architecture';
import { BuildingDress } from './BuildingDress';
import { buildingsInChunk, chunksAround, visibleChunks, type ChunkLod } from './chunks';
import { footprintFor, type BuildingRecord, type CbdData } from './data';
import { extrudeFootprints, plasterMaterial, silhouetteMaterial } from './meshes';
import { livePose } from '../player/input';

interface Piece {
  polygon: [number, number][];
  height: number;
  lift?: number;
  style?: number;
}

interface Fabric {
  houseWall: Piece[];
  houseRoof: Piece[];
  apartmentBase: Piece[];
  apartmentUpper: Piece[];
  commercial: Piece[];
  office: Piece[];
  hotel: Piece[];
  mallBase: Piece[];
  mallUpper: Piece[];
  other: [Piece[], Piece[], Piece[]];
}

interface ChunkBands {
  mass: THREE.BufferGeometry | null;
  low: THREE.BufferGeometry | null;
  mid: THREE.BufferGeometry | null;
  high: THREE.BufferGeometry | null;
  houseWall: THREE.BufferGeometry | null;
  houseRoof: THREE.BufferGeometry | null;
  apartmentBase: THREE.BufferGeometry | null;
  apartmentUpper: THREE.BufferGeometry | null;
  commercial: THREE.BufferGeometry | null;
  office: THREE.BufferGeometry | null;
  hotel: THREE.BufferGeometry | null;
  mallBase: THREE.BufferGeometry | null;
  mallUpper: THREE.BufferGeometry | null;
  otherA: THREE.BufferGeometry | null;
  otherB: THREE.BufferGeometry | null;
  otherC: THREE.BufferGeometry | null;
  parapet: THREE.BufferGeometry | null;
}

const bandCache = new Map<string, ChunkBands | null>();

function emptyFabric(): Fabric {
  return {
    houseWall: [],
    houseRoof: [],
    apartmentBase: [],
    apartmentUpper: [],
    commercial: [],
    office: [],
    hotel: [],
    mallBase: [],
    mallUpper: [],
    other: [[], [], []],
  };
}

function toneIndex(id: string): 0 | 1 | 2 {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % 3;
  if (hash === 0) return 0;
  if (hash === 1) return 1;
  return 2;
}

function pushFabric(fabric: Fabric, building: BuildingRecord, polygon: [number, number][], parapet: Piece[]) {
  const height = shownHeight(building);
  const role = buildingRole(building);
  const style = facadeStyle(building);
  switch (role) {
    case 'landmark':
      return;
    case 'house': {
      const roof = height > 2.4 ? 0.45 : 0;
      fabric.houseWall.push({ polygon, height: height - roof, style });
      if (roof > 0) fabric.houseRoof.push({ polygon, height: roof, lift: height - roof, style });
      break;
    }
    case 'apartments': {
      const split = height > 6 ? 3.15 : 0;
      if (split === 0) fabric.apartmentUpper.push({ polygon, height, style });
      else {
        fabric.apartmentBase.push({ polygon, height: split, style: 2 });
        fabric.apartmentUpper.push({ polygon, height: height - split, lift: split, style });
      }
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    }
    case 'commercial':
      fabric.commercial.push({ polygon, height, style });
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    case 'office':
      fabric.office.push({ polygon, height, style });
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    case 'hotel':
      fabric.hotel.push({ polygon, height, style });
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    case 'mall': {
      const base = Math.min(3.4, height);
      fabric.mallBase.push({ polygon, height: base, style });
      if (height - base > 0.8) fabric.mallUpper.push({ polygon, height: height - base, lift: base, style });
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    }
    case 'older':
      fabric.other[toneIndex(building.id)].push({ polygon, height, style });
      parapet.push({ polygon, height: 0.7, lift: height + 0.02, style: 5 });
      break;
    default: {
      const unexpected: never = role;
      return unexpected;
    }
  }
}

function footprint(data: CbdData, building: BuildingRecord): [number, number][] {
  return footprintFor(data.districtId, building.polygon);
}

function chunkBands(data: CbdData, ix: number, iz: number, lod: ChunkLod): ChunkBands | null {
  const tier = lod === 'far' ? 'far' : 'fabric';
  const key = `${data.districtId}:${ix}:${iz}:${tier}`;
  const cached = bandCache.get(key);
  if (cached !== undefined) return cached;
  const buildings = buildingsInChunk(data, ix, iz);
  if (buildings.length === 0) {
    bandCache.set(key, null);
    return null;
  }
  if (lod === 'far') {
    const house: Piece[] = [];
    const street: Piece[] = [];
    const tower: Piece[] = [];
    const landmark: Piece[] = [];
    for (const building of buildings) {
      const polygon = footprint(data, building);
      const role = buildingRole(building);
      switch (role) {
        case 'landmark':
          landmark.push({ polygon, height: shownHeight(building) });
          break;
        case 'house':
          house.push({ polygon, height: shownHeight(building) });
          break;
        case 'office':
        case 'hotel':
          tower.push({ polygon, height: massHeight(building) });
          break;
        case 'apartments':
        case 'commercial':
        case 'mall':
        case 'older':
          street.push({ polygon, height: massHeight(building) });
          break;
        default: {
          const unexpected: never = role;
          return unexpected;
        }
      }
    }
    const bands: ChunkBands = {
      mass: null,
      low: null,
      mid: null,
      high: extrudeFootprints(landmark),
      houseWall: extrudeFootprints(house),
      houseRoof: null,
      apartmentBase: null,
      apartmentUpper: null,
      commercial: extrudeFootprints(street),
      office: extrudeFootprints(tower),
      hotel: null,
      mallBase: null,
      mallUpper: null,
      otherA: null,
      otherB: null,
      otherC: null,
      parapet: null,
    };
    bandCache.set(key, bands);
    return bands;
  }
  const landmarks: Piece[] = [];
  const parapet: Piece[] = [];
  const fabric = emptyFabric();
  for (const building of buildings) {
    const polygon = footprint(data, building);
    if (buildingRole(building) === 'landmark') {
      landmarks.push({ polygon, height: shownHeight(building), style: 5 });
      continue;
    }
    pushFabric(fabric, building, polygon, parapet);
  }
  const bands: ChunkBands = {
    mass: null,
    low: null,
    mid: null,
    high: extrudeFootprints(landmarks),
    houseWall: extrudeFootprints(fabric.houseWall),
    houseRoof: extrudeFootprints(fabric.houseRoof),
    apartmentBase: extrudeFootprints(fabric.apartmentBase),
    apartmentUpper: extrudeFootprints(fabric.apartmentUpper),
    commercial: extrudeFootprints(fabric.commercial),
    office: extrudeFootprints(fabric.office),
    hotel: extrudeFootprints(fabric.hotel),
    mallBase: extrudeFootprints(fabric.mallBase),
    mallUpper: extrudeFootprints(fabric.mallUpper),
    otherA: extrudeFootprints(fabric.other[0]),
    otherB: extrudeFootprints(fabric.other[1]),
    otherC: extrudeFootprints(fabric.other[2]),
    parapet: extrudeFootprints(parapet),
  };
  bandCache.set(key, bands);
  return bands;
}

function Band({
  geometry,
  tint,
  windows,
  lit,
  shadows,
}: {
  geometry: THREE.BufferGeometry | null;
  tint: string;
  windows: THREE.CanvasTexture | null;
  lit: boolean;
  shadows: boolean;
}) {
  if (!geometry?.getAttribute('position')) return null;
  return <mesh geometry={geometry} material={plasterMaterial(tint, windows, lit)} castShadow={shadows} receiveShadow={shadows} dispose={null} />;
}

function Silhouette({ geometry, tint }: { geometry: THREE.BufferGeometry | null; tint: string }) {
  if (!geometry?.getAttribute('position')) return null;
  return <mesh geometry={geometry} material={silhouetteMaterial(tint)} dispose={null} />;
}

function Fabric({
  bands,
  windows,
  lit,
  dress,
}: {
  bands: ChunkBands;
  windows: THREE.CanvasTexture;
  lit: boolean;
  dress: BuildingRecord[] | null;
}) {
  const shadows = dress !== null;
  return (
    <group>
      <Band geometry={bands.low} tint="#efe4d4" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.mid} tint="#e4ddd2" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.high} tint="#ddd4c8" windows={null} lit={false} shadows={shadows} />
      <Band geometry={bands.houseWall} tint="#f3eadc" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.houseRoof} tint="#8d4f38" windows={null} lit={false} shadows={shadows} />
      <Band geometry={bands.apartmentBase} tint="#c4b5a4" windows={null} lit={false} shadows={shadows} />
      <Band geometry={bands.apartmentUpper} tint="#e4ddd2" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.commercial} tint="#e2c9a4" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.office} tint="#d5ddd8" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.hotel} tint="#f0ddd0" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.mallBase} tint="#cfc3b2" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.mallUpper} tint="#f7f1e6" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.otherA} tint="#d9cbb6" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.otherB} tint="#cbb8a2" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.otherC} tint="#b7b1a4" windows={windows} lit={lit} shadows={shadows} />
      <Band geometry={bands.parapet} tint="#d5cfc3" windows={null} lit={false} shadows={shadows} />
      {dress ? <BuildingDress buildings={dress} /> : null}
    </group>
  );
}

function ChunkMesh({
  data,
  ix,
  iz,
  lod,
  windows,
  lit,
}: {
  data: CbdData;
  ix: number;
  iz: number;
  lod: ChunkLod;
  windows: THREE.CanvasTexture;
  lit: boolean;
}) {
  const bands = useMemo(() => chunkBands(data, ix, iz, lod), [data, ix, iz, lod]);
  if (!bands) return null;
  switch (lod) {
    case 'far':
      return (
        <group>
          <Silhouette geometry={bands.houseWall} tint="#efe6d8" />
          <Silhouette geometry={bands.commercial} tint="#e4d2b8" />
          <Silhouette geometry={bands.office} tint="#c9d0cc" />
          <Silhouette geometry={bands.high} tint="#d7d0c4" />
        </group>
      );
    case 'mid':
      return <Fabric bands={bands} windows={windows} lit={lit} dress={null} />;
    case 'near':
      return (
        <Fabric
          bands={bands}
          windows={windows}
          lit={lit}
          dress={buildingsInChunk(data, ix, iz).map((building) => ({ ...building, polygon: footprint(data, building) }))}
        />
      );
    default: {
      const unexpected: never = lod;
      return unexpected;
    }
  }
}

export function BuildingChunks({
  data,
  windows,
  lit,
  anchor,
}: {
  data: CbdData;
  windows: THREE.CanvasTexture;
  lit: boolean;
  /** When set, chunks stay around this point instead of the walking player. */
  anchor: { x: number; z: number } | null;
}) {
  const [cells, setCells] = useState(() => visibleChunks(anchor?.x ?? livePose.x, anchor?.z ?? livePose.z));
  const signature = useRef(cells.map((cell) => cell.id).join('|'));
  useFrame(() => {
    if (anchor) return;
    const next = chunksAround(livePose.x, livePose.z, cells);
    const nextSignature = next.map((cell) => cell.id).join('|');
    if (nextSignature === signature.current) return;
    signature.current = nextSignature;
    setCells(next);
  });
  return (
    <group>
      {cells.map((cell) => (
        <ChunkMesh key={cell.id} data={data} ix={cell.ix} iz={cell.iz} lod={cell.lod} windows={windows} lit={lit} />
      ))}
    </group>
  );
}
