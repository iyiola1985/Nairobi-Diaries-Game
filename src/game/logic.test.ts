import { describe, expect, it } from 'vitest';
import { liveCampaigns } from './ads/campaigns';
import { locomotionClip, PLAYER_SCALE } from './character/fbxMotion';
import { createDefaultCharacter } from './character/presets';
import { deriveLook } from './character/look';
import { bodyMetrics, faceSignature, validateIdentity } from './character/metrics';
import { randomizeCharacter, resetCategory } from './character/mutate';
import { localPresence } from './multiplayer/presence';
import { blocked, hitsWall, makeCollider, makeWallBlocks, moveWithCollision, pointInPolygon } from './world/collision';
import { buildingsInChunk, CHUNK_METRES, chunkCount, chunkOf, heldLod, lodAt, MID_METRES, NEAR_METRES, visibleChunks } from './world/chunks';
import { coverageReady, districtVisible, DRAW_REACH, EXPANSION_IDS, roadsInView } from './world/coverage';
import { cbd, cityBounds, cityRoads, colliders, districts, extractsFromCatalogue, kilimani, boundsAt, playableExtracts, wallColliders } from './world/data';
import { crossingPoint, holdForSignal, signalAllows } from './world/motion';
import { buildingRole, collectFitments, shownHeight } from './world/architecture';
import { extrudeFootprints, joinedRibbon } from './world/meshes';
import { buildRoadGraph, connectedRoute, nearestWithin, routeBetween, shortestPath } from './world/pathfind';
import { project } from './world/project';
import { movementKey } from './player/input';
import { placeById, placeRegistry, placeTitle, streetLabel, streetLabelRange } from './world/places';
import { circleHitsPolygon } from './world/collision';
import { geometryHonesty, streetSpawn } from './world/spawn';
import { PLAYER_RADIUS } from './world/session';
import { browseDestinations, matchesDestination, nearbyGuides, poiById, poiRegistry, selectionPoint } from './world/poi';
import { extractStatusLabel, NEIGHBOURHOODS } from './world/neighbourhoods';
import { carriageClearer, connectEnds, junctionPads, leftHandOffset, miterEdges } from './world/roads';
import { detourStep, lineIsOpen, nearestRoadPoint, nextLeg, pedestrianRoads, planWalk, remainingMetres, routeGoal, sameCorridor, shiftToPavement, skipBlocked, walkLines } from './world/walk';
import { clearTraffic, hitsTraffic, noteTraffic, setParkedTraffic } from './world/traffic';
import { queueSpots, readableSign, roofTanks, shopSigns, streetBlades, utilityPoles } from './world/locale';
import { furnitureIn } from './world/furniture';

describe('nairobi projection', () => {
  it('puts the published KICC coordinate at the origin', () => {
    const [x, z] = project(-1.28861, 36.82306);
    expect(x).toBeCloseTo(0, 4);
    expect(z).toBeCloseTo(0, 4);
  });

  it('maps north to negative Z and the Times Tower south-east of KICC', () => {
    const north = project(-1.28761, 36.82306);
    expect(north[1]).toBeLessThan(-100);
    const tower = project(-1.29028, 36.82389);
    expect(tower[0]).toBeGreaterThan(0);
    expect(tower[1]).toBeGreaterThan(0);
  });
});

describe('character identity', () => {
  it('keeps the face when clothing changes', () => {
    const base = createDefaultCharacter();
    const dressed = {
      ...base,
      clothing: { ...base.clothing, top: 'tee' as const, topColor: '#111111', dress: 'none' as const },
    };
    expect(faceSignature(base)).toBe(faceSignature(dressed));
    expect(deriveLook(dressed).sleeveColor).toBe('#111111');
    expect(deriveLook(dressed).sleeve).toBe('short');
  });

  it('hides separates under a full dress', () => {
    const base = createDefaultCharacter();
    const evening = { ...base, clothing: { ...base.clothing, dress: 'evening' as const, dressColor: '#111111', outer: 'blazer' as const } };
    const look = deriveLook(evening);
    expect(look.trouser).toBe('none');
    expect(look.skirt).toBe('ankle');
    expect(look.torsoColor).toBe('#111111');
    expect(look.sleeve).toBe('long');
  });

  it('gives a wider hip to the feminine base', () => {
    const feminine = createDefaultCharacter();
    feminine.presentation = 'feminine';
    const masculine = createDefaultCharacter();
    masculine.presentation = 'masculine';
    expect(bodyMetrics(feminine).hip).toBeGreaterThan(bodyMetrics(masculine).hip);
  });

  it('resets one category and preserves the name', () => {
    const base = { ...createDefaultCharacter(), displayName: 'Amina', username: 'amina_k' };
    const edited = { ...base, face: { ...base.face, jaw: 0.92 }, clothing: { ...base.clothing, top: 'tank' as const } };
    const reset = resetCategory(edited, 'face');
    expect(reset.face.jaw).toBeCloseTo(createDefaultCharacter().face.jaw);
    expect(reset.clothing.top).toBe('tank');
    expect(reset.displayName).toBe('Amina');
  });

  it('randomises the body without renaming the player', () => {
    let seed = 9;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const base = { ...createDefaultCharacter(), displayName: 'Amina', username: 'amina_k' };
    const next = randomizeCharacter(base, rng);
    expect(next.displayName).toBe('Amina');
    expect(next.username).toBe('amina_k');
    expect(faceSignature(next)).not.toBe(faceSignature(base));
  });

  it('checks usernames', () => {
    expect(validateIdentity('Jo', 'jo_k')).toEqual({});
    expect(validateIdentity('J', 'Jo')).toHaveProperty('username');
  });
});

describe('city rules', () => {
  it('blocks a point inside a footprint and allows the pavement', () => {
    const box = makeCollider('box', [[0, 0], [10, 0], [10, 10], [0, 10]]);
    const bounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
    expect(pointInPolygon(5, 5, box.polygon)).toBe(true);
    expect(blocked(5, 5, 0.4, [box], bounds)).toBe(true);
    expect(blocked(-3, 5, 0.4, [box], bounds)).toBe(false);
  });

  it('stops at a compound wall and slides along it', () => {
    const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    const walls = makeWallBlocks([{ points: [[0, -3], [0, 3]] }]);
    expect(hitsWall(0, 0, 0.46, walls)).toBe(true);
    expect(hitsWall(2, 0, 0.46, walls)).toBe(false);
    const [x, z] = moveWithCollision(-1, 0, 1.2, 0.4, 0.46, [], bounds, walls);
    expect(x).toBeLessThan(0);
    expect(z).not.toBe(0);
  });

  it('routes along a road', () => {
    const graph = buildRoadGraph([{ points: [[0, 0], [16, 0], [32, 0], [48, 0]] }], 16);
    const path = routeBetween(graph, 0, 0, 48, 0);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1][0]).toBeCloseTo(48);
  });

  it('keeps measured heights and varies missing ones by building type', () => {
    const times = cbd.buildings.find((building) => building.special === 'times-tower');
    expect(times).toBeTruthy();
    expect(shownHeight(times!)).toBe(140);
    expect(buildingRole(times!)).toBe('landmark');
    const measured = cbd.buildings.find((building) => building.heightSource === 'osm-levels' || building.heightSource === 'osm-height');
    expect(measured).toBeTruthy();
    expect(shownHeight(measured!)).toBe(measured!.renderHeight);
    const footprint: [number, number][] = [
      [0, 0],
      [24, 0],
      [24, 18],
      [0, 18],
    ];
    const estimate = {
      id: 'estimate-block',
      name: null,
      height: 14,
      renderHeight: 14,
      heightSource: 'estimate' as const,
      polygon: footprint,
      special: null,
      accent: null,
    };
    const heights = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((id) => shownHeight({ ...estimate, id }));
    expect(new Set(heights).size).toBeGreaterThan(1);
    expect(heights.every((height) => height >= 3.15 && height <= 25.2)).toBe(true);
    expect(shownHeight(estimate)).toBe(shownHeight(estimate));
    expect(shownHeight({ ...estimate, heightSource: 'osm-levels', renderHeight: 12.6 })).toBe(12.6);
    const landmark = collectFitments([{ ...estimate, id: 'kicc-stand-in', special: 'kicc', heightSource: 'published', renderHeight: 22 }]);
    expect(landmark.concrete.length + landmark.metal.length + landmark.cloth.length + landmark.glass.length + landmark.tanks.length).toBe(0);
    const apartments = collectFitments([{ ...estimate, id: 'apt-block', use: 'apartments' }]);
    expect(apartments.concrete.length).toBeGreaterThan(0);
    expect(apartments.glass.length).toBeGreaterThan(0);
  });

  it('extrudes a footprint upward and keeps its north-south extent', () => {
    const geometry = extrudeFootprints([{ polygon: [[0, 0], [10, 0], [10, 10], [0, 10]], height: 20 }]);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    expect(box!.max.y).toBeGreaterThan(19);
    expect(box!.max.z).toBeGreaterThan(9);
    expect(box!.min.z).toBeLessThan(1);
  });

  it('paints road ribbons along the mapped line without changing its width', () => {
    const geometry = joinedRibbon([{ points: [[0, 0], [12, 0]], width: 6 }], 0.07);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const uv = geometry.getAttribute('uv');
    expect(box).not.toBeNull();
    expect(box!.max.x).toBeGreaterThan(11);
    expect(box!.max.z).toBeLessThanOrEqual(3.05);
    expect(box!.min.z).toBeGreaterThanOrEqual(-3.05);
    expect(uv).toBeTruthy();
    expect(uv.count).toBe(geometry.getAttribute('position').count);
  });

  it('loads KICC and Times Tower from the CBD extract', () => {
    expect(cbd.source).toBe('openstreetmap');
    expect(cbd.attribution).toContain('OpenStreetMap');
    expect(cbd.buildings.some((building) => building.special === 'kicc')).toBe(true);
    expect(cbd.buildings.some((building) => building.special === 'times-tower')).toBe(true);
    expect(cbd.buildings.find((building) => building.special === 'kicc')?.accent?.height).toBe(105);
    expect(cbd.buildings.find((building) => building.special === 'times-tower')?.renderHeight).toBe(140);
    expect(PLAYER_SCALE * 180).toBeCloseTo(1.8);
    expect(cbd.destinations.length).toBeGreaterThan(5);
    expect(cbd.roads.some((road) => road.name === 'Harambee Avenue')).toBe(true);
    expect(cbd.roads.some((road) => road.name === 'Kenyatta Avenue')).toBe(true);
  });

  it('loads a walkable Kilimani extract west of the CBD', () => {
    expect(kilimani.source).toBe('openstreetmap');
    expect(kilimani.attribution).toContain('OpenStreetMap');
    expect(kilimani.bounds.maxX).toBeLessThan(cbd.bounds.minX);
    expect(kilimani.roads.some((road) => road.name === 'Argwings Kodhek Road')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Ring Road Kilimani')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Ngong Road')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Dennis Pritt Road')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Wood Avenue')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Lenana Road')).toBe(true);
    expect(kilimani.roads.some((road) => road.name === 'Kilimani Road')).toBe(true);
    expect(kilimani.destinations.some((place) => place.name === 'Yaya Centre')).toBe(true);
    expect(kilimani.destinations.some((place) => place.name === 'Adams Arcade')).toBe(true);
    expect(kilimani.destinations.some((place) => place.name === 'Prestige Plaza')).toBe(true);
    expect(kilimani.buildings.find((building) => building.name === 'Yaya Centre')?.use).toBe('mall');
    expect(kilimani.destinations.find((place) => place.name === 'Yaya Centre')?.geometryNote).toMatch(/not a measured facade/i);
    expect(blocked(kilimani.spawn.x, kilimani.spawn.z, 0.46, colliders, kilimani.bounds)).toBe(false);
    expect(kilimani.roads.some((road) => road.class === 'footway' || road.class === 'service' || road.class === 'path')).toBe(true);
    expect(kilimani.facilities?.every((place) => place.name.trim().length > 1 && place.osm.includes('='))).toBe(true);
    expect(kilimani.facilities?.some((place) => place.kind === 'shopping' || place.kind === 'restaurant' || place.kind === 'church' || place.kind === 'worship')).toBe(true);
    expect(kilimani.intersections?.some((junction) => junction.roads.includes('Argwings Kodhek Road'))).toBe(true);
    expect(Array.isArray(kilimani.parking)).toBe(true);
  });

  it('streams building chunks around the player instead of the whole extract', () => {
    const aroundOrigin = visibleChunks(0, 0);
    expect(aroundOrigin.some((cell) => cell.ix === 0 && cell.iz === 0 && cell.lod === 'near')).toBe(true);
    expect(aroundOrigin.find((cell) => cell.ix === 2 && cell.iz === 0)?.lod).toBe('mid');
    expect(aroundOrigin.find((cell) => cell.ix === 3 && cell.iz === 0)?.lod).toBe('far');
    expect(aroundOrigin.some((cell) => Math.abs(cell.ix) > 8)).toBe(false);
    expect(lodAt(NEAR_METRES)).toBe('near');
    expect(lodAt(NEAR_METRES + 1)).toBe('mid');
    expect(lodAt(MID_METRES + 1)).toBe('far');
    expect(heldLod(NEAR_METRES + 10, 'near')).toBe('near');
    expect(heldLod(NEAR_METRES + 40, 'near')).toBe('mid');
    expect(heldLod(120, 'far')).toBe('near');
    expect(chunkOf(CHUNK_METRES + 1, 0)).toEqual({ ix: 1, iz: 0 });
    const filed = new Set<string>();
    let counted = 0;
    for (const building of kilimani.buildings) {
      const count = building.polygon.length || 1;
      const x = building.polygon.reduce((sum, point) => sum + point[0], 0) / count;
      const z = building.polygon.reduce((sum, point) => sum + point[1], 0) / count;
      const cell = chunkOf(x, z);
      const key = `${cell.ix}:${cell.iz}`;
      if (filed.has(key)) continue;
      filed.add(key);
      counted += buildingsInChunk(kilimani, cell.ix, cell.iz).length;
    }
    expect(counted).toBe(kilimani.buildings.length);
    expect(filed.size).toBe(chunkCount(kilimani).chunks);
    expect(chunkCount(kilimani).chunks).toBeGreaterThan(1);
  });

  it('stops traffic for a red mapped signal and walks onto a mapped crossing', () => {
    const signals = [{ x: 18, z: 0 }];
    expect(signalAllows(0, 1)).toBe(true);
    expect(signalAllows(1, 1)).toBe(false);
    expect(signalAllows(0, 13)).toBe(false);
    expect(holdForSignal(4, 0, 1, 0, signals, [false])).toBe(true);
    expect(holdForSignal(4, 0, 1, 0, signals, [true])).toBe(false);
    expect(holdForSignal(4, 0, -1, 0, signals, [false])).toBe(false);
    const crossing = crossingPoint(0, 0, [{ x: 6, z: 0 }], 9);
    expect(crossing).not.toBeNull();
    expect(crossingPoint(0, 0, [{ x: 6, z: 0 }], 2)).toBeNull();
    expect(crossingPoint(0, 0, [{ x: 40, z: 0 }], 9)).toBeNull();
    const mapped = furnitureIn('kilimani').filter((item) => item.kind === 'signal');
    expect(mapped.length).toBe(2);
  });

  it('loads only cached extracts and leaves catalogue windows out of the mesh', () => {
    const loaded = extractsFromCatalogue({
      'cbd-data.json': cbd,
      'kilimani-data.json': kilimani,
      'kileleshwa-data.json': kilimani,
    });
    expect(loaded.map((item) => item.districtId)).toEqual(['nairobi-cbd', 'kilimani']);
    expect(NEIGHBOURHOODS.filter((item) => item.status === 'catalogued').length).toBeGreaterThan(0);
  });

  it('catalogues neighbouring extract windows without loading them', () => {
    const ids = NEIGHBOURHOODS.map((item) => item.id);
    expect(ids).toEqual(['nairobi-cbd', 'kilimani', 'kileleshwa', 'hurlingham', 'lavington', 'upper-hill', 'westlands', 'karen']);
    expect(NEIGHBOURHOODS.filter((item) => item.status === 'extracted').map((item) => item.id)).toEqual(['nairobi-cbd', 'kilimani', 'hurlingham']);
    expect(extractStatusLabel('catalogued')).toMatch(/not loaded/i);
    expect(NEIGHBOURHOODS.every((item) => item.bbox.south < item.bbox.north && item.bbox.west < item.bbox.east)).toBe(true);
  });

  it('keeps only joined extracts playable and streams roads around the player', () => {
    expect([...EXPANSION_IDS]).toEqual(['nairobi-cbd', 'hurlingham', 'kilimani', 'upper-hill', 'kileleshwa', 'lavington', 'westlands', 'karen']);
    expect(playableExtracts().map((district) => district.districtId)).toEqual(['nairobi-cbd', 'kilimani', 'hurlingham']);
    expect(districts.map((district) => district.districtId)).toEqual(['nairobi-cbd', 'kilimani', 'hurlingham']);
    const partial = playableExtracts({
      'cbd-data.json': cbd,
      'kilimani-data.json': kilimani,
    });
    expect(partial.map((district) => district.districtId)).toEqual(['nairobi-cbd']);
    expect(coverageReady([{ class: 'residential', points: [[0, 0], [30, 0]] }], [])).toBe(false);
    expect(
      coverageReady(
        [
          { class: 'residential', points: [[0, 0], [30, 0]] },
          { class: 'footway', points: [[0, 3], [30, 3]] },
        ],
        [],
      ),
    ).toBe(true);
    expect(
      coverageReady(
        [
          { class: 'residential', points: [[80, 0], [100, 0]] },
          { class: 'footway', points: [[80, 3], [100, 3]] },
        ],
        [{ class: 'secondary', points: [[0, 0], [10, 0]] }],
      ),
    ).toBe(false);
    const spawn = streetSpawn();
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    expect(yaya).toBeTruthy();
    if (!yaya) return;
    expect(districtVisible(kilimani.bounds, kilimani.roads, spawn.x, spawn.z)).toBe(false);
    expect(districtVisible(cbd.bounds, cbd.roads, spawn.x, spawn.z)).toBe(true);
    expect(districtVisible(kilimani.bounds, kilimani.roads, yaya.x, yaya.z)).toBe(true);
    const aroundSpawn = roadsInView(cityRoads(), spawn.x, spawn.z);
    const aroundYaya = roadsInView(cityRoads(), yaya.x, yaya.z);
    expect(aroundSpawn.length).toBeGreaterThan(0);
    expect(aroundSpawn.length).toBeLessThan(cityRoads().length);
    expect(aroundYaya.some((road) => road.points.some((point) => Math.hypot(point[0] - yaya.x, point[1] - yaya.z) < 40))).toBe(true);
    expect(aroundSpawn.some((road) => road.points.some((point) => Math.hypot(point[0] - yaya.x, point[1] - yaya.z) < 40))).toBe(false);
    expect(aroundYaya.some((road) => road.points.some((point) => Math.hypot(point[0] - spawn.x, point[1] - spawn.z) < 40))).toBe(false);
    expect(DRAW_REACH).toBeGreaterThan(760);
  });

  it('keeps left-hand traffic off the centre of a corner', () => {
    const [x, z] = leftHandOffset(1, 0, 2);
    expect(x).toBeCloseTo(0, 4);
    expect(z).toBeCloseTo(-2, 4);
    const edges = miterEdges(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      2,
    );
    const corner = edges[1];
    expect(corner).toBeTruthy();
    const reach = Math.hypot(corner!.left[0] - 10, corner!.left[1]);
    expect(reach).toBeGreaterThan(1);
    expect(reach).toBeLessThan(4.81);
    expect(junctionPads([{ class: 'residential', width: 6, points: [[0, 0], [20, 0]] }])).toHaveLength(0);
    const meet = junctionPads([
      { class: 'residential', width: 6, points: [[0, 0], [20, 0]] },
      { class: 'residential', width: 6, points: [[20, 0], [20, 20]] },
    ]);
    expect(meet.length).toBeGreaterThan(0);
  });

  it('joins a side street that stops short and leaves a parallel carriageway apart', () => {
    const joined = connectEnds([
      { class: 'residential', width: 6, points: [[0, 0], [10, 0]] },
      { class: 'residential', width: 6, points: [[18, -8], [18, 8]] },
      { class: 'secondary', width: 11, points: [[0, 8], [10, 8]] },
    ]);
    expect(joined[0]?.points.at(-1)).toEqual([18, 0]);
    expect(joined[2]?.points).toEqual([
      [0, 8],
      [10, 8],
    ]);
  });

  it('keeps Kilimani landmarks on the roads they belong to', () => {
    const place = (name: string) => kilimani.destinations.find((item) => item.name === name);
    const yaya = place('Yaya Centre');
    const adams = place('Adams Arcade');
    const prestige = place('Prestige Plaza');
    expect(yaya && adams && prestige).toBeTruthy();
    expect(yaya!.z).toBeLessThan(adams!.z);
    expect(yaya!.z).toBeLessThan(prestige!.z);
    expect(adams!.x).toBeLessThan(prestige!.x);
    const distanceTo = (x: number, z: number, roadName: string) => {
      let best = Infinity;
      for (const road of kilimani.roads) {
        if (road.name !== roadName || road.points.length < 2) continue;
        for (let i = 0; i < road.points.length - 1; i += 1) {
          const start = road.points[i];
          const end = road.points[i + 1];
          if (!start || !end) continue;
          const dx = end[0] - start[0];
          const dz = end[1] - start[1];
          const len2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / len2));
          best = Math.min(best, Math.hypot(x - (start[0] + dx * t), z - (start[1] + dz * t)));
        }
      }
      return best;
    };
    expect(distanceTo(yaya!.x, yaya!.z, 'Argwings Kodhek Road')).toBeLessThan(distanceTo(yaya!.x, yaya!.z, 'Ngong Road'));
    expect(distanceTo(adams!.x, adams!.z, 'Ngong Road')).toBeLessThan(120);
    expect(distanceTo(prestige!.x, prestige!.z, 'Ngong Road')).toBeLessThan(120);
    expect(streetBlades(kilimani.roads).some((sign) => sign.text === 'Ngong Road')).toBe(true);
    expect(streetBlades(kilimani.roads).some((sign) => sign.text === 'Argwings Kodhek Road')).toBe(true);
  });

  it('clears a footprint vertex that sits in the carriageway', () => {
    const clear = carriageClearer([{ class: 'residential', width: 6, points: [[0, 0], [40, 0]] }]);
    const moved = clear([
      [20, 1],
      [30, 20],
      [10, 20],
    ]);
    expect(moved[0]?.[1]).toBeGreaterThan(1);
    const enclosed = clear([
      [0, 0],
      [10, 0],
      [10, 1],
      [0, 1],
    ]);
    expect(enclosed).toEqual([
      [0, 0],
      [10, 0],
      [10, 1],
      [0, 1],
    ]);
  });

  it('loads mapped street furniture without invented sign text', () => {
    const kilimaniKit = furnitureIn('kilimani');
    const cbdKit = furnitureIn('nairobi-cbd');
    const allowed = ['signal', 'bus_stop', 'crossing', 'bump', 'roundabout', 'mini_roundabout', 'stop', 'give_way'];
    expect(kilimaniKit.length + cbdKit.length).toBeGreaterThan(0);
    expect([...kilimaniKit, ...cbdKit].every((item) => allowed.includes(item.kind))).toBe(true);
    expect(kilimaniKit.some((item) => item.kind === 'bus_stop' || item.kind === 'signal' || item.kind === 'crossing')).toBe(true);
  });

  it('spawns on an open named road facing KICC', () => {
    const start = streetSpawn();
    const tower = cbd.buildings.find((building) => building.special === 'kicc')?.accent;
    expect(tower).toBeTruthy();
    expect(blocked(start.x, start.z, 0.46, colliders, cbd.bounds)).toBe(false);
    expect(start.road.length).toBeGreaterThan(3);
    const distance = Math.hypot(start.x - tower!.cx, start.z - tower!.cz);
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(150);
    const kicc = cbd.destinations.find((item) => /kenyatta international/i.test(item.name));
    const times = cbd.destinations.find((item) => /times tower/i.test(item.name));
    expect(kicc && geometryHonesty(kicc)).toMatch(/simplified/i);
    expect(times && geometryHonesty(times)).toMatch(/not a surveyed facade/i);
  });
});

describe('points of interest', () => {
  it('uses mapped Kilimani places and does not invent Nairobi Hospital', () => {
    const places = poiRegistry();
    expect(places.every((place) => place.interior === false && place.name.trim().length > 1)).toBe(true);
    expect(places.some((place) => place.name === 'Nairobi Hospital' && place.district === 'Hurlingham' && place.interior === false)).toBe(true);
    const yaya = poiById('b26772773');
    const adams = poiById('b731529769');
    const prestige = poiById('b95790444');
    expect(yaya?.name).toBe('Yaya Centre');
    expect(adams?.name).toBe('Adams Arcade');
    expect(prestige?.name).toBe('Prestige Plaza');
    for (const mall of [yaya, adams, prestige]) {
      expect(mall?.category).toBe('shopping');
      expect(mall?.label).toBe('Shopping mall');
      expect(mall?.district).toBe('Kilimani');
      expect(mall?.actions).toContain('venue');
      expect(mall?.prompt).toMatch(/Open the venue panel/);
    }
    const hospital = places.find((place) => place.name === "The Nairobi Women's Hospital - Adams");
    expect(hospital?.category).toBe('hospital');
    expect(hospital?.actions).toContain('info');
    expect(hospital?.actions).not.toContain('venue');
    expect(hospital?.prompt).toMatch(/See location details/);
    const cafe = places.find((place) => place.name === 'Artcaffe Yaya');
    expect(cafe?.category).toBe('restaurant');
    expect(cafe?.label).toBe('Restaurant');
    expect(cafe?.actions).toContain('venue');
    const yayaBuilding = kilimani.buildings.find((building) => building.id === 'b26772773');
    if (cafe && yayaBuilding && pointInPolygon(cafe.x, cafe.z, yayaBuilding.polygon)) {
      expect(pointInPolygon(cafe.approach.x, cafe.approach.z, yayaBuilding.polygon)).toBe(false);
    }
    const gates = new Set(districts.flatMap((district) => (district.gates ?? []).map((gate) => `${gate.x},${gate.z}`)));
    for (const place of places) {
      if (!place.entrance) continue;
      expect(gates.has(`${place.entrance.x},${place.entrance.z}`)).toBe(true);
    }
  });
});

describe('kenyan street details', () => {
  it('prints mapped names and keeps tanks on apartment roofs', () => {
    expect(readableSign('Ngong Road')).toBe('Ngong Road');
    expect(readableSign("Dr Lang'o Medical clinic")).toBe("Dr Lang'o Medical clinic");
    expect(readableSign('###')).toBeNull();
    expect(readableSign('')).toBeNull();
    const blades = streetBlades(kilimani.roads, 16);
    const names = new Set(kilimani.roads.map((road) => road.name).filter((name): name is string => Boolean(name)));
    expect(blades.some((sign) => sign.text === 'Ngong Road')).toBe(true);
    expect(blades.some((sign) => sign.text === 'Argwings Kodhek Road')).toBe(true);
    expect(blades.every((sign) => names.has(sign.text) && readableSign(sign.text) === sign.text)).toBe(true);
    const shops = shopSigns(kilimani.facilities ?? [], kilimani.roads, 12);
    const facilityNames = new Set((kilimani.facilities ?? []).map((place) => place.name.split(';')[0]?.trim()));
    expect(shops.length).toBeGreaterThan(0);
    expect(shops.every((sign) => facilityNames.has(sign.text))).toBe(true);
    const tanks = roofTanks(kilimani.buildings, 24);
    expect(tanks.length).toBeGreaterThan(0);
    expect(tanks.every((tank) => tank.kind === 'tank' && tank.y > 8)).toBe(true);
    const poles = utilityPoles([{ class: 'residential', width: 8, points: [[8000, 8000], [8080, 8000]] }], 4);
    expect(poles.length).toBeGreaterThan(0);
    expect(poles.every((pole) => Math.abs(pole.z - 8000) > 4)).toBe(true);
    const queue = queueSpots([{ x: 8000, z: 8008, yaw: 0 }], [], 2);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.x).toBeCloseTo(8000);
    expect(Math.abs((queue[0]?.z ?? 8008) - 8008)).toBeGreaterThan(0.5);
  });
});

describe('place names', () => {
  it('labels KICC and Times Tower from OpenStreetMap and leaves unnamed footprints out', () => {
    const places = placeRegistry();
    const kicc = places.find((place) => place.id === 'b1553682723');
    const times = places.find((place) => place.id === 'b1436349700');
    expect(kicc?.name).toBe('Kenyatta International Convention Center');
    expect(times?.name).toBe('Times Tower');
    expect(kicc?.category).toBe('landmark');
    expect(times?.category).toBe('landmark');
    expect(kicc?.verified).toBe(true);
    expect(kicc?.placeholder).toBe(true);
    expect(kicc?.district).toBe('Nairobi CBD');
    expect(kicc?.description.length).toBeGreaterThan(20);
    expect(places.filter((place) => place.district === 'Nairobi CBD')).toHaveLength(cbd.destinations.length);
    expect(places.filter((place) => place.district === 'Kilimani')).toHaveLength(kilimani.destinations.length + (kilimani.facilities?.length ?? 0));
    expect(places.every((place) => place.name.trim().length > 1 && place.verified)).toBe(true);
    expect(places.some((place) => /national archives/i.test(place.name))).toBe(false);
    expect(places.some((place) => /railway station/i.test(place.name))).toBe(false);
    const kiccBuilding = cbd.buildings.find((building) => building.id === kicc?.id);
    const timesBuilding = cbd.buildings.find((building) => building.id === times?.id);
    expect(kicc && kiccBuilding && circleHitsPolygon(kicc.x, kicc.z, 2, kiccBuilding.polygon)).toBe(false);
    expect(times && timesBuilding && circleHitsPolygon(times.x, times.z, 2, timesBuilding.polygon)).toBe(false);
    expect(placeById('b1553682723')?.name).toBe(kicc?.name);
    expect(placeTitle('Kenyatta University Plaza;Kenyatta University City Campus')).toBe(
      'Kenyatta University Plaza · Kenyatta University City Campus',
    );
    expect(streetLabelRange('hospital')).toBeGreaterThan(streetLabelRange('restaurant'));
    expect(streetLabelRange('building')).toBe(0);
    expect(streetLabel("Dr Lang'o Medical clinic", 'hospital')).toContain('Hospital');
    const guides = nearbyGuides(kilimani.spawn.x, kilimani.spawn.z, 8);
    expect(guides.some((guide) => guide.category === 'hospital')).toBe(true);
    expect(guides.some((guide) => guide.category === 'restaurant')).toBe(true);
    expect(guides.some((guide) => guide.category === 'landmark')).toBe(true);
    const yaya = poiById('b26772773');
    const yayaPoint = selectionPoint('b26772773');
    expect(yaya && yayaPoint).toBeTruthy();
    if (yaya && yayaPoint) {
      expect(yayaPoint).toEqual({ x: yaya.entrance?.x ?? yaya.approach.x, z: yaya.entrance?.z ?? yaya.approach.z });
    }
    for (const filter of ['shopping', 'restaurant', 'hospital', 'school', 'worship', 'hotel', 'office', 'park', 'landmark'] as const) {
      const listed = browseDestinations(kilimani.spawn.x, kilimani.spawn.z, filter, 8);
      const present = poiRegistry().some((place) => matchesDestination(place, filter));
      if (present) expect(listed.length).toBeGreaterThan(0);
      expect(listed.every((place) => matchesDestination(place, filter))).toBe(true);
    }
  });
});

describe('movement keys', () => {
  it('accepts WASD, arrows, and shift by code or printed key', () => {
    expect(movementKey('KeyW', 'w')).toBe('forward');
    expect(movementKey('', 'W')).toBe('forward');
    expect(movementKey('ArrowUp', 'ArrowUp')).toBe('forward');
    expect(movementKey('KeyA', 'a')).toBe('left');
    expect(movementKey('ArrowLeft', 'ArrowLeft')).toBe('left');
    expect(movementKey('KeyS', 's')).toBe('back');
    expect(movementKey('KeyD', 'd')).toBe('right');
    expect(movementKey('ShiftLeft', 'Shift')).toBe('run');
    expect(movementKey('KeyE', 'e')).toBe('interact');
    expect(movementKey('KeyF', 'f')).toBeNull();
  });
});

describe('walking to a selected place', () => {
  it('follows a connected street and refuses a disconnected one', () => {
    const graph = buildRoadGraph(
      [
        { points: [[0, 0], [20, 0], [40, 0]], class: 'residential' },
        { points: [[0, 400], [40, 400]], class: 'residential' },
      ],
      16,
      10,
    );
    const path = connectedRoute(graph, 0, 0, 40, 0, 30);
    expect(path).not.toBeNull();
    expect(path?.[path.length - 1]?.[0]).toBeCloseTo(40);
    expect(connectedRoute(graph, 0, 0, 40, 400, 30)).toBeNull();
  });

  it('joins a gap that sits two cells away and leaves parallel carriageways apart', () => {
    const cell = 12;
    const gap = buildRoadGraph(
      [
        { points: [[cell - 0.1, 0], [-20, 0]], class: 'residential' },
        { points: [[cell - 0.1 + 16, 0], [60, 0]], class: 'residential' },
      ],
      14,
      18,
    );
    expect(Math.floor((cell - 0.1) / cell)).toBe(0);
    expect(Math.floor((cell - 0.1 + 16) / cell)).toBe(2);
    expect(connectedRoute(gap, cell - 0.1, 0, cell - 0.1 + 16, 0, 20)).not.toBeNull();

    const parallel = buildRoadGraph(
      [
        { points: [[0, 0], [40, 0], [80, 0]], class: 'secondary' },
        { points: [[0, 13], [40, 13], [80, 13]], class: 'secondary' },
      ],
      14,
      18,
    );
    expect(connectedRoute(parallel, 0, 0, 0, 13, 20)).toBeNull();
    for (const list of parallel.adj) expect(new Set(list).size).toBe(list.length);
  });

  it('keeps Haile Selassie Avenue on one connected walk', () => {
    const points = cityRoads()
      .filter((road) => road.name === 'Haile Selassie Avenue' && road.class === 'secondary')
      .flatMap((road) => road.points);
    expect(points.length).toBeGreaterThan(1);
    let east = points[0];
    let west = points[0];
    for (const point of points) {
      if (!east || !west) continue;
      if (point[0] > east[0]) east = point;
      if (point[0] < west[0]) west = point;
    }
    expect(east && west).toBeTruthy();
    const graph = buildRoadGraph(walkLines(cityRoads()), 14, 18);
    const from = nearestWithin(graph, east![0], east![1], 20);
    const to = nearestWithin(graph, west![0], west![1], 20);
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThanOrEqual(0);
    expect(shortestPath(graph, from, to).length).toBeGreaterThan(1);
  });

  it('moves a corner onto the open pavement', () => {
    const shifted = shiftToPavement(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      2,
      (_x, z) => z < 0,
    );
    expect(shifted[1]?.[1]).toBeGreaterThan(0);
    expect(shifted[0]).toEqual([0, 0]);
    expect(shifted[2]).toEqual([20, 0]);
  });

  it('steps toward the next corner and stops at the destination', () => {
    const points: [number, number][] = [
      [0, 0],
      [10, 0],
      [20, 0],
    ];
    const mid = nextLeg(0, 0, points, 0);
    expect(mid.arrived).toBe(false);
    expect(mid.dx).toBeGreaterThan(0);
    expect(nextLeg(19, 0, points, 1).arrived).toBe(true);
    expect(nextLeg(12, 0, points, 2).arrived).toBe(false);
    expect(skipBlocked(false, 13, 0, 3).index).toBe(1);
    expect(skipBlocked(true, 4, 1, 3).stuck).toBe(0);
    expect(locomotionClip(1.8, false)).toBe('strut');
    expect(locomotionClip(0, false)).toBe('idle');
    expect(locomotionClip(5.1, false)).toBe('jog');
    const street = routeGoal([{ name: 'Harambee Avenue', points: [[0, 0], [40, 0]] }], 20, 50);
    expect(street.door).toBeNull();
    expect(street.z).toBeCloseTo(0);
    const door = routeGoal([{ name: 'Harambee Avenue', points: [[0, 0], [40, 0]] }], 20, 8);
    expect(door.door).toEqual([20, 8]);
  });

  it('walks Kilimani streets to Yaya Centre and continues there from the CBD', () => {
    const graph = buildRoadGraph(walkLines(cityRoads()), 14, 18);
    const yaya = kilimani.destinations.find((place) => place.name === 'Yaya Centre');
    const adams = kilimani.destinations.find((place) => place.name === 'Adams Arcade');
    expect(yaya).toBeTruthy();
    expect(adams).toBeTruthy();
    if (!yaya || !adams) return;
    const local = planWalk({
      graph,
      roads: kilimani.roads,
      fromX: adams.x,
      fromZ: adams.z,
      toX: yaya.x,
      toZ: yaya.z,
    });
    expect(local.kind).toBe('walk');
    if (local.kind !== 'walk') return;
    expect(local.points.length).toBeGreaterThan(5);
    expect(local.metres).toBeGreaterThan(Math.hypot(yaya.x - adams.x, yaya.z - adams.z));
    const paved = shiftToPavement(local.points, 2.15, (x, z) => blocked(x, z, 0.46, colliders, boundsAt(x, z), wallColliders));
    const sample = paved[Math.floor(paved.length / 2)];
    expect(sample).toBeTruthy();
    if (sample) expect(blocked(sample[0], sample[1], 0.3, colliders, boundsAt(sample[0], sample[1]), wallColliders)).toBe(false);
    const start = streetSpawn();
    const cross = planWalk({
      graph,
      roads: cityRoads(),
      fromX: start.x,
      fromZ: start.z,
      toX: yaya.x,
      toZ: yaya.z,
    });
    expect(cross.kind).toBe('walk');
    if (cross.kind === 'walk') {
      expect(cross.metres).toBeGreaterThan(Math.hypot(yaya.x - start.x, yaya.z - start.z));
      const end = cross.points[cross.points.length - 1];
      expect(end).toBeTruthy();
      if (end) expect(Math.hypot(end[0] - yaya.x, end[1] - yaya.z)).toBeLessThan(8);
      expect(cross.points.some((point) => point[0] < -800 && point[0] > -3200)).toBe(true);
      const samples = cross.points.filter((_, index) => index % 12 === 0);
      for (const point of samples) {
        expect(blocked(point[0], point[1], 0.2, colliders, cityBounds(), wallColliders)).toBe(false);
      }
    }
    const yayaPoint = selectionPoint('b26772773');
    expect(yayaPoint).toBeTruthy();
    if (yayaPoint && local.kind === 'walk') {
      const end = local.points[local.points.length - 1];
      expect(end).toBeTruthy();
      if (end) expect(Math.hypot(end[0] - yaya.x, end[1] - yaya.z)).toBeLessThan(8);
    }
    const missed = planWalk({
      graph: buildRoadGraph([{ points: [[0, 0], [40, 0]], class: 'residential' }], 12, 10),
      roads: [{ name: 'Wood Avenue', points: [[0, 0], [40, 0]] }],
      fromX: 0,
      fromZ: 0,
      toX: 20,
      toZ: 80,
    });
    expect(missed.kind).toBe('none');
    expect(remainingMetres(0, 0, [[10, 0], [20, 0]], 0)).toBeCloseTo(20);
  });

  it('follows a carriageway when the footway stops short', () => {
    const graph = buildRoadGraph(
      [
        { points: [[0, 0], [16, 0]], class: 'footway' },
        { points: [[0, 6], [20, 6], [36, 6]], class: 'residential' },
      ],
      12,
      10,
    );
    const plan = planWalk({
      graph,
      roads: [
        { name: null, points: [[0, 0], [16, 0]] },
        { name: 'Wood Avenue', points: [[0, 6], [20, 6], [36, 6]] },
      ],
      fromX: 0,
      fromZ: 0,
      toX: 36,
      toZ: 6,
    });
    expect(plan.kind).toBe('walk');
    if (plan.kind !== 'walk') return;
    expect(plan.points.some((point) => Math.abs(point[1] - 6) < 1.5)).toBe(true);
    expect(sameCorridor(plan.points, plan.points)).toBe(true);
    const sidestep = detourStep(0, 0, 1, 0, 1, (_x, z) => Math.abs(z) > 0.5);
    expect(sidestep.moved).toBe(true);
    expect(Math.abs(sidestep.z)).toBeGreaterThan(0.5);
    setParkedTraffic([{ x: 5, z: 0, radius: 1.2 }]);
    noteTraffic(8, 1, 0.8);
    expect(hitsTraffic(5.4, 0, 0.4)).toBe(true);
    expect(hitsTraffic(8.2, 1, 0.4)).toBe(true);
    expect(hitsTraffic(20, 20, 0.4)).toBe(false);
    setParkedTraffic([]);
    clearTraffic();
  });

  it('keeps a mall door on open pavement and refuses a sealed entrance', () => {
    const open = (x: number, z: number) => !blocked(x, z, PLAYER_RADIUS, colliders, cityBounds(), wallColliders);
    const graph = buildRoadGraph(walkLines(cityRoads()), 14, 18);
    const roads = pedestrianRoads(cityRoads());
    for (const name of ['Yaya Centre', 'Adams Arcade']) {
      const place = poiRegistry().find((item) => item.name === name);
      expect(place).toBeTruthy();
      if (!place) continue;
      const here = place.entrance ?? place.approach;
      const snap = nearestRoadPoint(roads, here.x, here.z, 40);
      expect(snap).toBeTruthy();
      if (!snap) continue;
      const plan = planWalk({
        graph,
        roads,
        fromX: snap.x,
        fromZ: snap.z,
        toX: here.x,
        toZ: here.z,
        open,
      });
      expect(plan.kind).toBe('walk');
      if (plan.kind !== 'walk') continue;
      const end = plan.points[plan.points.length - 1];
      expect(end).toBeTruthy();
      if (!end) continue;
      expect(Math.hypot(end[0] - here.x, end[1] - here.z)).toBeLessThan(8);
      expect(lineIsOpen(snap.x, snap.z, end[0], end[1], open)).toBe(true);
    }

    const sealedGraph = buildRoadGraph([{ points: [[0, 0], [40, 0]], class: 'residential' }], 12, 10);
    const sealedRoads = [{ name: 'Argwings Kodhek Road', points: [[0, 0], [40, 0]] as [number, number][] }];
    const shifted = planWalk({
      graph: sealedGraph,
      roads: sealedRoads,
      fromX: 0,
      fromZ: 0,
      toX: 20,
      toZ: 6,
      open: (x, z) => z < 3,
    });
    expect(shifted.kind).toBe('walk');
    if (shifted.kind === 'walk') {
      const end = shifted.points[shifted.points.length - 1];
      expect(end?.[1]).toBeLessThan(3);
      expect(lineIsOpen(20, 0, end?.[0] ?? 0, end?.[1] ?? 0, (x, z) => z < 3)).toBe(true);
    }
    const refused = planWalk({
      graph: sealedGraph,
      roads: sealedRoads,
      fromX: 0,
      fromZ: 0,
      toX: 20,
      toZ: 6,
      open: () => false,
    });
    expect(refused).toEqual({ kind: 'none', reason: 'building' });
  });
});

describe('services that are not live', () => {
  it('shows the placeholder campaign only inside its dates', () => {
    expect(liveCampaigns(new Date('2026-10-16T00:00:00Z')).every((item) => item.status === 'placeholder')).toBe(true);
    expect(liveCampaigns(new Date('2027-02-01T00:00:00Z'))).toHaveLength(0);
  });

  it('does not invent remote players', () => {
    const presence = localPresence(createDefaultCharacter());
    expect(presence.mode).toBe('local');
    expect(presence.peers()).toEqual([]);
  });
});
