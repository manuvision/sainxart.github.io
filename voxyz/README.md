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
| Look | Mouse, without holding a button; native pointer lock where supported | Drag anywhere on the world outside the movement stick and UI |
| Jump / swim up | Space | Jump button |
| Sprint | Shift | — |
| Toggle flight | Double-tap Space | Double-tap Jump / Up |
| Rise while flying | Hold Space | Up button |
| Descend while flying | Hold Ctrl or C | Down button |
| Hover | Release movement keys | Release the controls |
| Swim down | Ctrl or C | — |
| Break a block | Left mouse button | Break button |
| Place selected block | Right mouse button | Place button |
| Select inventory slot | 1–5, scroll wheel, or click a slot | Tap a slot |
| Level camera | R or center-camera button | Center-camera button |
| Exploration map | M or circular minimap | Tap circular minimap |
| Pause | Escape or menu | Menu button |

Desktop entry and resume request native mouse capture; Escape releases it and pauses. Embedded browsers without pointer-lock support use free mouse movement within the window bounds. UI controls and dialogs suspend looking.

The settings panel controls the seed, lighting, graphics quality and sound. The same seed reproduces the same landscape. **Reloading starts a pristine session:** block edits, placed water and map discovery are not read from or written to browser storage. Pausing or returning to the title screen keeps the current session; changing seeds starts a fresh one. Seed and display preferences can still be remembered.

The north-up minimap shows a 180-block radius. The full map shows 400 blocks from its center to the shorter edge. Visits reveal a 128-block radius; undiscovered terrain stays dark. Discovery and raster sampling are cached and bounded.

Holding break or place repeats normal construction. Water pours once per press, preventing a held button from unintentionally creating a column of new sources.

## Engine structure

| File | Responsibility |
| --- | --- |
| `main.js` | Scene lifecycle, title/game UI, inventory, settings, interactions, timing |
| `terrain.js` | Seed hashing, deterministic terrain, caves, biome selection, voxel trees, chunk halos |
| `world.js` | Chunk lifecycle, worker scheduling, block queries, session edits and fluid scheduling |
| `world-worker.js` | Terrain generation and remeshing away from the main thread |
| `mesher.js` | Exposed-face chunk geometry, hidden-face removal, vertex colors, ambient occlusion |
| `water.js` | Pure gravity, downhill routing, source/flow states and shared water heights |
| `torch-lights.js` | Fixed light pool and prewarmed flame/glow shaders for responsive torch placement |
| `held-item.js` | Selected item peeking into the first-person view, with a persistent torch light |
| `player.js` | Player collision, gravity, jumping, swimming, pointer lock and touch input |
| `graphics.js` | Sky, shadows, water reflection/refraction, fog and nearby water-column cache |
| `surface-material.js` | World-aligned material textures, relief, roughness and filtered environment light |
| `post-processing.js` | HDR bloom, ACES display mapping, antialiasing and color grading |
| `sun-rays.js` | Bounded sun-shadow ray marching, underwater scattering and depth-aware filtering |
| `ecosystem.js` | Instanced foliage, flowers, kelp, lily pads, animals, clouds and particles |
| `exploration-map.js` | Session discovery grid, cached terrain raster, minimap and full map |
| `audio.js` | Procedural daytime birds, night wildlife and interaction sounds through Web Audio |

The engine streams 16 × 16 columns, each 80 blocks high, with an eight-chunk radius on desktop and six on touch layouts. Fog begins 44 blocks away on desktop and 32 on touch layouts; nearby scenery stays clear. One-voxel halos make neighboring meshes and ambient occlusion agree at chunk boundaries, including after edits. Trees are actual editable blocks. Smaller plants and wildlife use instanced decorative geometry. Native ponds and rivers have source water at block level 12, with the exposed surface at 12.875. Source cells supply falling streams and up to seven horizontal flow levels. Unsupported flow falls before spreading; downhill routes take priority. Sources are never created automatically. Streams merge into ponds and recede when their feed is removed. Falling and stacked water are full height; neighboring exposed corners form slopes. See `RESEARCH.md` for behavior sources and deliberate differences from Minecraft.

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

The tests cover deterministic generation, chunk seams and stale workers, collision and swimming, immediate input and held-action metadata, stable scenery, session reset, exploration caching, source/flow/falling surfaces, downhill routing, finite spread, waterfall entry into ponds, drainage and transient-data cleanup. Post-processing tests cover HDR targets, pass order without framebuffer feedback, quality fallback, resizing and resource cleanup.

## Visual and interaction revision

The world uses rough PBR materials with original procedural bark, stone, turf, sand and leaf relief. Mipmapped textures and derivative-filtered fine detail keep surfaces stable at distance. Rounded crowns and tapered spruce silhouettes replace repeated flat foliage shelves; leaf clusters, reeds and grasses add smaller scale detail within bounded instance budgets.

Scene lighting, refraction and reflection remain in linear HDR. A single final pass combines thresholded bloom, ACES tone mapping, subtle grading and FXAA. Lantern flames exceed display white to produce true bloom; ordinary foliage does not receive a blanket glow. Water has calmer multi-scale ripples, depth-dependent absorption, foreground-aware refraction and a darker sky fallback for elevated streams. Shallow placed water has blue-green tint and filtered ripple detail. Sun glints sample the existing tree-shadow map instead of shining through blocked sunlight. Visible planar reflections refresh every frame, including between intermittent mouse movements. The target follows the viewport aspect, at half drawing-buffer resolution capped at 1024 pixels on desktop and 512 on mobile. Multisample edge coverage (up to 4 desktop / 2 mobile), mipmaps and world-projected ripples reduce reflection shimmer without temporal trails. From below, the surface stays transmissive at every angle so the sky and trees remain visible; underwater floor reflection is deliberately disabled for this art direction. Blue absorption, a subtle surface tint and stronger ripple distortion keep the interface visible. Above-water refraction is rendered without underwater fog, avoiding double attenuation, and reflection clip offsets remain valid near surface crossings. Sun shadows snap in light space to reduce shimmer. A wider PCF filter softens their edges, while stronger diffuse sky fill and gentle distance haze balance the lower sun without washing out nearby color.

Grass keeps its full size through distance fades, bends away from the nearby player and settles back after footsteps. The approach influence reaches 1.45 blocks and bends about 19% more than the previous release. Grass and reeds require live dirt/turf at each blade root, so clumps cannot spill onto sand; kelp, lily pads and cactus retain separate rules. Fine scenery reaches 48 blocks on desktop and 32 on mobile. Coverage fading avoids translucent-instance sorting. Decorative geometry remains tied to stable world coordinates.

Torch posts use matte brown wood. Six reusable lights keep the shader light count constant, while flame and glow shaders compile against the HDR scene target during launch. Torch edits avoid rebuilding surrounding decorative foliage.

Double-tap jump toggles flight with collision, hovering, vertical controls and sprinting. On mobile, Down occupies the former Jump position while Up sits directly above. Pausing preserves flight and releases held inputs; returning to title or changing worlds exits flight.

The soundscape uses sparse birds during daylight, transitioning to gentle crickets and occasional frogs after dusk. Water is very quiet and local to nearby loaded water columns, fading away with distance or altitude. Submersion crossfades to a low, muffled water bed and soft bubbles. Walking is silent; deliberate block and jump effects remain.

The selected inventory item peeks in from the right screen edge with subtle movement and interaction animation; no character arm or hand is shown. A held torch illuminates nearby terrain using a persistent light slot. All props are prewarmed at launch. They render once into the HDR scene before bloom, outside both water captures; compressed near depth keeps the item visible beside nearby walls while preserving the world depth used by sun shafts. Fireflies spawn directly at their floating height and fade with per-particle opacity, including when their viewing volume recycles them. Their size stays fixed during appearance.

The title stays minimal: logo, entry and settings buttons, plus site and sound controls. In-game UI retains the five-slot inventory, direct touch looking, large action buttons, camera-level control and circular exploration map.

Verified on 6 September 2026: all 151 automated tests and 17 JavaScript syntax checks pass. Chrome native mouse capture, Escape release/pause, and resume recapture were verified; narrow desktop and hybrid input have regression coverage. Browser checks covered button-free desktop looking, title/start, session reset, block and water edits, flight/hover/up/down, portrait and landscape controls, map overlays, grass contact, moving-camera reflections, the blue underwater interface, shared caustics, sun-shadow shafts, and night/Lightweight fallbacks. The audio follow-ups verify day-only birds, a mixed dusk transition, no new bird calls at night, cricket/frog scheduling, silent walking, proximity-based water, underwater crossfading and mute. The held-item follow-up checked desktop and portrait item placement, torch illumination, the underwater view, and unchanged shader-program counts when selecting the torch. The checked desktop and portrait views remained at 60 FPS on the development Mac. No browser or shader errors appeared in the checked views.

On the development Mac, the updated 1280 × 720 desktop view held 60 FPS at render scale 1 with 221 loaded chunks and roughly 1.01 million visible scene triangles, using a 640 × 360 four-sample reflection refreshed every visible frame. The 390 × 844 layout also held 60 FPS at scale 0.85 with the continuous two-sample reflection and about 277,000 visible triangles above water. The 390 × 844 mobile layout held 60 FPS at scale 0.85 with 137 chunks and about 283,000 visible triangles underwater. These measurements include the six-pass post-processing path with sun shafts; night drops to four passes and Lightweight to one. The first torch-placement measurement held 60 FPS with a peak frame interval of 17.4 ms and no added shader programs during its 1.2-second measurement window. Initial launch or graphics-mode shader compilation can briefly dip below target. Responsive browser tests are not a physical-phone performance benchmark.

## Rendering scope and performance

60 fps is the performance target; it is not a guarantee across hardware, browser versions, thermal conditions, display resolution, or complex user constructions. Worker generation, exposed-face meshes, instanced details, limited nearby simulation, reduced-resolution water passes and adjustable quality keep the budget bounded. The FPS indicator is the useful runtime check on a particular device.

The visual effects are chosen for an interactive web scene:

- Rendering uses linear HDR targets and a single display transform. Bloom runs at quarter resolution on desktop, one-eighth on mobile Auto, and is disabled in Lightweight mode. Devices without HDR render-target support use a byte-target fallback without bloom.
- Water uses real voxel surface geometry, depth-based screen-space refraction and a reduced-resolution planar reflection pass. The reflection plane is the main water level; arbitrary elevated placed water does not receive a separate physically correct reflection camera.
- Caustics are animated procedural light patterns, not a physical transport simulation. A bounded nearby column cache restricts them to exposed water columns, follows their actual source/flow heights, and excludes dry ground and sealed water. The pattern is shared by terrain, underwater foliage and fish. Only upward-facing surfaces receive the neutral, albedo-colored focused light; vertical sides and undersides retain wet shading without caustic stripes. Two smooth wave families vary the local width, strength and motion of the highlights, with pixel-footprint filtering.
- Sun shafts march through the actual sun shadow map at quarter resolution, with depth-aware filtering. Trees and terrain occlude them; decorative clouds do not. Underwater shafts stop at the local exit surface. Night, Lightweight and non-HDR modes skip the effect.
- Atmospheric fog conceals the streaming horizon, while a separate session discovery grid controls the exploration map. Map terrain sampling runs only for discovered cells and is capped per frame.
- Animals use lightweight ambient movement rather than a survival AI, breeding, or food-chain simulation. Water follows finite cellular flow rules rather than fluid dynamics.
- Grass contact uses bounded visual spring trails rather than rigid-body colliders. Decorative plants, particles and clouds are visual scenery. Terrain and voxel trees are the editable world.

Three.js and Tiny5 licenses are included alongside their vendored files.
