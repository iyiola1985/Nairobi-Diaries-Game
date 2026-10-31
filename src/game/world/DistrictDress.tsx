import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hitsBuilding } from './collision';
import { colliders, type CbdData } from './data';
import { livePose } from '../player/input';

/** Cloth, step bob and the building check. */
const PERSON_DETAIL = 72;
/** Body only, still walking. */
const PERSON_HIDE = 280;
const PROP_REACH = 240;
const SIGN_REACH = 200;
import { cbdCrossings, kilimaniCrossings, placedProps } from './furniture';
import { crossingPoint } from './motion';
import {
  compoundTrees,
  queueSpots,
  shopSigns,
  streetBlades,
  streetLights,
  utilityPoles,
  vergeTrees,
  walkRoutes,
  type PlacedSign,
  type QueueSpot,
  type WalkRoute,
  type YardMark,
} from './locale';

const SKIN = ['#8d552f', '#6b3a28', '#a86b45', '#4a2c20', '#c4926a', '#3c2618', '#7a4b32'];
const CLOTH = ['#f4f0e6', '#1f4d7a', '#245c42', '#7a3030', '#242424', '#c6a15a', '#5c4632', '#d7d2c8'];

const dummy = new THREE.Object3D();

function streetTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.fillStyle = '#1f6b45';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f4f7f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 42;
  ctx.font = `600 ${size}px Outfit, sans-serif`;
  while (size > 18 && ctx.measureText(text).width > 470) {
    size -= 2;
    ctx.font = `600 ${size}px Outfit, sans-serif`;
  }
  ctx.fillText(text, 256, 64);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shopTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.fillStyle = '#f6f1e6';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#8d3b2a';
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillStyle = '#241c16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 40;
  ctx.font = `600 ${size}px Outfit, sans-serif`;
  while (size > 16 && ctx.measureText(text).width > 470) {
    size -= 2;
    ctx.font = `600 ${size}px Outfit, sans-serif`;
  }
  ctx.fillText(text, 256, 86);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function NamePlate({ sign, plate }: { sign: PlacedSign; plate: 'street' | 'shop' }) {
  const texture = useMemo(() => (plate === 'street' ? streetTexture(sign.text) : shopTexture(sign.text)), [plate, sign.text]);
  const group = useRef<THREE.Group>(null);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    const plateGroup = group.current;
    if (!plateGroup) return;
    plateGroup.visible = Math.hypot(sign.x - livePose.x, sign.z - livePose.z) <= SIGN_REACH;
  });
  const wide = plate === 'street' ? 1.7 : 2.15;
  const y = plate === 'street' ? 2.05 : 2.45;
  return (
    <group ref={group} position={[sign.x, 0, sign.z]} rotation={[0, sign.yaw, 0]}>
      <mesh position={[0, y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, y, 6]} />
        <meshStandardMaterial color="#3e4346" roughness={0.7} />
      </mesh>
      <mesh position={[0, y, 0]} castShadow>
        <planeGeometry args={[wide, plate === 'street' ? 0.4 : 0.52]} />
        <meshStandardMaterial map={texture} roughness={0.62} side={THREE.DoubleSide} />
      </mesh>
      {plate === 'shop' && !hitsBuilding(sign.x + Math.cos(sign.yaw) * 0.7, sign.z - Math.sin(sign.yaw) * 0.7, 0.4, colliders) ? (
        <mesh position={[0.7, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.35, 2.1]} />
          <meshStandardMaterial color="#cfc6b8" roughness={0.95} />
        </mesh>
      ) : null}
    </group>
  );
}

function paint(mesh: THREE.InstancedMesh, marks: YardMark[], yLift: number, tall = 1) {
  marks.forEach((mark, index) => {
    dummy.position.set(mark.x, mark.y + yLift, mark.z);
    dummy.rotation.set(0, mark.yaw, 0);
    dummy.scale.set(1, tall, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.count = marks.length;
  mesh.instanceMatrix.needsUpdate = true;
}

function Marks({ marks, args, color, y, emissive }: { marks: YardMark[]; args: [number, number, number] | 'trunk' | 'pole' | 'canopy' | 'tank' | 'lamp'; color: string; y: number; emissive?: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    if (args === 'trunk') return new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6);
    if (args === 'pole') return new THREE.CylinderGeometry(0.07, 0.1, 5.4, 6);
    if (args === 'canopy') return new THREE.SphereGeometry(1.15, 8, 6);
    if (args === 'tank') return new THREE.CylinderGeometry(0.55, 0.55, 0.7, 10);
    if (args === 'lamp') return new THREE.BoxGeometry(0.7, 0.12, 0.28);
    return new THREE.BoxGeometry(args[0], args[1], args[2]);
  }, [args]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const lift = args === 'trunk' ? 1.2 : args === 'pole' ? 2.7 : args === 'canopy' ? 2.7 : args === 'tank' ? 0 : args === 'lamp' ? 5.5 : y;
    paint(mesh, marks, lift);
  }, [args, marks, y]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sway = reduce ? 0 : 0.07;
    const t = clock.elapsedTime;
    const lift = args === 'trunk' ? 1.2 : args === 'pole' ? 2.7 : args === 'canopy' ? 2.7 : args === 'tank' ? 0 : args === 'lamp' ? 5.5 : y;
    marks.forEach((mark, index) => {
      const away = Math.hypot(mark.x - livePose.x, mark.z - livePose.z);
      const shown = away <= PROP_REACH;
      dummy.position.set(mark.x, mark.y + lift, mark.z);
      const lean = args === 'canopy' && shown && away <= PERSON_DETAIL * 2 ? Math.sin(t * 0.65 + index) * sway : 0;
      dummy.rotation.set(0, mark.yaw, lean);
      dummy.scale.set(shown ? 1 : 0, shown ? 1 : 0, shown ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (marks.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, marks.length]} castShadow>
      <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.85 : 0} roughness={0.8} />
    </instancedMesh>
  );
}

function sampleRoute(route: WalkRoute, distance: number): { x: number; z: number; dx: number; dz: number } | null {
  let remain = distance % route.length;
  const points = route.points;
  for (let i = 0; i < points.length - 1; i += 1) {
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
  return null;
}

/** Standing figures at mapped stops and shops. They do not move, talk, or block the player. */
function Waiting({ spots }: { spots: QueueSpot[] }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const cloth = useRef<THREE.InstancedMesh>(null);
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.22, 0.72, 3, 6), []);
  const clothGeo = useMemo(() => new THREE.BoxGeometry(0.46, 0.42, 0.28), []);
  useEffect(
    () => () => {
      bodyGeo.dispose();
      clothGeo.dispose();
    },
    [bodyGeo, clothGeo],
  );
  useLayoutEffect(() => {
    const skinMesh = body.current;
    const shirt = cloth.current;
    if (!skinMesh || !shirt) return;
    spots.forEach((spot, index) => {
      skinMesh.setColorAt(index, new THREE.Color(SKIN[index % SKIN.length] ?? '#8d552f'));
      shirt.setColorAt(index, new THREE.Color(CLOTH[index % CLOTH.length] ?? '#f4f0e6'));
      dummy.position.set(spot.x, 0.95, spot.z);
      dummy.rotation.set(0, spot.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      skinMesh.setMatrixAt(index, dummy.matrix);
      dummy.position.y = 1.15;
      dummy.updateMatrix();
      shirt.setMatrixAt(index, dummy.matrix);
    });
    skinMesh.instanceMatrix.needsUpdate = true;
    shirt.instanceMatrix.needsUpdate = true;
    if (skinMesh.instanceColor) skinMesh.instanceColor.needsUpdate = true;
    if (shirt.instanceColor) shirt.instanceColor.needsUpdate = true;
  }, [spots]);
  useFrame(() => {
    const skinMesh = body.current;
    const shirt = cloth.current;
    if (!skinMesh || !shirt) return;
    spots.forEach((spot, index) => {
      const away = Math.hypot(spot.x - livePose.x, spot.z - livePose.z);
      const shown = away <= PROP_REACH ? 1 : 0;
      dummy.position.set(spot.x, 0.95, spot.z);
      dummy.rotation.set(0, spot.yaw, 0);
      dummy.scale.set(shown, shown, shown);
      dummy.updateMatrix();
      skinMesh.setMatrixAt(index, dummy.matrix);
      const clothScale = away <= PERSON_DETAIL ? shown : 0;
      dummy.position.y = 1.15;
      dummy.scale.set(clothScale, clothScale, clothScale);
      dummy.updateMatrix();
      shirt.setMatrixAt(index, dummy.matrix);
    });
    skinMesh.instanceMatrix.needsUpdate = true;
    shirt.instanceMatrix.needsUpdate = true;
  });
  if (spots.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={body} args={[bodyGeo, undefined, spots.length]} castShadow>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={cloth} args={[clothGeo, undefined, spots.length]} castShadow>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

function Pedestrians({ routes, count, crossings }: { routes: WalkRoute[]; count: number; crossings: { x: number; z: number }[] }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const cloth = useRef<THREE.InstancedMesh>(null);
  const walkers = useMemo(
    () =>
      routes.length === 0
        ? []
        : Array.from({ length: count }, (_, index) => {
            const route = routes[index % routes.length];
            return {
              route: index % routes.length,
              distance: route ? (index * 11) % route.length : 0,
              speed: 1.15 + (index % 4) * 0.12,
              skin: SKIN[index % SKIN.length] ?? SKIN[0],
              cloth: CLOTH[index % CLOTH.length] ?? CLOTH[0],
              heading: 0,
            };
          }),
    [count, routes],
  );
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.22, 0.72, 3, 6), []);
  const clothGeo = useMemo(() => new THREE.BoxGeometry(0.46, 0.42, 0.28), []);
  useEffect(
    () => () => {
      bodyGeo.dispose();
      clothGeo.dispose();
    },
    [bodyGeo, clothGeo],
  );
  useLayoutEffect(() => {
    const skinMesh = body.current;
    const shirt = cloth.current;
    if (!skinMesh || !shirt) return;
    walkers.forEach((walker, index) => {
      skinMesh.setColorAt(index, new THREE.Color(walker.skin));
      shirt.setColorAt(index, new THREE.Color(walker.cloth));
    });
    if (skinMesh.instanceColor) skinMesh.instanceColor.needsUpdate = true;
    if (shirt.instanceColor) shirt.instanceColor.needsUpdate = true;
  }, [walkers]);
  useFrame((_, delta) => {
    const skinMesh = body.current;
    const shirt = cloth.current;
    if (!skinMesh || !shirt) return;
    const step = Math.min(delta, 0.05);
    walkers.forEach((walker, index) => {
      const route = routes[walker.route];
      if (!route) return;
      walker.distance = (walker.distance + walker.speed * step) % route.length;
      let pose = sampleRoute(route, walker.distance);
      const away = pose ? Math.hypot(pose.x - livePose.x, pose.z - livePose.z) : Infinity;
      if (!pose || away > PERSON_HIDE) {
        dummy.position.set(pose?.x ?? 0, -8, pose?.z ?? 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        skinMesh.setMatrixAt(index, dummy.matrix);
        shirt.setMatrixAt(index, dummy.matrix);
        return;
      }
      const close = away <= PERSON_DETAIL;
      if (close && hitsBuilding(pose.x, pose.z, 0.3, colliders)) {
        walker.distance = (walker.distance + 6) % route.length;
        pose = sampleRoute(route, walker.distance);
      }
      const blocked = close && (!pose || hitsBuilding(pose.x, pose.z, 0.3, colliders));
      const crossing = pose && close && !blocked ? crossingPoint(pose.x, pose.z, crossings, performance.now() / 1000) : null;
      const bob = close && !blocked ? Math.sin(walker.distance * 3.2) * 0.035 : 0;
      if (pose && close) {
        const desired = Math.atan2(pose.dx, pose.dz);
        walker.heading += Math.atan2(Math.sin(desired - walker.heading), Math.cos(desired - walker.heading)) * 0.2;
      } else if (pose) {
        walker.heading = Math.atan2(pose.dx, pose.dz);
      }
      dummy.position.set(crossing?.x ?? pose?.x ?? 0, blocked ? -8 : 0.95 + bob, crossing?.z ?? pose?.z ?? 0);
      dummy.rotation.set(blocked ? 0 : bob, walker.heading, 0);
      dummy.scale.set(blocked ? 0 : 1, blocked ? 0 : 1, blocked ? 0 : 1);
      dummy.updateMatrix();
      skinMesh.setMatrixAt(index, dummy.matrix);
      const clothScale = close && !blocked ? 1 : 0;
      dummy.position.y = blocked ? -8 : 1.15 + bob;
      dummy.scale.set(clothScale, clothScale, clothScale);
      dummy.updateMatrix();
      shirt.setMatrixAt(index, dummy.matrix);
    });
    skinMesh.instanceMatrix.needsUpdate = true;
    shirt.instanceMatrix.needsUpdate = true;
  });
  if (walkers.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={body} args={[bodyGeo, undefined, walkers.length]} castShadow>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={cloth} args={[clothGeo, undefined, walkers.length]} castShadow>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

export function DistrictDress({ data, lit }: { data: CbdData; lit: boolean }) {
  const dress = useMemo(() => {
    const roads = data.roads;
    const residential = data.districtId !== 'nairobi-cbd';
    const shops = shopSigns(data.facilities ?? [], roads, residential ? 12 : 8);
    return {
      blades: streetBlades(roads, residential ? 16 : 10),
      shops,
      lights: streetLights(roads, residential ? 64 : 36),
      poles: utilityPoles(roads, residential ? 28 : 16),
      trees: [...vergeTrees(roads, data.parks, residential ? 48 : 18), ...compoundTrees(data.buildings, 12)],
      walks: walkRoutes(roads, residential ? 10 : 6),
      waiting: queueSpots(
        placedProps(data.districtId).filter((item) => item.kind === 'bus_stop'),
        shops,
        residential ? 8 : 5,
      ),
    };
  }, [data]);
  const jacaranda = dress.trees.filter((tree) => tree.kind === 'jacaranda');
  const shade = dress.trees.filter((tree) => tree.kind === 'shade');
  const people = data.districtId === 'nairobi-cbd' ? 10 : 18;
  const crossings = data.districtId === 'kilimani' ? kilimaniCrossings() : data.districtId === 'nairobi-cbd' ? cbdCrossings() : [];
  return (
    <group>
      {dress.blades.map((sign) => (
        <NamePlate key={`blade-${sign.text}-${sign.x}`} sign={sign} plate="street" />
      ))}
      {dress.shops.map((sign) => (
        <NamePlate key={`shop-${sign.text}-${sign.x}`} sign={sign} plate="shop" />
      ))}
      <Marks marks={dress.lights} args="pole" color="#3a3f42" y={0} />
      <Marks marks={dress.lights} args="lamp" color={lit ? '#f3ddb0' : '#c8c2b4'} y={0} emissive={lit ? '#f0d7a0' : undefined} />
      <Marks marks={dress.poles} args="pole" color="#4a463f" y={0} />
      <Marks marks={jacaranda} args="trunk" color="#5c4632" y={0} />
      <Marks marks={jacaranda} args="canopy" color="#6d5c86" y={0} />
      <Marks marks={shade} args="trunk" color="#4a3a2a" y={0} />
      <Marks marks={shade} args="canopy" color="#2f5a38" y={0} />
      <Pedestrians routes={dress.walks} count={people} crossings={crossings} />
      <Waiting spots={dress.waiting} />
    </group>
  );
}
