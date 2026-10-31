import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { livePose } from '../player/input';

const COUNT = 140;

export function Rainfall({ rain }: { rain: boolean }) {
  const streaks = useRef<THREE.InstancedMesh>(null);
  const puddles = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const drops = useMemo(() => {
    return Array.from({ length: COUNT }, (_, index) => ({
      x: ((index * 17) % 40) - 20,
      z: ((index * 29) % 40) - 20,
      y: (index % 12) + 1,
      speed: 12 + (index % 5),
    }));
  }, []);
  useFrame((_, delta) => {
    if (!rain) return;
    const mesh = streaks.current;
    const ponds = puddles.current;
    if (!mesh || !ponds) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = Math.min(delta, 0.05);
    drops.forEach((drop, index) => {
      if (!reduce) drop.y -= drop.speed * step;
      if (drop.y < 0.2) drop.y = 8 + (index % 4);
      dummy.position.set(livePose.x + drop.x, drop.y, livePose.z + drop.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    const cellX = Math.round(livePose.x / 10) * 10;
    const cellZ = Math.round(livePose.z / 10) * 10;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      dummy.position.set(cellX + Math.cos(angle) * (3 + (i % 3)), 0.095, cellZ + Math.sin(angle) * (2.4 + (i % 2)));
      dummy.rotation.set(-Math.PI / 2, 0, angle);
      dummy.scale.set(1.2 + (i % 3) * 0.35, 0.7, 1);
      dummy.updateMatrix();
      ponds.setMatrixAt(i, dummy.matrix);
    }
    ponds.instanceMatrix.needsUpdate = true;
  });
  if (!rain) return null;
  return (
    <group>
      <instancedMesh ref={streaks} args={[undefined, undefined, COUNT]}>
        <boxGeometry args={[0.03, 0.55, 0.03]} />
        <meshBasicMaterial color="#d5dde4" transparent opacity={0.45} />
      </instancedMesh>
      <instancedMesh ref={puddles} args={[undefined, undefined, 8]}>
        <circleGeometry args={[0.85, 10]} />
        <meshStandardMaterial color="#2c3438" transparent opacity={0.55} roughness={0.25} metalness={0.05} />
      </instancedMesh>
    </group>
  );
}
