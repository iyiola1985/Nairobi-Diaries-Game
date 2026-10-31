import { describe, expect, it } from 'vitest';
import { nairobiNow } from './clock';
import { afterDark, nextPeriod, streetLampsOn, sunOffset } from '../world/sky';
import { districtById, districtStops } from './districts';
import { buyCar, buyFurniture, buyHome, buyMeal, drink, emptyLife, helpOut, workShift } from './economy';
import { opening } from './hours';
import { quoteRide } from './travel';

const afternoon = new Date('2026-10-16T10:24:00Z');
const night = new Date('2026-10-16T19:30:00Z');

describe('Nairobi clock', () => {
  it('reads 13:24 in Africa/Nairobi on the sample afternoon', () => {
    const clock = nairobiNow(afternoon);
    expect(clock.hour).toBe(13);
    expect(clock.minute).toBe(24);
    expect(clock.timeOfDay).toBe('day');
  });

  it('steps from daylight to night and lights the street after dark', () => {
    expect(nextPeriod('day')).toBe('sunset');
    expect(nextPeriod('sunset')).toBe('evening');
    expect(nextPeriod('evening')).toBe('night');
    expect(nextPeriod('night')).toBe('day');
    expect(streetLampsOn('day')).toBe(false);
    expect(streetLampsOn('sunset')).toBe(true);
    expect(afterDark('sunset')).toBe(false);
    expect(afterDark('evening')).toBe(true);
    expect(afterDark('night')).toBe(true);
    expect(sunOffset('day').shadow).toBe(true);
    expect(sunOffset('night').shadow).toBe(false);
    expect(sunOffset('night').y).toBeGreaterThan(sunOffset('evening').y);
  });
});

describe('opening hours', () => {
  it('keeps the named malls open in the afternoon and a night venue closed', () => {
    expect(opening('Diamond Shopping Mall', afternoon).open).toBe(true);
    expect(opening('Taveta Shopping Mall', afternoon).open).toBe(true);
    expect(opening('Times Tower', afternoon).kind).toBe('landmark');
    const club = opening('Sample Club', afternoon);
    expect(club.kind).toBe('night');
    expect(club.open).toBe(false);
    expect(club.status).toContain('18:00');
    expect(opening('Sample Club', night).open).toBe(true);
  });

  it('closes a bank on Sunday', () => {
    const sunday = new Date('2026-10-18T08:00:00Z');
    expect(opening('Equity Bank', sunday).open).toBe(false);
  });
});

describe('environs', () => {
  it('includes the requested districts and a cheaper matatu than a booked ride', () => {
    const ids = districtStops().map((stop) => stop.id);
    expect(ids).toEqual(['kilimani', 'lavington', 'kileleshwa', 'ngong-road', 'trm', 'kiambu-road', 'jkia', 'syokimau']);
    const airport = districtById('jkia');
    expect(airport?.name).toContain('Jomo Kenyatta');
    expect(airport && airport.km).toBeGreaterThan(5);
    const matatu = quoteRide('matatu', airport?.km ?? 1);
    const ride = quoteRide('ride', airport?.km ?? 1);
    expect(matatu.coins).toBeLessThan(ride.coins);
    expect(matatu.note).toMatch(/not a live fare/i);
  });

  it('gets thirsty and tired, then recovers with a drink and a task', () => {
    let life = emptyLife();
    const thirsty = drink({ ...life, coins: 15, thirst: 10 });
    expect(thirsty.ok).toBe(true);
    expect(thirsty.life.thirst).toBeGreaterThan(10);
    life = helpOut({ ...life, coins: 0, energy: 40 }, 1_000).life;
    expect(life.coins).toBe(80);
    expect(life.energy).toBeLessThan(40);
  });
});

describe('coins', () => {
  it('earns a shift, then spends on a meal, a home, a car, and furniture', () => {
    let life = emptyLife();
    const earned = workShift(life, 1_000, true);
    expect(earned.ok).toBe(true);
    life = earned.life;
    expect(life.coins).toBe(250);
    expect(workShift(life, 1_000, true).ok).toBe(false);
    life = { ...life, coins: 4000 };
    life = buyMeal(life, true).life;
    expect(life.coins).toBe(3960);
    const home = buyHome(life, 10, 12);
    expect(home.ok).toBe(true);
    life = home.life;
    expect(buyHome(life, 1, 1).ok).toBe(false);
    life = buyCar(life).life;
    expect(life.car).toBe(true);
    life = buyFurniture(life, 'bed').life;
    expect(life.furniture).toEqual(['bed']);
    expect(buyFurniture(life, 'bed').ok).toBe(false);
  });
});
