import { beforeAll, describe, expect, it } from 'vitest';
import { persistedGameSlice } from '../../store/useGame';
import { blocked } from './collision';
import { cityBounds, cityRoads, colliders, districtAt, kilimani, wallColliders } from './data';
import { project } from './project';
import { buildRoadGraph } from './pathfind';
import { poiRegistry, selectionPoint, type PointOfInterest } from './poi';
import { streetSpawn } from './spawn';
import { clearTraffic } from './traffic';
import { freshNavMemory, stepNavigation, type NavEvent, type NavInput, type NavMemory, type NavPose, type NavTarget } from './session';
import { remainingMetres, walkLines } from './walk';
import type { Graph } from './pathfind';

const FRAME = 0.05;

let graph: Graph;

beforeAll(() => {
  graph = buildRoadGraph(walkLines(cityRoads()), 14, 18);
});

function targetOf(place: { id: string; name: string }): NavTarget | null {
  const here = selectionPoint(place.id);
  if (!here) return null;
  return { id: place.id, name: place.name, x: here.x, z: here.z };
}

function onFoot(x: number, z: number): boolean {
  return blocked(x, z, 0.3, colliders, cityBounds(), wallColliders);
}

function crossesBuilding(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  for (let t = 0.2; t <= 0.8; t += 0.1) {
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    if (onFoot(x, z)) return true;
  }
  return false;
}

function chordDistance(x: number, z: number, start: [number, number], end: [number, number]): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / len2));
  return Math.hypot(x - (start[0] + dx * t), z - (start[1] + dz * t));
}

interface Tick {
  memory: NavMemory;
  pose: NavPose;
  target: NavTarget | null;
  manual?: { x: number; z: number };
}

function tick(step: Tick, extra: Partial<NavInput> = {}) {
  const manual = step.manual;
  const input: NavInput = {
    frame: FRAME,
    target: step.target,
    manual: Boolean(manual),
    moveX: manual?.x ?? 0,
    moveZ: manual?.z ?? 0,
    length: manual ? Math.hypot(manual.x, manual.z) : 0,
    paused: false,
    shift: false,
    pace: 'walk',
    ...extra,
  };
  return stepNavigation(step.memory, step.pose, input, graph);
}

function play(step: Tick, frames: number, extra: Partial<NavInput> = {}) {
  const events: NavEvent[] = [];
  let guiding = false;
  let speed = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const result = tick(step, extra);
    guiding = result.guiding;
    speed = result.speed;
    events.push(...result.events);
  }
  return { events, guiding, speed };
}

function nearbyPlace(origin: { x: number; z: number }, district: 'kilimani' | 'nairobi-cbd', min: number, max: number) {
  let best: { place: PointOfInterest; at: NavTarget; distance: number } | null = null;
  for (const place of poiRegistry()) {
    const at = targetOf(place);
    if (!at) continue;
    if (districtAt(at.x, at.z)?.districtId !== district) continue;
    const distance = Math.hypot(at.x - origin.x, at.z - origin.z);
    if (distance < min || distance > max) continue;
    if (!best || distance < best.distance) best = { place, at, distance };
  }
  return best;
}

describe('street navigation session', () => {
  it('walks toward a nearby destination without entering a building', () => {
    clearTraffic();
    const origin = { x: kilimani.spawn.x, z: kilimani.spawn.z, heading: 0 };
    const place = nearbyPlace(origin, 'kilimani', 25, 90);
    expect(place).toBeTruthy();
    if (!place) return;
    const step = { memory: freshNavMemory(), pose: { ...origin }, target: place.at };
    const played = play(step, 80);
    const route = played.events.find((event): event is Extract<NavEvent, { type: 'path' }> => event.type === 'path' && event.points.length > 1);
    expect(route).toBeTruthy();
    if (!route || !step.memory.guide) return;
    const end = route.points[route.points.length - 1];
    expect(end).toBeTruthy();
    if (!end) return;
    const started = remainingMetres(origin.x, origin.z, route.points, 0);
    const left = remainingMetres(step.pose.x, step.pose.z, step.memory.guide.points, step.memory.guide.index);
    expect(left).toBeLessThan(started - 2);
    expect(Math.hypot(step.pose.x - origin.x, step.pose.z - origin.z)).toBeGreaterThan(2);
    expect(Math.hypot(end[0] - place.at.x, end[1] - place.at.z)).toBeLessThan(8);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
    expect(played.events.some((event) => event.type === 'stop')).toBe(false);
  });

  it('follows the street around a corner instead of the straight chord', () => {
    clearTraffic();
    const adams = kilimani.destinations.find((place) => place.name === 'Adams Arcade');
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(adams).toBeTruthy();
    expect(yaya).toBeTruthy();
    if (!adams || !yaya) return;
    const goal = targetOf(yaya);
    expect(goal).toBeTruthy();
    if (!goal) return;
    const step = {
      memory: freshNavMemory(),
      pose: { x: adams.x, z: adams.z, heading: 0 },
      target: goal,
    };
    const played = play(step, 100);
    const path = played.events.find((event): event is Extract<NavEvent, { type: 'path' }> => event.type === 'path' && event.points.length > 4);
    expect(path).toBeTruthy();
    if (!path) return;
    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    if (!start || !end) return;
    const bend = Math.max(...path.points.map((point) => chordDistance(point[0], point[1], start, end)));
    expect(bend).toBeGreaterThan(8);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
    expect(Math.hypot(step.pose.x - adams.x, step.pose.z - adams.z)).toBeGreaterThan(3);
  });

  it('does not walk through a building that stands on the straight line', () => {
    clearTraffic();
    const origin = { x: kilimani.spawn.x, z: kilimani.spawn.z };
    let chosen: NavTarget | null = null;
    for (const place of poiRegistry()) {
      const at = targetOf(place);
      if (!at || districtAt(at.x, at.z)?.districtId !== 'kilimani') continue;
      const distance = Math.hypot(at.x - origin.x, at.z - origin.z);
      if (distance < 40 || distance > 180) continue;
      if (crossesBuilding(origin, at)) {
        chosen = at;
        break;
      }
    }
    expect(chosen).toBeTruthy();
    if (!chosen) return;
    const step = { memory: freshNavMemory(), pose: { ...origin, heading: 0 }, target: chosen };
    const samples: { x: number; z: number }[] = [];
    for (let frame = 0; frame < 120; frame += 1) {
      tick(step);
      samples.push({ x: step.pose.x, z: step.pose.z });
    }
    const last = samples[samples.length - 1];
    expect(last).toBeTruthy();
    if (!last) return;
    expect(Math.hypot(last.x - origin.x, last.z - origin.z)).toBeGreaterThan(2);
    expect(samples.every((sample) => !onFoot(sample.x, sample.z))).toBe(true);
  });

  it('replaces the route when a second destination is chosen while travelling', () => {
    clearTraffic();
    const origin = { x: kilimani.spawn.x, z: kilimani.spawn.z, heading: 0 };
    const first = nearbyPlace(origin, 'kilimani', 40, 120);
    const second = nearbyPlace(origin, 'kilimani', 140, 400);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    const step = { memory: freshNavMemory(), pose: { ...origin }, target: first.at };
    play(step, 30);
    expect(step.memory.guide?.id).toBe(first.at.id);
    step.target = second.at;
    const switched = play(step, 20);
    expect(step.memory.guide?.id).toBe(second.at.id);
    const paths = switched.events.filter((event): event is Extract<NavEvent, { type: 'path' }> => event.type === 'path' && event.points.length > 1);
    const last = paths[paths.length - 1];
    expect(last).toBeTruthy();
    if (!last) return;
    const end = last.points[last.points.length - 1];
    expect(end).toBeTruthy();
    if (!end) return;
    expect(Math.hypot(end[0] - second.at.x, end[1] - second.at.z)).toBeLessThan(8);
    expect(switched.events.some((event) => event.type === 'arrive' && event.name === first.place.name)).toBe(false);
  });

  it('cancels an active walk and then accepts manual movement', () => {
    clearTraffic();
    const origin = { x: kilimani.spawn.x, z: kilimani.spawn.z, heading: 0 };
    const place = nearbyPlace(origin, 'kilimani', 40, 140);
    expect(place).toBeTruthy();
    if (!place) return;
    const step: Tick = { memory: freshNavMemory(), pose: { ...origin }, target: place.at };
    play(step, 25);
    expect(step.memory.guide).toBeTruthy();
    step.target = null;
    const stopped = play(step, 20);
    expect(step.memory.guide).toBeNull();
    expect(stopped.guiding).toBe(false);
    expect(stopped.events.some((event) => event.type === 'arrive')).toBe(false);
    const settled = { x: step.pose.x, z: step.pose.z };
    play(step, 8);
    expect(Math.hypot(step.pose.x - settled.x, step.pose.z - settled.z)).toBeLessThan(0.05);
    let moved = 0;
    const parked = { ...step.pose };
    for (let turn = 0; turn < 8; turn += 1) {
      step.pose.x = parked.x;
      step.pose.z = parked.z;
      step.pose.heading = turn * Math.PI / 4;
      step.memory.gait = 0;
      step.memory.turnRate = 0;
      step.manual = { x: Math.cos(step.pose.heading), z: Math.sin(step.pose.heading) };
      play(step, 24);
      moved = Math.max(moved, Math.hypot(step.pose.x - parked.x, step.pose.z - parked.z));
      step.manual = undefined;
    }
    expect(moved).toBeGreaterThan(0.5);
  });

  it('refuses a destination the mapped streets do not reach', () => {
    clearTraffic();
    const spawn = streetSpawn();
    const step = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: { id: 'unmapped', name: 'Unmapped point', x: -18000, z: 8000 },
    };
    const played = play(step, 8);
    const note = played.events.find((event) => event.type === 'note');
    expect(note && note.type === 'note' ? note.message : '').toMatch(/cannot cross the gap|cannot end at that point|No connected street/);
    expect(played.events.some((event) => event.type === 'stop')).toBe(true);
    expect(played.events.some((event) => event.type === 'arrive')).toBe(false);
    expect(Math.hypot(step.pose.x - spawn.x, step.pose.z - spawn.z)).toBeLessThan(0.05);
  });

  it('recalculates the Yaya Centre walk after manual steering', () => {
    clearTraffic();
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(yaya).toBeTruthy();
    if (!yaya) return;
    const goal = targetOf(yaya);
    expect(goal).toBeTruthy();
    if (!goal) return;
    const spawn = streetSpawn();
    const step: Tick = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: goal,
    };
    play(step, 40);
    expect(step.memory.guide?.id).toBe(goal.id);
    const before = { x: step.pose.x, z: step.pose.z };
    step.manual = { x: 0, z: 1 };
    const steered = play(step, 24);
    const note = steered.events.find((event) => event.type === 'note');
    expect(note && note.type === 'note' ? note.message : '').toMatch(/Steering\. The walk to Yaya Centre resumes/);
    expect(step.memory.guide).toBeNull();
    expect(Math.hypot(step.pose.x - before.x, step.pose.z - before.z)).toBeGreaterThan(0.4);
    step.manual = undefined;
    const resumed = play(step, 20);
    expect(step.memory.guide?.id).toBe(goal.id);
    const path = resumed.events.find((event): event is Extract<NavEvent, { type: 'path' }> => event.type === 'path' && event.points.length > 4);
    expect(path).toBeTruthy();
    const end = path?.points[path.points.length - 1];
    expect(end).toBeTruthy();
    if (end) expect(Math.hypot(end[0] - goal.x, end[1] - goal.z)).toBeLessThan(8);
    expect(resumed.events.some((event) => event.type === 'arrive')).toBe(false);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
  });

  it('refuses Karen because that extract is not loaded', () => {
    clearTraffic();
    const [x, z] = project(-1.319, 36.715);
    const spawn = streetSpawn();
    const step = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: { id: 'karen', name: 'Karen', x, z },
    };
    const played = play(step, 8);
    const note = played.events.find((event) => event.type === 'note');
    expect(note && note.type === 'note' ? note.message : '').toMatch(/cannot cross the gap|cannot end at that point|No connected street/);
    expect(played.events.some((event) => event.type === 'stop')).toBe(true);
    expect(played.events.some((event) => event.type === 'arrive')).toBe(false);
    expect(Math.hypot(step.pose.x - spawn.x, step.pose.z - spawn.z)).toBeLessThan(0.05);
    expect(districtAt(x, z)).toBeNull();
  });

  function walkUntil(
    step: Tick,
    frames: number,
    done: (events: NavEvent[]) => boolean,
  ) {
    let corridor = false;
    let kilimaniSide = false;
    let inside = false;
    let finished = false;
    let note = '';
    for (let frame = 0; frame < frames && !finished; frame += 1) {
      const result = tick(step);
      if (step.pose.x < -800 && step.pose.x > -3200) corridor = true;
      if (districtAt(step.pose.x, step.pose.z)?.districtId === 'kilimani') kilimaniSide = true;
      if (frame > 8 && frame % 8 === 0 && onFoot(step.pose.x, step.pose.z)) inside = true;
      const said = result.events.find((event) => event.type === 'note');
      if (said && said.type === 'note') note = said.message;
      finished = done(result.events) || result.events.some((event) => event.type === 'stop' || event.type === 'arrive');
    }
    return { corridor, kilimaniSide, inside, finished, note, framePose: { x: step.pose.x, z: step.pose.z } };
  }

  it('walks from Harambee Avenue through the connecting streets and stops at Yaya Centre', () => {
    clearTraffic();
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(yaya).toBeTruthy();
    if (!yaya) return;
    const goal = targetOf(yaya);
    expect(goal).toBeTruthy();
    if (!goal) return;
    const spawn = streetSpawn();
    const step = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: goal,
    };
    let arrived = false;
    const traced = walkUntil(step, 60000, (events) => {
      arrived = events.some((event) => event.type === 'arrive' && event.name === 'Yaya Centre');
      return arrived;
    });
    const guide = step.memory.guide;
    const aim = guide?.points[guide.index];
    const where = guide
      ? `index ${guide.index}/${guide.points.length} aim ${aim ? `${aim[0].toFixed(1)},${aim[1].toFixed(1)}` : 'none'} dist ${aim ? Math.hypot(aim[0] - step.pose.x, aim[1] - step.pose.z).toFixed(1) : '-'} heading ${step.pose.heading.toFixed(2)}`
      : `stopped ${step.memory.stoppedId ?? 'none'}`;
    expect(arrived, `${traced.note} @ ${traced.framePose.x.toFixed(1)},${traced.framePose.z.toFixed(1)} ${where}`).toBe(true);
    expect(traced.corridor).toBe(true);
    expect(traced.kilimaniSide).toBe(true);
    expect(traced.inside).toBe(false);
    expect(step.memory.guide).toBeNull();
    expect(step.memory.stoppedId).toBe(goal.id);
    expect(Math.hypot(step.pose.x - goal.x, step.pose.z - goal.z)).toBeLessThan(8);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
    const parked = { x: step.pose.x, z: step.pose.z };
    const after = play(step, 20);
    expect(after.speed).toBe(0);
    expect(after.guiding).toBe(false);
    expect(Math.hypot(step.pose.x - parked.x, step.pose.z - parked.z)).toBe(0);
  }, 180000);

  it('walks from Adams Arcade to Yaya Centre and stops at the entrance', () => {
    clearTraffic();
    const adams = kilimani.destinations.find((place) => place.name === 'Adams Arcade');
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(adams).toBeTruthy();
    expect(yaya).toBeTruthy();
    if (!adams || !yaya) return;
    const goal = targetOf(yaya);
    expect(goal).toBeTruthy();
    if (!goal) return;
    const step = {
      memory: freshNavMemory(),
      pose: { x: adams.x, z: adams.z, heading: 0 },
      target: goal,
    };
    let arrived = false;
    const traced = walkUntil(step, 40000, (events) => {
      arrived = events.some((event) => event.type === 'arrive' && event.name === 'Yaya Centre');
      return arrived;
    });
    expect(arrived).toBe(true);
    expect(traced.inside).toBe(false);
    expect(Math.hypot(step.pose.x - adams.x, step.pose.z - adams.z)).toBeGreaterThan(20);
    expect(Math.hypot(step.pose.x - goal.x, step.pose.z - goal.z)).toBeLessThan(8);
    expect(step.memory.stoppedId).toBe(goal.id);
    const parked = { x: step.pose.x, z: step.pose.z };
    play(step, 16);
    expect(Math.hypot(step.pose.x - parked.x, step.pose.z - parked.z)).toBe(0);
  }, 120000);

  it('walks from the CBD spawn toward Yaya Centre', () => {
    clearTraffic();
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(yaya).toBeTruthy();
    if (!yaya) return;
    const goal = targetOf(yaya);
    expect(goal).toBeTruthy();
    if (!goal) return;
    const spawn = streetSpawn();
    const step = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: goal,
    };
    const played = play(step, 40);
    const path = played.events.find((event): event is Extract<NavEvent, { type: 'path' }> => event.type === 'path' && event.points.length > 4);
    expect(path).toBeTruthy();
    if (!path) return;
    const end = path.points[path.points.length - 1];
    expect(end).toBeTruthy();
    if (end) expect(Math.hypot(end[0] - goal.x, end[1] - goal.z)).toBeLessThan(8);
    expect(step.memory.guide).toBeTruthy();
    if (!step.memory.guide) return;
    const started = remainingMetres(spawn.x, spawn.z, step.memory.guide.points, 0);
    const left = remainingMetres(step.pose.x, step.pose.z, step.memory.guide.points, step.memory.guide.index);
    expect(left).toBeLessThan(started - 2);
    expect(step.pose.x).toBeLessThan(spawn.x);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
    expect(played.events.some((event) => event.type === 'stop')).toBe(false);
  });

  it('announces arrival and then stands still', () => {
    clearTraffic();
    const origin = { x: kilimani.spawn.x, z: kilimani.spawn.z, heading: 0 };
    const place = nearbyPlace(origin, 'kilimani', 12, 55);
    expect(place).toBeTruthy();
    if (!place) return;
    const step = { memory: freshNavMemory(), pose: { ...origin }, target: place.at };
    let arrived = false;
    for (let frame = 0; frame < 1600 && !arrived; frame += 1) {
      const result = tick(step);
      arrived = result.events.some((event) => event.type === 'arrive' && event.name === place.place.name);
    }
    expect(arrived).toBe(true);
    expect(step.memory.guide).toBeNull();
    expect(step.memory.stoppedId).toBe(place.at.id);
    const parked = { x: step.pose.x, z: step.pose.z };
    const after = play(step, 20);
    expect(after.guiding).toBe(false);
    expect(after.speed).toBe(0);
    expect(Math.hypot(step.pose.x - parked.x, step.pose.z - parked.z)).toBe(0);
  });

  it('starts a new walk from the street spawn after a refresh clears the route', () => {
    clearTraffic();
    const draft = {
      phase: 'world' as const,
      creatorReturn: 'world' as const,
      character: {} as never,
      savedLooks: [],
      timeOfDay: 'day' as const,
      campaignStats: {},
      life: {} as never,
      routeTargetId: 'b26772773',
      notice: 'Walking to somewhere',
    };
    const saved = persistedGameSlice(draft);
    expect(saved).not.toHaveProperty('routeTargetId');
    expect(Object.keys(saved)).not.toContain('notice');
    const spawn = streetSpawn();
    const place = nearbyPlace(spawn, 'nairobi-cbd', 20, 120);
    expect(place).toBeTruthy();
    if (!place) return;
    const step = {
      memory: freshNavMemory(),
      pose: { x: spawn.x, z: spawn.z, heading: spawn.heading },
      target: place.at,
    };
    const before = Math.hypot(place.at.x - spawn.x, place.at.z - spawn.z);
    play(step, 60);
    expect(step.memory.guide?.id).toBe(place.at.id);
    expect(Math.hypot(place.at.x - step.pose.x, place.at.z - step.pose.z)).toBeLessThan(before - 1);
    expect(onFoot(step.pose.x, step.pose.z)).toBe(false);
  });
});
