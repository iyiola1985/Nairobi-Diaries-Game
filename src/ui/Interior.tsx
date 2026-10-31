import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { FbxAvatar } from '../game/character/FbxAvatar';
import type { FurnitureId } from '../game/life/economy';
import { useGame } from '../store/useGame';
import { FillFrame, KeepPainting } from './Studio';

const PIECES: Record<FurnitureId, { position: [number, number, number]; size: [number, number, number]; color: string }> = {
  bed: { position: [-1.4, 0.28, -1.2], size: [1.5, 0.4, 2], color: '#efe4d4' },
  sofa: { position: [1.3, 0.32, 0.2], size: [1.4, 0.5, 0.7], color: '#6e4e24' },
  table: { position: [0.1, 0.35, 0.8], size: [0.9, 0.08, 0.6], color: '#8a6248' },
  lamp: { position: [1.5, 0.7, -1.1], size: [0.16, 0.9, 0.16], color: '#c9a66b' },
};

export function Interior({
  title,
  note,
  furniture,
  children,
  onLeave,
}: {
  title: string;
  note: string;
  furniture: readonly FurnitureId[];
  children: ReactNode;
  onLeave: () => void;
}) {
  const character = useGame((state) => state.character);
  return (
    <main className="world-shell">
      <Canvas camera={{ position: [0, 1.7, 4.2], fov: 48 }}>
        <FillFrame />
        <KeepPainting />
        <color attach="background" args={['#efe8db']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#d9d0c2" />
        </mesh>
        <mesh position={[0, 1.4, -2.4]}>
          <boxGeometry args={[8, 2.8, 0.1]} />
          <meshStandardMaterial color="#f4f0e8" />
        </mesh>
        {furniture.map((id) => {
          const piece = PIECES[id];
          return (
            <mesh key={id} position={piece.position}>
              <boxGeometry args={piece.size} />
              <meshStandardMaterial color={piece.color} />
            </mesh>
          );
        })}
        <group position={[0, 0, 0.2]}>
          <FbxAvatar config={character} />
        </group>
      </Canvas>
      <div className="hud">
        <div className="sheet" role="dialog" aria-label={title}>
          <p className="eyebrow">Inside</p>
          <h2>{title}</h2>
          <p className="hint">{note}</p>
          {children}
          <button className="btn" type="button" onClick={onLeave}>
            Back to the street
          </button>
        </div>
      </div>
    </main>
  );
}
