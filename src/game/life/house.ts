import type { LifeResult, LifeState } from './economy';

export const VILLAGE_LOAN = 1200;

export const CREDIT_PACKS = [
  { id: 'small', label: 'Small credit pack', credits: 500 },
  { id: 'city', label: 'City credit pack', credits: 1500 },
  { id: 'home', label: 'Home credit pack', credits: 4000 },
] as const;

export type FloorId = 'cement' | 'timber' | 'tile' | 'terrazzo';
export type WallId = 'plaster' | 'sage' | 'clay' | 'charcoal' | 'whitewash';
export type PieceId =
  | 'bed'
  | 'sofa'
  | 'armchair'
  | 'dining-table'
  | 'chair'
  | 'coffee-table'
  | 'lamp'
  | 'shelf'
  | 'wardrobe'
  | 'stool'
  | 'side-table'
  | 'rug'
  | 'plant'
  | 'mirror'
  | 'cushion'
  | 'curtain';

export interface PlacedPiece {
  uid: string;
  itemId: PieceId;
  x: number;
  z: number;
  turn: 0 | 1 | 2 | 3;
}

export type Opening = 'none' | 'door' | 'window';

export interface PlanWall {
  uid: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  opening: Opening;
}

export const PLAN_GRID = 12;
export const PLAN_CELL = 0.42;
export const WALL_HEIGHTS = [2.4, 2.7, 3] as const;
export type WallHeight = (typeof WALL_HEIGHTS)[number];

export interface HomeDesign {
  floorId: FloorId;
  wallId: WallId;
  wallHeight: WallHeight;
  walls: PlanWall[];
  pieces: PlacedPiece[];
}

interface Finish<Id extends string> {
  id: Id;
  label: string;
  color: string;
  cost: number;
}

interface CatalogPiece {
  id: PieceId;
  label: string;
  group: 'furniture' | 'decor';
  cost: number;
  max: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  shape: 'box' | 'rug' | 'plant' | 'lamp';
}

export const FLOORS: readonly Finish<FloorId>[] = [
  { id: 'cement', label: 'Cement', color: '#c8c2b6', cost: 0 },
  { id: 'timber', label: 'Timber boards', color: '#8a6248', cost: 60 },
  { id: 'tile', label: 'Pale tile', color: '#efe8dc', cost: 70 },
  { id: 'terrazzo', label: 'Terrazzo', color: '#d5d0c8', cost: 80 },
];

export const WALLS: readonly Finish<WallId>[] = [
  { id: 'plaster', label: 'Ivory plaster', color: '#f4f0e8', cost: 0 },
  { id: 'whitewash', label: 'Whitewash', color: '#f7f4ee', cost: 25 },
  { id: 'sage', label: 'Sage', color: '#c5d0c4', cost: 40 },
  { id: 'clay', label: 'Warm clay', color: '#c4a48a', cost: 40 },
  { id: 'charcoal', label: 'Charcoal', color: '#3a4044', cost: 45 },
];

export const PIECES: readonly CatalogPiece[] = [
  { id: 'bed', label: 'Bed', group: 'furniture', cost: 200, max: 1, width: 1.5, depth: 2, height: 0.45, color: '#efe4d4', shape: 'box' },
  { id: 'sofa', label: 'Sofa', group: 'furniture', cost: 160, max: 1, width: 1.6, depth: 0.7, height: 0.55, color: '#6e4e24', shape: 'box' },
  { id: 'armchair', label: 'Armchair', group: 'furniture', cost: 90, max: 2, width: 0.7, depth: 0.7, height: 0.55, color: '#8c5a3c', shape: 'box' },
  { id: 'dining-table', label: 'Dining table', group: 'furniture', cost: 120, max: 1, width: 1.2, depth: 0.7, height: 0.42, color: '#8a6248', shape: 'box' },
  { id: 'chair', label: 'Chair', group: 'furniture', cost: 35, max: 4, width: 0.42, depth: 0.42, height: 0.5, color: '#5c4738', shape: 'box' },
  { id: 'coffee-table', label: 'Coffee table', group: 'furniture', cost: 50, max: 1, width: 0.9, depth: 0.5, height: 0.28, color: '#a68462', shape: 'box' },
  { id: 'side-table', label: 'Side table', group: 'furniture', cost: 30, max: 2, width: 0.4, depth: 0.4, height: 0.4, color: '#c4a484', shape: 'box' },
  { id: 'wardrobe', label: 'Wardrobe', group: 'furniture', cost: 140, max: 1, width: 1.1, depth: 0.45, height: 1.5, color: '#6b5344', shape: 'box' },
  { id: 'shelf', label: 'Shelf', group: 'furniture', cost: 70, max: 2, width: 0.8, depth: 0.28, height: 1.2, color: '#9a7b5a', shape: 'box' },
  { id: 'stool', label: 'Stool', group: 'furniture', cost: 20, max: 2, width: 0.32, depth: 0.32, height: 0.42, color: '#4a4036', shape: 'box' },
  { id: 'lamp', label: 'Floor lamp', group: 'decor', cost: 40, max: 2, width: 0.2, depth: 0.2, height: 1.15, color: '#c9a66b', shape: 'lamp' },
  { id: 'rug', label: 'Rug', group: 'decor', cost: 45, max: 2, width: 1.6, depth: 1, height: 0.02, color: '#a9b8a1', shape: 'rug' },
  { id: 'plant', label: 'Plant', group: 'decor', cost: 25, max: 4, width: 0.35, depth: 0.35, height: 0.7, color: '#2f6a45', shape: 'plant' },
  { id: 'mirror', label: 'Mirror', group: 'decor', cost: 35, max: 1, width: 0.6, depth: 0.06, height: 0.9, color: '#d9e2ea', shape: 'box' },
  { id: 'cushion', label: 'Cushion', group: 'decor', cost: 15, max: 4, width: 0.4, depth: 0.4, height: 0.16, color: '#c46b4a', shape: 'box' },
  { id: 'curtain', label: 'Curtain', group: 'decor', cost: 30, max: 2, width: 0.9, depth: 0.08, height: 1.4, color: '#efe4d4', shape: 'box' },
];

export const ROOM_LOOKS = [
  { id: 'timber', label: 'Warm timber', floorId: 'timber' as const, wallId: 'clay' as const, cost: 40 },
  { id: 'plaster', label: 'City plaster', floorId: 'tile' as const, wallId: 'plaster' as const, cost: 30 },
  { id: 'courtyard', label: 'Courtyard', floorId: 'terrazzo' as const, wallId: 'sage' as const, cost: 45 },
];

const ROOM = 2.55;

export function emptyDesign(): HomeDesign {
  return { floorId: 'cement', wallId: 'plaster', wallHeight: 2.7, walls: [], pieces: [] };
}

export function pieceById(id: PieceId): CatalogPiece {
  const item = PIECES.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown piece ${id}`);
  return item;
}

export function floorById(id: FloorId): Finish<FloorId> {
  const item = FLOORS.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown floor ${id}`);
  return item;
}

export function wallById(id: WallId): Finish<WallId> {
  const item = WALLS.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown wall ${id}`);
  return item;
}

function fail(life: LifeState, message: string): LifeResult {
  return { ok: false, life, message };
}

function charge(life: LifeState, cost: number, next: LifeState, message: string): LifeResult {
  if (cost > 0 && life.coins < cost) return fail(life, `You need ${cost} coins. You have ${life.coins}.`);
  return { ok: true, life: { ...next, coins: life.coins - cost }, message };
}

export function chooseScratch(life: LifeState): LifeResult {
  if (life.origin !== 'unset') return fail(life, 'You already chose how to arrive.');
  return { ok: true, life: { ...life, origin: 'scratch' }, message: 'You arrived with no coins. Earn them in the city.' };
}

export function chooseLoan(life: LifeState): LifeResult {
  if (life.origin !== 'unset') return fail(life, 'You already chose how to arrive.');
  return {
    ok: true,
    life: { ...life, origin: 'loan', coins: life.coins + VILLAGE_LOAN, debt: life.debt + VILLAGE_LOAN },
    message: `Village loan of ${VILLAGE_LOAN} game coins. You owe the same amount. This is not a bank loan.`,
  };
}

export function repayLoan(life: LifeState): LifeResult {
  if (life.debt <= 0) return fail(life, 'You do not owe a village loan.');
  if (life.coins <= 0) return fail(life, 'You have no coins to repay.');
  const paid = Math.min(life.coins, life.debt);
  return {
    ok: true,
    life: { ...life, coins: life.coins - paid, debt: life.debt - paid },
    message: `Repaid ${paid} coins. ${life.debt - paid} still owed.`,
  };
}

/** Shift and task earnings clear the village loan before they stay in the wallet. */
export function grantEarning(life: LifeState, amount: number): Pick<LifeState, 'coins' | 'debt'> {
  const toward = Math.min(life.debt, amount);
  return { coins: life.coins + (amount - toward), debt: life.debt - toward };
}

export function applyFloor(life: LifeState, floorId: FloorId): LifeResult {
  if (!life.home) return fail(life, 'Buy a home before changing the floor.');
  if (life.design.floorId === floorId) return fail(life, 'That floor is already down.');
  const finish = floorById(floorId);
  return charge(life, finish.cost, { ...life, design: { ...life.design, floorId } }, `${finish.label} floor. −${finish.cost} coins.`);
}

export function applyWall(life: LifeState, wallId: WallId): LifeResult {
  if (!life.home) return fail(life, 'Buy a home before changing the walls.');
  if (life.design.wallId === wallId) return fail(life, 'That wall finish is already up.');
  const finish = wallById(wallId);
  return charge(life, finish.cost, { ...life, design: { ...life.design, wallId } }, `${finish.label} walls. −${finish.cost} coins.`);
}

export function applyLook(life: LifeState, lookId: (typeof ROOM_LOOKS)[number]['id']): LifeResult {
  if (!life.home) return fail(life, 'Buy a home before choosing a room look.');
  const look = ROOM_LOOKS.find((entry) => entry.id === lookId);
  if (!look) return fail(life, 'That room look is not available.');
  if (life.design.floorId === look.floorId && life.design.wallId === look.wallId) return fail(life, 'The room already uses that look.');
  return charge(
    life,
    look.cost,
    { ...life, design: { ...life.design, floorId: look.floorId, wallId: look.wallId } },
    `${look.label} applied. −${look.cost} coins.`,
  );
}

function span(item: CatalogPiece, turn: PlacedPiece['turn']): { width: number; depth: number } {
  if (turn === 1 || turn === 3) return { width: item.depth, depth: item.width };
  return { width: item.width, depth: item.depth };
}

function hits(piece: PlacedPiece, other: PlacedPiece): boolean {
  const a = span(pieceById(piece.itemId), piece.turn);
  const b = span(pieceById(other.itemId), other.turn);
  return Math.abs(piece.x - other.x) < (a.width + b.width) / 2 - 0.04 && Math.abs(piece.z - other.z) < (a.depth + b.depth) / 2 - 0.04;
}

function inside(piece: PlacedPiece): boolean {
  const box = span(pieceById(piece.itemId), piece.turn);
  return Math.abs(piece.x) + box.width / 2 <= ROOM && Math.abs(piece.z) + box.depth / 2 <= ROOM;
}

function fits(pieces: PlacedPiece[], candidate: PlacedPiece): boolean {
  return inside(candidate) && pieces.every((piece) => piece.uid === candidate.uid || !hits(candidate, piece));
}

function nextSpot(pieces: PlacedPiece[], item: CatalogPiece): { x: number; z: number } | null {
  for (let z = -1.8; z <= 1.8; z += 0.6) {
    for (let x = -1.8; x <= 1.8; x += 0.6) {
      const candidate: PlacedPiece = { uid: 'try', itemId: item.id, x, z, turn: 0 };
      if (fits(pieces, candidate)) return { x, z };
    }
  }
  return null;
}

function legacyId(itemId: PieceId): LifeState['furniture'][number] | null {
  if (itemId === 'bed' || itemId === 'sofa' || itemId === 'lamp') return itemId;
  if (itemId === 'coffee-table') return 'table';
  return null;
}

function withLegacy(life: LifeState, itemId: PieceId, present: boolean): LifeState['furniture'] {
  const legacy = legacyId(itemId);
  if (!legacy) return life.furniture;
  if (present) return life.furniture.includes(legacy) ? life.furniture : [...life.furniture, legacy];
  return life.furniture.filter((id) => id !== legacy);
}

export function placePiece(life: LifeState, itemId: PieceId): LifeResult {
  if (!life.home) return fail(life, 'Buy a home before furnishing it.');
  const item = pieceById(itemId);
  const owned = life.design.pieces.filter((piece) => piece.itemId === itemId).length;
  if (owned >= item.max) return fail(life, owned === 1 ? 'That piece is already in the home.' : `You already have ${item.max}.`);
  const spot = nextSpot(life.design.pieces, item);
  if (!spot) return fail(life, 'The room has no free spot for that.');
  const piece: PlacedPiece = { uid: `${itemId}-${life.design.pieces.length + 1}`, itemId, x: spot.x, z: spot.z, turn: 0 };
  const next: LifeState = {
    ...life,
    furniture: withLegacy(life, itemId, true),
    design: { ...life.design, pieces: [...life.design.pieces, piece] },
  };
  return charge(life, item.cost, next, `${item.label} placed. −${item.cost} coins.`);
}

export function movePiece(life: LifeState, uid: string, axis: 'x' | 'z', step: number): LifeResult {
  const current = life.design.pieces.find((piece) => piece.uid === uid);
  if (!current) return fail(life, 'Select a piece in the room first.');
  const moved: PlacedPiece = { ...current, [axis]: Math.round((current[axis] + step) * 10) / 10 };
  if (!fits(life.design.pieces, moved)) return fail(life, 'That spot is blocked.');
  return {
    ok: true,
    life: { ...life, design: { ...life.design, pieces: life.design.pieces.map((piece) => (piece.uid === uid ? moved : piece)) } },
    message: 'Moved.',
  };
}

export function rotatePiece(life: LifeState, uid: string): LifeResult {
  const current = life.design.pieces.find((piece) => piece.uid === uid);
  if (!current) return fail(life, 'Select a piece in the room first.');
  const turn = ((current.turn + 1) % 4) as PlacedPiece['turn'];
  const turned: PlacedPiece = { ...current, turn };
  if (!fits(life.design.pieces, turned)) return fail(life, 'It does not fit turned that way.');
  return {
    ok: true,
    life: { ...life, design: { ...life.design, pieces: life.design.pieces.map((piece) => (piece.uid === uid ? turned : piece)) } },
    message: 'Turned.',
  };
}

export function removePiece(life: LifeState, uid: string): LifeResult {
  const current = life.design.pieces.find((piece) => piece.uid === uid);
  if (!current) return fail(life, 'Select a piece in the room first.');
  const item = pieceById(current.itemId);
  const pieces = life.design.pieces.filter((piece) => piece.uid !== uid);
  const stillThere = pieces.some((piece) => piece.itemId === current.itemId);
  return {
    ok: true,
    life: {
      ...life,
      coins: life.coins + item.cost,
      furniture: withLegacy(life, current.itemId, stillThere),
      design: { ...life.design, pieces },
    },
    message: `${item.label} removed. +${item.cost} coins back.`,
  };
}

export function seedPieces(ids: readonly string[]): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  for (const id of ids) {
    if (!PIECES.some((item) => item.id === id)) continue;
    const itemId = id as PieceId;
    const spot = nextSpot(pieces, pieceById(itemId));
    if (!spot) continue;
    pieces.push({ uid: `${itemId}-${pieces.length + 1}`, itemId, x: spot.x, z: spot.z, turn: 0 });
  }
  return pieces;
}
