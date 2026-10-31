import { describe, expect, it } from 'vitest';
import { buyHome, emptyLife } from './economy';
import { applyTemplate, drawRoom, drawWall, markOpening, straightWall } from './plan';

function owned() {
  const bought = buyHome({ ...emptyLife(), coins: 500, origin: 'scratch' }, 1, 2);
  if (!bought.ok) throw new Error(bought.message);
  return bought.life;
}

describe('floor plan', () => {
  it('keeps a wall straight on the grid', () => {
    expect(straightWall(1, 1, 4, 1)).toEqual({ x1: 1, z1: 1, x2: 4, z2: 1 });
    expect(straightWall(4, 1, 1, 1)).toEqual({ x1: 1, z1: 1, x2: 4, z2: 1 });
    expect(straightWall(2, 2, 2, 2)).toBeNull();
  });

  it('draws a room, then marks a door', () => {
    const room = drawRoom(owned(), 2, 2, 8, 7);
    expect(room.ok).toBe(true);
    expect(room.life.design.walls).toHaveLength(4);
    const door = markOpening(room.life, room.life.design.walls[0]?.uid ?? '', 'door');
    expect(door.ok).toBe(true);
    expect(door.life.design.walls[0]?.opening).toBe('door');
  });

  it('places the two-room template with a door', () => {
    const plan = applyTemplate(owned(), 'split');
    expect(plan.ok).toBe(true);
    expect(plan.life.design.walls.some((wall) => wall.opening === 'door')).toBe(true);
    expect(drawWall(plan.life, 0, 0, 0, 0).ok).toBe(false);
  });
});
