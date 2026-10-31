import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeLabelTexture } from './meshes';
import { selectionPoint } from './poi';
import { placeRegistry, streetLabel, streetLabelRange, type PlaceInfo } from './places';
import { livePose } from '../player/input';

const LABEL_LIMIT = 6;

function sameIds(a: readonly PlaceInfo[], b: readonly PlaceInfo[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

function visiblePlaces(places: readonly PlaceInfo[]): PlaceInfo[] {
  const ranked = places
    .map((place) => ({ place, distance: Math.hypot(place.x - livePose.x, place.z - livePose.z) }))
    .filter((item) => item.distance < streetLabelRange(item.place.category))
    .sort((a, b) => a.distance - b.distance);
  return ranked.slice(0, LABEL_LIMIT).map((item) => item.place);
}

export function PlaceLabels({ enabled, onSelect }: { enabled: boolean; onSelect: (id: string) => void }) {
  const places = useMemo(() => placeRegistry(), []);
  const [shown, setShown] = useState<PlaceInfo[]>(() => visiblePlaces(places));
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    if (clock.current < 0.3) return;
    clock.current = 0;
    const next = enabled ? visiblePlaces(places) : [];
    setShown((current) => (sameIds(current, next) ? current : next));
  });

  if (!enabled) return null;
  return (
    <group>
      {shown.map((place) => (
        <PlaceSprite key={place.id} place={place} onSelect={onSelect} />
      ))}
    </group>
  );
}

function PlaceSprite({ place, onSelect }: { place: PlaceInfo; onSelect: (id: string) => void }) {
  const sprite = useRef<THREE.Sprite>(null);
  const point = selectionPoint(place.id) ?? { x: place.x, z: place.z };
  const texture = useMemo(() => makeLabelTexture(streetLabel(place.name, place.category)), [place.category, place.name]);
  const { camera } = useThree();
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    const object = sprite.current;
    if (!object) return;
    const distance = Math.max(8, camera.position.distanceTo(object.position));
    const width = Math.min(16, Math.max(7, distance * 0.09));
    const height = width * 0.25;
    object.scale.set(width, height, 1);
    object.position.y = place.labelY + height * 0.5;
    object.renderOrder = 3;
  });
  return (
    <sprite
      ref={sprite}
      position={[point.x, place.labelY, point.z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(place.id);
      }}
    >
      <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} />
    </sprite>
  );
}
