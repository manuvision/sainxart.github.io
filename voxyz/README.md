# Voxyz

A cozy, playable voxel world for the browser, built with Three.js and plain JavaScript modules. The live route is `https://manu.vision/voxyz/`; its card is the second project in the main site's `#lab` carousel.

## Run locally

From the **site root** (the directory containing the main `index.html` and `voxyz/`):

```sh
python3 -m http.server 4175
```

Open `http://localhost:4175/voxyz/`. Serve it over HTTP rather than opening `index.html` as a file: JavaScript module workers and module imports need a normal web origin. Three.js and the pixel font are vendored in `vendor/`; no package install or build step is required.

The world starts generating while the title screen is visible. Starting reveals the controls over the same scene. Browser autoplay policies require a click or tap before the ambient audio can begin.

## Controls

| Action | Desktop | Touchscreen |
| --- | --- | --- |
| Move | WASD or arrow keys | Left joystick |
| Look | Mouse; drag fallback if pointer lock is unavailable | Right joystick |
| Jump / swim up | Space | Jump button |
| Sprint | Shift | Sprint button |
| Swim down | Ctrl or C | — |
| Break a block | Left mouse button | Break button |
| Place selected block | Right mouse button | Place button |
| Select inventory slot | 1–9, scroll wheel, or click a slot | Tap a slot |
| Pause | Escape or menu | Menu button |

The settings panel lets you choose a world seed, lighting mode, graphics quality, and sound. The same seed reproduces the same terrain. Block edits are saved per seed in this browser's `localStorage`; they survive reloads on the same origin. Different browsers, devices, and origins have separate saves. Clearing browser site data removes those edits. Moving water is recalculated locally and its transient flow cells are not stored as permanent edits.

## Engine structure

| File | Responsibility |
| --- | --- |
| `main.js` | Scene lifecycle, title/game UI, inventory, settings, interactions, timing |
| `terrain.js` | Seed hashing, deterministic terrain, caves, biome selection, voxel trees, chunk halos |
| `world.js` | Chunk lifecycle, worker scheduling, block queries and edits, persistence, water updates |
| `world-worker.js` | Terrain generation and remeshing away from the main thread |
| `mesher.js` | Exposed-face chunk geometry, hidden-face removal, vertex colors, ambient occlusion |
| `player.js` | Player collision, gravity, jumping, swimming, pointer lock and touch input |
| `graphics.js` | Sky, shadows, water reflection/refraction, fog, caustic patterns, light shafts |
| `ecosystem.js` | Instanced foliage, flowers, kelp, lily pads, animals, clouds and particles |
| `audio.js` | Procedural forest, water, wildlife and interaction sounds through Web Audio |

The engine streams 16 × 16 columns, each 80 blocks high. One-voxel halos make neighboring meshes and ambient occlusion agree at chunk boundaries, including after edits. Trees are actual editable blocks. Smaller plants and wildlife use instanced decorative geometry. Native ponds and rivers have source water at block level 12, with the exposed surface at 12.86. Source cells produce descending streams and up to seven horizontal flow levels; streams recede after losing their source.

## Verification

With a current Node.js installation, from `voxyz/`:

```sh
npm run check
npm test
```

The world tests can also run alone, without npm, from the site root:

```sh
node --test voxyz/tests/world.test.js
```

The world suite covers deterministic seed generation, negative-coordinate chunk seams, agreement between generated and queried blocks, dry starting ground and discoverable biomes, hidden faces, exact water surface elevation, bounded fluid spread and drainage, cross-chunk edit halos, per-seed save restoration and storage failures, stale worker results, a real world water placement/removal cycle, and suspended water waking when its neighborhood is revisited. Player and interaction tests cover their respective input, physics and targeting behavior.

All 30 automated tests passed during implementation. A 61-chunk terrain-only generation/meshing benchmark for the `VOXYZ` seed produced 197,948 triangles and approximately 18.9 MiB of geometry on the development host.

Browser verification on September 6, 2026 used the local Mac's Codex in-app browser. The 1280 × 720 desktop view settled at 60 fps at adaptive scale 1, including terrain, instanced vegetation, wildlife, refraction and periodically updated planar reflection. The final `fern-62408` scene contained 61 terrain chunks, 218,924 terrain/water triangles and approximately 573,000 triangles in the final scene pass. A 390 × 844 viewport used the mobile budget (37 chunks, scale .85) and held 60 fps during touch-stick movement into the pond. This is a phone-sized viewport on desktop hardware, **not a physical-phone benchmark**. Frame drops during initial shader compilation and interaction were observed; 60 fps is a steady-state target rather than an absolute minimum.

Browser checks verified title-to-play camera handoff, hotbar keyboard selection, left-click break/right-click placement, edit survival after reload, pause/resume, seed changes, settings, night mode, independent touch controls, swimming and underwater rendering. No shader or browser console errors were reported. Physical iOS/Android devices and extended exploration are still useful follow-up validation.

## Rendering scope and performance

60 fps is the performance target; it is not a guarantee across hardware, browser versions, thermal conditions, display resolution, or complex user constructions. Worker generation, exposed-face meshes, instanced details, limited nearby simulation, reduced-resolution water passes and adjustable quality keep the budget bounded. The FPS indicator is the useful runtime check on a particular device.

The visual effects are chosen for an interactive web scene:

- Water uses real voxel surface geometry, depth-based screen-space refraction and a reduced-resolution planar reflection pass. The reflection plane is the main water level; arbitrary elevated placed water does not receive a separate physically correct reflection camera.
- Caustics are animated procedural light patterns, not a physical transport simulation. A bounded nearby column cache restricts them to exposed water columns, follows their actual source/flow heights, and excludes dry ground and sealed water.
- Light shafts use translucent additive geometry rather than full volumetric ray marching or physically accurate cloud occlusion.
- Fog creates atmospheric depth and conceals the streaming horizon. It is not a stored fog-of-war map.
- Animals use lightweight ambient movement rather than a survival AI, breeding, or food-chain simulation. Water follows finite cellular flow rules rather than fluid dynamics.
- Decorative plants, particles and clouds are visual scenery. Terrain and voxel trees are the editable world.

Three.js and Tiny5 licenses are included alongside their vendored files.
