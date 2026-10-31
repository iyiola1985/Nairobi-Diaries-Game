export type TransportMode = 'pikipiki' | 'matatu' | 'ride';

export interface RideQuote {
  mode: TransportMode;
  label: string;
  coins: number;
  seconds: number;
  note: string;
}

const NOTE = 'Game coins and a shortened ride. Not a live fare or a live arrival time.';

export function quoteRide(mode: TransportMode, km: number): RideQuote {
  const distance = Math.max(1, km);
  switch (mode) {
    case 'pikipiki':
      return { mode, label: 'Pikipiki', coins: Math.round(20 + distance * 6), seconds: 4, note: NOTE };
    case 'matatu':
      return { mode, label: 'Matatu', coins: Math.round(12 + distance * 3), seconds: 8, note: NOTE };
    case 'ride':
      return { mode, label: 'Book a ride', coins: Math.round(35 + distance * 8), seconds: 5, note: NOTE };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
