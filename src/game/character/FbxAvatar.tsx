import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Avatar, type AvatarMotion } from './Avatar';
import type { CharacterConfig } from './types';
import { boneNames, clipForSkeleton, clipTimeScale, idleArmsClip, locomotionClip, PLAYER_FILES, PLAYER_SCALE } from './fbxMotion';
import { WornLook } from './WornLook';

interface RigTemplate {
  model: THREE.Group;
  idle: THREE.AnimationClip;
  strut: THREE.AnimationClip;
  jog: THREE.AnimationClip;
}

let templatePromise: Promise<RigTemplate> | null = null;

function namedClip(group: THREE.Group): THREE.AnimationClip {
  const clip = group.animations.find((item) => item.tracks.length > 0);
  if (!clip) throw new Error('Animation file has no tracks');
  return clip;
}

function loadTemplate(): Promise<RigTemplate> {
  if (!templatePromise) {
    const loader = new FBXLoader();
    templatePromise = Promise.all([
      loader.loadAsync(PLAYER_FILES.body),
      loader.loadAsync(PLAYER_FILES.strut),
      loader.loadAsync(PLAYER_FILES.jog),
    ])
      .then(([model, strutFile, jogFile]) => {
        model.scale.setScalar(PLAYER_SCALE);
        const bones = boneNames(model);
        const strut = clipForSkeleton(namedClip(strutFile), bones, 'strut');
        return {
          model,
          idle: idleArmsClip(strutFile, strut, bones),
          strut,
          jog: clipForSkeleton(namedClip(jogFile), bones, 'jog'),
        };
      })
      .catch((error: unknown) => {
        templatePromise = null;
        throw error;
      });
  }
  return templatePromise;
}

function prepare(root: THREE.Object3D) {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
    }
  });
}

interface FbxAvatarProps {
  config: CharacterConfig;
  motion?: { current: AvatarMotion };
  /** Studio only: play a clip instead of city movement. */
  preview?: boolean;
  /** Studio only: stand in the idle pose, or loop the strut walk. */
  pose?: 'stand' | 'walk';
}

export function FbxAvatar({ config, motion, preview = false, pose = 'walk' }: FbxAvatarProps) {
  const holder = useRef<THREE.Group>(null);
  const [rig, setRig] = useState<THREE.Object3D | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<{ idle: THREE.AnimationAction; strut: THREE.AnimationAction; jog: THREE.AnimationAction } | null>(null);
  const playing = useRef<'idle' | 'strut' | 'jog' | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let clone: THREE.Object3D | null = null;
    loadTemplate()
      .then((template) => {
        if (!alive || !holder.current) return;
        clone = cloneSkinned(template.model);
        prepare(clone);
        holder.current.add(clone);
        setRig(clone);
        const nextMixer = new THREE.AnimationMixer(clone);
        const idle = nextMixer.clipAction(template.idle);
        const strut = nextMixer.clipAction(template.strut);
        const jog = nextMixer.clipAction(template.jog);
        idle.setLoop(THREE.LoopRepeat, Infinity);
        strut.setLoop(THREE.LoopRepeat, Infinity);
        jog.setLoop(THREE.LoopRepeat, Infinity);
        idle.play();
        mixer.current = nextMixer;
        actions.current = { idle, strut, jog };
        playing.current = 'idle';
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      mixer.current?.stopAllAction();
      mixer.current = null;
      actions.current = null;
      playing.current = null;
      setRig(null);
      if (clone && holder.current) holder.current.remove(clone);
    };
  }, []);

  useFrame((_, dt) => {
    const mix = mixer.current;
    const pair = actions.current;
    if (!mix || !pair) return;
    const speed = motion?.current.speed ?? 0;
    const dancing = motion?.current.emote === 'dance';
    const want = motion || !preview ? locomotionClip(speed, dancing) : pose === 'stand' ? 'idle' : 'strut';
    if (want !== playing.current) {
      const next = want ? pair[want] : null;
      const prev = playing.current ? pair[playing.current] : null;
      next?.reset().fadeIn(0.24).play();
      prev?.fadeOut(0.24);
      playing.current = want;
    }
    pair.idle.timeScale = 1;
    pair.strut.timeScale = clipTimeScale('strut', speed, dancing);
    pair.jog.timeScale = clipTimeScale('jog', speed, false);
    mix.update(Math.min(dt, 0.05));
  });

  if (failed) return <Avatar config={config} motion={motion} />;
  return (
    <group ref={holder}>
      <pointLight position={[0.4, 2.4, 1.6]} intensity={18} distance={9} decay={2} color="#fff6ea" />
      {rig ? <WornLook config={config} rig={rig} /> : null}
    </group>
  );
}
