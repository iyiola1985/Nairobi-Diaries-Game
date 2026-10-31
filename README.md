# NairobiDiaries

Live Nairobi your way. A browser prototype of a 3D social life game set in the Nairobi CBD.

This milestone is a playable loop, not the finished city.

1. Open the app.
2. Create a local profile and a 3D character.
3. Change face, hair, body, clothes, shoes, and accessories. The preview updates.
4. Confirm the character, choose a home base and a daily focus, and enter the CBD.
5. Walk with collision, follow a road route, and read a destination.
6. Reload. The saved character comes back.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints, usually `http://localhost:5173`.

```bash
npm run typecheck
npm run test
npm run build
npm run fetch-map
```

`fetch-map` refreshes `src/game/world/cbd-data.json` from OpenStreetMap. The checked-in extract is enough to run.

No environment variables are required. See `.env.example` for names reserved for later services.

## What is real in this build

- Character configuration is saved in `localStorage` under `nairobidiaries-v1`.
- Clothing, hair, face, and body controls change meshes, scales, or materials on one character. The same configuration is used in the studio and on the street.
- The CBD block uses OpenStreetMap footprints. Map data © OpenStreetMap contributors, ODbL.
- KICC and Times Tower are at their OSM positions. KICC’s tower is a simplified silhouette on that plot, not a measured architectural model. Heights use OSM tags when present, otherwise an estimate. The ground is flat.
- Walking, running, a third-person camera, collision, a minimap, destination search, and road wayfinding work inside this block.
- One billboard is a **placeholder** campaign. Impressions are counted locally. No payment or ad delivery exists.
- The asset registry is in `src/game/assets/`. The only 3D file is an original 1 metre probe at `public/assets/probes/pipeline-probe.glb`. Open **Assets** on the street to load it. Character, clothing, and landmark GLBs are registered as absent. See `docs/ASSET_PIPELINE.md`.
- Other players are not simulated. The session is local until a presence server exists.

## What is not built yet

Accounts, a rigged GLB character, interiors, the rest of Nairobi, careers, currency, multiplayer, moderation, and a real advertiser dashboard. The loader and the folder layout are in place so those models can be added without a new renderer. The technical plan is in `docs/PLAN.md`. The asset guide is in `docs/ASSET_PIPELINE.md`.

## Stack

React, TypeScript, Vite, Three.js, React Three Fiber, Zustand. The world is rendered in Three.js from OSM geometry rather than MapLibre, because this block needs collision and a walking character. MapLibre remains an option for a later city map.
