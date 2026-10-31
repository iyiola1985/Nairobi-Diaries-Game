import { describe, expect, it } from 'vitest';
import { advanceRide, beginRide, rideBody } from './ride';

const lanes = [
  { points: [[0, 0], [0, 40], [30, 40]] as [number, number][], length: 70 },
  { points: [[0, 40], [0, 0]] as [number, number][], length: 40 },
  { points: [[30, 40], [50, 40]] as [number, number][], length: 20 },
];

describe('passenger ride', () => {
  it('boards the lane that heads toward the stop', () => {
    const track = beginRide(lanes, 1, 4, 0, 30);
    expect(track).not.toBeNull();
    expect(track?.lane).toBe(0);
  });

  it('keeps the passenger on that lane as it moves', () => {
    const track = beginRide(lanes, 0, 2, 0, 36);
    const moved = track ? advanceRide(lanes, track, 10, 0, 36) : null;
    expect(moved).not.toBeNull();
    expect(moved!.z).toBeGreaterThan(10);
    expect(moved!.x).toBeCloseTo(0, 0);
  });

  it('hands onto a lane that continues toward the stop', () => {
    const track = { lane: 0, distance: 68 };
    const moved = advanceRide(lanes, track, 6, 48, 40);
    expect(moved).not.toBeNull();
    expect(moved!.track.lane).toBe(2);
    expect(moved!.x).toBeGreaterThan(29);
  });

  it('leaves the head above the cabin', () => {
    expect(rideBody('matatu').h).toBeLessThan(1.7);
    expect(rideBody('pikipiki').seatY).toBeGreaterThan(rideBody('pikipiki').h);
    expect(rideBody('car').seatY).toBeLessThan(rideBody('car').h);
  });
});
