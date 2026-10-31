# Asset pipeline

This document is the contract for adding a character, a piece of clothing, an animation, or a Nairobi building. The renderer does not need a rewrite. A new file plus a registry record is the whole change, after the checks below pass.

## What the project does today

| Piece | Current state |
| --- | --- |
| Renderer | Three.js 0.170 through React Three Fiber 8. One WebGL canvas per screen. |
| Character | Procedural meshes in `src/game/character/Avatar.tsx`. Save format is `CharacterConfig` version 1. Source tag `procedural-prototype`. |
| Asset loader | `src/game/assets/load.ts`. glTF binary via Three’s `GLTFLoader`. One id at a time. Absent records are not fetched. |
| Coordinates | Origin is the published KICC position, −1.28861, 36.82306. East is +X. North is −Z. One unit is one metre. `src/game/world/project.ts`. |
| City | OpenStreetMap footprints and roads in `src/game/world/cbd-data.json`, ODbL. Buildings are merged by height. Collision uses the footprint polygons. |
| Landmarks on screen | KICC is a cylinder at the OSM plot, roof marked at 105 m. Times Tower is the OSM footprint extruded toward 140 m. Neither is a surveyed model. |
| Animation | No clip files and no animation mixer. The procedural body has no skeleton. Walking is a position change, not a walk cycle. |
| Folders | `public/assets/` holds deliverable files. `src/game/assets/` holds the registry, the rig contract, and the loader. |

The only real 3D file in the repo is `public/assets/probes/pipeline-probe.glb`. It is an original 1 metre cube written by `scripts/write-probe-glb.mjs`. It is a loader test. It is not a person and not a building.

## Folder layout

Drop files here. Do not put production models under `src/`.

```
public/assets/
  probes/            loader tests only
  characters/rigs/   nd-humanoid-v1 body
  characters/hair/
  characters/clothing/
  characters/shoes/
  characters/accessories/
  characters/animations/
  buildings/         ordinary authored shells, if a footprint extrusion is not enough
  landmarks/         KICC, Times Tower, and later named buildings
  vehicles/
  furniture/
  props/
  textures/          shared images that are not already packed in a GLB
  environment/       district tiles, when a district stops being an OSM JSON
```

Empty folders are intentional. An empty folder is not an asset.

## Registry

`assetRegistry()` in `src/game/assets/registry.ts` is the list the game will load. Each record has:

- `id`, `role`, `status`
- `file` public path, or `null`
- `format`: `glb`, `gltf`, `ktx2`, or `osm-json`
- `license` and `provenance`
- `lod` 0, 1, or 2
- `rigId` when the mesh must fit `nd-humanoid-v1`
- `slots` naming the `CharacterConfig` fields the mesh represents
- `placement` in metres and lat/lon for a landmark

Status meanings:

| Status | Meaning |
| --- | --- |
| `absent` | No file. The loader must not fetch. |
| `placeholder` | A stand-in file that is not the production model. The probe is the only one. |
| `procedural` | Built in code from real data. The CBD block is this. |
| `review` | A file is present and has not been accepted. |
| `ready` | A file passed the checklist and may be shown as the real object. |

Nothing in the registry is `ready`. Do not mark a record `ready` to make the UI look finished.

## Adding a file

1. Put the `.glb` in the folder for its role.
2. Add or edit one `AssetRecord`. Set `status` to `review` and fill license, provenance, rig, slots, and placement.
3. Open the world and choose **Assets**, or run `loadGltfBuffer` in a test.
4. `validateFacts` must pass. Then set `status` to `ready`.
5. Wire that id into the avatar or the district only after the status is `ready`. The procedural avatar and the OSM extrusions stay in place until then.

`loadGltfAsset` returns `loading`, `error`, or `ready`. An error on an absent id means the fetch was refused. An error on a real path is a network or parse failure. The bench shows the checks under the model.

## Character contract

`MASTER_RIG` in `src/game/assets/rig.ts`:

- Id `nd-humanoid-v1`
- Metres, Y up, facing −Z, rest height about 1.7 m
- Bones: `Hips`, `Spine`, `Chest`, `Neck`, `Head`, shoulders, arms, hands, legs, feet, both sides
- Clips that must exist on the body or in the locomotion file: `idle`, `walk`, `run`, `turn`
- Emotes to add with the social work: `wave`, `talk`, `sit`
- Morphs that should match the creator sliders: jaw, cheeks, chin, eyes, brow, nose, lips

Skin is a material colour or a texture set driven by `CharacterConfig.skin`. Body height, build, shoulder, and hip stay on `CharacterConfig.body` and scale the rig. They are not a second identity.

Hair, clothing, shoes, and accessories are separate GLBs bound to the bones in `ATTACHMENTS`. `wearPlan(config)` decides what is visible. A full dress (`evening`, `print-dress`) hides top, outer, and the separate bottom. That matches `deriveLook`. Swapping those meshes must not change `faceSignature`.

The live street still draws `Avatar.tsx`. Pointing the registry at a missing body does not invent a person.

## City contract

- Keep ordinary blocks as footprint extrusions. A GLB per CBD building will not run.
- A landmark GLB is placed at the `placement` on its registry record. KICC and Times Tower already store the OSM position and the published height. The mesh file is absent.
- Provenance stays on the record: OSM for the plot, the modeller and the licence for the mesh.
- Collision stays on the footprint polygon until a landmark brings a simpler collider mesh. Do not collide against a decorative high-poly shell.
- Entrances stay on `destinations` in the OSM extract. An interior is a separate file and is not implied by a door.
- Districts stream by id. `district-nairobi-cbd` is loaded. Later districts are new records with `status: 'absent'` until their extract or tile exists. Unload a tile by dropping its merged geometries, not by keeping every mesh in the graph.

## Delivery

| Concern | Now | Later, when a decoder is vendored |
| --- | --- | --- |
| Container | GLB | GLB |
| Mesh compression | None | Meshopt, then Draco if a source requires it |
| Textures | Inside the GLB, as small as the art allows | KTX2 / Basis |
| LOD | Field on the record. Only lod 0 exists | lod 1 and 2 as extra records, chosen by distance |
| Instancing | CBD bands are already merged | Repeated props share one geometry |
| Loading | Lazy, per id, cached after parse | Same, plus district tiles |

Do not turn compression on by importing a decoder and claiming every asset uses it. The probe is uncompressed on purpose.

## Budgets

Enforced by `validateFacts` when a file is parsed:

| Role | Triangles |
| --- | --- |
| Body | 25 000 |
| Hair or clothing | 8 000 |
| Shoes | 4 000 |
| Accessory | 3 000 |
| Landmark | 80 000 |
| Ordinary building shell | 4 000 |
| Prop | 3 000 |
| Vehicle | 20 000 |
| Furniture | 6 000 |
| Probe | 64 |

Also required: a non-empty licence, at least one mesh, file under 8 MB, landmark placement present, body height between 1.45 m and 2.05 m, world bounds under 400 m on an axis. A body or clip set must include the master bones and `idle`, `walk`, `run`, `turn`.

## Validation checklist

Use this before `status` becomes `ready`.

- Topology: closed enough for the material, no accidental interior faces, normals point out. The probe uses flat face normals.
- UVs: present on any mesh that uses a texture. The probe is a solid colour and has no UVs.
- Materials: glTF PBR. No engine-only shader. Names are stable (`probe-brass` on the test cube).
- Scale: metres. A person is about 1.7 m. The probe’s bounds are 1 × 1 × 1.
- Pivot: feet on Y = 0 for a body. The probe sits on Y = 0.
- Skeleton: bone names match `MASTER_RIG.bones` exactly, or the file stays in `review`.
- Skinning: weights assigned, no unweighted vertices on a body.
- Morphs: names from the rig list, in the 0–1 range the creator already uses.
- Clips: play on that skeleton without a scale pop. Idle, walk, run, and turn loop. Emotes return to idle.
- Collision: a simple mesh or the existing footprint, not the render mesh.
- Licence: commercial use is allowed for this game, stated on the record. Credit the author.
- Size: inside the triangle budget and under 8 MB for a single file.

`validateFacts` covers the items a parser can see: meshes, triangles, bytes, scale, bones, clips, placement, licence text. UVs, weight quality, and legal review are still a human pass. The function returning pass does not by itself make a record `ready`.

## Where models should come from

Generate or download only with a licence that allows a commercial game. Record the licence on the asset. A generated mesh is not production-ready until the checklist passes.

| Category | Prefer | Avoid |
| --- | --- | --- |
| Body, hair, clothes | A modeller working to `nd-humanoid-v1`, or a library whose licence allows shipped game use and modification | Scraped marketplace rips, unlicensed “free” rigs, anything that forbids commercial use |
| Walk and emote clips | Authored on this skeleton, or retargeted from a library whose licence allows it | Clips that cannot be retargeted, or clips tied to a licence that expires when the subscription ends |
| Ordinary buildings | Keep the OSM extrusion | A unique GLB for every footprint |
| KICC, Times Tower | Commission or model from licensed reference. Store the file under `landmarks/` and the OSM point on the record | Photogrammetry or meshes taken from another game, a film, or an unlicensed scan |
| Props, furniture, vehicles | CC0 libraries such as Poly Haven or Kenney when the licence fits, or original models | Branded vehicles, logotypes, and product replicas |
| Textures | CC0 photo sets, or original | Street photography used as a facade without rights |
| AI mesh tools | Useful as a blockout. Name the tool in `provenance` | Treating the first export as final. Check triangles, UVs, the rig, and the tool’s commercial terms |

Do not scrape or redistribute copyrighted models, textures, photographs, or branded assets. If the rights are unclear, the status stays `absent`.
