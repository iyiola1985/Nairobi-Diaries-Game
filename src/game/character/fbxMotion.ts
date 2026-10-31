import * as THREE from 'three';

/** Mixamo FBX from the supplied files is authored in centimetres. */
export const PLAYER_SCALE = 0.01;

export const PLAYER_FILES = {
  body: '/assets/characters/player/player.fbx',
  strut: '/assets/characters/player/strut-walking.fbx',
  jog: '/assets/characters/player/jogging.fbx',
} as const;

export function boneNames(root: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((node) => {
    if (node instanceof THREE.Bone) names.add(node.name);
  });
  return names;
}

/**
 * Keep tracks whose bones exist on the supplied character.
 * Drop hip translation so the city movement, not the clip, carries the body.
 */
export function clipForSkeleton(clip: THREE.AnimationClip, bones: Set<string>, name: string): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const node = track.name.split('.')[0] ?? '';
    if (!bones.has(node)) return false;
    if (node === 'mixamorigHips' && track.name.endsWith('.position')) return false;
    return true;
  });
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

const ARM_BONES = [
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
] as const;

export function locomotionClip(speed: number, dancing: boolean): 'idle' | 'strut' | 'jog' {
  if (dancing) return 'strut';
  if (speed > 3.5) return 'jog';
  if (speed > 0.2) return 'strut';
  return 'idle';
}

/** Hip travel of the supplied strut walk, scaled from centimetres to metres. */
export const STRUT_METRES_PER_SECOND = 1.168;

/** Hip travel of the supplied jogging clip, scaled from centimetres to metres. */
export const JOG_METRES_PER_SECOND = 2.102;

export const WALK_SPEED = 1.8;
export const RUN_SPEED = 4.2;
/** Fastest jog the supplied clip can play without the feet sliding. */
export const SPRINT_SPEED = 5.4;

const ACCEL = 3.4;
const DECEL = 6.2;

/** Ease ground speed. Starting and stopping take a fraction of a second. */
export function approachSpeed(current: number, target: number, dt: number): number {
  if (dt <= 0) return current;
  const rate = target > current ? ACCEL : DECEL;
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** 1 when the body already faces the move. Corners keep a little speed so the turn is an arc. */
export function facingScale(current: number, target: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const align = Math.cos(delta);
  if (Math.abs(delta) < Math.PI * 0.67) return Math.max(0.4, align);
  return Math.max(0, align);
}

/** Turn toward a heading without snapping through the whole angle in one frame. */
export function easeHeading(
  current: number,
  target: number,
  rate: number,
  dt: number,
  maxRate: number,
): { heading: number; rate: number } {
  if (dt <= 0) return { heading: current, rate };
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const desired = Math.max(-maxRate, Math.min(maxRate, delta * 5.5));
  const rateStep = maxRate * 6 * dt;
  let nextRate = rate + Math.max(-rateStep, Math.min(rateStep, desired - rate));
  const step = nextRate * dt;
  if (Math.abs(step) >= Math.abs(delta)) return { heading: current + delta, rate: 0 };
  return { heading: current + step, rate: nextRate };
}

/** Match the clip to the ground speed. The supplied files have no separate sprint clip. */
export function clipTimeScale(clip: 'idle' | 'strut' | 'jog', speed: number, dancing: boolean): number {
  if (clip === 'idle') return 1;
  if (dancing) return 1.35;
  const authored = clip === 'jog' ? JOG_METRES_PER_SECOND : STRUT_METRES_PER_SECOND;
  const scale = authored > 0 ? speed / authored : 1;
  const max = clip === 'jog' ? 2.6 : 1.7;
  return Math.min(max, Math.max(0.7, scale));
}

function sampleQuaternion(track: THREE.KeyframeTrack, time: number): THREE.Quaternion {
  const times = track.times;
  const values = track.values;
  if (times.length === 0) return new THREE.Quaternion();
  let index = 0;
  while (index < times.length - 1 && (times[index + 1] ?? 0) <= time) index += 1;
  const current = new THREE.Quaternion().fromArray(values, index * 4);
  const nextIndex = Math.min(index + 1, times.length - 1);
  if (nextIndex === index) return current;
  const start = times[index] ?? 0;
  const end = times[nextIndex] ?? start;
  const span = end - start;
  const weight = span > 0 ? (time - start) / span : 0;
  const next = new THREE.Quaternion().fromArray(values, nextIndex * 4);
  return current.slerp(next, THREE.MathUtils.clamp(weight, 0, 1));
}

function armHangScore(root: THREE.Object3D, side: 'Left' | 'Right'): number | null {
  const arm = root.getObjectByName(`mixamorig${side}Arm`);
  const hand = root.getObjectByName(`mixamorig${side}Hand`);
  if (!arm || !hand) return null;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  arm.getWorldPosition(from);
  hand.getWorldPosition(to);
  to.sub(from);
  if (to.lengthSq() < 1e-8) return null;
  to.normalize();
  return -to.y - Math.abs(to.x) - Math.abs(to.z);
}

/** Time in the clip when one arm hangs closest to the side, not out in a T-pose. */
export function relaxedArmTime(root: THREE.Object3D, clip: THREE.AnimationClip, side: 'Left' | 'Right'): number {
  if (clip.duration <= 0 || armHangScore(root, side) === null) return 0;
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  let bestTime = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const steps = 24;
  for (let step = 0; step < steps; step += 1) {
    const time = (clip.duration * step) / (steps - 1);
    mixer.setTime(time);
    root.updateMatrixWorld(true);
    const score = armHangScore(root, side);
    if (score !== null && score > bestScore) {
      bestScore = score;
      bestTime = time;
    }
  }
  action.stop();
  mixer.uncacheAction(clip, root);
  mixer.uncacheRoot(root);
  return bestTime;
}

/**
 * Standing pose. The supplied file rests in a T-pose, so idle holds the
 * arm chain from the walk frame where the arms hang at the sides.
 */
export function idleArmsClip(root: THREE.Object3D, clip: THREE.AnimationClip, bones: Set<string>): THREE.AnimationClip {
  const leftTime = relaxedArmTime(root, clip, 'Left');
  const rightTime = relaxedArmTime(root, clip, 'Right');
  const tracks: THREE.QuaternionKeyframeTrack[] = [];
  for (const name of ARM_BONES) {
    if (!bones.has(name)) continue;
    const track = clip.tracks.find((item) => item.name === `${name}.quaternion`);
    if (!track) continue;
    const time = name.includes('Left') ? leftTime : rightTime;
    const pose = sampleQuaternion(track, time);
    tracks.push(
      new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [pose.x, pose.y, pose.z, pose.w, pose.x, pose.y, pose.z, pose.w]),
    );
  }
  return new THREE.AnimationClip('idle', 1, tracks);
}
