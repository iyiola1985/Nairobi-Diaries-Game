import type { CharacterConfig } from '../character/types';

export interface NetPlayer {
  userId: string;
  username: string;
  displayName: string;
  districtId: string;
  x: number;
  z: number;
  heading: number;
}

/**
 * Remote presence is intentionally empty until a server exists.
 * Do not fill peers with generated people.
 */
export interface PresenceClient {
  readonly mode: 'local';
  self: NetPlayer;
  peers(): readonly NetPlayer[];
}

export function localPresence(character: CharacterConfig, districtId = 'nairobi-cbd'): PresenceClient {
  return {
    mode: 'local',
    self: {
      userId: 'local',
      username: character.username || 'guest',
      displayName: character.displayName || 'Guest',
      districtId,
      x: 0,
      z: 0,
      heading: 0,
    },
    peers: () => [],
  };
}
