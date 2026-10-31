import { approachSpeed, easeHeading, facingScale, RUN_SPEED, SPRINT_SPEED, WALK_SPEED } from '../character/fbxMotion';
import { blocked, moveWithCollision } from './collision';
import { cityBounds, cityRoads, colliders, districtAt, districtLabel, wallColliders } from './data';
import type { Graph } from './pathfind';
import { placeTitle } from './places';
import { hitsTraffic } from './traffic';
import {
  CLOSE_METRES,
  ARRIVE_METRES,
  detourStep,
  lineIsOpen,
  nearestRoadPoint,
  nextLeg,
  pedestrianRoads,
  planWalk,
  remainingMetres,
  sameCorridor,
  shiftToPavement,
  skipBlocked,
} from './walk';

export const PLAYER_RADIUS = 0.46;

export interface NavTarget {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface NavGuide {
  id: string;
  name: string;
  points: [number, number][];
  index: number;
  stuck: number;
  yields: number;
  replans: number;
  /** Distance to the current waypoint the last time the walk actually closed on it. */
  mark: number;
  goalX: number;
  goalZ: number;
}

export interface NavMemory {
  guide: NavGuide | null;
  stoppedId: string | null;
  steered: boolean;
  gait: number;
  turnRate: number;
  reported: number;
  drawn: number;
}

export interface NavPose {
  x: number;
  z: number;
  heading: number;
}

export interface NavInput {
  frame: number;
  target: NavTarget | null;
  manual: boolean;
  moveX: number;
  moveZ: number;
  length: number;
  paused: boolean;
  shift: boolean;
  pace: 'walk' | 'run' | 'sprint';
}

export type NavEvent =
  | { type: 'progress'; metres: number | null }
  | { type: 'note'; message: string }
  | { type: 'arrive'; name: string }
  | { type: 'stop' }
  | { type: 'path'; points: [number, number][] };

export function freshNavMemory(): NavMemory {
  return {
    guide: null,
    stoppedId: null,
    steered: false,
    gait: 0,
    turnRate: 0,
    reported: -1,
    drawn: -1,
  };
}

/** Drop a ride landing back to a standstill so the next walk is planned from there. */
export function resetNavMotion(memory: NavMemory): void {
  memory.guide = null;
  memory.stoppedId = null;
  memory.steered = false;
  memory.gait = 0;
  memory.turnRate = 0;
  memory.reported = -1;
  memory.drawn = -1;
}

export function steerAround(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  distance: number,
): { x: number; z: number; moved: boolean; yielded: boolean } {
  const [nx, nz] = moveWithCollision(x, z, dirX * distance, dirZ * distance, PLAYER_RADIUS, colliders, cityBounds(), wallColliders);
  const buildingMoved = nx !== x || nz !== z;
  if (buildingMoved && !hitsTraffic(nx, nz, 0.55)) return { x: nx, z: nz, moved: true, yielded: false };
  const detour = detourStep(
    x,
    z,
    dirX,
    dirZ,
    distance,
    (px, pz) => !blocked(px, pz, PLAYER_RADIUS, colliders, cityBounds(), wallColliders) && !hitsTraffic(px, pz, 0.55),
  );
  if (detour.moved) return { x: detour.x, z: detour.z, moved: true, yielded: false };
  return { x, z, moved: false, yielded: hitsTraffic(x + dirX * distance, z + dirZ * distance, 0.55) };
}

function pavement(x: number, z: number): boolean {
  return blocked(x, z, PLAYER_RADIUS, colliders, cityBounds(), wallColliders);
}

function buildingStop(name: string): string {
  return `A mapped building blocks the entrance of ${placeTitle(name)}. The walk stops rather than passing through it.`;
}

function paceSpeed(shift: boolean, pace: NavInput['pace']): number {
  const chosen = shift ? 'run' : pace;
  if (chosen === 'sprint') return SPRINT_SPEED;
  if (chosen === 'run') return RUN_SPEED;
  return WALK_SPEED;
}

/**
 * One frame of the street walk. The scene calls this; it is the only place a destination moves the character.
 */
export function stepNavigation(memory: NavMemory, pose: NavPose, input: NavInput, graph: Graph): { guiding: boolean; speed: number; events: NavEvent[] } {
  const events: NavEvent[] = [];
  const frame = input.frame;
  const target = input.target;
  let guiding = false;

  const pushPath = (points: [number, number][]) => {
    events.push({ type: 'path', points });
  };

  const open = (x: number, z: number) => !pavement(x, z);

  const giveUp = (following: NavGuide) => {
    const last = following.points[following.points.length - 1];
    const left = last ? Math.hypot(last[0] - pose.x, last[1] - pose.z) : Infinity;
    const doorOpen = Boolean(last && lineIsOpen(pose.x, pose.z, last[0], last[1], open));
    if (left <= CLOSE_METRES && !doorOpen && left > ARRIVE_METRES) {
      memory.guide = null;
      memory.gait = 0;
      memory.turnRate = 0;
      memory.stoppedId = following.id;
      memory.reported = -1;
      guiding = false;
      events.push({ type: 'progress', metres: null });
      events.push({ type: 'note', message: buildingStop(following.name) });
      events.push({ type: 'stop' });
      pushPath([]);
      return;
    }
    if (left <= CLOSE_METRES) {
      memory.guide = null;
      memory.gait = 0;
      memory.turnRate = 0;
      memory.stoppedId = following.id;
      memory.reported = -1;
      guiding = false;
      events.push({ type: 'progress', metres: null });
      events.push({ type: 'arrive', name: following.name });
      pushPath([]);
      return;
    }
    const roads = pedestrianRoads(cityRoads());
    const again = following.replans < 1
      ? planWalk({ graph, roads, fromX: pose.x, fromZ: pose.z, toX: following.goalX, toZ: following.goalZ, open })
      : { kind: 'none' as const, reason: 'street' as const };
    if (again.kind === 'walk' && !sameCorridor(following.points, again.points)) {
      following.points = shiftToPavement(again.points, 2.15, pavement);
      following.index = 0;
      following.stuck = 0;
      following.yields = 0;
      following.replans += 1;
      following.mark = Infinity;
      memory.drawn = -1;
      pushPath(following.points);
      memory.reported = Math.round(again.metres);
      events.push({ type: 'progress', metres: memory.reported });
      return;
    }
    memory.guide = null;
    memory.gait = 0;
    memory.turnRate = 0;
    memory.stoppedId = following.id;
    memory.reported = -1;
    guiding = false;
    events.push({ type: 'progress', metres: null });
    events.push({
      type: 'note',
      message: again.kind === 'none' && again.reason === 'building'
        ? buildingStop(following.name)
        : `No clear path reaches ${placeTitle(following.name)} from here.`,
    });
    events.push({ type: 'stop' });
    pushPath([]);
  };

  if (!target) {
    memory.stoppedId = null;
    memory.steered = false;
    if (memory.guide) {
      memory.guide = null;
      pushPath([]);
    }
  } else if (memory.stoppedId === target.id) {
    guiding = false;
  } else if (input.manual && !input.paused) {
    if (memory.guide) {
      memory.guide = null;
      memory.drawn = -1;
      pushPath([]);
    }
    if (!memory.steered) {
      memory.steered = true;
      memory.reported = -1;
      events.push({ type: 'progress', metres: null });
      events.push({ type: 'note', message: `Steering. The walk to ${placeTitle(target.name)} resumes when you let go.` });
    }
  } else if (!input.paused && (!memory.guide || memory.guide.id !== target.id)) {
    memory.steered = false;
    const here = districtAt(pose.x, pose.z);
    const there = districtAt(target.x, target.z);
    const roads = pedestrianRoads(cityRoads());
    const plan = planWalk({ graph, roads, fromX: pose.x, fromZ: pose.z, toX: target.x, toZ: target.z, open });
    switch (plan.kind) {
      case 'none': {
        memory.guide = null;
        memory.stoppedId = target.id;
        const gap = Boolean(here && there && here.districtId !== there.districtId);
        const other = there && (there.districtId === 'kilimani' || there.districtId === 'nairobi-cbd' || there.districtId === 'hurlingham')
          ? districtLabel(there.districtId)
          : 'that extract';
        let message: string;
        switch (plan.reason) {
          case 'building':
            message = buildingStop(target.name);
            break;
          case 'street': {
            const snap = nearestRoadPoint(roads, target.x, target.z, 120);
            const away = snap ? Math.round(Math.hypot(snap.x - target.x, snap.z - target.z)) : null;
            message = gap
              ? `The mapped streets do not join ${other} from here. Walking cannot cross the gap. Go has a shortened matatu to the district, and you can walk onward from those streets.`
              : away !== null && away > 30
                ? `The mapped streets stay about ${away} m from ${placeTitle(target.name)}, so the walk cannot end at that point.`
                : `No connected street reaches ${placeTitle(target.name)} from here.`;
            break;
          }
          default: {
            const unexpected: never = plan.reason;
            message = unexpected;
          }
        }
        events.push({ type: 'progress', metres: null });
        events.push({ type: 'note', message });
        events.push({ type: 'stop' });
        pushPath([]);
        break;
      }
      case 'walk': {
        const shifted = shiftToPavement(plan.points, 2.15, pavement);
        const previous = shifted[shifted.length - 2];
        const door = shifted[shifted.length - 1];
        const shiftBlocksDoor = Boolean(
          previous && door && shifted.length >= 2 && !lineIsOpen(previous[0], previous[1], door[0], door[1], open),
        );
        const points = shiftBlocksDoor ? plan.points : shifted;
        memory.guide = {
          id: target.id,
          name: target.name,
          points,
          index: 0,
          stuck: 0,
          yields: 0,
          replans: 0,
          mark: Infinity,
          goalX: target.x,
          goalZ: target.z,
        };
        memory.drawn = -1;
        memory.reported = -1;
        pushPath(points);
        const rounded = Math.round(plan.metres);
        events.push({ type: 'progress', metres: rounded });
        events.push({
          type: 'note',
          message: rounded > 650 ? `Walking the mapped streets to ${placeTitle(target.name)}. This route is about ${rounded} m.` : '',
        });
        break;
      }
      default: {
        const unexpected: never = plan;
        void unexpected;
      }
    }
  }

  let intended = 0;
  let face = pose.heading;
  if (input.paused) {
    guiding = false;
  } else if (input.manual) {
    guiding = false;
    intended = paceSpeed(input.shift, input.pace) * Math.min(1, input.length);
    face = Math.atan2(input.moveX, input.moveZ);
  } else {
    const active = memory.guide;
    const destinationId = target?.id ?? null;
    const following = active && destinationId && active.id === destinationId ? active : null;
    if (following && destinationId) {
      const leg = nextLeg(pose.x, pose.z, following.points, following.index);
      if (leg.index !== following.index) following.mark = Infinity;
      following.index = leg.index;
      if (leg.arrived) {
        memory.guide = null;
        memory.gait = 0;
        memory.turnRate = 0;
        memory.stoppedId = destinationId;
        memory.reported = -1;
        events.push({ type: 'progress', metres: null });
        events.push({ type: 'arrive', name: following.name });
        pushPath([]);
      } else {
        intended = paceSpeed(input.shift, input.pace);
        face = leg.heading;
        guiding = true;
      }
    }
  }

  if (input.manual || guiding) intended *= facingScale(pose.heading, face);
  memory.gait = approachSpeed(memory.gait, intended, frame);
  const travel = memory.gait > 0.2 ? memory.gait : 0;
  let stepped = false;
  if (!input.paused && travel > 0) {
    let remain = travel * frame;
    let moved = false;
    const dirX = Math.sin(pose.heading);
    const dirZ = Math.cos(pose.heading);
    while (remain > 0.0001) {
      const step = Math.min(0.18, remain);
      const steered = steerAround(pose.x, pose.z, dirX, dirZ, step);
      if (!steered.moved) {
        const following = !input.manual && memory.guide && target?.id === memory.guide.id ? memory.guide : null;
        if (following && frame >= 0.001) {
          const waiting = steered.yielded && following.yields < 36;
          if (waiting) following.yields += 1;
          else {
            if (!steered.yielded) following.yields = 0;
            const skip = skipBlocked(false, following.stuck, following.index, following.points.length);
            following.stuck = skip.stuck;
            following.index = skip.index;
            if (skip.giveUp) giveUp(following);
          }
        }
        break;
      }
      pose.x = steered.x;
      pose.z = steered.z;
      moved = true;
      remain -= step;
    }
    stepped = moved;
    if (!moved) memory.gait = approachSpeed(memory.gait, 0, frame);
    const following = memory.guide;
    if (moved && following && guiding && frame >= 0.001) {
      following.yields = 0;
      const point = following.points[following.index];
      const dist = point ? Math.hypot(point[0] - pose.x, point[1] - pose.z) : 0;
      const turn = Math.atan2(Math.sin(face - pose.heading), Math.cos(face - pose.heading));
      const closing = Math.abs(turn) >= 0.6 || dist < following.mark - 0.02;
      if (closing) following.mark = dist;
      const skip = skipBlocked(closing, following.stuck, following.index, following.points.length);
      if (skip.index !== following.index) following.mark = Infinity;
      following.stuck = skip.stuck;
      following.index = skip.index;
      if (skip.giveUp) giveUp(following);
    }
  }

  const walking = memory.guide && guiding && target?.id === memory.guide.id ? memory.guide : null;
  if (walking) {
    if (memory.drawn !== walking.index) {
      memory.drawn = walking.index;
      pushPath([[pose.x, pose.z], ...walking.points.slice(walking.index)]);
    }
    const left = Math.round(remainingMetres(pose.x, pose.z, walking.points, walking.index));
    if (Math.abs(left - memory.reported) >= 8) {
      memory.reported = left;
      events.push({ type: 'progress', metres: left });
    }
  }

  const maxTurn = intended >= RUN_SPEED ? 4.4 : 2.5;
  const turned = easeHeading(pose.heading, input.manual || guiding ? face : pose.heading, memory.turnRate, frame, maxTurn);
  pose.heading = turned.heading;
  memory.turnRate = turned.rate;
  return { guiding, speed: stepped ? memory.gait : 0, events };
}
