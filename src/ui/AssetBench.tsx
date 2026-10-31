import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { assetById, assetRegistry } from '../game/assets/registry';
import { loadGltfAsset } from '../game/assets/load';
import { checksPass } from '../game/assets/validate';
import type { LoadResult, MeshFacts } from '../game/assets/types';
import { AVATURN, assessHumanoid } from '../game/character/externalAvatar';
import { FillFrame, KeepPainting, useWakeCanvas } from './Studio';

const PROBE_ID = 'pipeline-probe';

export function AssetBench({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<LoadResult>({ status: 'loading', id: PROBE_ID });
  const [yaw, setYaw] = useState(0);
  useWakeCanvas();

  useEffect(() => {
    const record = assetById(PROBE_ID);
    if (!record) {
      setResult({ status: 'error', id: PROBE_ID, message: 'The probe is not in the registry.' });
      return undefined;
    }
    let live = true;
    loadGltfAsset(record).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const registry = assetRegistry();
  const passed = result.status === 'ready' && checksPass(result.checks);

  return (
    <main className="asset-bench">
      <div className="stage">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [1.7, 1.35, 2.1], fov: 40 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        >
          <FillFrame />
          <KeepPainting />
          <BenchOrbit />
          <color attach="background" args={['#2a241e']} />
          <hemisphereLight args={['#f3ecdf', '#4a4036', 0.85]} />
          <directionalLight position={[3, 5, 2]} intensity={2.2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[1.4, 40]} />
            <meshStandardMaterial color="#4a4036" roughness={1} />
          </mesh>
          <group rotation={[0, yaw, 0]}>{result.status === 'ready' ? <primitive object={result.scene} /> : null}</group>
        </Canvas>
      </div>
      <aside className="asset-log">
        <p className="eyebrow">Asset pipeline</p>
        <h1>Model bench</h1>
        <p className="fine">
          The cube is an original 1 metre probe. It is not a character, a building, or a landmark. Drag to inspect it. The player on the street is still the procedural character. Avaturn is not connected.
        </p>
        <p className={passed ? 'asset-state ok' : 'asset-state'}>
          {result.status === 'loading' ? 'Loading the probe…' : null}
          {result.status === 'error' ? result.message : null}
          {result.status === 'ready' ? (passed ? 'Probe loaded and the checks passed.' : 'Probe loaded. One or more checks failed.') : null}
        </p>
        {result.status === 'ready' ? (
          <ul className="asset-checks">
            {result.checks.map((item) => (
              <li key={item.id} className={item.pass ? 'ok' : 'bad'}>
                {item.detail}
              </li>
            ))}
          </ul>
        ) : null}
        {result.status === 'ready' ? <HumanoidReport facts={result.facts} /> : null}
        <h2>Registry</h2>
        <ul className="asset-registry">
          {registry.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span>
                {item.status} · {item.role}
                {item.file ? ` · ${item.file}` : ' · no file'}
              </span>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn" type="button" onClick={() => setYaw((value) => value + 0.7)}>
            Turn model
          </button>
          <button className="btn primary" type="button" onClick={onClose}>
            Back to the street
          </button>
        </div>
      </aside>
    </main>
  );
}

function HumanoidReport({ facts }: { facts: MeshFacts }) {
  const report = assessHumanoid(facts);
  return (
    <>
      <h2>Humanoid contract</h2>
      <p className="fine">
        {report.matchesContract
          ? 'This file matches nd-humanoid-v1. It is not switched on as the player.'
          : 'This file does not match nd-humanoid-v1. No Avaturn bone names are assumed.'}
      </p>
      <ul className="asset-checks">
        <li className={report.skinned ? 'ok' : 'bad'}>{report.skinned ? 'Skinned.' : 'Not skinned.'}</li>
        <li className={report.missingBones.length === 0 ? 'ok' : 'bad'}>
          {report.missingBones.length === 0 ? 'Master bones present.' : `Missing bones: ${report.missingBones.join(', ')}.`}
        </li>
        <li className={report.missingClips.length === 0 ? 'ok' : 'bad'}>
          {report.missingClips.length === 0 ? 'Locomotion clips present.' : `Missing clips: ${report.missingClips.join(', ')}.`}
        </li>
        <li className="bad">{AVATURN.connected ? 'Avaturn session connected.' : 'No Avaturn session. Nothing was fetched from Avaturn.'}</li>
      </ul>
    </>
  );
}

function BenchOrbit() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false;
    orbit.target.set(0, 0.45, 0);
    orbit.update();
    return () => orbit.dispose();
  }, [camera, gl]);
  return null;
}
