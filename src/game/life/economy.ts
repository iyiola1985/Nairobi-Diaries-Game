import { emptyDesign, grantEarning, placePiece, seedPieces, type HomeDesign, type PieceId } from './house';

export const COINS = {
  shift: 250,
  meal: 40,
  shopping: 70,
  fare: 15,
  home: 500,
  car: 350,
  bed: 200,
  sofa: 160,
  table: 80,
  lamp: 40,
} as const;

export const FURNITURE = [
  { id: 'bed', label: 'Bed', cost: COINS.bed },
  { id: 'sofa', label: 'Sofa', cost: COINS.sofa },
  { id: 'table', label: 'Table', cost: COINS.table },
  { id: 'lamp', label: 'Lamp', cost: COINS.lamp },
] as const;

export type FurnitureId = (typeof FURNITURE)[number]['id'];

export type Arrival = 'unset' | 'scratch' | 'loan';

export interface LifeState {
  coins: number;
  home: { x: number; z: number } | null;
  car: boolean;
  furniture: FurnitureId[];
  debt: number;
  origin: Arrival;
  design: HomeDesign;
  shiftReadyAt: number;
  taskReadyAt: number;
  energy: number;
  thirst: number;
  hunger: number;
}

export const SHIFT_WAIT_MS = 10 * 60 * 1000;

export function emptyLife(): LifeState {
  return {
    coins: 0,
    home: null,
    car: false,
    furniture: [],
    debt: 0,
    origin: 'unset',
    design: emptyDesign(),
    shiftReadyAt: 0,
    taskReadyAt: 0,
    energy: 80,
    thirst: 70,
    hunger: 75,
  };
}

export function completeLife(raw: Partial<LifeState> | null | undefined): LifeState {
  const furniture = raw?.furniture ?? [];
  const design = raw?.design ?? emptyDesign();
  const pieces = design.pieces.length > 0 ? design.pieces : seedPieces(furniture);
  const progressed = Boolean(raw?.home) || (raw?.coins ?? 0) > 0 || furniture.length > 0;
  const origin = raw?.origin === 'scratch' || raw?.origin === 'loan' ? raw.origin : progressed ? 'scratch' : 'unset';
  return {
    ...emptyLife(),
    ...raw,
    furniture,
    debt: raw?.debt ?? 0,
    origin,
    design: { ...emptyDesign(), ...design, pieces, walls: design.walls ?? [], wallHeight: design.wallHeight ?? 2.7 },
  };
}

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export type LifeResult = { ok: true; life: LifeState; message: string } | { ok: false; life: LifeState; message: string };

function pay(life: LifeState, cost: number, message: string): LifeResult {
  if (life.coins < cost) return { ok: false, life, message: `You need ${cost} coins. You have ${life.coins}.` };
  return { ok: true, life: { ...life, coins: life.coins - cost }, message };
}

export function workShift(life: LifeState, now: number, open: boolean): LifeResult {
  if (!open) return { ok: false, life, message: 'This building is closed, so there is no shift.' };
  if (now < life.shiftReadyAt) {
    const minutes = Math.ceil((life.shiftReadyAt - now) / 60000);
    return { ok: false, life, message: `The next shift is in ${minutes} min.` };
  }
  const earned = grantEarning(life, COINS.shift);
  const owed = life.debt - earned.debt;
  const message = owed > 0
    ? `Shift done. ${owed} coins went to the village loan. ${earned.debt} still owed.`
    : `Shift done. +${COINS.shift} coins. These are game coins, not shillings.`;
  return {
    ok: true,
    life: { ...life, ...earned, shiftReadyAt: now + SHIFT_WAIT_MS },
    message,
  };
}

export function buyMeal(life: LifeState, open: boolean): LifeResult {
  if (!open) return { ok: false, life, message: 'The kitchen is closed.' };
  const paid = pay(life, COINS.meal, `You ordered food. −${COINS.meal} coins.`);
  if (!paid.ok) return paid;
  return {
    ok: true,
    life: { ...paid.life, hunger: clampNeed(life.hunger + 45), thirst: clampNeed(life.thirst + 12) },
    message: paid.message,
  };
}

export function drink(life: LifeState): LifeResult {
  const paid = pay(life, 15, 'You drank. −15 coins.');
  if (!paid.ok) return paid;
  return { ok: true, life: { ...paid.life, thirst: clampNeed(life.thirst + 35) }, message: paid.message };
}

export function rest(life: LifeState): LifeResult {
  if (!life.home) return { ok: false, life, message: 'Rest in your room after you buy one.' };
  return { ok: true, life: { ...life, energy: clampNeed(life.energy + 40) }, message: 'You rested. Energy is back up.' };
}

export function dance(life: LifeState): LifeResult {
  if (life.energy < 12) return { ok: false, life, message: 'You are too tired to dance.' };
  return { ok: true, life: { ...life, energy: clampNeed(life.energy - 8) }, message: 'You dance for a moment.' };
}

export function helpOut(life: LifeState, now: number): LifeResult {
  if (life.energy < 15) return { ok: false, life, message: 'You are too tired for an extra task.' };
  if (now < life.taskReadyAt) return { ok: false, life, message: 'No extra task is waiting yet.' };
  const earned = grantEarning(life, 80);
  return {
    ok: true,
    life: {
      ...life,
      ...earned,
      energy: clampNeed(life.energy - 12),
      thirst: clampNeed(life.thirst - 8),
      taskReadyAt: now + SHIFT_WAIT_MS,
    },
    message: life.debt > 0 ? `Task done. Coins went to the village loan. ${earned.debt} still owed.` : 'Task done. +80 coins.',
  };
}

export function tickNeeds(life: LifeState, moving: boolean, pace: 'walk' | 'run' | 'sprint'): LifeState {
  const burn = !moving ? 0 : pace === 'sprint' ? 4 : pace === 'run' ? 2 : 1;
  return {
    ...life,
    energy: clampNeed(life.energy - burn),
    thirst: clampNeed(life.thirst - 2),
    hunger: clampNeed(life.hunger - 1),
  };
}

export function payRide(life: LifeState, coins: number, label: string): LifeResult {
  return pay(life, coins, `${label} paid. −${coins} coins. Game fare, not a live price.`);
}

export function buyShopping(life: LifeState, open: boolean): LifeResult {
  if (!open) return { ok: false, life, message: 'The shop is closed.' };
  return pay(life, COINS.shopping, `Purchase paid. −${COINS.shopping} coins.`);
}

export function buyHome(life: LifeState, x: number, z: number): LifeResult {
  if (life.home) return { ok: false, life, message: 'You already have a game home.' };
  const paid = pay(life, COINS.home, `Home bought for ${COINS.home} coins. It is a game room, not a real listing.`);
  if (!paid.ok) return paid;
  return { ok: true, life: { ...paid.life, home: { x, z } }, message: paid.message };
}

export function buyCar(life: LifeState): LifeResult {
  if (life.car) return { ok: false, life, message: 'You already have a city car.' };
  const paid = pay(life, COINS.car, `City car bought for ${COINS.car} coins.`);
  if (!paid.ok) return paid;
  return { ok: true, life: { ...paid.life, car: true }, message: paid.message };
}

export function payFare(life: LifeState): LifeResult {
  if (!life.car) return { ok: false, life, message: 'Buy a city car before driving.' };
  return pay(life, COINS.fare, `Drove to the entrance. −${COINS.fare} coins. This is not a real fare.`);
}

export function buyFurniture(life: LifeState, id: FurnitureId): LifeResult {
  const piece: PieceId = id === 'table' ? 'coffee-table' : id;
  return placePiece(life, piece);
}
