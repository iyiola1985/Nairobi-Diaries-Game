import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarMotion } from '../character/Avatar';
import { FbxAvatar } from '../character/FbxAvatar';
import { liveCampaigns } from '../ads/campaigns';
import { useGame } from '../../store/useGame';
import { findOpen, hitsBuilding, hitsWall } from '../world/collision';
import { cbd, cityBounds, cityRoads, colliders, districtAt, districtLabel, wallColliders } from '../world/data';
import { driveLanes } from '../world/roads';
import { advanceRide, beginRide, rideBody, type RideTrack } from '../world/ride';
import { poiRegistry, selectionPoint, type PointOfInterest } from '../world/poi';
import { buildRoadGraph } from '../world/pathfind';
import { makeLabelTexture } from '../world/meshes';
import { placeTitle } from '../world/places';
import { walkLines } from '../world/walk';
import { freshNavMemory, PLAYER_RADIUS, resetNavMotion, stepNavigation, type NavMemory } from '../world/session';
import { Atmosphere, District } from '../world/District';
import { Rainfall } from '../world/Rainfall';
import { PlaceLabels } from '../world/PlaceLabels';
import { streetSpawn } from '../world/spawn';
import { livePose, worldInput } from './input';
import type { TimeOfDay } from '../../store/useGame';

const START = streetSpawn();
/** Close over-the-shoulder framing. Pitch is radians above the horizon. */
const CAMERA_PITCH = 0.26;
const CAMERA_DISTANCE = 4.15;
const CAMERA_SHOULDER = 0.62;
const CAMERA_LOOK_AHEAD = 7.6;
const CAMERA_FOLLOW = 5;
worldInput.yaw = START.yaw;
worldInput.pitch = CAMERA_PITCH;
worldInput.distance = CAMERA_DISTANCE;

export interface GuideTarget {
  id: string;
  name: string;
  x: number;
  z: number;
}

interface WorldSceneProps {
  time: TimeOfDay;
  rain: boolean;
  guideTarget: GuideTarget | null;
  onNear: (place: PointOfInterest | null) => void;
  onPlace: (label: string) => void;
  onInteract: (place: PointOfInterest) => void;
  onWalk: (id: string) => void;
  onArrive: (name: string) => void;
  onGuideStop: () => void;
  onGuideNote: (message: string) => void;
  onGuideProgress: (metres: number | null) => void;
  onImpression: (campaignId: string) => void;
  onAdInteract: (campaignId: string) => void;
  showLabels: boolean;
}

export function WorldScene({
  time,
  rain,
  guideTarget,
  onNear,
  onPlace,
  onInteract,
  onWalk,
  onArrive,
  onGuideStop,
  onGuideNote,
  onGuideProgress,
  onImpression,
  onAdInteract,
  showLabels,
}: WorldSceneProps) {
  const character = useGame((state) => state.character);
  const player = useRef<THREE.Group>(null);
  const motion = useRef<AvatarMotion>({ speed: 0, emote: 'none' });
  const pos = useRef({ x: START.x, z: START.z, heading: START.heading });
  const nav = useRef<NavMemory>(freshNavMemory());
  const graph = useMemo(() => buildRoadGraph(walkLines(cityRoads()), 14, 18), []);
  const routeLine = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3600), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: '#e7c48a' });
    const object = new THREE.Line(geometry, material);
    object.frustumCulled = false;
    return { geometry, material, object };
  }, []);
  const nearId = useRef<string | null>(null);
  const placeLabel = useRef('');
  const impressed = useRef(false);
  const targetRef = useRef(guideTarget);
  targetRef.current = guideTarget;
  const notify = useRef({ onArrive, onGuideStop, onGuideNote, onGuideProgress });
  notify.current = { onArrive, onGuideStop, onGuideNote, onGuideProgress };
  const booted = useRef(false);
  const snapCamera = useRef(false);
  const rideVehicle = useRef<THREE.Group>(null);
  const rideBodyMesh = useRef<THREE.Mesh>(null);
  const rideTrack = useRef<RideTrack | null>(null);
  const rideUntil = useRef<number | null>(null);
  const lanes = useMemo(() => driveLanes(cityRoads()), []);
  const boom = useRef(worldInput.distance);
  const shoulder = useRef(CAMERA_SHOULDER);
  const look = useRef(new THREE.Vector3(START.x, 1.35, START.z));
  const lookGoal = useRef(new THREE.Vector3());
  const camGoal = useRef(new THREE.Vector3());
  const { camera, gl } = useThree();

  useEffect(() => {
    const [x, z] = findOpen(START.x, START.z, PLAYER_RADIUS, colliders, cbd.bounds, wallColliders);
    pos.current.x = x;
    pos.current.z = z;
    pos.current.heading = START.heading;
    worldInput.yaw = START.yaw;
    worldInput.pitch = CAMERA_PITCH;
    worldInput.distance = CAMERA_DISTANCE;
    livePose.x = x;
    livePose.z = z;
    livePose.heading = START.heading;
  }, []);

  useEffect(
    () => () => {
      routeLine.geometry.dispose();
      routeLine.material.dispose();
    },
    [routeLine],
  );

  useEffect(() => {
    const el = gl.domElement;
    el.tabIndex = 0;
    el.style.outline = 'none';
    el.setAttribute('aria-label', 'Nairobi street. Choose a place to walk there, or use WASD. Steering pauses the walk until you let go. Drag looks around.');
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      el.focus({ preventScroll: true });
      dragging = true;
      worldInput.lookHeld = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      worldInput.yaw -= (event.clientX - lastX) * 0.005;
      worldInput.pitch = clamp(worldInput.pitch + (event.clientY - lastY) * 0.0035, 0.08, 1.05);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const up = () => {
      dragging = false;
      worldInput.lookHeld = false;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      worldInput.distance = clamp(worldInput.distance + event.deltaY * 0.008, 2.4, 18);
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      worldInput.lookHeld = false;
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const pose = pos.current;
    const frame = Math.min(Math.max(dt, 0), 0.05);
    const ride = worldInput.ride;
    const boarding = ride?.mode != null && ride.until != null && performance.now() < ride.until;
    if (boarding && ride?.mode && ride.until != null) {
      if (rideTrack.current == null || rideUntil.current !== ride.until) {
        rideTrack.current = beginRide(lanes, pose.x, pose.z, ride.x, ride.z);
        rideUntil.current = ride.until;
        snapCamera.current = true;
      }
      const body = rideBody(ride.mode);
      const track = rideTrack.current;
      let moved = track ? advanceRide(lanes, track, 11 * frame, ride.x, ride.z) : null;
      if (moved && hitsBuilding(moved.x, moved.z, 1.1, colliders)) {
        moved = advanceRide(lanes, moved.track, 8, ride.x, ride.z);
      }
      if (moved) {
        rideTrack.current = moved.track;
        pose.x = moved.x;
        pose.z = moved.z;
        pose.heading = moved.heading;
      }
      const bus = rideVehicle.current;
      const shell = rideBodyMesh.current;
      if (bus) {
        bus.position.set(pose.x, 0, pose.z);
        bus.rotation.set(0, pose.heading, 0);
      }
      if (shell) {
        shell.visible = true;
        shell.scale.set(body.w, body.h, body.d);
        shell.position.y = body.h / 2;
        const material = shell.material;
        if (material instanceof THREE.MeshStandardMaterial) material.color.set(body.color);
      }
      if (player.current) {
        player.current.position.set(body.seatX, body.seatY, body.seatZ);
        player.current.rotation.set(0, 0, 0);
      }
      motion.current.speed = 0;
    } else if (ride) {
      if (ride.land !== false) {
        const [nx, nz] = findOpen(ride.x, ride.z, PLAYER_RADIUS, colliders, cityBounds(), wallColliders);
        pose.x = nx;
        pose.z = nz;
      }
      rideVehicle.current?.position.set(pose.x, 0, pose.z);
      rideVehicle.current?.rotation.set(0, pose.heading, 0);
      if (rideBodyMesh.current) rideBodyMesh.current.visible = false;
      if (player.current) {
        player.current.position.set(0, 0, 0);
        player.current.rotation.set(0, 0, 0);
      }
      worldInput.ride = null;
      rideTrack.current = null;
      rideUntil.current = null;
      resetNavMotion(nav.current);
      motion.current.speed = 0;
      snapCamera.current = true;
    }
    if (!boarding) {
    const target = targetRef.current;
    const move = movementVector();
    const length = Math.hypot(move.x, move.z);
    const stepped = stepNavigation(nav.current, pose, {
      frame,
      target,
      manual: length > 0.01,
      moveX: move.x,
      moveZ: move.z,
      length,
      paused: worldInput.paused,
      shift: worldInput.keys.shift,
      pace: worldInput.pace,
    }, graph);
    worldInput.guiding = stepped.guiding;
    motion.current.speed = stepped.speed;
    for (const event of stepped.events) {
      switch (event.type) {
        case 'progress':
          notify.current.onGuideProgress(event.metres);
          break;
        case 'note':
          notify.current.onGuideNote(event.message);
          break;
        case 'arrive':
          notify.current.onArrive(event.name);
          break;
        case 'stop':
          notify.current.onGuideStop();
          break;
        case 'path':
          if (event.points.length === 0) routeLine.geometry.setDrawRange(0, 0);
          else writePath(routeLine.geometry, event.points);
          break;
        default: {
          const unexpected: never = event;
          void unexpected;
        }
      }
    }
    } else {
      worldInput.guiding = false;
    }

    if (!boarding) {
      if (rideVehicle.current) {
        rideVehicle.current.position.set(pose.x, 0, pose.z);
        rideVehicle.current.rotation.set(0, pose.heading, 0);
      }
      if (player.current) {
        player.current.position.set(0, 0, 0);
        player.current.rotation.set(0, 0, 0);
      }
    }
    livePose.x = pose.x;
    livePose.z = pose.z;
    livePose.heading = pose.heading;

    if (boarding && !worldInput.lookHeld) {
      worldInput.yaw = pose.heading + Math.PI;
    } else if (worldInput.guiding && !worldInput.lookHeld) {
      worldInput.yaw = dampAngle(worldInput.yaw, pose.heading + Math.PI, 3.2, frame);
    }
    const yaw = worldInput.yaw;
    const pitch = worldInput.pitch;
    const ox = Math.sin(yaw) * Math.cos(pitch);
    const oz = Math.cos(yaw) * Math.cos(pitch);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const beside = hitsBuilding(pose.x + rightX * CAMERA_SHOULDER, pose.z + rightZ * CAMERA_SHOULDER, 0.22, colliders) || hitsWall(pose.x + rightX * CAMERA_SHOULDER, pose.z + rightZ * CAMERA_SHOULDER, 0.22, wallColliders);
    const damp = 1 - Math.exp(-CAMERA_FOLLOW * frame);
    shoulder.current += ((beside ? 0 : CAMERA_SHOULDER) - shoulder.current) * damp;
    const side = shoulder.current;
    const open = clearDistance(pose.x + rightX * side, pose.z + rightZ * side, ox, oz, worldInput.distance);
    boom.current += (open - boom.current) * damp;
    const distance = boom.current;
    const camY = Math.max(1.35, 1.62 + Math.sin(pitch) * distance);
    camGoal.current.set(pose.x + rightX * side + ox * distance, camY, pose.z + rightZ * side + oz * distance);
    const lockCamera = !booted.current || boarding || snapCamera.current;
    if (lockCamera) {
      camera.position.copy(camGoal.current);
      booted.current = true;
      snapCamera.current = false;
    } else {
      camera.position.lerp(camGoal.current, damp);
    }
    const lookX = -Math.sin(yaw);
    const lookZ = -Math.cos(yaw);
    const lookAhead = CAMERA_LOOK_AHEAD * Math.cos(Math.min(pitch, 1.1));
    let aimX = pose.x + lookX * lookAhead;
    let aimZ = pose.z + lookZ * lookAhead;
    const route = worldInput.guiding ? nav.current.guide : null;
    const ahead = route ? route.points[Math.min(route.index, route.points.length - 1)] : null;
    if (ahead) {
      const dx = ahead[0] - pose.x;
      const dz = ahead[1] - pose.z;
      const len = Math.hypot(dx, dz);
      if (len > 1.2) {
        aimX += (dx / len) * 1.2;
        aimZ += (dz / len) * 1.2;
      }
    }
    lookGoal.current.set(aimX, boarding ? 1.7 : 1.45, aimZ);
    if (lockCamera) look.current.copy(lookGoal.current);
    else look.current.lerp(lookGoal.current, damp);
    camera.lookAt(look.current);

    const near = closest(pose.x, pose.z, 22);
    if ((near?.id ?? null) !== nearId.current) {
      nearId.current = near?.id ?? null;
      onNear(near);
    }
    const area = closest(pose.x, pose.z, 36);
    const standing = districtAt(pose.x, pose.z)?.districtId;
    const districtName = standing === 'kilimani' || standing === 'nairobi-cbd' || standing === 'hurlingham' ? districtLabel(standing) : 'Nairobi CBD';
    const label = area ? area.name : districtName;
    if (label !== placeLabel.current) {
      placeLabel.current = label;
      onPlace(label);
    }
    const board = cbd.placements[0];
    const campaign = liveCampaigns().find((item) => item.placementId === board?.id);
    if (worldInput.interact) {
      worldInput.interact = false;
      if (near) onInteract(near);
      if (board && campaign && Math.hypot(board.x - pose.x, board.z - pose.z) < 8) onAdInteract(campaign.id);
    }

    if (!impressed.current && board && campaign && Math.hypot(board.x - pose.x, board.z - pose.z) < 28) {
      impressed.current = true;
      onImpression(campaign.id);
    }
  });

  return (
    <>
      <Atmosphere time={time} rain={rain} />
      <Rainfall rain={rain} />
      <District time={time} rain={rain} />
      <PlaceLabels
        enabled={showLabels}
        onSelect={(id) => {
          onWalk(id);
        }}
      />
      <primitive object={routeLine.object} />
      {guideTarget ? <DestinationMark name={guideTarget.name} x={guideTarget.x} z={guideTarget.z} /> : null}
      <group ref={rideVehicle}>
        <mesh ref={rideBodyMesh} visible={false} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f4e6c4" roughness={0.72} metalness={0.02} />
        </mesh>
        <group ref={player}>
          <FbxAvatar config={character} motion={motion} />
        </group>
      </group>
    </>
  );
}

function DestinationMark({ name, x, z }: { name: string; x: number; z: number }) {
  const label = placeTitle(name);
  const texture = useMemo(() => makeLabelTexture(label), [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <ringGeometry args={[1.15, 1.55, 28]} />
        <meshBasicMaterial color="#e7c48a" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 2.2, 12]} />
        <meshStandardMaterial color="#e7c48a" emissive="#e7c48a" emissiveIntensity={0.45} />
      </mesh>
      <sprite position={[0, 3.6, 0]} scale={[7.4, 1.85, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  );
}

function movementVector(): { x: number; z: number } {
  let ix = (worldInput.keys.d ? 1 : 0) - (worldInput.keys.a ? 1 : 0) + worldInput.stick.x;
  let iz = (worldInput.keys.w ? 1 : 0) - (worldInput.keys.s ? 1 : 0) + worldInput.stick.y;
  const yaw = worldInput.yaw;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return { x: forwardX * iz + rightX * ix, z: forwardZ * iz + rightZ * ix };
}

function closest(x: number, z: number, max: number): PointOfInterest | null {
  let best: PointOfInterest | null = null;
  let bestD = max;
  for (const place of poiRegistry()) {
    const here = selectionPoint(place.id);
    if (!here) continue;
    const distance = Math.hypot(here.x - x, here.z - z);
    if (distance < bestD) {
      best = place;
      bestD = distance;
    }
  }
  return best;
}

function clearDistance(x: number, z: number, ox: number, oz: number, desired: number): number {
  for (let distance = 1.2; distance <= desired; distance += 0.28) {
    const px = x + ox * distance;
    const pz = z + oz * distance;
    if (hitsBuilding(px, pz, 0.28, colliders) || hitsWall(px, pz, 0.28, wallColliders)) return Math.max(1.2, distance - 0.28);
  }
  return desired;
}

function writePath(geometry: THREE.BufferGeometry, points: [number, number][]) {
  const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = Math.min(points.length, attr.count);
  for (let i = 0; i < count; i++) attr.setXYZ(i, points[i][0], 0.2, points[i][1]);
  attr.needsUpdate = true;
  geometry.setDrawRange(0, count);
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
