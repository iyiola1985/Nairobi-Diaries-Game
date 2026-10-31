import { useEffect, useRef } from 'react';
import { advance, Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { FbxAvatar } from '../game/character/FbxAvatar';
import { useGame } from '../store/useGame';

export type StudioFrame = 'body' | 'face' | 'shoes';

const FRAMES: Record<StudioFrame, { pos: [number, number, number]; target: [number, number, number] }> = {
  body: { pos: [0.12, 0.98, 3.45], target: [0, 0.86, 0] },
  face: { pos: [0.05, 1.68, 1.15], target: [0, 1.58, 0] },
  shoes: { pos: [0.35, 0.42, 1.85], target: [0, 0.12, 0] },
};

export function FillFrame() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el) return undefined;
    const apply = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) gl.setSize(width, height, false);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [gl]);
  return null;
}

/** Embedded browsers can suspend requestAnimationFrame, which leaves the canvas blank. */
export function KeepPainting() {
  useEffect(() => {
    let lastRaf = performance.now();
    let raf = 0;
    let timer = 0;
    let stopped = false;
    const count = () => {
      lastRaf = performance.now();
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);
    const step = () => {
      if (stopped) return;
      if (performance.now() - lastRaf > 200) advance(performance.now());
      timer = window.setTimeout(step, 32);
    };
    timer = window.setTimeout(step, 400);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

/** R3F drops its first size sample if it arrives before the canvas effect. */
export function useWakeCanvas() {
  useEffect(() => {
    const kick = () => window.dispatchEvent(new Event('resize'));
    const frame = requestAnimationFrame(kick);
    const timer = window.setTimeout(kick, 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
}

export function StudioStage({ frame, pose = 'walk' }: { frame: StudioFrame; pose?: 'stand' | 'walk' }) {
  const character = useGame((state) => state.character);
  useWakeCanvas();
  return (
    <div className="stage">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: FRAMES.body.pos, fov: 36 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <FillFrame />
        <KeepPainting />
        <color attach="background" args={['#e6e1d8']} />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={['#fff8ef', '#d5cdc2', 0.55]} />
        <directionalLight
          position={[2.2, 4.2, 3.2]}
          intensity={1.35}
          color="#fff6ea"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-2.2, 2.2, -1.2]} intensity={0.55} color="#f3ece3" />
        <StudioCamera frame={frame} />
        <FbxAvatar config={character} preview pose={pose} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.7, 64]} />
          <meshStandardMaterial color="#d7d0c6" roughness={0.9} />
        </mesh>
      </Canvas>
    </div>
  );
}

type StudioNudge = { yaw: number; zoom: number };

const nudgeListeners = new Set<(nudge: StudioNudge) => void>();

export function nudgeStudio(nudge: StudioNudge) {
  nudgeListeners.forEach((listener) => listener(nudge));
}

function StudioCamera({ frame }: { frame: StudioFrame }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const anim = useRef(1);
  const goalPos = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false;
    orbit.enableDamping = false;
    orbit.minDistance = 0.65;
    orbit.maxDistance = 5.6;
    orbit.minPolarAngle = 0.45;
    orbit.maxPolarAngle = 1.55;
    orbit.target.set(0, 0.98, 0);
    controls.current = orbit;
    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    anim.current = 1;
  }, [frame]);

  useEffect(() => {
    const onNudge = ({ yaw, zoom }: StudioNudge) => {
      const orbit = controls.current;
      if (!orbit) return;
      anim.current = 0;
      const offset = camera.position.clone().sub(orbit.target);
      if (yaw !== 0) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const next = THREE.MathUtils.clamp(offset.length() * zoom, orbit.minDistance, orbit.maxDistance);
      if (offset.lengthSq() < 1e-6) offset.set(0, 0, 1);
      offset.setLength(next);
      camera.position.copy(orbit.target).add(offset);
      orbit.update();
    };
    nudgeListeners.add(onNudge);
    return () => {
      nudgeListeners.delete(onNudge);
    };
  }, [camera]);

  useFrame((_, dt) => {
    const orbit = controls.current;
    if (!orbit) return;
    if (anim.current > 0) {
      const goal = FRAMES[frame];
      goalPos.current.set(...goal.pos);
      goalTarget.current.set(...goal.target);
      const k = 1 - Math.exp(-5 * dt);
      camera.position.lerp(goalPos.current, k);
      orbit.target.lerp(goalTarget.current, k);
      anim.current = Math.max(0, anim.current - dt);
    }
    orbit.update();
  });

  return null;
}
