import type { LifeResult, LifeState } from './economy';
import { PLAN_CELL, PLAN_GRID, type Opening, type PlanWall, type WallHeight } from './house';

export const PLAN_TEMPLATES = [
  { id: 'studio', label: 'Single room' },
  { id: 'split', label: 'Two rooms' },
] as const;

export type PlanTemplateId = (typeof PLAN_TEMPLATES)[number]['id'];

function fail(life: LifeState, message: string): LifeResult {
  return { ok: false, life, message };
}

function owned(life: LifeState): LifeResult | null {
  if (!life.home) return fail(life, 'Buy a home before drawing the plan.');
  return null;
}

function clampPoint(value: number): number {
  return Math.max(0, Math.min(PLAN_GRID, Math.round(value)));
}

export function straightWall(x1: number, z1: number, x2: number, z2: number): Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'> | null {
  const ax = clampPoint(x1);
  const az = clampPoint(z1);
  const bx = clampPoint(x2);
  const bz = clampPoint(z2);
  const dx = bx - ax;
  const dz = bz - az;
  if (dx === 0 && dz === 0) return null;
  if (dx !== 0 && dz !== 0) {
    if (Math.abs(dx) >= Math.abs(dz)) return straightWall(ax, az, bx, az);
    return straightWall(ax, az, ax, bz);
  }
  if (dx < 0 || dz < 0) return { x1: bx, z1: bz, x2: ax, z2: az };
  return { x1: ax, z1: az, x2: bx, z2: bz };
}

function sameSpan(a: Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>, b: Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>): boolean {
  return a.x1 === b.x1 && a.z1 === b.z1 && a.x2 === b.x2 && a.z2 === b.z2;
}

function overlaps(a: Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>, b: Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>): boolean {
  if (a.z1 === a.z2 && b.z1 === b.z2 && a.z1 === b.z1) return Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1);
  if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1) return Math.min(a.z2, b.z2) > Math.max(a.z1, b.z1);
  return false;
}

function wallId(span: Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>, index: number): string {
  return `w${index}-${span.x1}${span.z1}${span.x2}${span.z2}`;
}

function addSpans(walls: PlanWall[], spans: Array<Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'>>, opening: Opening = 'none'): PlanWall[] {
  const next = [...walls];
  for (const span of spans) {
    if (next.some((wall) => overlaps(wall, span))) continue;
    next.push({ uid: wallId(span, next.length + 1), ...span, opening });
  }
  return next;
}

export function drawWall(life: LifeState, x1: number, z1: number, x2: number, z2: number): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  const span = straightWall(x1, z1, x2, z2);
  if (!span) return fail(life, 'Pick two different grid points.');
  if (life.design.walls.some((wall) => sameSpan(wall, span) || overlaps(wall, span))) {
    return fail(life, 'A wall already covers that line.');
  }
  const walls = addSpans(life.design.walls, [span]);
  return { ok: true, life: { ...life, design: { ...life.design, walls } }, message: 'Wall drawn.' };
}

export function drawRoom(life: LifeState, x1: number, z1: number, x2: number, z2: number): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  const left = Math.min(clampPoint(x1), clampPoint(x2));
  const right = Math.max(clampPoint(x1), clampPoint(x2));
  const top = Math.min(clampPoint(z1), clampPoint(z2));
  const bottom = Math.max(clampPoint(z1), clampPoint(z2));
  if (right - left < 2 || bottom - top < 2) return fail(life, 'A room needs at least two grid steps on each side.');
  const spans = [
    straightWall(left, top, right, top),
    straightWall(right, top, right, bottom),
    straightWall(left, bottom, right, bottom),
    straightWall(left, top, left, bottom),
  ].filter((span): span is Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'> => span !== null);
  const walls = addSpans(life.design.walls, spans);
  if (walls.length === life.design.walls.length) return fail(life, 'Those walls are already there.');
  return { ok: true, life: { ...life, design: { ...life.design, walls } }, message: 'Room outline added.' };
}

export function nearestWall(walls: readonly PlanWall[], x: number, z: number): PlanWall | null {
  let best: PlanWall | null = null;
  let bestDistance = 0.75;
  for (const wall of walls) {
    const along = wall.x1 === wall.x2 ? z : x;
    const start = wall.x1 === wall.x2 ? wall.z1 : wall.x1;
    const end = wall.x1 === wall.x2 ? wall.z2 : wall.x2;
    const cross = wall.x1 === wall.x2 ? Math.abs(x - wall.x1) : Math.abs(z - wall.z1);
    const onSpan = along >= start - 0.2 && along <= end + 0.2;
    const distance = onSpan ? cross : Math.min(Math.hypot(x - wall.x1, z - wall.z1), Math.hypot(x - wall.x2, z - wall.z2));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = wall;
    }
  }
  return best;
}

export function markOpening(life: LifeState, uid: string, opening: Opening): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  if (!life.design.walls.some((wall) => wall.uid === uid)) return fail(life, 'Choose a wall first.');
  const walls = life.design.walls.map((wall) => (wall.uid === uid ? { ...wall, opening } : wall));
  const label = opening === 'none' ? 'Opening cleared.' : opening === 'door' ? 'Door marked on that wall.' : 'Window marked on that wall.';
  return { ok: true, life: { ...life, design: { ...life.design, walls } }, message: label };
}

export function eraseWall(life: LifeState, uid: string): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  if (!life.design.walls.some((wall) => wall.uid === uid)) return fail(life, 'Choose a wall first.');
  return {
    ok: true,
    life: { ...life, design: { ...life.design, walls: life.design.walls.filter((wall) => wall.uid !== uid) } },
    message: 'Wall removed.',
  };
}

export function clearPlan(life: LifeState): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  return { ok: true, life: { ...life, design: { ...life.design, walls: [] } }, message: 'The plan is clear.' };
}

function roomWalls(x1: number, z1: number, x2: number, z2: number): PlanWall[] {
  return addSpans([], [
    straightWall(x1, z1, x2, z1),
    straightWall(x2, z1, x2, z2),
    straightWall(x1, z2, x2, z2),
    straightWall(x1, z1, x1, z2),
  ].filter((span): span is Pick<PlanWall, 'x1' | 'z1' | 'x2' | 'z2'> => span !== null));
}

export function applyTemplate(life: LifeState, id: PlanTemplateId): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  if (id === 'studio') {
    return {
      ok: true,
      life: { ...life, design: { ...life.design, walls: roomWalls(2, 2, 9, 8) } },
      message: 'Single room template placed. Draw over it or clear it.',
    };
  }
  if (id === 'split') {
    const outer = roomWalls(1, 2, 11, 9);
    const divider = straightWall(6, 2, 6, 9);
    const walls = divider ? addSpans(outer, [divider], 'door') : outer;
    return { ok: true, life: { ...life, design: { ...life.design, walls } }, message: 'Two rooms placed, with a door in the shared wall.' };
  }
  const unexpected: never = id;
  return unexpected;
}

export function setWallHeight(life: LifeState, wallHeight: WallHeight): LifeResult {
  const blocked = owned(life);
  if (blocked) return blocked;
  return { ok: true, life: { ...life, design: { ...life.design, wallHeight } }, message: `Wall height set to ${wallHeight} m.` };
}

export function planToWorld(x: number, z: number): [number, number] {
  return [(x - PLAN_GRID / 2) * PLAN_CELL, (z - PLAN_GRID / 2) * PLAN_CELL];
}

export interface WallBox {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
}

export function wallBoxes(wall: PlanWall, height: number): WallBox[] {
  const [ax, az] = planToWorld(wall.x1, wall.z1);
  const [bx, bz] = planToWorld(wall.x2, wall.z2);
  const horizontal = wall.z1 === wall.z2;
  const length = Math.hypot(bx - ax, bz - az);
  const thickness = 0.1;
  const midX = (ax + bx) / 2;
  const midZ = (az + bz) / 2;
  const gap = wall.opening === 'none' ? 0 : Math.min(0.86, length * 0.45);
  if (gap <= 0 || length < 1.1) {
    return [{ key: wall.uid, position: [midX, height / 2, midZ], size: horizontal ? [length, height, thickness] : [thickness, height, length] }];
  }
  const side = (length - gap) / 2;
  if (wall.opening === 'window') {
    const sill = 0.9;
    const head = Math.min(height - 0.3, 2.05);
    return [
      { key: `${wall.uid}-sill`, position: [midX, sill / 2, midZ], size: horizontal ? [length, sill, thickness] : [thickness, sill, length] },
      { key: `${wall.uid}-head`, position: [midX, (head + height) / 2, midZ], size: horizontal ? [length, height - head, thickness] : [thickness, height - head, length] },
    ];
  }
  const shift = (side + gap) / 2;
  if (horizontal) {
    return [
      { key: `${wall.uid}-a`, position: [midX - shift, height / 2, midZ], size: [side, height, thickness] },
      { key: `${wall.uid}-b`, position: [midX + shift, height / 2, midZ], size: [side, height, thickness] },
    ];
  }
  return [
    { key: `${wall.uid}-a`, position: [midX, height / 2, midZ - shift], size: [thickness, height, side] },
    { key: `${wall.uid}-b`, position: [midX, height / 2, midZ + shift], size: [thickness, height, side] },
  ];
}
