import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { deriveLook } from './look';
import { bodyMetrics } from './metrics';
import type { CharacterConfig, FacialHairStyle, HairStyle, HeadwearStyle, ShoeStyle } from './types';
import { makePrintTexture } from '../world/meshes';

export interface AvatarMotion {
  speed: number;
  emote: 'none' | 'dance';
}

interface AvatarProps {
  config: CharacterConfig;
  motion?: { current: AvatarMotion };
}

export function Avatar({ config, motion }: AvatarProps) {
  const look = deriveLook(config);
  const metrics = bodyMetrics(config);
  const bob = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const blend = useRef(0);
  const time = useRef(0);

  const pattern = useMemo(
    () => (look.torsoPattern || look.skirtPattern ? makePrintTexture(look.skirtPattern ? look.skirtColor : look.torsoColor) : null),
    [look.skirtColor, look.skirtPattern, look.torsoColor, look.torsoPattern],
  );
  useEffect(() => () => pattern?.dispose(), [pattern]);

  useFrame((_, dt) => {
    const speed = motion?.current.speed ?? 0;
    const dancing = motion?.current.emote === 'dance';
    const moving = speed > 0.25 || dancing;
    const run = speed > 3.5 || dancing;
    time.current += dt;
    if (moving) phase.current += dt * (run ? 11.5 : 7);
    blend.current = THREE.MathUtils.damp(blend.current, moving ? 1 : 0, 8, dt);
    const swing = Math.sin(phase.current) * (run ? 0.9 : 0.52) * blend.current;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftKnee.current) leftKnee.current.rotation.x = Math.max(0, -Math.sin(phase.current)) * 1.15 * blend.current;
    if (rightKnee.current) rightKnee.current.rotation.x = Math.max(0, Math.sin(phase.current)) * 1.15 * blend.current;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.75;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.75;
    if (spine.current) {
      const breathe = Math.sin(time.current * 1.7) * 0.012;
      spine.current.rotation.x = (run ? 0.16 : 0.045) * blend.current + breathe * (1 - blend.current);
    }
    if (bob.current) bob.current.position.y = Math.abs(Math.cos(phase.current)) * 0.035 * blend.current;
  });

  const shoulderX = 0.06 * metrics.shoulder + 0.11;
  const hipX = 0.06 * metrics.hip + 0.05;
  const heightScale = metrics.height / 1.74;
  const sleeveUpper = look.sleeve === 'none' ? look.skin : look.sleeveColor;
  const sleeveLower = look.sleeve === 'long' ? look.sleeveColor : look.skin;
  const legUpper = look.trouser === 'none' ? look.skin : look.trouserColor;
  const legLower = look.trouser === 'full' ? look.trouserColor : look.skin;

  return (
    <group scale={heightScale} position={[0, look.shoeLift, 0]}>
      <group ref={bob}>
        <Leg
          side={-1}
          x={hipX}
          upperColor={legUpper}
          lowerColor={legLower}
          upperRadius={look.trouser === 'none' ? 0.07 : 0.082}
          lowerRadius={look.trouser === 'full' ? 0.07 : 0.058}
          legRef={leftLeg}
          kneeRef={leftKnee}
          shoe={look.shoe}
          shoeColor={look.shoeColor}
        />
        <Leg
          side={1}
          x={hipX}
          upperColor={legUpper}
          lowerColor={legLower}
          upperRadius={look.trouser === 'none' ? 0.07 : 0.082}
          lowerRadius={look.trouser === 'full' ? 0.07 : 0.058}
          legRef={rightLeg}
          kneeRef={rightKnee}
          shoe={look.shoe}
          shoeColor={look.shoeColor}
        />
        {look.skirt !== 'none' ? (
          <mesh position={[0, look.skirt === 'ankle' ? 0.5 : look.skirt === 'knee' ? 0.68 : 0.78, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[
                Math.max(0.18, 0.16 * metrics.waist),
                look.skirt === 'short' ? 0.24 : look.skirt === 'ankle' ? 0.34 : 0.28,
                look.skirt === 'ankle' ? 0.92 : look.skirt === 'knee' ? 0.55 : 0.32,
                28,
              ]}
            />
            <meshStandardMaterial
              color={look.skirtPattern ? '#ffffff' : look.skirtColor}
              map={look.skirtPattern ? pattern : undefined}
              roughness={0.72}
            />
          </mesh>
        ) : null}
        <group ref={spine}>
          <mesh position={[0, 0.84, 0]} scale={[metrics.hip, 0.7, 0.9]} castShadow receiveShadow>
            <sphereGeometry args={[0.16, 20, 14]} />
            <meshStandardMaterial
              color={look.trouser === 'none' ? (look.skirt === 'none' ? look.skin : look.skirtColor) : look.trouserColor}
              roughness={0.74}
            />
          </mesh>
          <mesh position={[0, 1.02, 0]} castShadow receiveShadow scale={[metrics.chest * look.bulk, 1, look.bulk * 0.86]}>
            <cylinderGeometry args={[0.15, 0.145, 0.78, 24]} />
            <meshStandardMaterial
              color={look.torsoPattern ? '#ffffff' : look.torsoColor}
              map={look.torsoPattern ? pattern : undefined}
              roughness={0.72}
            />
          </mesh>
          <mesh position={[0, 1.44, 0.015]} castShadow>
            <capsuleGeometry args={[0.052, 0.08, 4, 10]} />
            <meshStandardMaterial color={look.face} roughness={0.58} />
          </mesh>
          {look.collar ? (
            <group position={[0, 1.36, 0.07]}>
              <mesh position={[-0.045, 0, 0]} rotation={[0.5, 0.4, 0.2]} castShadow>
                <boxGeometry args={[0.07, 0.09, 0.012]} />
                <meshStandardMaterial color={look.torsoColor} roughness={0.7} />
              </mesh>
              <mesh position={[0.045, 0, 0]} rotation={[0.5, -0.4, -0.2]} castShadow>
                <boxGeometry args={[0.07, 0.09, 0.012]} />
                <meshStandardMaterial color={look.torsoColor} roughness={0.7} />
              </mesh>
            </group>
          ) : null}
          {look.cargo
            ? [-1, 1].map((side) => (
                <mesh key={`cargo-${side}`} position={[side * (hipX + 0.07), 0.62, 0.07]} castShadow>
                  <boxGeometry args={[0.07, 0.09, 0.035]} />
                  <meshStandardMaterial color={look.trouserColor} roughness={0.8} />
                </mesh>
              ))
            : null}
          {config.accessories.chain ? (
            <mesh position={[0, 1.5, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.075, 0.006, 8, 24]} />
              <meshStandardMaterial color="#d7b07a" metalness={0.86} roughness={0.22} />
            </mesh>
          ) : null}
          <Arm
            side={-1}
            x={shoulderX}
            armRef={leftArm}
            upper={sleeveUpper}
            lower={sleeveLower}
            skin={look.skin}
            nails={config.nails.style === 'natural' ? look.skin : config.nails.color}
            nailStyle={config.nails.style}
            watch={false}
          />
          <Arm
            side={1}
            x={shoulderX}
            armRef={rightArm}
            upper={sleeveUpper}
            lower={sleeveLower}
            skin={look.skin}
            nails={config.nails.style === 'natural' ? look.skin : config.nails.color}
            nailStyle={config.nails.style}
            watch={config.accessories.watch}
          />
          <group position={[0, 1.56, 0]}>
            <Head config={config} lookFace={look.face} lookLip={look.lip} />
            <group position={[0, 0.035, -0.03]}>
              <Hair style={config.hair.style} color={look.hair} />
            </group>
            {look.hood ? <Hood color={look.sleeveColor} /> : null}
            <Headwear style={config.accessories.headwear} color={config.accessories.headwearColor} lift={config.hair.style === 'afro' || config.hair.style === 'long-coils' ? 0.06 : 0} />
            <Beard style={look.facialHair} color={config.facialHair.color} />
          </group>
        </group>
        <Bag config={config} />
      </group>
    </group>
  );
}

function Head({ config, lookFace, lookLip }: { config: CharacterConfig; lookFace: string; lookLip: string }) {
  const face = config.face;
  const eyeX = 0.036 + face.eyeSpacing * 0.028;
  const eyeScale = 0.75 + face.eyeSize * 0.55;
  const eyeY = 0.02 + (face.forehead - 0.5) * 0.02;
  const eyeZ = 0.112;
  return (
    <group>
      <mesh scale={[0.86 + face.shape * 0.32, 0.92 + face.forehead * 0.2, 0.96]} castShadow receiveShadow>
        <sphereGeometry args={[0.115, 32, 24]} />
        <meshStandardMaterial color={lookFace} roughness={0.56} />
      </mesh>
      <mesh position={[0, -0.075 - (face.chin - 0.5) * 0.03, 0.02]} scale={[0.72 + face.jaw * 0.55, 0.5 + face.chin * 0.35, 0.72]} castShadow>
        <sphereGeometry args={[0.07, 22, 16]} />
        <meshStandardMaterial color={lookFace} roughness={0.56} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.055, -0.02, 0.045]} scale={0.65 + face.cheeks * 0.9} castShadow>
          <sphereGeometry args={[0.038, 16, 12]} />
          <meshStandardMaterial color={lookFace} roughness={0.56} />
        </mesh>
      ))}
      {config.makeup.blush
        ? [-1, 1].map((side) => (
            <mesh key={`blush-${side}`} position={[side * 0.05, -0.03, 0.07]} scale={[1, 0.7, 0.4]}>
              <sphereGeometry args={[0.028, 12, 8]} />
              <meshStandardMaterial color={config.makeup.blush ?? lookFace} transparent opacity={0.55} roughness={0.6} />
            </mesh>
          ))
        : null}
      {[-1, 1].map((side) => (
        <mesh key={`ear-${side}`} position={[side * (0.1 + face.shape * 0.02), -0.01, 0]} scale={[0.7, 1, 0.55]} castShadow>
          <sphereGeometry args={[0.028, 12, 10]} />
          <meshStandardMaterial color={lookFace} roughness={0.58} />
        </mesh>
      ))}
      <mesh position={[0, -0.012, 0.112]} rotation={[Math.PI / 2, 0, 0]} scale={[0.65 + face.noseWidth * 0.8, 0.75 + face.noseLength * 0.7, 0.7 + face.noseLength * 0.45]} castShadow>
        <coneGeometry args={[0.022, 0.055, 14]} />
        <meshStandardMaterial color={lookFace} roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.055, 0.112]} scale={[1.15, 0.4 + face.lipFullness * 1.05, 0.62]} castShadow>
        <sphereGeometry args={[0.03, 18, 12]} />
        <meshStandardMaterial color={lookLip} roughness={0.42} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`eye-${side}`} position={[side * eyeX, eyeY, eyeZ]} scale={eyeScale}>
          <mesh>
            <sphereGeometry args={[0.02, 16, 12]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <sphereGeometry args={[0.011, 14, 10]} />
            <meshStandardMaterial color={face.eyeColor} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.0055, 10, 8]} />
            <meshStandardMaterial color="#140e0c" />
          </mesh>
          {config.makeup.eyeliner > 0.04 ? (
            <mesh position={[0, 0, -0.002]} scale={[1.25, 0.85, 0.4]}>
              <sphereGeometry args={[0.02, 12, 8]} />
              <meshStandardMaterial color="#16110e" transparent opacity={Math.min(0.9, config.makeup.eyeliner)} />
            </mesh>
          ) : null}
          {config.makeup.eyeshadow ? (
            <mesh position={[0, 0.012, 0.004]} scale={[1.15, 0.45, 0.35]}>
              <sphereGeometry args={[0.02, 12, 8]} />
              <meshStandardMaterial color={config.makeup.eyeshadow} transparent opacity={0.85} roughness={0.5} />
            </mesh>
          ) : null}
          {config.makeup.lashes > 0.04 ? (
            <mesh position={[0, 0.018, 0.008]} scale={[1, 0.35 + config.makeup.lashes, 1]}>
              <boxGeometry args={[0.034, 0.008, 0.01]} />
              <meshStandardMaterial color="#16110e" />
            </mesh>
          ) : null}
          <mesh position={[side * -0.01, 0.04 + (face.brow - 0.5) * 0.03, 0]} rotation={[0, 0, side * (face.brow - 0.5) * -0.5]}>
            <boxGeometry args={[0.04, 0.008, 0.012]} />
            <meshStandardMaterial color={config.makeup.browColor || config.hair.color} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {config.accessories.glasses ? (
        <group position={[0, eyeY, eyeZ]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * eyeX, 0, 0]}>
              <torusGeometry args={[0.024 * eyeScale, 0.0032, 8, 18]} />
              <meshStandardMaterial color="#1b1a17" metalness={0.4} roughness={0.3} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[Math.max(0.01, eyeX * 2 - 0.04), 0.004, 0.004]} />
            <meshStandardMaterial color="#1b1a17" />
          </mesh>
        </group>
      ) : null}
      {config.accessories.earrings
        ? [-1, 1].map((side) => (
            <mesh key={`jewel-${side}`} position={[side * 0.125, -0.05, 0.01]}>
              <sphereGeometry args={[0.012, 10, 8]} />
              <meshStandardMaterial color="#d7b07a" metalness={0.8} roughness={0.25} />
            </mesh>
          ))
        : null}
    </group>
  );
}

function hairMaterial(color: string) {
  return <meshStandardMaterial color={color} roughness={0.78} />;
}

export function Hair({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'afro':
      return (
        <mesh position={[0, 0.06, -0.04]} scale={[1.12, 0.92, 1.02]} castShadow>
          <sphereGeometry args={[0.14, 28, 20]} />
          {hairMaterial(color)}
        </mesh>
      );
    case 'short-fade':
      return (
        <mesh position={[0, 0.045, 0]} scale={[1.05, 0.72, 1.05]} castShadow>
          <sphereGeometry args={[0.125, 24, 16]} />
          {hairMaterial(color)}
        </mesh>
      );
    case 'buzz':
      return (
        <mesh position={[0, 0.05, 0]} scale={[1.02, 0.48, 1.02]} castShadow>
          <sphereGeometry args={[0.12, 20, 12]} />
          {hairMaterial(color)}
        </mesh>
      );
    case 'waves':
      return (
        <group>
          <mesh position={[0, 0.04, 0]} scale={[1.06, 0.62, 1.08]} castShadow>
            <sphereGeometry args={[0.124, 22, 14]} />
            {hairMaterial(color)}
          </mesh>
          <mesh position={[0, 0.02, 0.02]} scale={[1.12, 0.28, 0.7]} castShadow>
            <sphereGeometry args={[0.11, 16, 10]} />
            {hairMaterial(color)}
          </mesh>
        </group>
      );
    case 'cornrows':
      return <Strands count={7} radius={0.011} length={0.18} y={0.1} color={color} spread={0.03} along="z" />;
    case 'box-braids':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} scale={[1.04, 0.55, 1.04]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            {hairMaterial(color)}
          </mesh>
          <Strands count={10} radius={0.012} length={0.34} y={-0.08} color={color} />
        </group>
      );
    case 'locs':
      return <Strands count={8} radius={0.016} length={0.42} y={-0.1} color={color} spread={0.04} />;
    case 'twists':
      return <Strands count={9} radius={0.013} length={0.3} y={-0.05} color={color} />;
    case 'ponytail':
      return (
        <group>
          <mesh position={[0, 0.03, -0.02]} scale={[1.05, 0.7, 1.02]} castShadow>
            <sphereGeometry args={[0.12, 20, 14]} />
            {hairMaterial(color)}
          </mesh>
          <mesh position={[0, 0.02, -0.12]} castShadow>
            <sphereGeometry args={[0.045, 14, 12]} />
            {hairMaterial(color)}
          </mesh>
          <mesh position={[0, -0.12, -0.12]} castShadow>
            <capsuleGeometry args={[0.028, 0.22, 4, 8]} />
            {hairMaterial(color)}
          </mesh>
        </group>
      );
    case 'bob':
      return (
        <mesh position={[0, -0.01, 0]} scale={[1.12, 0.95, 1.08]} castShadow>
          <sphereGeometry args={[0.14, 24, 16]} />
          {hairMaterial(color)}
        </mesh>
      );
    case 'long-coils':
      return (
        <group>
          <mesh position={[0, 0.04, 0]} scale={[1.08, 0.7, 1.05]} castShadow>
            <sphereGeometry args={[0.125, 18, 12]} />
            {hairMaterial(color)}
          </mesh>
          <Strands count={12} radius={0.014} length={0.55} y={-0.16} color={color} spread={0.038} />
        </group>
      );
    case 'headwrap':
      return (
        <group>
          <mesh rotation={[Math.PI / 2.3, 0.2, 0]} castShadow>
            <torusGeometry args={[0.12, 0.048, 12, 24]} />
            {hairMaterial(color)}
          </mesh>
          <mesh position={[0.09, 0.03, 0.05]} castShadow>
            <sphereGeometry args={[0.045, 14, 12]} />
            {hairMaterial(color)}
          </mesh>
        </group>
      );
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

function Strands({
  count,
  radius,
  length,
  y,
  color,
  spread = 0.042,
  along = 'y',
}: {
  count: number;
  radius: number;
  length: number;
  y: number;
  color: string;
  spread?: number;
  along?: 'y' | 'z';
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, index) => {
        const cols = Math.min(count, along === 'z' ? count : 5);
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = (col - (cols - 1) / 2) * spread;
        const z = along === 'z' ? 0 : row === 0 ? 0.02 : -0.045;
        return (
          <mesh key={index} position={[x, y, z]} rotation={along === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} castShadow>
            <capsuleGeometry args={[radius, length, 3, 6]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Beard({ style, color }: { style: FacialHairStyle; color: string }) {
  if (style === 'none') return null;
  return (
    <group>
      {style === 'stubble' || style === 'full-beard' || style === 'goatee' ? (
        <mesh position={[0, -0.09, 0.04]} scale={style === 'stubble' ? [0.9, 0.55, 0.7] : [1.15, 0.85, 0.85]}>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshStandardMaterial color={color} roughness={1} transparent opacity={style === 'stubble' ? 0.55 : 1} />
        </mesh>
      ) : null}
      {style === 'moustache' || style === 'full-beard' ? (
        <mesh position={[0, -0.045, 0.1]} scale={[1.4, 0.45, 0.45]}>
          <sphereGeometry args={[0.028, 12, 8]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Headwear({ style, color, lift }: { style: HeadwearStyle; color: string; lift: number }) {
  switch (style) {
    case 'none':
      return null;
    case 'cap':
      return (
        <group position={[0, 0.08 + lift, 0.02]}>
          <mesh scale={[1.05, 0.55, 1.05]} castShadow>
            <sphereGeometry args={[0.12, 18, 12]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.02, 0.1]} rotation={[0.3, 0, 0]} castShadow>
            <boxGeometry args={[0.12, 0.012, 0.08]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'bucket':
      return (
        <group position={[0, 0.1 + lift, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.12, 0.08, 20]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.04, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.015, 24]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
        </group>
      );
    case 'brim':
      return (
        <group position={[0, 0.12 + lift, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.1, 20]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.05, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.012, 24]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'beret':
      return (
        <mesh position={[0, 0.1 + lift, 0.02]} rotation={[0.25, 0, 0.15]} scale={[1.15, 0.28, 1.05]} castShadow>
          <sphereGeometry args={[0.12, 20, 12]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
      );
    case 'kufi':
      return (
        <mesh position={[0, 0.09 + lift, 0]} scale={[1, 0.55, 1]} castShadow>
          <sphereGeometry args={[0.12, 18, 12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      );
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

function Hood({ color }: { color: string }) {
  return (
    <mesh position={[0, 0.02, -0.04]} scale={[1.15, 1.05, 0.8]} castShadow>
      <sphereGeometry args={[0.14, 18, 12]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Arm({
  side,
  x,
  armRef,
  upper,
  lower,
  skin,
  nails,
  nailStyle,
  watch,
}: {
  side: -1 | 1;
  x: number;
  armRef: { current: THREE.Group | null };
  upper: string;
  lower: string;
  skin: string;
  nails: string;
  nailStyle: CharacterConfig['nails']['style'];
  watch: boolean;
}) {
  return (
    <group ref={armRef} position={[side * x, 1.3, 0.02]} rotation={[0.06, 0, side * -0.1]}>
      <mesh position={[0, -0.16, 0]} castShadow>
        <capsuleGeometry args={[upper === skin ? 0.048 : 0.055, 0.22, 4, 10]} />
        <meshStandardMaterial color={upper} roughness={0.72} />
      </mesh>
      <group position={[0, -0.3, 0.01]}>
        <mesh position={[0, -0.14, 0]} castShadow>
          <capsuleGeometry args={[lower === skin ? 0.042 : 0.048, 0.2, 4, 8]} />
          <meshStandardMaterial color={lower} roughness={0.72} />
        </mesh>
        <mesh position={[0, -0.32, 0.02]} castShadow>
          <sphereGeometry args={[0.04, 12, 10]} />
          <meshStandardMaterial color={skin} roughness={0.58} />
        </mesh>
        <mesh position={[0, -0.34, 0.05]} scale={nailStyle === 'long' ? [1, 1, 1.8] : [1, 1, 1]}>
          <boxGeometry args={[0.045, 0.012, 0.02]} />
          <meshStandardMaterial color={nails} roughness={0.4} />
        </mesh>
        {watch ? (
          <mesh position={[0, -0.28, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.045, 0.008, 8, 16]} />
            <meshStandardMaterial color="#1b1a17" metalness={0.5} roughness={0.35} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function Leg({
  side,
  x,
  upperColor,
  lowerColor,
  upperRadius,
  lowerRadius,
  legRef,
  kneeRef,
  shoe,
  shoeColor,
}: {
  side: -1 | 1;
  x: number;
  upperColor: string;
  lowerColor: string;
  upperRadius: number;
  lowerRadius: number;
  legRef: { current: THREE.Group | null };
  kneeRef: { current: THREE.Group | null };
  shoe: ShoeStyle;
  shoeColor: string;
}) {
  return (
    <group ref={legRef} position={[side * x, 0.8, 0]}>
      <mesh position={[0, -0.2, 0]} castShadow>
        <capsuleGeometry args={[upperRadius + 0.012, 0.34, 4, 10]} />
        <meshStandardMaterial color={upperColor} roughness={0.74} />
      </mesh>
      <group ref={kneeRef} position={[0, -0.36, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[lowerRadius + 0.008, 0.28, 4, 8]} />
          <meshStandardMaterial color={lowerColor} roughness={0.74} />
        </mesh>
        <Shoe style={shoe} color={shoeColor} />
      </group>
    </group>
  );
}

function Shoe({ style, color }: { style: ShoeStyle; color: string }) {
  const sole = '#ece7df';
  switch (style) {
    case 'sneakers':
      return (
        <group position={[0, -0.3, 0.04]}>
          <mesh position={[0, 0.04, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.06, 0.2]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.005, 0.02]}>
            <boxGeometry args={[0.095, 0.02, 0.21]} />
            <meshStandardMaterial color={sole} />
          </mesh>
        </group>
      );
    case 'trainers':
      return (
        <group position={[0, -0.3, 0.03]}>
          <mesh position={[0, 0.035, 0.02]} castShadow>
            <boxGeometry args={[0.08, 0.05, 0.18]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.008, 0.02]}>
            <boxGeometry args={[0.085, 0.016, 0.19]} />
            <meshStandardMaterial color={sole} />
          </mesh>
        </group>
      );
    case 'loafers':
      return (
        <mesh position={[0, -0.28, 0.04]} castShadow>
          <boxGeometry args={[0.08, 0.045, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
        </mesh>
      );
    case 'heels':
      return (
        <group position={[0, -0.28, 0.03]}>
          <mesh position={[0, 0.05, 0.03]} castShadow>
            <boxGeometry args={[0.075, 0.04, 0.14]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.01, -0.05]} castShadow>
            <boxGeometry args={[0.03, 0.07, 0.03]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        </group>
      );
    case 'sandals':
      return (
        <group position={[0, -0.28, 0.03]}>
          <mesh position={[0, 0.01, 0.02]}>
            <boxGeometry args={[0.08, 0.015, 0.18]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.035, 0.05]}>
            <boxGeometry args={[0.08, 0.012, 0.02]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case 'boots':
      return (
        <group position={[0, -0.22, 0.03]}>
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.2, 0.18]} />
            <meshStandardMaterial color={color} roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.09, 0.02]}>
            <boxGeometry args={[0.095, 0.02, 0.19]} />
            <meshStandardMaterial color="#2a241c" />
          </mesh>
        </group>
      );
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

function Bag({ config }: { config: CharacterConfig }) {
  const { bag, bagColor } = config.accessories;
  if (bag === 'none') return null;
  if (bag === 'tote') {
    return (
      <mesh position={[0.22, 0.78, 0.02]} castShadow>
        <boxGeometry args={[0.12, 0.16, 0.06]} />
        <meshStandardMaterial color={bagColor} roughness={0.7} />
      </mesh>
    );
  }
  if (bag === 'crossbody') {
    return (
      <group>
        <mesh position={[-0.2, 0.72, 0.12]} castShadow>
          <boxGeometry args={[0.1, 0.12, 0.04]} />
          <meshStandardMaterial color={bagColor} roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.15, 0.06]} rotation={[0.2, 0, 0.5]}>
          <boxGeometry args={[0.02, 0.42, 0.012]} />
          <meshStandardMaterial color={bagColor} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 1.15, -0.12]} castShadow>
      <boxGeometry args={[0.16, 0.2, 0.08]} />
      <meshStandardMaterial color={bagColor} roughness={0.7} />
    </mesh>
  );
}
