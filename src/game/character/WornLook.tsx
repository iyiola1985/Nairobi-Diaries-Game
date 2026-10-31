import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Beard, Hair, Headwear } from './Avatar';
import { deriveLook } from './look';
import type { CharacterConfig, ShoeStyle } from './types';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);

const TORSO = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.072, 0.5),
    new THREE.Vector2(0.1, 0.44),
    new THREE.Vector2(0.155, 0.34),
    new THREE.Vector2(0.132, 0.2),
    new THREE.Vector2(0.128, 0.08),
    new THREE.Vector2(0.15, 0.0),
  ],
  32,
);
const DRESS = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.078, 0.58),
    new THREE.Vector2(0.15, 0.46),
    new THREE.Vector2(0.145, 0.28),
    new THREE.Vector2(0.17, 0.08),
    new THREE.Vector2(0.21, -0.16),
    new THREE.Vector2(0.25, -0.42),
  ],
  36,
);
const SKIRT = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.145, 0.02),
    new THREE.Vector2(0.16, -0.06),
    new THREE.Vector2(0.2, -0.18),
    new THREE.Vector2(0.24, -0.32),
  ],
  36,
);
const ARM = new THREE.CapsuleGeometry(0.04, 0.18, 8, 16);
const LEG = new THREE.CapsuleGeometry(0.052, 0.18, 8, 16);
const ARM_LEN = 0.04 * 2 + 0.18;
const LEG_LEN = 0.052 * 2 + 0.18;

function named(root: THREE.Object3D, boneName: string): THREE.Object3D | null {
  return root.getObjectByName(boneName) ?? null;
}

function placeAt(holder: THREE.Object3D, node: THREE.Object3D, target: THREE.Object3D) {
  node.getWorldPosition(_a);
  holder.worldToLocal(_a);
  target.position.copy(_a);
  target.quaternion.identity();
  target.visible = true;
}

function placeSegment(holder: THREE.Object3D, from: THREE.Object3D, to: THREE.Object3D, target: THREE.Object3D, along: number): number {
  from.getWorldPosition(_a);
  to.getWorldPosition(_b);
  holder.worldToLocal(_a);
  holder.worldToLocal(_b);
  target.position.lerpVectors(_a, _b, along);
  _dir.subVectors(_b, _a);
  const length = _dir.length();
  if (length < 1e-4) {
    target.visible = false;
    return 0;
  }
  _dir.multiplyScalar(1 / length);
  target.quaternion.setFromUnitVectors(UP, _dir);
  target.visible = true;
  return length;
}

function fitLength(target: THREE.Object3D, length: number, unit: number, thick: number) {
  target.scale.set(thick, Math.max(length, 0.04) / unit, thick);
}

function sampleSkin(root: THREE.Object3D): string | null {
  let found: string | null = null;
  root.traverse((node) => {
    if (found || !(node instanceof THREE.Mesh)) return;
    const source = Array.isArray(node.material) ? node.material[0] : node.material;
    if (!source || !('map' in source)) return;
    const map = source.map;
    const image = map?.image as CanvasImageSource | undefined;
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const width = 'width' in image ? Number(image.width) : 0;
    const height = 'height' in image ? Number(image.height) : 0;
    if (width < 4 || height < 4) return;
    try {
      context.drawImage(image, width * 0.45, height * 0.22, 12, 12, 0, 0, 4, 4);
      const pixel = context.getImageData(2, 2, 1, 1).data;
      const red = pixel[0] ?? 0;
      const green = pixel[1] ?? 0;
      const blue = pixel[2] ?? 0;
      found = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
    } catch {
      found = null;
    }
  });
  return found;
}

function Surface({ color, rough = 0.58 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0.02} />;
}

function FootWear({ style, color }: { style: ShoeStyle; color: string }) {
  switch (style) {
    case 'sneakers':
    case 'trainers':
      return (
        <group position={[0, -0.045, 0.03]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.045, 0.1, 6, 12]} />
            <Surface color={color} rough={0.48} />
          </mesh>
          <mesh position={[0, -0.04, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.02, 0.12, 4, 10]} />
            <meshStandardMaterial color="#ece7df" roughness={0.7} />
          </mesh>
        </group>
      );
    case 'loafers':
      return (
        <mesh position={[0, -0.04, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.04, 0.09, 6, 12]} />
          <Surface color={color} rough={0.42} />
        </mesh>
      );
    case 'heels':
      return (
        <group position={[0, -0.02, 0.03]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.036, 0.08, 6, 12]} />
            <Surface color={color} rough={0.38} />
          </mesh>
          <mesh position={[0, -0.045, -0.04]} castShadow>
            <cylinderGeometry args={[0.012, 0.016, 0.07, 10]} />
            <Surface color={color} rough={0.38} />
          </mesh>
        </group>
      );
    case 'sandals':
      return (
        <group position={[0, -0.055, 0.03]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.016, 0.11, 4, 10]} />
            <Surface color={color} rough={0.55} />
          </mesh>
          <mesh position={[0, 0.025, 0.02]}>
            <boxGeometry args={[0.07, 0.01, 0.018]} />
            <Surface color={color} />
          </mesh>
        </group>
      );
    case 'boots':
      return (
        <group position={[0, 0.02, 0.02]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.05, 0.16, 8, 14]} />
            <Surface color={color} rough={0.55} />
          </mesh>
        </group>
      );
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

export function WornLook({ config, rig }: { config: CharacterConfig; rig: THREE.Object3D }) {
  const look = deriveLook(config);
  const gl = useThree((state) => state.gl);
  const [skinHex, setSkinHex] = useState(config.skin);
  const head = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const gown = useRef<THREE.Group>(null);
  const skirt = useRef<THREE.Group>(null);
  const bagAnchor = useRef<THREE.Group>(null);
  const leftUpper = useRef<THREE.Group>(null);
  const rightUpper = useRef<THREE.Group>(null);
  const leftLower = useRef<THREE.Group>(null);
  const rightLower = useRef<THREE.Group>(null);
  const leftSleeve = useRef<THREE.Group>(null);
  const rightSleeve = useRef<THREE.Group>(null);
  const leftForeSleeve = useRef<THREE.Group>(null);
  const rightForeSleeve = useRef<THREE.Group>(null);
  const leftThigh = useRef<THREE.Group>(null);
  const rightThigh = useRef<THREE.Group>(null);
  const leftCalf = useRef<THREE.Group>(null);
  const rightCalf = useRef<THREE.Group>(null);
  const leftClothThigh = useRef<THREE.Group>(null);
  const rightClothThigh = useRef<THREE.Group>(null);
  const leftClothCalf = useRef<THREE.Group>(null);
  const rightClothCalf = useRef<THREE.Group>(null);
  const leftShoulder = useRef<THREE.Mesh>(null);
  const rightShoulder = useRef<THREE.Mesh>(null);
  const leftHip = useRef<THREE.Mesh>(null);
  const rightHip = useRef<THREE.Mesh>(null);
  const leftFoot = useRef<THREE.Group>(null);
  const rightFoot = useRef<THREE.Group>(null);
  const leftHand = useRef<THREE.Group>(null);
  const rightHand = useRef<THREE.Group>(null);

  useEffect(() => {
    gl.localClippingEnabled = true;
    const copies: THREE.Material[] = [];
    rig.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const source = Array.isArray(node.material) ? node.material : [node.material];
      const next = source.map((material) => {
        const copy = material.clone();
        copy.clippingPlanes = [clipPlane];
        copy.clipShadows = true;
        copies.push(copy);
        return copy;
      });
      node.material = Array.isArray(node.material) ? next : next[0] ?? node.material;
    });
    const sampled = sampleSkin(rig);
    if (sampled) setSkinHex(sampled);
    return () => {
      copies.forEach((material) => material.dispose());
    };
  }, [gl, rig]);

  useFrame(() => {
    const holder = head.current?.parent;
    const neckBone = named(rig, 'mixamorigNeck');
    if (!holder || !neckBone) return;
    neckBone.getWorldPosition(_a);
    clipPlane.constant = -(_a.y - 0.04);

    const headBone = named(rig, 'mixamorigHead');
    const chest = named(rig, 'mixamorigSpine2');
    const hipBone = named(rig, 'mixamorigHips');
    const leftArm = named(rig, 'mixamorigLeftArm');
    const rightArm = named(rig, 'mixamorigRightArm');
    const leftFore = named(rig, 'mixamorigLeftForeArm');
    const rightFore = named(rig, 'mixamorigRightForeArm');
    const leftHandBone = named(rig, 'mixamorigLeftHand');
    const rightHandBone = named(rig, 'mixamorigRightHand');
    const leftUp = named(rig, 'mixamorigLeftUpLeg');
    const rightUp = named(rig, 'mixamorigRightUpLeg');
    const leftLeg = named(rig, 'mixamorigLeftLeg');
    const rightLeg = named(rig, 'mixamorigRightLeg');
    const leftFootBone = named(rig, 'mixamorigLeftFoot');
    const rightFootBone = named(rig, 'mixamorigRightFoot');
    if (!headBone || !chest || !hipBone || !leftArm || !rightArm || !leftFore || !rightFore || !leftHandBone || !rightHandBone || !leftUp || !rightUp || !leftLeg || !rightLeg || !leftFootBone || !rightFootBone) return;
    if (!head.current || !neck.current || !torso.current || !gown.current || !skirt.current || !bagAnchor.current) return;
    if (!leftUpper.current || !rightUpper.current || !leftLower.current || !rightLower.current) return;
    if (!leftSleeve.current || !rightSleeve.current || !leftForeSleeve.current || !rightForeSleeve.current) return;
    if (!leftThigh.current || !rightThigh.current || !leftCalf.current || !rightCalf.current) return;
    if (!leftClothThigh.current || !rightClothThigh.current || !leftClothCalf.current || !rightClothCalf.current) return;
    if (!leftFoot.current || !rightFoot.current || !leftHand.current || !rightHand.current) return;
    if (!leftShoulder.current || !rightShoulder.current || !leftHip.current || !rightHip.current) return;

    placeAt(holder, headBone, head.current);
    placeAt(holder, neckBone, neck.current);
    placeAt(holder, neckBone, torso.current);
    placeAt(holder, neckBone, gown.current);
    placeAt(holder, hipBone, skirt.current);
    placeAt(holder, chest, bagAnchor.current);
    placeAt(holder, leftFootBone, leftFoot.current);
    placeAt(holder, rightFootBone, rightFoot.current);
    placeAt(holder, leftHandBone, leftHand.current);
    placeAt(holder, rightHandBone, rightHand.current);
    placeAt(holder, leftArm, leftShoulder.current);
    placeAt(holder, rightArm, rightShoulder.current);
    placeAt(holder, leftUp, leftHip.current);
    placeAt(holder, rightUp, rightHip.current);

    neckBone.getWorldPosition(_a);
    hipBone.getWorldPosition(_b);
    const body = Math.max(0.45, _a.distanceTo(_b));
    leftArm.getWorldPosition(_a);
    rightArm.getWorldPosition(_b);
    const span = Math.max(0.28, _a.distanceTo(_b));
    const bulk = look.bulk * (config.clothing.top === 'tank' && config.clothing.dress === 'none' && config.clothing.outer === 'none' ? 0.92 : 1);
    const dressed = config.clothing.dress !== 'none' && config.clothing.outer === 'none';
    torso.current.visible = !dressed;
    torso.current.scale.set((span / 0.31) * bulk, body / 0.5, (span / 0.34) * bulk);
    gown.current.visible = dressed;
    const gownHeight = look.skirt === 'ankle' ? body + 0.9 : look.skirt === 'knee' ? body + 0.55 : body + 0.28;
    gown.current.scale.set(span / 0.32, gownHeight / 1.0, span / 0.34);
    skirt.current.visible = look.skirt !== 'none' && !dressed;
    const skirtScale = look.skirt === 'ankle' ? 2.15 : look.skirt === 'knee' ? 1.35 : 0.85;
    skirt.current.scale.set(1.05, skirtScale, 1.05);

    const sleeve = look.sleeve !== 'none';
    const long = look.sleeve === 'long';
    const leftUpperLength = placeSegment(holder, leftArm, leftFore, leftUpper.current, 0.5);
    const rightUpperLength = placeSegment(holder, rightArm, rightFore, rightUpper.current, 0.5);
    leftUpper.current.visible = !sleeve;
    rightUpper.current.visible = !sleeve;
    fitLength(leftUpper.current, leftUpperLength * 1.08, ARM_LEN, 0.92);
    fitLength(rightUpper.current, rightUpperLength * 1.08, ARM_LEN, 0.92);
    placeSegment(holder, leftArm, leftFore, leftSleeve.current, long ? 0.5 : 0.36);
    placeSegment(holder, rightArm, rightFore, rightSleeve.current, long ? 0.5 : 0.36);
    leftSleeve.current.visible = sleeve;
    rightSleeve.current.visible = sleeve;
    fitLength(leftSleeve.current, leftUpperLength * (long ? 0.98 : 0.62), ARM_LEN, 1.35 * bulk);
    fitLength(rightSleeve.current, rightUpperLength * (long ? 0.98 : 0.62), ARM_LEN, 1.35 * bulk);
    const leftLowerLength = placeSegment(holder, leftFore, leftHandBone, leftLower.current, 0.5);
    const rightLowerLength = placeSegment(holder, rightFore, rightHandBone, rightLower.current, 0.5);
    leftLower.current.visible = !long;
    rightLower.current.visible = !long;
    fitLength(leftLower.current, leftLowerLength * 1.08, ARM_LEN, 0.92);
    fitLength(rightLower.current, rightLowerLength * 1.08, ARM_LEN, 0.92);
    placeSegment(holder, leftFore, leftHandBone, leftForeSleeve.current, 0.48);
    placeSegment(holder, rightFore, rightHandBone, rightForeSleeve.current, 0.48);
    leftForeSleeve.current.visible = long;
    rightForeSleeve.current.visible = long;
    fitLength(leftForeSleeve.current, leftLowerLength * 0.96, ARM_LEN, 1.28 * bulk);
    fitLength(rightForeSleeve.current, rightLowerLength * 0.96, ARM_LEN, 1.28 * bulk);

    const clothLegs = look.trouser !== 'none';
    const shortLegs = look.trouser === 'short';
    const coverThigh = look.skirt === 'knee' || look.skirt === 'ankle';
    const leftThighLength = placeSegment(holder, leftUp, leftLeg, leftThigh.current, 0.5);
    const rightThighLength = placeSegment(holder, rightUp, rightLeg, rightThigh.current, 0.5);
    leftThigh.current.visible = !coverThigh;
    rightThigh.current.visible = !coverThigh;
    fitLength(leftThigh.current, leftThighLength * 1.12, LEG_LEN, look.cargo ? 1.15 : 1);
    fitLength(rightThigh.current, rightThighLength * 1.12, LEG_LEN, look.cargo ? 1.15 : 1);
    placeSegment(holder, leftUp, leftLeg, leftClothThigh.current, shortLegs ? 0.34 : 0.5);
    placeSegment(holder, rightUp, rightLeg, rightClothThigh.current, shortLegs ? 0.34 : 0.5);
    leftClothThigh.current.visible = clothLegs && !coverThigh;
    rightClothThigh.current.visible = clothLegs && !coverThigh;
    fitLength(leftClothThigh.current, leftThighLength * (shortLegs ? 0.55 : 0.96), LEG_LEN, look.cargo ? 1.28 : 1.12);
    fitLength(rightClothThigh.current, rightThighLength * (shortLegs ? 0.55 : 0.96), LEG_LEN, look.cargo ? 1.28 : 1.12);
    const leftCalfLength = placeSegment(holder, leftLeg, leftFootBone, leftCalf.current, 0.55);
    const rightCalfLength = placeSegment(holder, rightLeg, rightFootBone, rightCalf.current, 0.55);
    leftCalf.current.visible = !coverThigh;
    rightCalf.current.visible = !coverThigh;
    fitLength(leftCalf.current, leftCalfLength * 1.2, LEG_LEN, 0.9);
    fitLength(rightCalf.current, rightCalfLength * 1.2, LEG_LEN, 0.9);
    placeSegment(holder, leftLeg, leftFootBone, leftClothCalf.current, 0.52);
    placeSegment(holder, rightLeg, rightFootBone, rightClothCalf.current, 0.52);
    leftClothCalf.current.visible = clothLegs && !shortLegs && !coverThigh;
    rightClothCalf.current.visible = clothLegs && !shortLegs && !coverThigh;
    fitLength(leftClothCalf.current, leftCalfLength * 0.94, LEG_LEN, 1.02);
    fitLength(rightClothCalf.current, rightCalfLength * 0.94, LEG_LEN, 1.02);
  });

  const { bag, bagColor } = config.accessories;
  const skin = skinHex;
  const shoulderColor = look.sleeve === 'none' ? skin : look.sleeveColor;
  const hipColor = config.clothing.dress !== 'none' ? look.skirtColor : look.trouser !== 'none' ? look.trouserColor : skin;

  return (
    <group>
      <group ref={head}>
        <Hair style={config.hair.style} color={config.hair.color} />
        <Beard style={config.facialHair.style} color={config.facialHair.color} />
        <Headwear style={config.accessories.headwear} color={config.accessories.headwearColor} lift={look.hood ? 0.04 : 0} />
        {look.hood ? (
          <mesh position={[0, 0.02, -0.02]} scale={[1.08, 0.95, 0.82]} castShadow>
            <sphereGeometry args={[0.13, 24, 16]} />
            <Surface color={config.clothing.outerColor} />
          </mesh>
        ) : null}
        {config.accessories.glasses ? (
          <group position={[0, 0.02, 0.09]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.04, 0, 0]}>
                <torusGeometry args={[0.024, 0.0035, 10, 18]} />
                <meshStandardMaterial color="#1b1a17" metalness={0.4} roughness={0.3} />
              </mesh>
            ))}
            <mesh>
              <boxGeometry args={[0.018, 0.003, 0.003]} />
              <meshStandardMaterial color="#1b1a17" />
            </mesh>
          </group>
        ) : null}
        {config.accessories.earrings
          ? [-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.09, -0.05, 0.02]}>
                <sphereGeometry args={[0.012, 12, 10]} />
                <meshStandardMaterial color="#d7b07a" metalness={0.8} roughness={0.22} />
              </mesh>
            ))
          : null}
      </group>
      <group ref={neck}>
        <mesh position={[0, -0.02, 0.01]}>
          <sphereGeometry args={[0.07, 20, 14]} />
          <Surface color={skin} rough={0.62} />
        </mesh>
        {config.accessories.chain ? (
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.065, 0.006, 10, 20]} />
            <meshStandardMaterial color="#d7b07a" metalness={0.82} roughness={0.22} />
          </mesh>
        ) : null}
      </group>
      <group ref={torso}>
        <mesh position={[0, -0.5, 0.01]} geometry={TORSO} castShadow>
          <Surface color={look.torsoColor} />
        </mesh>
      </group>
      <group ref={gown}>
        <mesh position={[0, -0.58, 0.015]} geometry={DRESS} castShadow>
          <Surface color={look.skirtColor} />
        </mesh>
        {look.skirtPattern ? (
          <mesh position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.01, 8, 28]} />
            <meshStandardMaterial color="#c6a15b" roughness={0.5} />
          </mesh>
        ) : null}
      </group>
      <group ref={skirt}>
        <mesh geometry={SKIRT} castShadow>
          <Surface color={look.skirtColor} />
        </mesh>
      </group>
      <mesh ref={leftShoulder} castShadow>
        <sphereGeometry args={[0.07, 18, 14]} />
        <Surface color={shoulderColor} />
      </mesh>
      <mesh ref={rightShoulder} castShadow>
        <sphereGeometry args={[0.07, 18, 14]} />
        <Surface color={shoulderColor} />
      </mesh>
      <mesh ref={leftHip} castShadow>
        <sphereGeometry args={[0.09, 18, 14]} />
        <Surface color={hipColor} />
      </mesh>
      <mesh ref={rightHip} castShadow>
        <sphereGeometry args={[0.09, 18, 14]} />
        <Surface color={hipColor} />
      </mesh>
      <group ref={leftUpper}><mesh geometry={ARM} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={rightUpper}><mesh geometry={ARM} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={leftLower}><mesh geometry={ARM} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={rightLower}><mesh geometry={ARM} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={leftSleeve}><mesh geometry={ARM} castShadow><Surface color={look.sleeveColor} /></mesh></group>
      <group ref={rightSleeve}><mesh geometry={ARM} castShadow><Surface color={look.sleeveColor} /></mesh></group>
      <group ref={leftForeSleeve}><mesh geometry={ARM} castShadow><Surface color={look.sleeveColor} /></mesh></group>
      <group ref={rightForeSleeve}><mesh geometry={ARM} castShadow><Surface color={look.sleeveColor} /></mesh></group>
      <group ref={leftThigh}><mesh geometry={LEG} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={rightThigh}><mesh geometry={LEG} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={leftCalf}><mesh geometry={LEG} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={rightCalf}><mesh geometry={LEG} castShadow><Surface color={skin} rough={0.62} /></mesh></group>
      <group ref={leftClothThigh}><mesh geometry={LEG} castShadow><Surface color={look.trouserColor} /></mesh></group>
      <group ref={rightClothThigh}><mesh geometry={LEG} castShadow><Surface color={look.trouserColor} /></mesh></group>
      <group ref={leftClothCalf}><mesh geometry={LEG} castShadow><Surface color={look.trouserColor} /></mesh></group>
      <group ref={rightClothCalf}><mesh geometry={LEG} castShadow><Surface color={look.trouserColor} /></mesh></group>
      <group ref={leftFoot}><FootWear style={look.shoe} color={look.shoeColor} /></group>
      <group ref={rightFoot}><FootWear style={look.shoe} color={look.shoeColor} /></group>
      <group ref={leftHand}>
        <mesh>
          <sphereGeometry args={[0.038, 16, 12]} />
          <Surface color={skin} rough={0.6} />
        </mesh>
        {config.accessories.watch ? (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.034, 0.007, 8, 16]} />
            <meshStandardMaterial color="#1b1a17" metalness={0.5} roughness={0.32} />
          </mesh>
        ) : null}
      </group>
      <group ref={rightHand}>
        <mesh>
          <sphereGeometry args={[0.038, 16, 12]} />
          <Surface color={skin} rough={0.6} />
        </mesh>
      </group>
      <group ref={bagAnchor}>
        {bag === 'tote' ? (
          <mesh position={[0.18, -0.28, 0.1]} castShadow>
            <capsuleGeometry args={[0.05, 0.1, 4, 10]} />
            <Surface color={bagColor} />
          </mesh>
        ) : null}
        {bag === 'crossbody' ? (
          <mesh position={[-0.16, -0.34, 0.12]} castShadow>
            <capsuleGeometry args={[0.045, 0.08, 4, 10]} />
            <Surface color={bagColor} />
          </mesh>
        ) : null}
        {bag === 'backpack' ? (
          <mesh position={[0, -0.08, -0.14]} castShadow>
            <capsuleGeometry args={[0.08, 0.12, 6, 12]} />
            <Surface color={bagColor} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}
