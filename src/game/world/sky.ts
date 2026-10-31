import type { TimeOfDay } from '../../store/useGame';

export function nextPeriod(time: TimeOfDay): TimeOfDay {
  switch (time) {
    case 'day':
      return 'sunset';
    case 'sunset':
      return 'evening';
    case 'evening':
      return 'night';
    case 'night':
      return 'day';
    default: {
      const unexpected: never = time;
      return unexpected;
    }
  }
}

/** Street lamps come on while the sun is still low, as they do in the city. */
export function streetLampsOn(time: TimeOfDay): boolean {
  switch (time) {
    case 'day':
      return false;
    case 'sunset':
    case 'evening':
    case 'night':
      return true;
    default: {
      const unexpected: never = time;
      return unexpected;
    }
  }
}

/** Windows and vehicle lamps wait until it is actually dark. */
export function afterDark(time: TimeOfDay): boolean {
  switch (time) {
    case 'day':
    case 'sunset':
      return false;
    case 'evening':
    case 'night':
      return true;
    default: {
      const unexpected: never = time;
      return unexpected;
    }
  }
}

export function sunOffset(time: TimeOfDay): { x: number; y: number; z: number; shadow: boolean } {
  switch (time) {
    case 'day':
      return { x: 78, y: 128, z: -36, shadow: true };
    case 'sunset':
      return { x: -96, y: 26, z: 18, shadow: true };
    case 'evening':
      return { x: -48, y: 14, z: 24, shadow: false };
    case 'night':
      return { x: 24, y: 70, z: 36, shadow: false };
    default: {
      const unexpected: never = time;
      return unexpected;
    }
  }
}
