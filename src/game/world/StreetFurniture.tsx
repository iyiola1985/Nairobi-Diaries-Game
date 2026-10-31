import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { placedProps, type FurnitureKind, type PlacedProp } from './furniture';
import { signalAllows } from './motion';

const dummy = new THREE.Object3D();

function bake(geometry: THREE.BufferGeometry, dx = 0, dy = 0, dz = 0): number[] {
  geometry.translate(dx, dy, dz);
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const out: number[] = [];
  const push = (vertex: number) => out.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
  if (index) {
    for (let i = 0; i < index.count; i++) push(index.getX(i));
  } else {
    for (let i = 0; i < position.count; i++) push(i);
  }
  geometry.dispose();
  return out;
}

function solid(parts: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(parts.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function propGeometry(kind: FurnitureKind): THREE.BufferGeometry {
  switch (kind) {
    case 'signal':
      return solid([
        bake(new THREE.CylinderGeometry(0.07, 0.09, 4.1, 6), 0, 2.05, 0),
        bake(new THREE.BoxGeometry(0.28, 0.78, 0.22), 0.22, 3.85, 0),
      ]);
    case 'bus_stop':
      return solid([
        bake(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 6), -1.1, 1.3, 0),
        bake(new THREE.BoxGeometry(2.5, 0.08, 1.15), 0, 2.45, 0),
        bake(new THREE.BoxGeometry(2.5, 1.15, 0.08), 0, 1.85, -0.52),
      ]);
    case 'bump':
      return solid([bake(new THREE.BoxGeometry(1, 0.12, 0.55), 0, 0.08, 0)]);
    case 'roundabout':
      return solid([bake(new THREE.CylinderGeometry(1, 1.05, 0.28, 12), 0, 0.14, 0)]);
    case 'mini_roundabout':
      return solid([bake(new THREE.CylinderGeometry(0.8, 0.9, 0.16, 10), 0, 0.1, 0)]);
    case 'stop':
      return solid([
        bake(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), 0, 1.2, 0),
        bake(new THREE.BoxGeometry(0.62, 0.62, 0.06), 0, 2.25, 0),
      ]);
    case 'give_way':
      return solid([
        bake(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), 0, 1.1, 0),
        bake(new THREE.BoxGeometry(0.7, 0.16, 0.06), 0, 2.05, 0),
      ]);
    case 'crossing':
      return solid([bake(new THREE.BoxGeometry(0.12, 0.9, 0.12), 0, 0.45, 0)]);
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function propColor(kind: FurnitureKind): string {
  switch (kind) {
    case 'signal':
      return '#2c3034';
    case 'bus_stop':
      return '#d7d0c2';
    case 'bump':
      return '#2a2e32';
    case 'roundabout':
      return '#3f5a40';
    case 'mini_roundabout':
      return '#d8d2c4';
    case 'stop':
      return '#9c2b2b';
    case 'give_way':
      return '#f4efe6';
    case 'crossing':
      return '#c8c2b4';
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

const RENDERED: FurnitureKind[] = ['signal', 'bus_stop', 'bump', 'roundabout', 'mini_roundabout', 'stop', 'give_way'];

function scaleOf(item: PlacedProp): [number, number, number] {
  switch (item.kind) {
    case 'bump':
      return [Math.max(2.4, item.across - 0.6), 1, 1];
    case 'roundabout': {
      const island = item.radius * 0.42;
      return [island, 1, island];
    }
    case 'signal':
    case 'bus_stop':
    case 'crossing':
    case 'mini_roundabout':
    case 'stop':
    case 'give_way':
      return [1, 1, 1];
    default: {
      const unexpected: never = item.kind;
      return unexpected;
    }
  }
}

function apply(mesh: THREE.InstancedMesh, items: PlacedProp[]) {
  items.forEach((item, index) => {
    const [sx, sy, sz] = scaleOf(item);
    dummy.position.set(item.x, 0, item.z);
    dummy.rotation.set(0, item.yaw, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
}

function KindMesh({ kind, items }: { kind: FurnitureKind; items: PlacedProp[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => propGeometry(kind), [kind]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (ref.current) apply(ref.current, items);
  }, [items]);
  useFrame(() => {
    if (kind !== 'signal') return;
    const mesh = ref.current;
    if (!mesh) return;
    const seconds = performance.now() / 1000;
    items.forEach((_, index) => {
      mesh.setColorAt(index, new THREE.Color(signalAllows(index, seconds) ? '#2f8f4e' : '#9c2b2b'));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow>
      <meshStandardMaterial color={kind === 'signal' ? '#ffffff' : propColor(kind)} roughness={0.82} />
    </instancedMesh>
  );
}

export function StreetFurniture({ districtId }: { districtId: string }) {
  const groups = useMemo(() => {
    const props = placedProps(districtId);
    return RENDERED.map((kind) => ({
      kind,
      items: props.filter((item) => {
        if (item.kind !== kind) return false;
        if (kind === 'roundabout') return item.radius > 4;
        return true;
      }),
    }));
  }, [districtId]);
  return (
    <group>
      {groups.map((group) => (
        <KindMesh key={group.kind} kind={group.kind} items={group.items} />
      ))}
    </group>
  );
}
