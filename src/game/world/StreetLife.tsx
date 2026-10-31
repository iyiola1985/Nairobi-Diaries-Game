import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hitsBuilding } from './collision';
import { colliders, type CbdData } from './data';
import { furnitureIn } from './furniture';
import { holdForSignal, signalAllows, type StopPoint } from './motion';
import { livePose } from '../player/input';
import { beginTrafficFrame, noteTraffic, setParkedTraffic } from './traffic';
import { driveLanes, leftHandOffset, type DriveLane, type RoadPoint, type RoadSpan } from './roads';

const dummy = new THREE.Object3D();
/** Lamps, roof rack and the building hop. */
const VEHICLE_DETAIL = 80;
/** Body and stripe. Past this, only the body box remains. */
const VEHICLE_BODY = 320;
/** Beyond the mid building band the car leaves the scene. */
const VEHICLE_HIDE = 560;

type VehicleKind = 'car' | 'matatu' | 'bus' | 'boda' | 'van' | 'tuk';

interface FleetSpec {
  kind: VehicleKind;
  count: number;
  color: string;
  stripe: string | null;
  size: [number, number, number];
  speed: number;
  roads: 'main' | 'local';
}

interface Rider {
  lane: number;
  distance: number;
  speed: number;
}

function fleetFor(districtId: string): FleetSpec[] {
  switch (districtId) {
    case 'kilimani':
      return [
        { kind: 'car', count: 14, color: '#c8c2b6', stripe: null, size: [1.7, 1.35, 4.1], speed: 7.2, roads: 'main' },
        { kind: 'matatu', count: 3, color: '#f4e6c4', stripe: '#e2b33a', size: [1.9, 2.1, 6.2], speed: 6.4, roads: 'main' },
        { kind: 'matatu', count: 2, color: '#f7f7f4', stripe: '#1f6b45', size: [1.9, 2.1, 6.2], speed: 6.2, roads: 'main' },
        { kind: 'matatu', count: 2, color: '#163a5c', stripe: '#f4f0e6', size: [1.9, 2.1, 6.2], speed: 6.1, roads: 'main' },
        { kind: 'bus', count: 3, color: '#1f4d7a', stripe: null, size: [2.3, 2.8, 11], speed: 5.2, roads: 'main' },
        { kind: 'boda', count: 10, color: '#3d6b4f', stripe: null, size: [0.7, 1.2, 1.8], speed: 8.4, roads: 'main' },
        { kind: 'tuk', count: 4, color: '#d7e4c4', stripe: '#e2b33a', size: [1.35, 1.7, 2.6], speed: 5.2, roads: 'local' },
        { kind: 'van', count: 5, color: '#d8d2c8', stripe: null, size: [1.8, 1.8, 4.8], speed: 6.6, roads: 'main' },
      ];
    case 'nairobi-cbd':
      return [
        { kind: 'car', count: 6, color: '#c8c2b6', stripe: null, size: [1.7, 1.35, 4.1], speed: 6.4, roads: 'main' },
        { kind: 'car', count: 2, color: '#f7f4ea', stripe: '#e2b33a', size: [1.7, 1.35, 4.1], speed: 6.2, roads: 'main' },
        { kind: 'matatu', count: 2, color: '#f4e6c4', stripe: '#e2b33a', size: [1.9, 2.1, 6.2], speed: 5.6, roads: 'main' },
        { kind: 'matatu', count: 1, color: '#163a5c', stripe: '#f4f0e6', size: [1.9, 2.1, 6.2], speed: 5.4, roads: 'main' },
        { kind: 'bus', count: 2, color: '#1f4d7a', stripe: null, size: [2.3, 2.8, 11], speed: 4.8, roads: 'main' },
        { kind: 'boda', count: 4, color: '#3d6b4f', stripe: null, size: [0.7, 1.2, 1.8], speed: 7.4, roads: 'main' },
        { kind: 'tuk', count: 1, color: '#d7e4c4', stripe: '#e2b33a', size: [1.35, 1.7, 2.6], speed: 4.6, roads: 'local' },
        { kind: 'van', count: 2, color: '#d8d2c8', stripe: null, size: [1.8, 1.8, 4.8], speed: 5.8, roads: 'main' },
      ];
    case 'hurlingham':
      return [
        { kind: 'car', count: 10, color: '#c8c2b6', stripe: null, size: [1.7, 1.35, 4.1], speed: 7.2, roads: 'main' },
        { kind: 'matatu', count: 3, color: '#f4e6c4', stripe: '#e2b33a', size: [1.9, 2.1, 6.2], speed: 6.4, roads: 'main' },
        { kind: 'bus', count: 2, color: '#1f4d7a', stripe: null, size: [2.3, 2.8, 11], speed: 5.2, roads: 'main' },
        { kind: 'boda', count: 6, color: '#3d6b4f', stripe: null, size: [0.7, 1.2, 1.8], speed: 8.4, roads: 'main' },
        { kind: 'van', count: 3, color: '#d8d2c8', stripe: null, size: [1.8, 1.8, 4.8], speed: 6.6, roads: 'main' },
      ];
    default:
      return [];
  }
}

function sample(points: RoadPoint[], distance: number): { x: number; z: number; dx: number; dz: number } | null {
  let remain = distance;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const span = Math.hypot(dx, dz);
    if (span < 0.05) continue;
    if (remain <= span) {
      const t = remain / span;
      return { x: start[0] + dx * t, z: start[1] + dz * t, dx, dz };
    }
    remain -= span;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || !prev) return null;
  return { x: last[0], z: last[1], dx: last[0] - prev[0], dz: last[1] - prev[1] };
}

function lampPair(width: number, length: number, y: number, end: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const side of [-1, 1]) {
    const box = new THREE.BoxGeometry(0.16, 0.1, 0.08);
    box.translate(side * width * 0.32, y, end * (length / 2));
    const attribute = box.getAttribute('position');
    const index = box.getIndex();
    const push = (vertex: number) => positions.push(attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex));
    if (index) {
      for (let i = 0; i < index.count; i += 1) push(index.getX(i));
    } else {
      for (let i = 0; i < attribute.count; i += 1) push(i);
    }
    box.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function FleetMesh({ spec, lanes, riders, dark, signals }: { spec: FleetSpec; lanes: DriveLane[]; riders: Rider[]; dark: boolean; signals: StopPoint[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stripeRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const tailRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]), [spec.size]);
  const headGeo = useMemo(() => lampPair(spec.size[0], spec.size[2], spec.size[1] * 0.15, 1), [spec.size]);
  const tailGeo = useMemo(() => lampPair(spec.size[0], spec.size[2], spec.size[1] * 0.12, -1), [spec.size]);
  const stripeGeo = useMemo(() => {
    const band = new THREE.BoxGeometry(spec.size[0] + 0.05, 0.2, spec.size[2] + 0.04);
    band.translate(0, spec.size[1] * 0.18, 0);
    return band;
  }, [spec.size]);
  const roofGeo = useMemo(() => {
    if (spec.kind !== 'matatu') return null;
    const rack = new THREE.BoxGeometry(spec.size[0] * 0.7, 0.08, spec.size[2] * 0.5);
    rack.translate(0, spec.size[1] * 0.55, 0);
    return rack;
  }, [spec.kind, spec.size]);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      stripeGeo.dispose();
      headGeo.dispose();
      tailGeo.dispose();
      roofGeo?.dispose();
    },
    [geometry, headGeo, roofGeo, stripeGeo, tailGeo],
  );
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh || lanes.length === 0) return;
    const step = Math.min(delta, 0.05);
    const seconds = performance.now() / 1000;
    const open = signals.map((_, index) => signalAllows(index, seconds));
    riders.forEach((rider, index) => {
      const lane = lanes[rider.lane];
      if (!lane) return;
      let pose = sample(lane.points, rider.distance);
      const holding = pose !== null && holdForSignal(pose.x, pose.z, pose.dx, pose.dz, signals, open);
      if (!holding) rider.distance = (rider.distance + rider.speed * step) % lane.length;
      pose = sample(lane.points, rider.distance);
      const away = pose ? Math.hypot(pose.x - livePose.x, pose.z - livePose.z) : Infinity;
      const hide = !pose || away > VEHICLE_HIDE;
      if (hide) {
        dummy.position.set(pose?.x ?? 0, -30, pose?.z ?? 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        stripeRef.current?.setMatrixAt(index, dummy.matrix);
        headRef.current?.setMatrixAt(index, dummy.matrix);
        tailRef.current?.setMatrixAt(index, dummy.matrix);
        roofRef.current?.setMatrixAt(index, dummy.matrix);
        return;
      }
      const shaped = away <= VEHICLE_BODY;
      if (shaped) {
        for (let attempt = 0; attempt < 6 && pose && hitsBuilding(pose.x, pose.z, 1.15, colliders); attempt++) {
          rider.distance = (rider.distance + 8) % lane.length;
          pose = sample(lane.points, rider.distance);
        }
      }
      const blocked = shaped && (!pose || hitsBuilding(pose.x, pose.z, 1.15, colliders));
      if (pose && !blocked) noteTraffic(pose.x, pose.z, Math.max(spec.size[0], spec.size[2]) * 0.5 + 0.35);
      dummy.position.set(pose?.x ?? 0, blocked || !pose ? -20 : spec.size[1] / 2 + 0.08, pose?.z ?? 0);
      dummy.rotation.set(0, pose ? Math.atan2(pose.dx, pose.dz) : 0, 0);
      dummy.scale.set(blocked ? 0 : 1, blocked ? 0 : 1, blocked ? 0 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const parts = shaped && !blocked ? 1 : 0;
      dummy.scale.set(parts, parts, parts);
      dummy.updateMatrix();
      stripeRef.current?.setMatrixAt(index, dummy.matrix);
      roofRef.current?.setMatrixAt(index, dummy.matrix);
      const lamps = away <= VEHICLE_DETAIL && !blocked ? 1 : 0;
      dummy.scale.set(lamps, lamps, lamps);
      dummy.updateMatrix();
      headRef.current?.setMatrixAt(index, dummy.matrix);
      tailRef.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (stripeRef.current) stripeRef.current.instanceMatrix.needsUpdate = true;
    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true;
    if (tailRef.current) tailRef.current.instanceMatrix.needsUpdate = true;
    if (roofRef.current) roofRef.current.instanceMatrix.needsUpdate = true;
  });
  if (riders.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={ref} args={[geometry, undefined, riders.length]} castShadow>
        <meshStandardMaterial color={spec.color} roughness={0.72} metalness={0.08} />
      </instancedMesh>
      {spec.stripe ? (
        <instancedMesh ref={stripeRef} args={[stripeGeo, undefined, riders.length]}>
          <meshStandardMaterial color={spec.stripe} roughness={0.6} />
        </instancedMesh>
      ) : null}
      {roofGeo ? (
        <instancedMesh ref={roofRef} args={[roofGeo, undefined, riders.length]}>
          <meshStandardMaterial color="#e2b33a" roughness={0.55} />
        </instancedMesh>
      ) : null}
      {dark ? (
        <instancedMesh ref={headRef} args={[headGeo, undefined, riders.length]}>
          <meshStandardMaterial color="#fff4d2" emissive="#fff1c4" emissiveIntensity={1.4} />
        </instancedMesh>
      ) : null}
      {dark ? (
        <instancedMesh ref={tailRef} args={[tailGeo, undefined, riders.length]}>
          <meshStandardMaterial color="#9c2b2b" emissive="#ff4d3a" emissiveIntensity={1.1} />
        </instancedMesh>
      ) : null}
    </group>
  );
}

function besideDriveway(roads: RoadSpan[], end: RoadPoint, previous: RoadPoint): RoadPoint | null {
  const [ox, oz] = leftHandOffset(end[0] - previous[0], end[1] - previous[1], 2.6);
  const spot: RoadPoint = [end[0] + ox, end[1] + oz];
  let best = Infinity;
  for (const road of roads) {
    if (road.class === 'service' || road.class === 'footway' || road.class === 'path' || road.class === 'steps' || road.class === 'cycleway') continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const start = road.points[i];
      const finish = road.points[i + 1];
      if (!start || !finish) continue;
      const dx = finish[0] - start[0];
      const dz = finish[1] - start[1];
      const length = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((spot[0] - start[0]) * dx + (spot[1] - start[1]) * dz) / length));
      const gap = Math.hypot(spot[0] - (start[0] + dx * t), spot[1] - (start[1] + dz * t));
      if (gap < best) best = gap;
    }
  }
  if (best < 4.2) return null;
  return spot;
}

function parkedCars(data: CbdData): { x: number; z: number; yaw: number }[] {
  const spots: { x: number; z: number; yaw: number }[] = [];
  for (const road of data.roads) {
    if (road.class !== 'service' || road.points.length < 2) continue;
    const end = road.points[road.points.length - 1];
    const previous = road.points[road.points.length - 2];
    if (!end || !previous) continue;
    const spot = besideDriveway(data.roads, end, previous);
    if (!spot || hitsBuilding(spot[0], spot[1], 1.2, colliders)) continue;
    spots.push({ x: spot[0], z: spot[1], yaw: Math.atan2(end[0] - previous[0], end[1] - previous[1]) });
    if (spots.length >= 16) break;
  }
  return spots;
}

function Parked({ spots }: { spots: { x: number; z: number; yaw: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const parkedDummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1.7, 1.35, 4.1), []);
  const colors = useMemo(() => ['#f4f1ea', '#8e938f', '#1f4d3a', '#c45a3a', '#2c3134'], []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((spot, index) => {
      parkedDummy.position.set(spot.x, 0.75, spot.z);
      parkedDummy.rotation.set(0, spot.yaw, 0);
      parkedDummy.scale.set(1, 1, 1);
      parkedDummy.updateMatrix();
      mesh.setMatrixAt(index, parkedDummy.matrix);
      mesh.setColorAt(index, new THREE.Color(colors[index % colors.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colors, parkedDummy, spots]);
  if (spots.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, spots.length]} castShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.8} />
    </instancedMesh>
  );
}

export function StreetLife({ data, dark }: { data: CbdData; dark: boolean }) {
  const lanes = useMemo(() => {
    const marked = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
    const main = driveLanes(data.roads.filter((road) => marked.has(road.class))).sort((a, b) => b.length - a.length).slice(0, 24);
    const local = driveLanes(data.roads.filter((road) => road.class === 'residential' || road.class === 'living_street')).slice(0, 12);
    return { main: main.length > 0 ? main : local, local: local.length > 0 ? local : main };
  }, [data.roads]);
  const fleets = useMemo(() => {
    const specs = fleetFor(data.districtId);
    return specs.map((spec) => {
      const roadset = spec.roads === 'local' ? lanes.local : lanes.main;
      const riders: Rider[] = [];
      for (let i = 0; i < spec.count; i++) {
        const lane = roadset[i % roadset.length];
        if (!lane) continue;
        riders.push({ lane: i % roadset.length, distance: (i * 17) % lane.length, speed: spec.speed });
      }
      return { spec, riders, roadset };
    });
  }, [data.districtId, lanes]);
  const parked = useMemo(() => parkedCars(data), [data]);
  useEffect(() => {
    setParkedTraffic(parked.map((spot) => ({ x: spot.x, z: spot.z, radius: 1.6 })));
    return () => setParkedTraffic([]);
  }, [parked]);
  useFrame(() => {
    beginTrafficFrame();
  });
  const signals = useMemo(
    () => furnitureIn(data.districtId).filter((item) => item.kind === 'signal').map((item) => ({ x: item.x, z: item.z })),
    [data.districtId],
  );
  return (
    <group>
      {fleets.map((fleet) => (
        <FleetMesh key={`${fleet.spec.kind}-${fleet.spec.color}`} spec={fleet.spec} lanes={fleet.roadset} riders={fleet.riders} dark={dark} signals={signals} />
      ))}
      <Parked spots={parked} />
    </group>
  );
}
