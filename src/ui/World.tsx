import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMPAIGNS } from '../game/ads/campaigns';
import { localPresence } from '../game/multiplayer/presence';
import { releaseKeys, livePose, movementKey, typingTarget, worldInput } from '../game/player/input';
import { WorldScene, type GuideTarget } from '../game/player/WorldScene';
import { labelOf, NEIGHBOURHOODS, FOCUSES } from '../game/character/catalog';
import { cbd, cityRoads, districtAt, kilimani, type CbdData, type DistrictId } from '../game/world/data';
import { streetSpawn } from '../game/world/spawn';
import { WORLD_PIPELINE } from '../game/world/pipeline';
import { placeTitle } from '../game/world/places';
import { browseDestinations, DESTINATION_FILTERS, poiById, poiRegistry, selectionPoint, type DestinationFilter, type PointOfInterest } from '../game/world/poi';
import { nearestStreetName } from '../game/world/walk';
import { nairobiNow } from '../game/life/clock';
import type { TimeOfDay } from '../store/useGame';
import { districtById, districtStops } from '../game/life/districts';
import { COINS } from '../game/life/economy';
import { CREDIT_PACKS, VILLAGE_LOAN } from '../game/life/house';
import { opening } from '../game/life/hours';
import { quoteRide, type TransportMode } from '../game/life/travel';
import { useGame } from '../store/useGame';
import { AssetBench } from './AssetBench';
import { HouseStudio } from './HouseStudio';
import { Interior } from './Interior';
import { takeQueuedPlaces } from './nav';
import { FillFrame, KeepPainting, useWakeCanvas } from './Studio';

const START = streetSpawn();

export function World() {
  const character = useGame((state) => state.character);
  const life = useGame((state) => state.life);
  const notice = useGame((state) => state.notice);
  const earnShift = useGame((state) => state.earnShift);
  const spendMeal = useGame((state) => state.spendMeal);
  const spendShopping = useGame((state) => state.spendShopping);
  const purchaseHome = useGame((state) => state.purchaseHome);
  const purchaseCar = useGame((state) => state.purchaseCar);
  const arriveFromVillage = useGame((state) => state.arriveFromVillage);
  const arriveWithNothing = useGame((state) => state.arriveWithNothing);
  const repayVillageLoan = useGame((state) => state.repayVillageLoan);
  const drive = useGame((state) => state.drive);
  const tickBody = useGame((state) => state.tickBody);
  const takeDrink = useGame((state) => state.takeDrink);
  const takeRest = useGame((state) => state.takeRest);
  const takeDance = useGame((state) => state.takeDance);
  const takeTask = useGame((state) => state.takeTask);
  const payForRide = useGame((state) => state.payForRide);
  const openWardrobe = useGame((state) => state.openWardrobe);
  const setPhase = useGame((state) => state.setPhase);
  const routeId = useGame((state) => state.routeTargetId);
  const setRouteTarget = useGame((state) => state.setRouteTarget);
  const stats = useGame((state) => state.campaignStats);
  const recordImpression = useGame((state) => state.recordImpression);
  const recordInteraction = useGame((state) => state.recordInteraction);
  const [near, setNear] = useState<PointOfInterest | null>(null);
  const [place, setPlace] = useState('Nairobi CBD');
  const [active, setActive] = useState<PointOfInterest | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DestinationFilter>('nearby');
  const [walkLeft, setWalkLeft] = useState<number | null>(null);
  const [showPlaces, setShowPlaces] = useState(false);
  const [showAds, setShowAds] = useState(false);
  const [showBench, setShowBench] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLife, setShowLife] = useState(false);
  const [showGo, setShowGo] = useState(false);
  const [visit, setVisit] = useState<string | null>(null);
  const [trip, setTrip] = useState<null | { placeId: string; left: number }>(null);
  const [pace, setPace] = useState<'walk' | 'run' | 'sprint'>('walk');
  const [pin, setPin] = useState<GuideTarget | null>(null);
  const [inside, setInside] = useState<null | { mode: 'place' | 'home'; title: string; x: number; z: number; kind: string; open: boolean }>(null);
  const [clock, setClock] = useState(() => nairobiNow());
  const [skyHold, setSkyHold] = useState<TimeOfDay | null>(null);
  const [rain, setRain] = useState(false);
  const dot = useRef<HTMLDivElement>(null);
  const time = skyHold ?? clock.timeOfDay;
  useWakeCanvas();

  useEffect(() => {
    const id = window.setInterval(() => setClock(nairobiNow()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const moving = worldInput.guiding || worldInput.keys.w || worldInput.keys.a || worldInput.keys.s || worldInput.keys.d;
      tickBody(moving, worldInput.pace);
    }, 8000);
    return () => window.clearInterval(id);
  }, [tickBody]);

  useEffect(() => {
    if (!trip) return undefined;
    if (trip.left <= 0) {
      if (trip.placeId === 'kilimani') {
        useGame.setState({ notice: 'You stepped out in Kilimani. These streets are the OpenStreetMap extract west of the CBD.' });
      } else {
        worldInput.ride = null;
        setVisit(trip.placeId);
      }
      setTrip(null);
      return undefined;
    }
    const id = window.setTimeout(() => setTrip({ ...trip, left: trip.left - 1 }), 1000);
    return () => window.clearTimeout(id);
  }, [trip]);

  useEffect(() => {
    if (life.energy < 18 && worldInput.pace === 'sprint') {
      worldInput.pace = 'walk';
      setPace('walk');
    }
  }, [life.energy]);

  useEffect(() => {
    if (takeQueuedPlaces()) setShowPlaces(true);
    const openPlaces = () => {
      setShowBench(false);
      setShowPlaces(true);
    };
    const showCity = () => setShowBench(false);
    window.addEventListener('nd-open-places', openPlaces);
    window.addEventListener('nd-show-city', showCity);
    return () => {
      window.removeEventListener('nd-open-places', openPlaces);
      window.removeEventListener('nd-show-city', showCity);
    };
  }, []);

  const route = routeId ? poiById(routeId) : null;
  const guideTarget = useMemo<GuideTarget | null>(() => {
    if (route) {
      const here = selectionPoint(route.id);
      if (!here) return null;
      return { id: route.id, name: route.name, x: here.x, z: here.z };
    }
    return pin;
  }, [pin, route]);
  const guideRef = useRef(guideTarget);
  guideRef.current = guideTarget;
  const stopWalking = () => {
    setPin(null);
    setRouteTarget(null);
  };
  const cancelWalking = () => {
    stopWalking();
    setWalkLeft(null);
    useGame.setState({ notice: '' });
  };
  const walkToPlace = (id: string) => {
    setPin(null);
    setRouteTarget(id);
  };
  const walkToMap = (event: PointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const x = livePose.x + (u - 0.5) * MAP_SPAN;
    const z = livePose.z + (v - 0.5) * MAP_SPAN;
    let best: PointOfInterest | null = null;
    let bestD = 26;
    for (const item of poiRegistry()) {
      const here = selectionPoint(item.id);
      if (!here) continue;
      const distance = Math.hypot(here.x - x, here.z - z);
      if (distance < bestD) {
        best = item;
        bestD = distance;
      }
    }
    if (best) {
      walkToPlace(best.id);
      return;
    }
    const standing = districtAt(x, z);
    const roads = standing?.roads ?? cityRoads();
    setRouteTarget(null);
    setPin({ id: `map:${x.toFixed(1)}:${z.toFixed(1)}`, name: nearestStreetName(roads, x, z), x, z });
  };
  const presence = useMemo(() => localPresence(character, cbd.districtId), [character]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return poiRegistry()
        .filter((item) => item.name.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.category.includes(q))
        .slice(0, 24);
    }
    return browseDestinations(livePose.x, livePose.z, kind, kind === 'nearby' ? 12 : 18);
  }, [kind, query, showPlaces]);

  useEffect(() => {
    if (!character.confirmed) setPhase('create');
  }, [character.confirmed, setPhase]);

  useEffect(() => {
    worldInput.paused = Boolean(showAds || showGo || showLife || life.origin === 'unset');
  }, [showAds, showGo, showLife, life.origin]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      if (event.key === 'Escape') setActive(null);
      const control = movementKey(event.code, event.key);
      if (!control) return;
      event.preventDefault();
      if (control === 'forward') worldInput.keys.w = true;
      else if (control === 'back') worldInput.keys.s = true;
      else if (control === 'left') worldInput.keys.a = true;
      else if (control === 'right') worldInput.keys.d = true;
      else if (control === 'run') worldInput.keys.shift = true;
      else worldInput.interact = true;
    };
    const up = (event: KeyboardEvent) => {
      const control = movementKey(event.code, event.key);
      if (!control || control === 'interact') return;
      if (control === 'forward') worldInput.keys.w = false;
      else if (control === 'back') worldInput.keys.s = false;
      else if (control === 'left') worldInput.keys.a = false;
      else if (control === 'right') worldInput.keys.d = false;
      else worldInput.keys.shift = false;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', releaseKeys);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', releaseKeys);
      releaseKeys();
    };
  }, []);

  useEffect(() => {
    let painted: DistrictId | null = null;
    let marked: string | null = null;
    let paintedHeading = 0;
    const paintedAt = { x: Number.NaN, z: Number.NaN };
    let timer = 0;
    const tick = () => {
      const standingData = districtAt(livePose.x, livePose.z) ?? cbd;
      const id = standingData.districtId as DistrictId;
      const goalId = guideRef.current?.id ?? null;
      const moved = Math.hypot(livePose.x - paintedAt.x, livePose.z - paintedAt.z) > 2 || painted !== id;
      const turned = Math.abs(livePose.heading - paintedHeading) > 0.35;
      if (moved || turned || goalId !== marked) {
        painted = id;
        marked = goalId;
        paintedHeading = livePose.heading;
        paintedAt.x = livePose.x;
        paintedAt.z = livePose.z;
        try {
          paintLocalMap({ ...standingData, roads: cityRoads() }, livePose.x, livePose.z, livePose.heading, guideRef.current);
        } catch (error) {
          console.error(error);
        }
      }
      const el = dot.current;
      if (el) {
        el.style.left = '50%';
        el.style.top = '50%';
      }
      timer = window.setTimeout(tick, 120);
    };
    timer = window.setTimeout(tick, 60);
    return () => window.clearTimeout(timer);
  }, []);

  const openDestination = (place: PointOfInterest) => {
    setActive(place);
  };

  const startTrip = (placeId: string, mode: TransportMode) => {
    const stop = districtById(placeId);
    if (!stop) return;
    const quote = quoteRide(mode, stop.km);
    if (!payForRide(quote.coins, quote.label)) return;
    const inKilimani = placeId === 'kilimani';
    worldInput.ride = {
      x: inKilimani ? kilimani.spawn.x : stop.x,
      z: inKilimani ? kilimani.spawn.z : stop.z,
      mode,
      until: performance.now() + quote.seconds * 1000,
      land: inKilimani,
    };
    setShowGo(false);
    setTrip({ placeId, left: quote.seconds });
  };

  if (showBench) return <AssetBench onClose={() => setShowBench(false)} />;

  const arrived = visit ? districtById(visit) : null;
  if (arrived) {
    return (
      <main className="arrival">
        <section className="sheet" role="dialog" aria-label={arrived.name}>
          <p className="eyebrow">{arrived.area}</p>
          <h2>{arrived.name}</h2>
          <p>{arrived.note}</p>
          <p className="hint">{arrived.km} km from KICC in a straight line. This stop is outside the walkable mesh. The loaded streets run from the CBD through Hurlingham to Kilimani.</p>
          <p className="hint">Energy {life.energy} · Thirst {life.thirst} · Hunger {life.hunger} · {life.coins} coins</p>
          {notice ? <p className="hint">{notice}</p> : null}
          <p>{localRemark(arrived.id)}</p>
          <div className="actions">
            {arrived.food ? (
              <button className="btn primary" type="button" onClick={() => spendMeal(true)}>
                Order food · {COINS.meal} coins
              </button>
            ) : null}
            <button className="btn" type="button" onClick={takeDrink}>Drink · 15 coins</button>
            <button className="btn" type="button" onClick={takeTask}>Help with a task · +80</button>
            {arrived.job ? (
              <button className="btn" type="button" onClick={() => earnShift(true)}>
                {arrived.job} · +{COINS.shift}
              </button>
            ) : null}
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (takeDance()) worldInput.emoteUntil = performance.now() + 4000;
              }}
            >
              Dance
            </button>
            <button className="btn" type="button" onClick={() => setVisit(null)}>
              Back to the CBD
            </button>
          </div>
            <div className="choices">
            {(['pikipiki', 'matatu', 'ride'] as const).map((mode) => {
              const quote = quoteRide(mode, arrived.km);
              return (
                <button
                  key={mode}
                  className="choice"
                  type="button"
                  onClick={() => {
                    if (!payForRide(quote.coins, `${quote.label} back`)) return;
                    setVisit(null);
                  }}
                >
                  {quote.label} back · {quote.coins} coins
                </button>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (inside?.mode === 'home') {
    return (
      <HouseStudio
        onLeave={() => {
          worldInput.ride = { x: inside.x, z: inside.z };
          setInside(null);
        }}
      />
    );
  }

  if (inside?.mode === 'place') {
    const placeOpen = inside.open;
    return (
      <Interior
        title={inside.title}
        note="This room is a generic stand-in. It is not a reconstructed interior of a mapped place."
        furniture={[]}
        onLeave={() => {
          worldInput.ride = { x: inside.x, z: inside.z };
          worldInput.paused = false;
          setInside(null);
        }}
      >
        <div className="actions">
          {inside.kind === 'shop' || inside.kind === 'market' || inside.kind === 'mall' ? (
            <button className="btn primary" type="button" disabled={!placeOpen} onClick={() => spendShopping(placeOpen)}>
              Shop · {COINS.shopping} coins
            </button>
          ) : null}
          {inside.kind === 'restaurant' || inside.kind === 'mall' || inside.kind === 'hotel' || inside.kind === 'cinema' ? (
            <button className="btn" type="button" disabled={!placeOpen} onClick={() => spendMeal(placeOpen)}>
              Order food · {COINS.meal} coins
            </button>
          ) : null}
          {inside.kind === 'office' || inside.kind === 'bank' || inside.kind === 'landmark' ? (
            <button className="btn" type="button" disabled={!placeOpen} onClick={() => earnShift(placeOpen)}>
              Work a shift · +{COINS.shift}
            </button>
          ) : null}
        </div>
        {notice ? <p className="hint">{notice}</p> : null}
      </Interior>
    );
  }

  return (
    <main className="world-shell">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [START.x, 6, START.z + 12], fov: 56 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      >
        <FillFrame />
        <KeepPainting />
        <WorldScene
          time={time}
          rain={rain}
          guideTarget={guideTarget}
          onNear={setNear}
          onPlace={setPlace}
          onInteract={openDestination}
          onWalk={walkToPlace}
          onArrive={(name) => {
            useGame.setState({ notice: `You have arrived at ${placeTitle(name)}.` });
            setWalkLeft(null);
            setPin(null);
            setRouteTarget(null);
          }}
          onGuideStop={stopWalking}
          onGuideNote={(message) => useGame.setState({ notice: message })}
          onGuideProgress={setWalkLeft}
          onImpression={recordImpression}
          onAdInteract={recordInteraction}
          showLabels={showLabels}
        />
      </Canvas>
      <div className="hud">
        <div className="hud-card">
          <p className="who">{character.displayName}</p>
          <p className="meta">
            @{character.username} · {place}
          </p>
          <p className="meta">
            {labelOf(NEIGHBOURHOODS, character.lifestyle.neighbourhood)} · {labelOf(FOCUSES, character.lifestyle.focus)}
          </p>
          {notice ? <p className="meta route-note">{notice}</p> : null}
          {guideTarget ? (
            <p className="meta route-note">
              Walking to {placeTitle(guideTarget.name)}
              {walkLeft !== null ? ` · ${walkLeft} m left · ${footTime(walkLeft)}` : ''}
            </p>
          ) : null}
          <div className="status-bar" aria-label="Condition">
            <span>{life.coins} coins</span>
            {life.debt > 0 ? <span>Loan {life.debt}</span> : null}
            <span>Energy {life.energy}</span>
            <span>Thirst {life.thirst}</span>
            <span>Hunger {life.hunger}</span>
          </div>
          <p className="fine">Solo session · {presence.peers().length} other players</p>
          <p className="fine">
            {districtAt(livePose.x, livePose.z)?.districtId === 'kilimani'
              ? `Kilimani extract. ${kilimani.attribution}. Heights without an OpenStreetMap tag are estimates.`
              : districtAt(livePose.x, livePose.z)?.districtId === 'hurlingham'
                ? `Hurlingham extract, the mapped streets between the CBD and Kilimani. ${cbd.attribution}. Heights without an OpenStreetMap tag are estimates.`
                : `Spawn on ${START.road}. ${cbd.attribution}. Landmark towers are simplified stand-ins.`}
          </p>
          <details className="hud-help">
            <summary>Streets and controls</summary>
            <p>Choose a place or click the map. The character walks the mapped streets. WASD or the stick steers, and that walk resumes when you let go. Drag looks around. E opens a place. Go has a shortened matatu between districts.</p>
          </details>
          <div className="hud-tools">
            <button className="btn small" type="button" onClick={() => setShowGo((value) => !value)}>Go</button>
            <button className="btn small" type="button" onClick={() => setShowLife((value) => !value)}>Wallet</button>
            <button className="btn small" type="button" onClick={() => setShowPlaces((value) => !value)}>Places</button>
            {guideTarget ? (
              <button className="btn small" type="button" onClick={cancelWalking}>
                Cancel
              </button>
            ) : null}
            <button className="btn small" type="button" onClick={openWardrobe}>Wardrobe</button>
            <button className="btn small" type="button" onClick={() => setShowAds((value) => !value)}>Placements</button>
            <button className="btn small" type="button" aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}>
              {showLabels ? 'Labels on' : 'Labels off'}
            </button>
            <button className="btn small" type="button" onClick={() => setShowBench(true)}>Assets</button>
            <button className="btn small" type="button" onClick={() => setPhase('welcome')}>Leave</button>
          </div>
        </div>
        {life.origin === 'unset' ? (
          <div className="arrival-gate">
            <div className="sheet" role="dialog" aria-label="How you arrive">
              <p className="eyebrow">From the village</p>
              <h2>How do you start?</h2>
              <p className="hint">Game coins only. A card or M-Pesa checkout is not connected, so buying credits does not charge real money and does not add any.</p>
              <div className="actions">
                <button className="btn primary" type="button" onClick={arriveFromVillage}>
                  Take a village loan · {VILLAGE_LOAN} coins
                </button>
                <button className="btn" type="button" onClick={arriveWithNothing}>
                  Begin from scratch
                </button>
              </div>
              <ul className="hint">
                {CREDIT_PACKS.map((pack) => (
                  <li key={pack.id}>{pack.label}: {pack.credits} credits. Not for sale.</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        <div className="time-switch">
          <p className="clock-pill">Nairobi {clock.label} · {time}</p>
          {(['day', 'sunset', 'evening', 'night'] as const).map((item) => (
            <button
              key={item}
              className={time === item ? 'on' : ''}
              type="button"
              onClick={() => setSkyHold(item === clock.timeOfDay ? null : item)}
            >
              {item}
            </button>
          ))}
          <button className={rain ? 'on' : ''} type="button" onClick={() => setRain((on) => !on)}>
            rain
          </button>
          {(['walk', 'run', 'sprint'] as const).map((item) => (
            <button
              key={item}
              className={pace === item ? 'on' : ''}
              type="button"
              disabled={item === 'sprint' && life.energy < 18}
              onClick={() => {
                worldInput.pace = item;
                setPace(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {near && !active ? (
          <button className="prompt" type="button" onClick={() => openDestination(near)}>
            {near.prompt}
          </button>
        ) : null}
        {showPlaces ? (
          <form className="places" onSubmit={(event) => event.preventDefault()}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mapped places" aria-label="Search destinations" />
            {query.trim() ? null : (
              <div className="choices">
                {DESTINATION_FILTERS.map((item) => (
                  <button key={item.id} className={kind === item.id ? 'choice on' : 'choice'} type="button" onClick={() => setKind(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {query.trim() ? null : <p className="hint">Mapped places in this extract. Choosing one starts the walk. Food and shop orders stay on the place panel until you confirm them.</p>}
            {results.length === 0 ? <p className="hint">No named place of this kind is in the mapped extracts.</p> : null}
            {results.map((item) => {
              const here = selectionPoint(item.id);
              const metres = here ? Math.round(Math.hypot(here.x - livePose.x, here.z - livePose.z)) : null;
              return (
              <button
                key={item.id}
                className="place"
                type="button"
                aria-current={route?.id === item.id ? 'true' : undefined}
                onClick={() => {
                  walkToPlace(item.id);
                  setShowPlaces(false);
                }}
              >
                {placeTitle(item.name)}
                <span className="hint"> · {item.label}{metres !== null ? ` · ${metres} m` : ''}</span>
              </button>
              );
            })}
            {route ? (
              <button className="btn small" type="button" onClick={cancelWalking}>
                Cancel walk to {placeTitle(route.name)}
              </button>
            ) : (
              <p className="hint">Distances are straight-line metres between mapped points. Walking time is shown only after a street route is found. A matatu between districts is in Go.</p>
            )}
          </form>
        ) : null}
        <Joystick />
        <button
          className="run-btn"
          type="button"
          onPointerDown={() => {
            worldInput.keys.shift = true;
          }}
          onPointerUp={() => {
            worldInput.keys.shift = false;
          }}
          onPointerLeave={() => {
            worldInput.keys.shift = false;
          }}
        >
          Run
        </button>
        <div className="minimap">
          <p className="map-caption">Streets</p>
          <div className="map-frame" aria-label="Streets around you. Click a mapped place to walk there." onPointerDown={walkToMap}>
            <canvas width={180} height={180} />
            <div className="you" ref={dot} />
          </div>
        </div>
        {active ? (
          <div className="sheet" role="dialog" aria-label={active.name}>
            <p className="eyebrow">{active.actions.includes('venue') ? 'Venue' : active.label}</p>
            <h2>{placeTitle(active.name)}</h2>
            <p>{active.summary}</p>
            <p className="hint">
              {active.lat.toFixed(5)}, {active.lon.toFixed(5)}
              {active.entrance ? ` · Gate ${active.entrance.x.toFixed(0)}, ${active.entrance.z.toFixed(0)}` : ''}
            </p>
            <p className="hint">{active.district} · {active.label}</p>
            <p className="hint">{active.note}</p>
            <p className="hint">There is no explorable interior for this place.</p>
            {active.actions.includes('venue') ? (
              <>
                <p className="hint">{opening(hoursQuery(active), clock.date).status}</p>
                <p className="hint">{opening(hoursQuery(active), clock.date).note}</p>
              </>
            ) : (
              <p className="hint">Location details from the mapped point. Hours are not a live timetable.</p>
            )}
            <div className="actions">
              <PlaceActions
                place={active}
                open={opening(hoursQuery(active), clock.date).open}
                hasCar={life.car}
                onMeal={() => spendMeal(opening(hoursQuery(active), clock.date).open)}
                onShop={() => spendShopping(opening(hoursQuery(active), clock.date).open)}
                onDrive={() => {
                  const here = selectionPoint(active.id);
                  if (!here || !drive()) return;
                  worldInput.ride = { x: here.x, z: here.z, mode: 'car', until: performance.now() + 2800, land: true };
                  worldInput.paused = false;
                  setActive(null);
                }}
                onGuide={() => {
                  walkToPlace(active.id);
                  setActive(null);
                }}
              />
              <button className="btn" type="button" onClick={() => setActive(null)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
        {trip ? (
          <div className="sheet" role="dialog" aria-label="On the way">
            <p className="eyebrow">On the way</p>
            <h2>{districtById(trip.placeId)?.name}</h2>
            <p className="hint">Arriving in {trip.left}s. The ride is shortened so you can play. It is not a live traffic time.</p>
          </div>
        ) : null}
        {showGo ? (
          <div className="sheet" role="dialog" aria-label="Leave the CBD">
            <p className="eyebrow">Around Nairobi</p>
            <h2>Go</h2>
            <p className="hint">The walkable streets run from the CBD through Hurlingham to Kilimani. Lavington, Kileleshwa, Ngong Road, TRM, Kiambu Road, the airport, and Syokimau are still outside the walkable mesh. Fares are game coins, not live prices.</p>
            {districtStops().map((stop) => (
              <div key={stop.id} className="section">
                <strong>{stop.name}</strong>
                <p className="hint">{stop.km} km · {stop.note}</p>
                <div className="choices">
                  {(['pikipiki', 'matatu', 'ride'] as const).map((mode) => {
                    const quote = quoteRide(mode, stop.km);
                    return (
                      <button key={mode} className="choice" type="button" onClick={() => startTrip(stop.id, mode)}>
                        {quote.label} · {quote.coins}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button className="btn" type="button" onClick={() => setShowGo(false)}>Close</button>
          </div>
        ) : null}
        {showLife ? (
          <div className="sheet" role="dialog" aria-label="Wallet">
            <p className="eyebrow">Game coins</p>
            <h2>{life.coins} coins</h2>
            <p className="hint">Coins are saved in this browser. They are not Kenyan shillings, and nothing here is a real purchase.</p>
            <p className="hint">Nairobi {clock.label}. The sky follows Africa/Nairobi. The loaded streets run from the CBD through Hurlingham to Kilimani. They are not the whole city.</p>
            <p className="hint">No nightclub is named in this extract, so none is listed. A place whose OpenStreetMap name says club, lounge, or disco would show as open from 18:00 to 03:00.</p>
            {notice ? <p className="hint">{notice}</p> : null}
            <div className="actions">
              {life.home ? (
                <button className="btn primary" type="button" onClick={() => { setInside({ mode: 'home', title: 'Your CBD room', x: life.home?.x ?? livePose.x, z: life.home?.z ?? livePose.z, kind: 'home', open: true }); setShowLife(false); }}>
                  Design the room
                </button>
              ) : (
                <button className="btn primary" type="button" onClick={() => purchaseHome(livePose.x, livePose.z)}>
                  Buy a room · {COINS.home} coins
                </button>
              )}
              {life.debt > 0 ? (
                <button className="btn" type="button" onClick={repayVillageLoan}>
                  Repay loan · {Math.min(life.coins, life.debt)} coins
                </button>
              ) : null}
              <button className="btn" type="button" disabled={life.car} onClick={purchaseCar}>
                {life.car ? 'City car owned' : `Buy a city car · ${COINS.car} coins`}
              </button>
              <button className="btn" type="button" onClick={takeRest}>Rest · +energy</button>
              <button className="btn" type="button" onClick={takeDrink}>Drink · 15 coins</button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (takeDance()) worldInput.emoteUntil = performance.now() + 4000;
                }}
              >
                Dance
              </button>
              <button className="btn" type="button" onClick={() => setShowLife(false)}>Close</button>
            </div>
          </div>
        ) : null}
        {showAds ? (
          <div className="sheet" role="dialog" aria-label="Placeholder placements">
            <p className="eyebrow">Local inventory</p>
            <h2>Placements</h2>
            <p className="hint">Placeholder campaigns only. No payment, approval, or delivery is connected.</p>
            {CAMPAIGNS.map((campaign) => {
              const stat = stats[campaign.id] ?? { impressions: 0, interactions: 0 };
              return (
                <div key={campaign.id} className="section">
                  <strong>{campaign.name}</strong>
                  <p className="hint">
                    {campaign.advertiser} · {campaign.status} · {campaign.starts} to {campaign.ends}
                  </p>
                  <p className="hint">
                    Impressions {stat.impressions} · Interactions {stat.interactions}
                  </p>
                </div>
              );
            })}
            <p className="fine">World data: {WORLD_PIPELINE.horizontal}. {cbd.attribution}.</p>
            <button className="btn" type="button" onClick={() => setShowAds(false)}>Close</button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function hoursQuery(place: PointOfInterest): string {
  switch (place.category) {
    case 'restaurant':
    case 'entertainment':
      return 'restaurant';
    case 'nightlife':
      return 'nightclub';
    case 'shopping':
      return place.label === 'Shopping mall' ? 'mall' : 'supermarket';
    case 'hotel':
      return 'hotel';
    case 'hospital':
    case 'school':
    case 'church':
    case 'public':
    case 'office':
    case 'residential':
    case 'park':
    case 'landmark':
    case 'building':
      return place.name;
    default: {
      const unexpected: never = place.category;
      return unexpected;
    }
  }
}

function localRemark(id: string): string {
  switch (id) {
    case 'kilimani':
      return 'Someone nearby says the shops up the hill are busy.';
    case 'lavington':
      return 'Someone nearby is walking a dog and nods as you pass.';
    case 'kileleshwa':
      return 'A neighbour asks if you are heading back toward town.';
    case 'ngong-road':
      return 'A conductor calls the next stop along Ngong Road.';
    case 'trm':
      return 'At the mall entrance, someone asks if you are meeting people inside.';
    case 'kiambu-road':
      return 'Traffic is moving along Kiambu Road. A rider asks which way you are going.';
    case 'jkia':
      return 'At the airport area, a worker points you toward the public forecourt.';
    case 'syokimau':
      return 'Someone heading south says Syokimau is quieter than the CBD at this hour.';
    default:
      return 'Someone nearby greets you.';
  }
}

function PlaceActions({
  place,
  open,
  hasCar,
  onMeal,
  onShop,
  onDrive,
  onGuide,
}: {
  place: PointOfInterest;
  open: boolean;
  hasCar: boolean;
  onMeal: () => void;
  onShop: () => void;
  onDrive: () => void;
  onGuide: () => void;
}) {
  const venue = place.actions.includes('venue');
  const food = place.category === 'restaurant' || place.category === 'hotel' || place.category === 'nightlife' || place.category === 'entertainment';
  return (
    <>
      {venue && food ? (
        <button className="btn primary" type="button" disabled={!open} onClick={onMeal}>
          {open ? `Order food · ${COINS.meal} coins` : 'Closed · food is not being served'}
        </button>
      ) : null}
      {venue && place.category === 'shopping' ? (
        <button className="btn primary" type="button" disabled={!open} onClick={onShop}>
          {open ? `Shop · ${COINS.shopping} coins` : 'Closed · the shop panel is not taking orders'}
        </button>
      ) : null}
      {place.category === 'park' ? <p className="hint">This is open ground. There is no door to enter.</p> : null}
      {place.category === 'hospital' ? <p className="hint">This panel only confirms the mapped hospital or clinic.</p> : null}
      <button className="btn" type="button" onClick={onGuide}>
        Go here
      </button>
      {hasCar ? (
        <button className="btn" type="button" onClick={onDrive}>
          Drive · {COINS.fare} coins
        </button>
      ) : null}
    </>
  );
}

function Joystick() {
  const nub = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = rect.width / 2;
    const length = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(max, length);
    dx = (dx / length) * clamped;
    dy = (dy / length) * clamped;
    worldInput.stick.x = dx / max;
    worldInput.stick.y = -dy / max;
    if (nub.current) nub.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    worldInput.stick.x = 0;
    worldInput.stick.y = 0;
    if (nub.current) nub.current.style.transform = 'translate(0, 0)';
  };
  return (
    <div
      className="stick"
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="stick-nub" ref={nub} />
    </div>
  );
}

const MAP_SPAN = 150;

function footTime(metres: number): string {
  const minutes = metres / 1.8 / 60;
  if (minutes < 1) return 'under a minute on foot';
  return `about ${Math.max(1, Math.round(minutes))} min on foot`;
}

function paintLocalMap(
  data: CbdData,
  cx: number,
  cz: number,
  heading: number,
  destination: { x: number; z: number } | null,
) {
  const canvas = document.querySelector<HTMLCanvasElement>('.minimap canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const half = MAP_SPAN / 2;
  const toMap = (x: number, z: number) => ({
    x: ((x - (cx - half)) / MAP_SPAN) * w,
    y: ((z - (cz - half)) / MAP_SPAN) * h,
  });
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#272b2e';
  ctx.fillRect(0, 0, w, h);
  const margin = 24;
  for (const road of data.roads) {
    if (road.points.length < 2) continue;
    const quiet = road.class === 'footway' || road.class === 'path' || road.class === 'steps';
    let near = false;
    for (const [x, z] of road.points) {
      if (Math.abs(x - cx) < half + margin && Math.abs(z - cz) < half + margin) {
        near = true;
        break;
      }
    }
    if (!near) continue;
    ctx.beginPath();
    road.points.forEach(([x, z], index) => {
      const p = toMap(x, z);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = quiet ? 'rgba(196, 184, 166, 0.35)' : 'rgba(232, 224, 210, 0.85)';
    ctx.lineWidth = quiet ? 1 : 2;
    ctx.stroke();
  }
  const marks = poiRegistry()
    .map((place) => {
      const point = selectionPoint(place.id);
      if (!point) return null;
      return { x: point.x, z: point.z, distance: Math.hypot(point.x - cx, point.z - cz) };
    })
    .filter((place): place is { x: number; z: number; distance: number } => place !== null && place.distance < half)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 28);
  ctx.fillStyle = 'rgba(232, 224, 210, 0.7)';
  for (const place of marks) {
    const dot = toMap(place.x, place.z);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const centre = toMap(cx, cz);
  ctx.strokeStyle = '#e7c48a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centre.x, centre.y);
  ctx.lineTo(centre.x + Math.sin(heading) * 14, centre.y + Math.cos(heading) * 14);
  ctx.stroke();
  if (!destination) return;
  const goal = destination;
  const dx = goal.x - cx;
  const dz = goal.z - cz;
  const limit = half - 8;
  const scale = Math.max(Math.abs(dx), Math.abs(dz));
  const shown = scale > limit ? { x: cx + (dx / scale) * limit, z: cz + (dz / scale) * limit } : goal;
  const mark = toMap(shown.x, shown.z);
  ctx.fillStyle = '#e7c48a';
  ctx.beginPath();
  ctx.arc(mark.x, mark.y, scale > limit ? 3 : 5, 0, Math.PI * 2);
  ctx.fill();
}
