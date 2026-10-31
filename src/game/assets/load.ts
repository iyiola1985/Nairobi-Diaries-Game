import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetRecord, LoadResult, MeshFacts } from './types';
import { validateFacts } from './validate';

const cache = new Map<string, Promise<{ gltf: GLTF; byteLength: number }>>();

export function factsFromObject(root: THREE.Object3D, clips: THREE.AnimationClip[], byteLength: number): MeshFacts {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let meshCount = 0;
  let triangleCount = 0;
  const materials = new Set<string>();
  const bones = new Set<string>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount += 1;
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.index;
    triangleCount += index ? index.count / 3 : position ? position.count / 3 : 0;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) materials.add(material.name || material.type);
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      for (const bone of skinned.skeleton.bones) bones.add(bone.name);
    }
  });
  return {
    meshCount,
    triangleCount,
    skinned: bones.size > 0,
    boneNames: [...bones],
    clipNames: clips.map((clip) => clip.name),
    materialNames: [...materials],
    size: [size.x, size.y, size.z],
    byteLength,
  };
}

function refuse(record: AssetRecord): string | null {
  switch (record.status) {
    case 'absent':
      return 'No file is registered. Nothing was fetched.';
    case 'procedural':
      return 'This block is built from OpenStreetMap geometry, not a GLB.';
    case 'placeholder':
    case 'review':
    case 'ready':
      return record.file ? null : 'This record has no file path.';
    default: {
      const _exhaustive: never = record.status;
      return _exhaustive;
    }
  }
}

function parseGltf(buffer: ArrayBuffer): Promise<GLTF> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', resolve, (error) => {
      reject(error instanceof Error ? error : new Error('The GLB could not be parsed.'));
    });
  });
}

async function fetchGltf(record: AssetRecord): Promise<{ gltf: GLTF; byteLength: number }> {
  const file = record.file;
  if (!file) throw new Error('This record has no file path.');
  const existing = cache.get(record.id);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`The model request failed (${response.status}).`);
    const buffer = await response.arrayBuffer();
    const gltf = await parseGltf(buffer);
    return { gltf, byteLength: buffer.byteLength };
  })();
  cache.set(record.id, pending);
  try {
    return await pending;
  } catch (error) {
    cache.delete(record.id);
    throw error;
  }
}

export async function loadGltfBuffer(record: AssetRecord, buffer: ArrayBuffer): Promise<LoadResult> {
  const blocked = refuse(record);
  if (blocked) return { status: 'error', id: record.id, message: blocked };
  try {
    const gltf = await parseGltf(buffer);
    const facts = factsFromObject(gltf.scene, gltf.animations, buffer.byteLength);
    return { status: 'ready', id: record.id, checks: validateFacts(record, facts), facts, scene: gltf.scene };
  } catch (error) {
    return { status: 'error', id: record.id, message: error instanceof Error ? error.message : 'The model could not be loaded.' };
  }
}

export async function loadGltfAsset(record: AssetRecord): Promise<LoadResult> {
  const blocked = refuse(record);
  if (blocked) return { status: 'error', id: record.id, message: blocked };
  try {
    const loaded = await fetchGltf(record);
    const facts = factsFromObject(loaded.gltf.scene, loaded.gltf.animations, loaded.byteLength);
    return {
      status: 'ready',
      id: record.id,
      checks: validateFacts(record, facts),
      facts,
      scene: loaded.gltf.scene,
    };
  } catch (error) {
    return { status: 'error', id: record.id, message: error instanceof Error ? error.message : 'The model could not be loaded.' };
  }
}
