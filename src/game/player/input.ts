import type { RideMode } from '../world/ride';

export const worldInput = {
  keys: { w: false, a: false, s: false, d: false, shift: false },
  stick: { x: 0, y: 0 },
  yaw: 0.8,
  pitch: 0.18,
  distance: 3.5,
  paused: false,
  interact: false,
  /**
   * One ride request. A mode and until board the character on a vehicle that this scene moves.
   * Without them, the same request only lands at x, z.
   */
  ride: null as null | { x: number; z: number; mode?: RideMode; until?: number; land?: boolean },
  pace: 'walk' as 'walk' | 'run' | 'sprint',
  emoteUntil: 0,
  /** True while a selected destination is moving the character. */
  guiding: false,
  /** True while the pointer is dragging the camera. */
  lookHeld: false,
};

export const livePose = {
  x: 0,
  z: 0,
  heading: 0,
};

export type MoveControl = 'forward' | 'back' | 'left' | 'right' | 'run' | 'interact';

/** Physical keys and the printed character, so a focused button cannot swallow WASD or arrows. */
export function movementKey(code: string, key: string): MoveControl | null {
  const printed = key.toLowerCase();
  if (code === 'KeyW' || printed === 'w' || code === 'ArrowUp' || printed === 'arrowup') return 'forward';
  if (code === 'KeyS' || printed === 's' || code === 'ArrowDown' || printed === 'arrowdown') return 'back';
  if (code === 'KeyA' || printed === 'a' || code === 'ArrowLeft' || printed === 'arrowleft') return 'left';
  if (code === 'KeyD' || printed === 'd' || code === 'ArrowRight' || printed === 'arrowright') return 'right';
  if (code === 'ShiftLeft' || code === 'ShiftRight' || printed === 'shift') return 'run';
  if (code === 'KeyE' || printed === 'e') return 'interact';
  return null;
}

export function typingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

export function releaseKeys(): void {
  worldInput.keys.w = false;
  worldInput.keys.a = false;
  worldInput.keys.s = false;
  worldInput.keys.d = false;
  worldInput.keys.shift = false;
  worldInput.stick.x = 0;
  worldInput.stick.y = 0;
  worldInput.interact = false;
}
