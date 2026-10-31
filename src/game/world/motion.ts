export interface StopPoint {
  x: number;
  z: number;
}

/** Mapped signals alternate. Index 0 is green while index 1 is red, then they swap. */
export function signalAllows(index: number, seconds: number, greenSeconds = 12): boolean {
  const span = Math.max(1, greenSeconds);
  const slot = Math.floor(seconds / span) % 2;
  return slot === index % 2;
}

/**
 * Hold if the vehicle is heading toward a red signal and is close to it.
 * Green signals and signals off to the side do not stop the lane.
 */
export function holdForSignal(
  x: number,
  z: number,
  dx: number,
  dz: number,
  signals: readonly StopPoint[],
  open: readonly boolean[],
  reach = 16,
): boolean {
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return false;
  const forwardX = dx / length;
  const forwardZ = dz / length;
  for (let i = 0; i < signals.length; i += 1) {
    if (open[i]) continue;
    const signal = signals[i];
    if (!signal) continue;
    const towardX = signal.x - x;
    const towardZ = signal.z - z;
    const along = towardX * forwardX + towardZ * forwardZ;
    const side = Math.abs(towardX * forwardZ - towardZ * forwardX);
    if (along > 2 && along < reach && side < 8) return true;
  }
  return false;
}

/** Walk onto a mapped crossing during the second half of the signal cycle. */
export function crossingPoint(
  x: number,
  z: number,
  crossings: readonly StopPoint[],
  seconds: number,
  reach = 14,
): StopPoint | null {
  let best: StopPoint | null = null;
  let bestDistance = reach;
  for (const crossing of crossings) {
    const distance = Math.hypot(crossing.x - x, crossing.z - z);
    if (distance < bestDistance) {
      best = crossing;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  const phase = seconds % 12;
  if (phase < 6) return null;
  const t = (phase - 6) / 6;
  return { x: x + (best.x - x) * t, z: z + (best.z - z) * t };
}
