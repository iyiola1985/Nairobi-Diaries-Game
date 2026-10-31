export type SkyPeriod = 'day' | 'sunset' | 'evening' | 'night';

export interface NairobiClock {
  date: Date;
  weekday: string;
  hour: number;
  minute: number;
  minutes: number;
  label: string;
  timeOfDay: SkyPeriod;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function nairobiNow(date = new Date()): NairobiClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(read('hour'));
  const minute = Number(read('minute'));
  const minutes = hour * 60 + minute;
  return {
    date,
    weekday: read('weekday'),
    hour,
    minute,
    minutes,
    label: `${read('weekday')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timeOfDay: skyFor(minutes),
  };
}

export function skyFor(minutes: number): SkyPeriod {
  if (minutes >= 6 * 60 && minutes < 17 * 60) return 'day';
  if (minutes >= 17 * 60 && minutes < 18 * 60 + 30) return 'sunset';
  if (minutes >= 18 * 60 + 30 && minutes < 21 * 60) return 'evening';
  return 'night';
}

export function weekdayIndex(date = new Date()): number {
  const name = nairobiNow(date).weekday;
  const index = WEEKDAYS.indexOf(name);
  return index === -1 ? date.getDay() : index;
}
