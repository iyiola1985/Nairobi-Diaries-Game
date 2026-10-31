import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { FbxAvatar } from '../game/character/FbxAvatar';
import {
  CREDIT_PACKS,
  FLOORS,
  PIECES,
  PLAN_GRID,
  WALL_HEIGHTS,
  WALLS,
  floorById,
  pieceById,
  wallById,
  type PieceId,
} from '../game/life/house';
import { PLAN_TEMPLATES, nearestWall, wallBoxes } from '../game/life/plan';
import { useGame } from '../store/useGame';
import { FillFrame, KeepPainting } from './Studio';

type Tool = 'wall' | 'room' | 'door' | 'window' | 'erase';
type Point = { x: number; z: number };

function FrameRoom() {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(0, 1.1, 0);
  }, [camera]);
  return null;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'wall', label: 'Draw straight walls' },
  { id: 'room', label: 'Draw a room' },
  { id: 'door', label: 'Door' },
  { id: 'window', label: 'Window' },
  { id: 'erase', label: 'Erase wall' },
];

export function HouseStudio({ onLeave }: { onLeave: () => void }) {
  const life = useGame((state) => state.life);
  const notice = useGame((state) => state.notice);
  const character = useGame((state) => state.character);
  const drawPlanWall = useGame((state) => state.drawPlanWall);
  const drawPlanRoom = useGame((state) => state.drawPlanRoom);
  const markPlanOpening = useGame((state) => state.markPlanOpening);
  const erasePlanWall = useGame((state) => state.erasePlanWall);
  const clearPlanWalls = useGame((state) => state.clearPlanWalls);
  const usePlanTemplate = useGame((state) => state.usePlanTemplate);
  const setPlanHeight = useGame((state) => state.setPlanHeight);
  const paintFloor = useGame((state) => state.paintFloor);
  const paintWall = useGame((state) => state.paintWall);
  const addPiece = useGame((state) => state.addPiece);
  const [tool, setTool] = useState<Tool>('room');
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [anchor, setAnchor] = useState<Point | null>(null);
  const floor = floorById(life.design.floorId);
  const wall = wallById(life.design.wallId);

  const pick = (x: number, z: number) => {
    if (tool === 'door' || tool === 'window' || tool === 'erase') {
      const hit = nearestWall(life.design.walls, x, z);
      if (!hit) return;
      if (tool === 'erase') erasePlanWall(hit.uid);
      else markPlanOpening(hit.uid, tool);
      setAnchor(null);
      return;
    }
    if (!anchor) {
      setAnchor({ x, z });
      return;
    }
    if (tool === 'room') drawPlanRoom(anchor.x, anchor.z, x, z);
    else drawPlanWall(anchor.x, anchor.z, x, z);
    setAnchor(null);
  };

  return (
    <main className="planner">
      <aside className="planner-tools">
        <p className="eyebrow">Create room</p>
        <h1>Plan</h1>
        <p className="hint">Draw on the grid. This is an original planner, not a copy of another design app. A scanned plan cannot be imported.</p>
        <h2>Templates</h2>
        <div className="choices">
          {PLAN_TEMPLATES.map((item) => (
            <button key={item.id} className="choice" type="button" onClick={() => usePlanTemplate(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <h2>Draw</h2>
        <div className="choices">
          {TOOLS.map((item) => (
            <button key={item.id} className={tool === item.id ? 'choice on' : 'choice'} type="button" aria-pressed={tool === item.id} onClick={() => { setTool(item.id); setAnchor(null); }}>
              {item.label}
            </button>
          ))}
          <button className="choice" type="button" onClick={clearPlanWalls}>Clear walls</button>
        </div>
        <h2>Furniture and decor</h2>
        <div className="choices">
          {PIECES.map((item) => (
            <button key={item.id} className="choice" type="button" onClick={() => addPiece(item.id as PieceId)}>
              {item.label} · {item.cost}
            </button>
          ))}
        </div>
        <button className="btn" type="button" onClick={onLeave}>Back to the street</button>
      </aside>
      <section className="planner-stage" aria-label={view === '2d' ? 'Floor plan' : '3D room'}>
        {view === '2d' ? (
          <div className="plan-board">
            <svg className="plan-lines" viewBox={`0 0 ${PLAN_GRID} ${PLAN_GRID}`} aria-hidden="true">
              {Array.from({ length: PLAN_GRID + 1 }, (_, index) => (
                <g key={index}>
                  <line x1={index} y1={0} x2={index} y2={PLAN_GRID} />
                  <line x1={0} y1={index} x2={PLAN_GRID} y2={index} />
                </g>
              ))}
              {life.design.walls.map((item) => (
                <line key={item.uid} x1={item.x1} y1={item.z1} x2={item.x2} y2={item.z2} className={item.opening === 'door' ? 'plan-door' : item.opening === 'window' ? 'plan-window' : 'plan-wall'} />
              ))}
            </svg>
            {Array.from({ length: PLAN_GRID + 1 }, (_, z) =>
              Array.from({ length: PLAN_GRID + 1 }, (_, x) => (
                <button
                  key={`${x}-${z}`}
                  className={anchor?.x === x && anchor?.z === z ? 'plan-point on' : 'plan-point'}
                  type="button"
                  aria-label={`Grid ${x}, ${z}`}
                  style={{ left: `${(x / PLAN_GRID) * 100}%`, top: `${(z / PLAN_GRID) * 100}%` }}
                  onClick={() => pick(x, z)}
                />
              )),
            )}
          </div>
        ) : (
          <Canvas camera={{ position: [4.2, 3.4, 4.6], fov: 42 }}>
            <FrameRoom />
            <FillFrame />
            <KeepPainting />
            <color attach="background" args={['#efe8db']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[3, 5, 2]} intensity={1.2} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[PLAN_GRID * 0.42, PLAN_GRID * 0.42]} />
              <meshStandardMaterial color={floor.color} />
            </mesh>
            {life.design.walls.map((item) =>
              wallBoxes(item, life.design.wallHeight).map((box) => (
                <mesh key={box.key} position={box.position}>
                  <boxGeometry args={box.size} />
                  <meshStandardMaterial color={wall.color} />
                </mesh>
              )),
            )}
            {life.design.walls.length > 0 ? (
              <mesh position={[0, life.design.wallHeight, 0]}>
                <boxGeometry args={[PLAN_GRID * 0.42, 0.06, PLAN_GRID * 0.42]} />
                <meshStandardMaterial color="#f7f4ee" transparent opacity={0.45} />
              </mesh>
            ) : null}
            {life.design.pieces.map((item) => {
              const spec = pieceById(item.itemId);
              return (
                <mesh key={item.uid} position={[item.x, spec.height / 2, item.z]} rotation={[0, item.turn * (Math.PI / 2), 0]}>
                  <boxGeometry args={[spec.width, spec.height, spec.depth]} />
                  <meshStandardMaterial color={spec.color} />
                </mesh>
              );
            })}
            <group position={[0, 0, 0.4]}>
              <FbxAvatar config={character} />
            </group>
          </Canvas>
        )}
      </section>
      <aside className="planner-side">
        <p className="eyebrow">View</p>
        <div className="choices">
          <button className={view === '2d' ? 'choice on' : 'choice'} type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D plan</button>
          <button className={view === '3d' ? 'choice on' : 'choice'} type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D view</button>
        </div>
        <h2>Wall height</h2>
        <div className="choices">
          {WALL_HEIGHTS.map((height) => (
            <button key={height} className={life.design.wallHeight === height ? 'choice on' : 'choice'} type="button" aria-pressed={life.design.wallHeight === height} onClick={() => setPlanHeight(height)}>
              {height} m
            </button>
          ))}
        </div>
        <h2>Floor</h2>
        <div className="swatches">
          {FLOORS.map((item) => (
            <button key={item.id} className={life.design.floorId === item.id ? 'swatch on' : 'swatch'} type="button" aria-label={`${item.label} floor`} style={{ background: item.color }} onClick={() => paintFloor(item.id)} />
          ))}
        </div>
        <h2>Walls</h2>
        <div className="swatches">
          {WALLS.map((item) => (
            <button key={item.id} className={life.design.wallId === item.id ? 'swatch on' : 'swatch'} type="button" aria-label={`${item.label} wall`} style={{ background: item.color }} onClick={() => paintWall(item.id)} />
          ))}
        </div>
        <p className="hint">{life.coins} coins{life.debt > 0 ? ` · loan ${life.debt}` : ''}. Furniture uses game coins. Credit packs are not for sale.</p>
        <ul className="hint">
          {CREDIT_PACKS.map((pack) => (
            <li key={pack.id}>{pack.label}: {pack.credits} credits. Checkout is not connected, so this does not charge real money.</li>
          ))}
        </ul>
        {anchor ? <p className="hint">First point is {anchor.x}, {anchor.z}. Pick the second point.</p> : null}
        {notice ? <p className="hint">{notice}</p> : null}
      </aside>
    </main>
  );
}
