import { nairobiNow, weekdayIndex } from './clock';

export type PlaceKind = 'mall' | 'shop' | 'market' | 'restaurant' | 'cinema' | 'hotel' | 'bank' | 'worship' | 'night' | 'office' | 'landmark';

export interface PlaceSchedule {
  kind: PlaceKind;
  /** Minutes from midnight in Africa/Nairobi. Close may be after midnight when overnight is set. */
  open: number;
  close: number;
  overnight: boolean;
  weekdaysOnly: boolean;
  saturdayUntil: number | null;
  note: string;
}

const TYPICAL = 'Typical hours for this kind of place. Not a live timetable from the business.';

export function scheduleFor(name: string): PlaceSchedule {
  const text = name.toLowerCase();
  if (/\b(club|lounge|disco|nightclub)\b/.test(text)) {
    return { kind: 'night', open: 18 * 60, close: 3 * 60, overnight: true, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Night venues in this game run from 18:00 to 03:00.` };
  }
  if (text.includes('mall')) {
    return { kind: 'mall', open: 9 * 60, close: 21 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Malls here open 09:00–21:00.` };
  }
  if (text.includes('cinema') || text.includes('odeon')) {
    return { kind: 'cinema', open: 11 * 60, close: 23 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Cinemas here open 11:00–23:00.` };
  }
  if (/restaurant|java house|subway/.test(text)) {
    return { kind: 'restaurant', open: 8 * 60, close: 22 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Restaurants here open 08:00–22:00.` };
  }
  if (text.includes('hotel')) {
    return { kind: 'hotel', open: 0, close: 24 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: 'Hotel doors stay open in this game. That is not a claim about the real front desk.' };
  }
  if (text.includes('market')) {
    return { kind: 'market', open: 7 * 60, close: 18 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Markets here open 07:00–18:00.` };
  }
  if (/supermarket|naivas|tuskys|\bbata\b/.test(text)) {
    return { kind: 'shop', open: 8 * 60, close: 21 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Shops here open 08:00–21:00.` };
  }
  if (/bank|equity|stanbic|ecobank|standard chartered/.test(text)) {
    return { kind: 'bank', open: 9 * 60, close: 16 * 60, overnight: false, weekdaysOnly: true, saturdayUntil: 12 * 60, note: `${TYPICAL} Banks here use Mon–Fri 09:00–16:00 and Sat 09:00–12:00.` };
  }
  if (/mosque|basilica|cathedral|church|baptister/.test(text)) {
    return { kind: 'worship', open: 6 * 60, close: 20 * 60, overnight: false, weekdaysOnly: false, saturdayUntil: null, note: `${TYPICAL} Places of worship here are marked open 06:00–20:00. Service times are not listed.` };
  }
  if (/kenyatta international|times tower|convention|city hall|parliament|bunge/.test(text)) {
    return { kind: 'landmark', open: 8 * 60, close: 18 * 60, overnight: false, weekdaysOnly: true, saturdayUntil: null, note: `${TYPICAL} Public buildings here are marked open on weekdays 08:00–18:00.` };
  }
  return { kind: 'office', open: 8 * 60, close: 17 * 60, overnight: false, weekdaysOnly: true, saturdayUntil: null, note: `${TYPICAL} Other named buildings are treated as weekday offices, 08:00–17:00.` };
}

export interface OpenState {
  open: boolean;
  kind: PlaceKind;
  note: string;
  status: string;
}

export function opening(name: string, date = new Date()): OpenState {
  const schedule = scheduleFor(name);
  const clock = nairobiNow(date);
  const day = weekdayIndex(date);
  const now = clock.minutes;
  let open = contains(now, schedule);
  if (schedule.weekdaysOnly && day === 0) open = false;
  if (schedule.weekdaysOnly && day === 6) open = schedule.saturdayUntil !== null && now >= schedule.open && now < schedule.saturdayUntil;
  const status = open ? 'Open' : `Closed · ${closedHint(schedule, day)}`;
  return { open, kind: schedule.kind, note: schedule.note, status };
}

function contains(now: number, schedule: PlaceSchedule): boolean {
  if (schedule.overnight) return now >= schedule.open || now < schedule.close;
  return now >= schedule.open && now < schedule.close;
}

function closedHint(schedule: PlaceSchedule, day: number): string {
  if (schedule.kind === 'night') return 'opens 18:00';
  if (schedule.weekdaysOnly && day === 0) return 'closed Sunday';
  if (schedule.weekdaysOnly && day === 6 && schedule.saturdayUntil === null) return 'closed Saturday';
  return `opens ${formatMinutes(schedule.open)}`;
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
