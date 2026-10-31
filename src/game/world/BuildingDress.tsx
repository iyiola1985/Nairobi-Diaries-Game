import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { collectFitments, type Fitment } from './architecture';
import type { BuildingRecord } from './data';
import { readableSign } from './locale';
import { makeLabelTexture } from './meshes';

const box = new THREE.BoxGeometry(1, 1, 1);
const drum = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const concrete = new THREE.MeshStandardMaterial({ color: '#cfc6b8', roughness: 0.86 });
const metal = new THREE.MeshStandardMaterial({ color: '#b7bbb6', roughness: 0.38, metalness: 0.55 });
const cloth = new THREE.MeshStandardMaterial({ color: '#c4552a', roughness: 0.8 });
const glass = new THREE.MeshStandardMaterial({ color: '#7a8b96', roughness: 0.32, metalness: 0 });
const dummy = new THREE.Object3D();

function writeMatrices(mesh: THREE.InstancedMesh | null, pieces: Fitment[]) {
  if (!mesh) return;
  pieces.forEach((piece, index) => {
    dummy.position.set(piece.x, piece.y, piece.z);
    dummy.rotation.set(0, piece.yaw, 0);
    dummy.scale.set(piece.sx, piece.sy, piece.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function Instances({ pieces, material, geometry = box }: { pieces: Fitment[]; material: THREE.Material; geometry?: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    writeMatrices(ref.current, pieces);
  }, [pieces]);
  if (pieces.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, pieces.length]} dispose={null} castShadow receiveShadow />;
}

function Boards({ signs }: { signs: { text: string; x: number; y: number; z: number; yaw: number }[] }) {
  const textures = useMemo(() => signs.map((sign) => makeLabelTexture(sign.text)), [signs]);
  return (
    <group>
      {signs.map((sign, index) => (
        <mesh key={`${sign.text}-${sign.x.toFixed(1)}`} position={[sign.x, sign.y, sign.z]} rotation={[0, sign.yaw, 0]} castShadow>
          <planeGeometry args={[Math.min(3.2, sign.text.length * 0.22), 0.7]} />
          <meshStandardMaterial map={textures[index]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Instanced façade parts for the buildings already in this chunk. Distant chunks skip this. */
export function BuildingDress({ buildings }: { buildings: readonly BuildingRecord[] }) {
  const dress = useMemo(() => collectFitments(buildings, (building) => readableSign(building.name)), [buildings]);
  return (
    <group>
      <Instances pieces={dress.concrete} material={concrete} />
      <Instances pieces={dress.metal} material={metal} />
      <Instances pieces={dress.tanks} material={metal} geometry={drum} />
      <Instances pieces={dress.cloth} material={cloth} />
      <Instances pieces={dress.glass} material={glass} />
      <Boards signs={dress.signs} />
    </group>
  );
}
