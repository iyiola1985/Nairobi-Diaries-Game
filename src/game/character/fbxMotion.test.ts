import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { approachSpeed, clipForSkeleton, clipTimeScale, easeHeading, facingScale, idleArmsClip, locomotionClip, SPRINT_SPEED, STRUT_METRES_PER_SECOND } from './fbxMotion';

describe('supplied character clips', () => {
  it('drops hip travel and bones the character file does not have', () => {
    const bones = new Set(['mixamorigHips', 'mixamorigSpine']);
    const clip = new THREE.AnimationClip('mixamo.com', 1, [
      new THREE.VectorKeyframeTrack('mixamorigHips.position', [0], [0, 0, 0]),
      new THREE.QuaternionKeyframeTrack('mixamorigHips.quaternion', [0], [0, 0, 0, 1]),
      new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], [0, 0, 0, 1]),
      new THREE.QuaternionKeyframeTrack('mixamorigHeadTop_End.quaternion', [0], [0, 0, 0, 1]),
    ]);
    const fitted = clipForSkeleton(clip, bones, 'strut');
    expect(fitted.name).toBe('strut');
    expect(fitted.tracks.map((track) => track.name)).toEqual([
      'mixamorigHips.quaternion',
      'mixamorigSpine.quaternion',
    ]);
  });

  it('uses strut for walking and jogging for a run', () => {
    expect(locomotionClip(0, false)).toBe('idle');
    expect(locomotionClip(1.8, false)).toBe('strut');
    expect(locomotionClip(5.1, false)).toBe('jog');
    expect(locomotionClip(7.8, false)).toBe('jog');
    expect(locomotionClip(0, true)).toBe('strut');
  });

  it('eases speed and turning, and matches the supplied clip to the ground speed', () => {
    expect(approachSpeed(0, 1.8, 0.05)).toBeCloseTo(0.17, 1);
    expect(approachSpeed(1.8, 0, 0.05)).toBeLessThan(1.8);
    expect(approachSpeed(1.8, 0, 0.05)).toBeGreaterThan(1.4);
    const first = easeHeading(0, Math.PI / 2, 0, 0.016, 2.5);
    expect(Math.abs(first.heading)).toBeLessThan(0.2);
    expect(first.heading).not.toBeCloseTo(Math.PI / 2);
    let heading = 0;
    let rate = 0;
    for (let frame = 0; frame < 40; frame += 1) {
      const next = easeHeading(heading, Math.PI / 2, rate, 0.016, 2.5);
      heading = next.heading;
      rate = next.rate;
    }
    expect(heading).toBeGreaterThan(0.8);
    expect(heading).toBeLessThan(Math.PI / 2 + 0.05);
    expect(clipTimeScale('strut', 1.8, false)).toBeCloseTo(1.8 / STRUT_METRES_PER_SECOND, 2);
    expect(clipTimeScale('jog', SPRINT_SPEED, false)).toBeLessThanOrEqual(2.6);
    expect(clipTimeScale('idle', 0, false)).toBe(1);
    expect(clipTimeScale('strut', 0, true)).toBeCloseTo(1.35);
    expect(facingScale(0, 0)).toBeCloseTo(1);
    expect(facingScale(0, Math.PI / 2)).toBeCloseTo(0.4);
    expect(facingScale(0, Math.PI)).toBeCloseTo(0);
    expect(facingScale(0, Math.PI / 4)).toBeCloseTo(Math.SQRT1_2);
  });

  it('holds the hanging arm pose instead of the T-pose', () => {
    const shoulder = new THREE.Bone();
    shoulder.name = 'mixamorigLeftShoulder';
    const arm = new THREE.Bone();
    arm.name = 'mixamorigLeftArm';
    arm.position.set(1, 0, 0);
    const hand = new THREE.Bone();
    hand.name = 'mixamorigLeftHand';
    hand.position.set(1, 0, 0);
    shoulder.add(arm);
    arm.add(hand);
    const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    const clip = new THREE.AnimationClip('mixamo.com', 1, [
      new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0, 1], [0, 0, 0, 1, down.x, down.y, down.z, down.w]),
    ]);
    const idle = idleArmsClip(shoulder, clip, new Set(['mixamorigLeftArm']));
    const track = idle.tracks[0];
    expect(track?.name).toBe('mixamorigLeftArm.quaternion');
    expect(track?.values[0]).toBeCloseTo(down.x);
    expect(track?.values[3]).toBeCloseTo(down.w);
    expect(track?.values[4]).toBeCloseTo(track?.values[0] ?? 0);
  });
});