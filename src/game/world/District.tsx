import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { liveCampaigns } from '../ads/campaigns';
import { livePose } from '../player/input';
import { BuildingChunks } from './BuildingChunks';
import { chunkOf, VIEW_REACH } from './chunks';
import { districtVisible, roadsInView } from './coverage';
import { cbd, districtAt, districts, type BuildingRecord, type CbdData, type DistrictId } from './data';
import { shownHeight } from './architecture';
import { extrudeFootprints, discGeometry, joinedRibbon, makeWindowTexture, postGeometry, skyColors, surfaceMaterial, wallGeometry } from './meshes';
import { cbdCrossings, kilimaniCrossings } from './furniture';
import { crossingStripes, roadLayers } from './roads';
import { streetSpawn } from './spawn';
import { StreetFurniture } from './StreetFurniture';
import { StreetLife } from './StreetLife';
import { DistrictDress } from './DistrictDress';
import { afterDark, streetLampsOn, sunOffset } from './sky';
import type { TimeOfDay } from '../../store/useGame';

function readView(x: number, z: number) {
  return {
    home: districtAt(x, z)?.districtId ?? null,
    ids: districts.filter((district) => districtVisible(district.bounds, district.roads, x, z)).map((district) => district.districtId),
  };
}

export function District({ time, rain = false, pinned }: { time: TimeOfDay; rain?: boolean; pinned?: DistrictId }) {
  const lit = afterDark(time);
  const lamps = streetLampsOn(time);
  const windows = useMemo(() => makeWindowTexture(lit), [lit]);
  useEffect(() => () => windows.dispose(), [windows]);
  const [view, setView] = useState(() => readView(livePose.x, livePose.z));
  const held = useRef(view);
  const origin = chunkOf(livePose.x, livePose.z);
  const chunkKey = useRef(`${origin.ix}:${origin.iz}`);
  useFrame(() => {
    if (pinned) return;
    const cell = chunkOf(livePose.x, livePose.z);
    const key = `${cell.ix}:${cell.iz}`;
    const home = districtAt(livePose.x, livePose.z)?.districtId ?? null;
    const entered = key !== chunkKey.current;
    if (!entered && home === held.current.home) return;
    chunkKey.current = key;
    const ids = entered
      ? districts.filter((district) => districtVisible(district.bounds, district.roads, livePose.x, livePose.z)).map((district) => district.districtId)
      : held.current.ids;
    const next = { home, ids };
    held.current = next;
    setView(next);
  });
  if (pinned) {
    const data = districts.find((district) => district.districtId === pinned) ?? cbd;
    return <DistrictMesh data={data} time={time} windows={windows} rain={rain} lamps={lamps} dark={lit} anchor={{ x: data.spawn.x, z: data.spawn.z }} full />;
  }
  const shown = districts.filter((district) => view.ids.includes(district.districtId));
  const meshes = shown.length > 0 ? shown : [cbd];
  return (
    <>
      <LocalGround />
      {meshes.map((data) => (
        <DistrictMesh
          key={data.districtId}
          data={data}
          time={time}
          windows={windows}
          rain={rain}
          lamps={lamps}
          dark={lit}
          anchor={null}
          full={data.districtId === view.home}
        />
      ))}
    </>
  );
}

function LocalGround() {
  const ground = useRef<THREE.Mesh>(null);
  const size = VIEW_REACH * 2;
  useFrame(() => {
    ground.current?.position.set(livePose.x, 0, livePose.z);
  });
  return (
    <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[livePose.x, 0, livePose.z]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#8d8476" roughness={1} />
    </mesh>
  );
}

function DistrictMesh({
  data,
  time,
  windows,
  rain,
  lamps,
  dark,
  anchor,
  full,
}: {
  data: CbdData;
  time: TimeOfDay;
  windows: THREE.CanvasTexture;
  rain: boolean;
  lamps: boolean;
  dark: boolean;
  anchor: { x: number; z: number } | null;
  /** Street life and dress stay on the district the player is standing in. */
  full: boolean;
}) {
  const lit = afterDark(time);

  const bands = useMemo(() => {
    const barriers = data.barriers ?? [];
    return {
      walls: wallGeometry(barriers.filter((item) => item.kind === 'wall').map((item) => ({ points: item.points })), 2.15),
      fences: wallGeometry(barriers.filter((item) => item.kind === 'fence').map((item) => ({ points: item.points })), 1.35),
      gateLines: wallGeometry(barriers.filter((item) => item.kind === 'gate').map((item) => ({ points: item.points })), 1.2),
      gatePosts: postGeometry((data.gates ?? []).map((gate) => [gate.x, gate.z]), 2.3, 0.28),
      parks: extrudeFootprints(data.parks.map((park) => ({ polygon: park.polygon, height: 0.12 }))),
      parking: extrudeFootprints((data.parking ?? []).map((lot) => ({ polygon: lot.polygon, height: 0.05 }))),
    };
  }, [data]);
  useEffect(
    () => () => {
      bands.walls.dispose();
      bands.fences.dispose();
      bands.gateLines.dispose();
      bands.gatePosts.dispose();
      bands.parks.dispose();
      bands.parking.dispose();
    },
    [bands],
  );

  const ground = useMemo(() => {
    const { bounds } = data;
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
      w: bounds.maxX - bounds.minX + 30,
      d: bounds.maxZ - bounds.minZ + 30,
    };
  }, [data]);

  return (
    <group>
      {anchor ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ground.x, 0, ground.z]} receiveShadow>
          <planeGeometry args={[ground.w, ground.d]} />
          <meshStandardMaterial color="#8d8476" roughness={1} />
        </mesh>
      ) : null}
      <mesh geometry={bands.parks} receiveShadow>
        <meshStandardMaterial color="#3f5a40" roughness={1} />
      </mesh>
      <mesh geometry={bands.parking} receiveShadow>
        <meshStandardMaterial color="#6a6e68" roughness={1} />
      </mesh>
      <StreamedRoads data={data} rain={rain} anchor={anchor} />
      <BuildingChunks data={data} windows={windows} lit={lit} anchor={anchor} />
      <BuildingBand geometry={bands.walls} tint="#e7e0d4" windows={null} lit={false} />
      <BuildingBand geometry={bands.fences} tint="#8a8478" windows={null} lit={false} />
      <BuildingBand geometry={bands.gateLines} tint="#6e5538" windows={null} lit={false} />
      <BuildingBand geometry={bands.gatePosts} tint="#5c4632" windows={null} lit={false} />
      {data.buildings.map((building) =>
        building.accent ? (
          <Accent key={building.id} kind={building.accent.kind} height={building.accent.height} cx={building.accent.cx} cz={building.accent.cz} />
        ) : null,
      )}
      {data.buildings.map((building) =>
        building.name && MALL_MARKS.has(building.name) ? <MallSign key={`mark-${building.id}`} building={building} /> : null,
      )}
      {data.districtId === 'nairobi-cbd' ? <SpawnMark /> : null}
      {data.districtId === 'nairobi-cbd' ? <Billboard lit={lit} /> : null}
      {full ? <StreetFurniture districtId={data.districtId} /> : null}
      {full ? <StreetLife data={data} dark={dark} /> : null}
      {full ? <DistrictDress data={data} lit={lamps} /> : null}
    </group>
  );
}

function StreamedRoads({ data, rain, anchor }: { data: CbdData; rain: boolean; anchor: { x: number; z: number } | null }) {
  const spot = anchor ?? { x: livePose.x, z: livePose.z };
  const [centre, setCentre] = useState(spot);
  const origin = chunkOf(spot.x, spot.z);
  const chunkKey = useRef(`${origin.ix}:${origin.iz}`);
  useFrame(() => {
    if (anchor) return;
    const cell = chunkOf(livePose.x, livePose.z);
    const key = `${cell.ix}:${cell.iz}`;
    if (key === chunkKey.current) return;
    chunkKey.current = key;
    setCentre({ x: livePose.x, z: livePose.z });
  });
  const locked = anchor !== null;
  const bands = useMemo(() => {
    const roads = locked ? data.roads : roadsInView(data.roads, centre.x, centre.z);
    const layers = roadLayers(roads);
    const crossings = (data.districtId === 'kilimani' ? kilimaniCrossings() : data.districtId === 'nairobi-cbd' ? cbdCrossings() : []).flatMap((item) =>
      crossingStripes(item.x, item.z, roads),
    );
    return {
      pavement: joinedRibbon(layers.pavement, 0.02),
      kerb: joinedRibbon(layers.kerb, 0.05),
      drain: joinedRibbon(layers.drain, 0.045),
      asphalt: joinedRibbon(layers.asphalt, 0.07),
      service: joinedRibbon(layers.service, 0.065),
      footways: joinedRibbon(layers.footway, 0.03),
      junctions: discGeometry(layers.junctions, 0.06),
      centerLines: joinedRibbon(layers.center, 0.09),
      edgeLines: joinedRibbon(layers.edges, 0.088),
      crossings: joinedRibbon(crossings, 0.092),
    };
  }, [locked, centre.x, centre.z, data]);
  useEffect(
    () => () => {
      bands.pavement.dispose();
      bands.kerb.dispose();
      bands.drain.dispose();
      bands.asphalt.dispose();
      bands.service.dispose();
      bands.footways.dispose();
      bands.junctions.dispose();
      bands.centerLines.dispose();
      bands.edgeLines.dispose();
      bands.crossings.dispose();
    },
    [bands],
  );
  return (
    <group>
      <mesh geometry={bands.pavement} receiveShadow material={surfaceMaterial('pavement', rain)} dispose={null} />
      <mesh geometry={bands.footways} receiveShadow material={surfaceMaterial('footway', rain)} dispose={null} />
      <mesh geometry={bands.kerb} receiveShadow>
        <meshStandardMaterial color="#b7b1a6" roughness={0.9} />
      </mesh>
      <mesh geometry={bands.drain}>
        <meshStandardMaterial color="#2c3134" roughness={0.7} />
      </mesh>
      <mesh geometry={bands.junctions} receiveShadow material={surfaceMaterial('asphalt', rain)} dispose={null} />
      <mesh geometry={bands.asphalt} receiveShadow material={surfaceMaterial('asphalt', rain)} dispose={null} />
      <mesh geometry={bands.service} receiveShadow material={surfaceMaterial('service', rain)} dispose={null} />
      <mesh geometry={bands.edgeLines}>
        <meshStandardMaterial color="#f3efe4" roughness={0.8} />
      </mesh>
      <mesh geometry={bands.centerLines}>
        <meshStandardMaterial color="#e0c15a" roughness={0.78} />
      </mesh>
      <mesh geometry={bands.crossings}>
        <meshStandardMaterial color="#f4f0e6" roughness={0.75} />
      </mesh>
    </group>
  );
}

function BuildingBand({
  geometry,
  tint,
  windows,
  lit,
}: {
  geometry: THREE.BufferGeometry;
  tint: string;
  windows: THREE.CanvasTexture | null;
  lit: boolean;
}) {
  if (!geometry.getAttribute('position')) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={tint}
        map={windows ?? undefined}
        emissive={windows ? '#f0c27a' : '#000000'}
        emissiveMap={windows ?? undefined}
        emissiveIntensity={windows && lit ? 0.85 : 0.04}
        roughness={0.84}
        metalness={0.04}
      />
    </mesh>
  );
}

const MALL_MARKS = new Set(['Yaya Centre', 'Adams Arcade', 'Prestige Plaza']);

function mallTint(name: string): string {
  switch (name) {
    case 'Yaya Centre':
      return '#c4552a';
    case 'Adams Arcade':
      return '#2f6b4f';
    case 'Prestige Plaza':
      return '#2c3034';
    default:
      return '#8a8478';
  }
}

function centroid(polygon: [number, number][]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  const count = polygon.length || 1;
  return [x / count, z / count];
}

/** A roof board so the three mapped malls read apart from ordinary blocks. It is not a surveyed sign. */
function MallSign({ building }: { building: BuildingRecord }) {
  const [x, z] = centroid(building.polygon);
  const tint = mallTint(building.name ?? '');
  return (
    <group position={[x, shownHeight(building) + 1.9, z]}>
      <mesh castShadow>
        <boxGeometry args={[11, 2.2, 0.4]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.15, 0.22]}>
        <boxGeometry args={[8.4, 0.28, 0.08]} />
        <meshStandardMaterial color="#e7c48a" roughness={0.55} />
      </mesh>
    </group>
  );
}

function Accent({
  kind,
  height,
  cx,
  cz,
}: {
  kind: 'kicc' | 'times-shaft';
  height: number;
  cx: number;
  cz: number;
}) {
  if (kind === 'kicc') {
    const tower = Math.max(40, height - 12);
    return (
      <group position={[cx, 0, cz]}>
        <mesh position={[0, 12 + tower / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[9, 10.5, tower, 28]} />
          <meshStandardMaterial color="#ddd4c6" roughness={0.74} />
        </mesh>
        <mesh position={[0, 12 + tower - 1.5, 0]} castShadow>
          <cylinderGeometry args={[16, 16, 4, 32]} />
          <meshStandardMaterial color="#c9bfae" roughness={0.7} />
        </mesh>
        <mesh position={[0, 12 + tower + 4, 0]}>
          <cylinderGeometry args={[0.35, 0.7, 10, 8]} />
          <meshStandardMaterial color="#8a847c" />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[32, height, 26]} />
        <meshStandardMaterial color="#8ea3b3" roughness={0.32} metalness={0.18} />
      </mesh>
    </group>
  );
}

function SpawnMark() {
  const start = streetSpawn();
  return (
    <group position={[start.x, 0, start.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.85, 1.25, 28]} />
        <meshStandardMaterial color="#e7c48a" emissive="#e7c48a" emissiveIntensity={0.55} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Billboard({ lit }: { lit: boolean }) {
  const placement = cbd.placements[0];
  const campaign = liveCampaigns().find((item) => item.placementId === placement?.id);
  const texture = useMemo(() => (campaign ? boardTexture(campaign.headline, campaign.label) : null), [campaign]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!placement || !campaign || !texture) return null;
  return (
    <group position={[placement.x, 0, placement.z]} rotation={[0, placement.yaw, 0]}>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3.4, 8]} />
          <meshStandardMaterial color="#2a2926" />
        </mesh>
      ))}
      <mesh position={[0, 3.15, 0]} castShadow>
        <planeGeometry args={[4.4, 2.15]} />
        <meshStandardMaterial map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={lit ? 0.35 : 0.05} roughness={0.45} />
      </mesh>
    </group>
  );
}

function boardTexture(headline: string, label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.fillStyle = '#1b1915';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#d7b07a';
  ctx.fillRect(0, 0, 1024, 10);
  ctx.font = '600 28px Outfit, sans-serif';
  ctx.fillStyle = '#d7b07a';
  ctx.fillText(label.toUpperCase(), 48, 72);
  ctx.fillStyle = '#f4efe6';
  ctx.font = '560 72px Fraunces, serif';
  wrapText(ctx, headline, 48, 180, 920, 80);
  ctx.font = '400 28px Outfit, sans-serif';
  ctx.fillStyle = '#b7aa96';
  ctx.fillText('Placeholder creative. No payment is being taken.', 48, 430);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(' ');
  let row = '';
  let cursor = y;
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max) {
      ctx.fillText(row, x, cursor);
      row = word;
      cursor += line;
    } else row = next;
  }
  ctx.fillText(row, x, cursor);
}

export function Atmosphere({ time, rain = false }: { time: TimeOfDay; rain?: boolean }) {
  const colors = skyColors(time);
  const sun = sunOffset(time);
  const light = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<THREE.Mesh>(null);
  const aim = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(colors.top) },
        uHorizon: { value: new THREE.Color(rain ? '#8d8680' : colors.horizon) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          float sky = smoothstep(0.0, 0.62, h);
          gl_FragColor = vec4(mix(uHorizon, uTop, sky), 1.0);
        }
      `,
    });
  }, [colors.horizon, colors.top, rain]);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const lamp = light.current;
    const dome = sky.current;
    if (dome) dome.position.set(livePose.x, 0, livePose.z);
    const cool = fill.current;
    if (cool) cool.position.set(livePose.x - sun.x * 0.55, Math.max(18, sun.y * 0.35), livePose.z - sun.z * 0.55);
    if (!lamp) return;
    lamp.position.set(livePose.x + sun.x, sun.y, livePose.z + sun.z);
    aim.position.set(livePose.x, 0, livePose.z);
    aim.updateMatrixWorld();
  });
  const hemiSky = rain ? '#b7b1a6' : time === 'night' ? '#46566c' : time === 'evening' ? '#8a5a48' : colors.top;
  const fogFar = (time === 'day' ? 760 : time === 'sunset' ? 540 : time === 'evening' ? 300 : 240) * (rain ? 0.72 : 1);
  const fogNear = time === 'day' ? 140 : time === 'sunset' ? 90 : time === 'evening' ? 48 : 40;
  const fogColor = rain ? '#9a938c' : colors.fog;
  return (
    <>
      <primitive object={aim} />
      <mesh ref={sky} frustumCulled={false}>
        <sphereGeometry args={[900, 20, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <hemisphereLight args={[hemiSky, '#4d5c58', rain ? colors.ambient * 0.7 : colors.ambient]} />
      <directionalLight ref={fill} target={aim} color="#9eb4c8" intensity={time === 'night' ? 0.08 : time === 'evening' ? 0.16 : time === 'sunset' ? 0.28 : 0.42} />
      <directionalLight
        ref={light}
        target={aim}
        position={[sun.x, sun.y, sun.z]}
        intensity={rain ? colors.sunIntensity * 0.55 : colors.sunIntensity}
        color={colors.sun}
        castShadow={sun.shadow}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={4}
        shadow-camera-far={160}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-bias={-0.00035}
        shadow-normalBias={0.04}
      />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </>
  );
}

export function Cinematic() {
  const camera = useThree((state) => state.camera);
  useFrame(({ clock }) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = reduce ? 0.7 : clock.elapsedTime * 0.045;
    camera.position.set(Math.sin(t) * 78 + 26, 32, Math.cos(t) * 78 + 8);
    camera.lookAt(26.8, 20, 1.2);
  });
  return null;
}
