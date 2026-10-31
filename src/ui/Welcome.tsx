import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Atmosphere, Cinematic, District } from '../game/world/District';
import { useGame } from '../store/useGame';
import { FillFrame, KeepPainting, useWakeCanvas } from './Studio';

export function Welcome() {
  const confirmed = useGame((state) => state.character.confirmed);
  const name = useGame((state) => state.character.displayName);
  const beginCreation = useGame((state) => state.beginCreation);
  const openWardrobe = useGame((state) => state.openWardrobe);
  const setPhase = useGame((state) => state.setPhase);
  useWakeCanvas();

  return (
    <main className="welcome">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [90, 32, 80], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <FillFrame />
        <KeepPainting />
        <Cinematic />
        <Atmosphere time="sunset" />
        <District time="sunset" pinned="nairobi-cbd" />
      </Canvas>
      <div className="welcome-copy">
        <p className="eyebrow">Nairobi CBD</p>
        <h1>NairobiDiaries</h1>
        <p className="lede">Live Nairobi your way.</p>
        <div className="actions">
          {confirmed ? (
            <>
              <button className="btn primary" type="button" onClick={() => setPhase('world')}>
                Enter as {name}
              </button>
              <button className="btn" type="button" onClick={openWardrobe}>
                Wardrobe
              </button>
            </>
          ) : (
            <button className="btn primary" type="button" onClick={beginCreation}>
              Create your character
            </button>
          )}
        </div>
        <p className="fine">
          The streets around the Kenyatta International Convention Centre, from OpenStreetMap. Make a person before you walk out.
        </p>
      </div>
    </main>
  );
}
