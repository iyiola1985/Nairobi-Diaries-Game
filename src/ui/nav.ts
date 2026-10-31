let pendingPlaces = false;

export function queuePlaces(): void {
  pendingPlaces = true;
}

export function takeQueuedPlaces(): boolean {
  const open = pendingPlaces;
  pendingPlaces = false;
  return open;
}
