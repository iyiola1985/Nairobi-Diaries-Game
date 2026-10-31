import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from '../character/presets';
import { faceSignature } from '../character/metrics';
import { assetById, assetRegistry } from './registry';
import { loadGltfBuffer } from './load';
import { PROBE_GLB_BASE64 } from './probe.glb';
import { checksPass, validateFacts } from './validate';
import { wearPlan } from './wear';
import type { MeshFacts } from './types';

function readProbe(): ArrayBuffer {
  const binary = atob(PROBE_GLB_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

describe('asset registry', () => {
  it('keeps the character, landmarks, and clothing files absent', () => {
    const registry = assetRegistry();
    const body = assetById('nd-humanoid-v1');
    const kicc = assetById('landmark-kicc');
    const tower = assetById('landmark-times-tower');
    expect(body?.status).toBe('absent');
    expect(body?.file).toBeNull();
    expect(kicc?.file).toBeNull();
    expect(tower?.file).toBeNull();
    expect(kicc?.placement?.heightM).toBe(105);
    expect(tower?.placement?.heightM).toBe(140);
    expect(Math.hypot(kicc?.placement?.x ?? 99, kicc?.placement?.z ?? 99)).toBeLessThan(80);
    expect(registry.filter((item) => item.status === 'ready')).toHaveLength(0);
    expect(registry.some((item) => item.id === 'pipeline-probe' && item.status === 'placeholder')).toBe(true);
  });

  it('does not fetch an absent asset', async () => {
    const body = assetById('nd-humanoid-v1');
    expect(body).not.toBeNull();
    const result = await loadGltfBuffer(body!, readProbe());
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toMatch(/Nothing was fetched/);
  });
});

describe('pipeline probe', () => {
  it('is a glTF binary with a named mesh', () => {
    const bytes = new Uint8Array(readProbe());
    const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
    expect(magic).toBe('glTF');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(4, true)).toBe(2);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
      meshes: { name: string }[];
      materials: { name: string }[];
    };
    expect(json.meshes[0]?.name).toBe('PipelineProbe');
    expect(json.materials[0]?.name).toBe('probe-brass');
  });

  it('loads the cube and passes the metre-scale checks', async () => {
    const record = assetById('pipeline-probe');
    expect(record).not.toBeNull();
    const result = await loadGltfBuffer(record!, readProbe());
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.facts.meshCount).toBe(1);
    expect(result.facts.triangleCount).toBe(12);
    expect(result.facts.skinned).toBe(false);
    expect(checksPass(result.checks)).toBe(true);
    expect(result.scene.getObjectByName('PipelineProbe')).toBeTruthy();
  });
});

describe('validation and wardrobe slots', () => {
  it('rejects a cube that is presented as the master body', () => {
    const record = assetById('nd-humanoid-v1');
    expect(record).not.toBeNull();
    const facts: MeshFacts = {
      meshCount: 1,
      triangleCount: 12,
      skinned: false,
      boneNames: [],
      clipNames: [],
      materialNames: ['probe-brass'],
      size: [1, 1, 1],
      byteLength: 1200,
    };
    const checks = validateFacts({ ...record!, status: 'review', file: '/missing-body.glb' }, facts);
    expect(checksPass(checks)).toBe(false);
    expect(checks.find((item) => item.id === 'bones')?.pass).toBe(false);
    expect(checks.find((item) => item.id === 'clips')?.pass).toBe(false);
  });

  it('hides separates when a full dress is worn and keeps the face', () => {
    const base = createDefaultCharacter();
    const dressed = {
      ...base,
      clothing: { ...base.clothing, dress: 'evening' as const, outer: 'blazer' as const },
    };
    const plan = wearPlan(dressed);
    expect(plan.find((item) => item.slot === 'dress')?.visible).toBe(true);
    expect(plan.find((item) => item.slot === 'top')?.visible).toBe(false);
    expect(plan.find((item) => item.slot === 'outer')?.visible).toBe(false);
    expect(plan.find((item) => item.slot === 'bottom')?.visible).toBe(false);
    expect(faceSignature(dressed)).toBe(faceSignature(base));
  });
});
