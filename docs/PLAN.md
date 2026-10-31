# NairobiDiaries technical plan

Positioning: a premium browser world where a person is made first, then walks a recognisable Nairobi and meets other people. Reference points are the life-simulation loop of Lagos Life (destinations, home, social presence) and the creator logic of DressUp (face before clothes, categories, colours, the face survives a wardrobe change). Neither site’s code or proprietary assets are used.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/ui` | Welcome, local profile, creator, lifestyle, world HUD |
| `src/game/character` | `CharacterConfig`, presets, clothing rules, procedural avatar |
| `src/game/world` | OSM district, projection, collision, pathfinding |
| `src/game/player` | Third-person movement and camera |
| `src/game/multiplayer` | `PresenceClient`. Only `local` is implemented |
| `src/game/ads` | Campaign records and one placeholder placement |
| `src/store/useGame.ts` | Persisted profile, character, looks, time of day, campaign counts |

The save contract is `CharacterConfig` version 1. A future rigged GLB should read that same object. Do not fork a second appearance format.

World coordinates: origin is the published KICC position, −1.28861, 36.82306. East is +X. North is −Z. One unit is one metre.

## Phases

1. **This milestone.** Creator, persisted character, one OSM CBD block, walking, one destination, one labelled placeholder billboard, local presence interface.
2. **Character asset.** The registry slot is `nd-humanoid-v1` (`docs/ASSET_PIPELINE.md`). Replace `Avatar.tsx` only after a rigged GLB passes validation: shared skeleton, morphs for face and body, separate hair and clothing. Keep `CharacterConfig`. The procedural body stays until that file exists.
3. **Districts.** Add Westlands, Kilimani, Upper Hill, Karen, Lavington, Parklands, and Eastleigh as streamed chunks. Home-base choice already stores the target district. Terrain comes from a real elevation source, not a flat plane.
4. **Interiors.** Separate from footprints. A door is not an interior.
5. **Life sim data.** Jobs, cash, apartments, and activities as content tables. The CBD already has named destinations to hang those on.
6. **Multiplayer.** Authoritative websocket server. Sync `NetPlayer` plus appearance. Friends, chat, block, mute, report, and moderation before public launch. Never fill the street with generated people.
7. **Advertising.** Advertiser accounts, creative review, flight dates, budgets, and reporting. The current board is a schema and a placeholder, not a product.
8. **MapLibre.** Use it for a 2D city map and data preview if the 3D block is not the right view. The walking world stays in Three.js.

## Dependencies chosen, and why

- React, TypeScript, Vite: UI and the creator.
- Three.js and React Three Fiber: one canvas for the character and the city.
- Zustand: small persisted store.
- OpenStreetMap Overpass: footprints and roads, ODbL, attribution on screen and in this repo.

Not installed yet, on purpose: a backend, auth, sockets, MapLibre, a physics engine, and a paid asset pack. Collision and pathfinding are local and good enough for one district.

## Asset and service gaps

- No rigged character GLB. The live body is generated geometry, marked `procedural-prototype`.
- No interior models, no surveyed landmark mesh, no terrain DEM.
- No auth provider, database, object storage, or websocket URL.
- No payment provider and no advertiser login.
- Kenyatta Avenue is in the extract. Railway station and several other landmarks are outside this block and are not faked.

## Highest risks

- **Character.** A procedural body will not pass as a commercial avatar. The config format is the hedge: swap the renderer without rewriting saves.
- **Map honesty.** Footprints can be OSM-accurate while heights and the KICC cylinder are not. The UI says which is which. Do not market the block as a survey.
- **Scale.** One merged CBD block is fine. The whole city needs streaming, simpler collision, and level-of-detail.
- **Multiplayer.** Position sync is the easy part. Moderation and age policy have to exist before strangers share a space.
- **Ads.** A mesh with a label is not an ad business. Billing and approval stay out until a server exists.

## Acceptance for this milestone

- The app boots in a desktop browser.
- A new player cannot skip the creator.
- Appearance controls change the 3D character, including after reload.
- The player walks the CBD with collision, opens at least one real destination, and sees their character.
- The billboard is marked Sponsored and described as a placeholder.
- The HUD does not claim other people are online.

## Later acceptance

- Returning players keep wardrobe, home, and district progress on a server.
- Two browsers see each other move in the same block.
- A second district loads without rewriting movement.
- An advertiser can create a flight that does not go live until it is approved.
