# Voxyz — visual and engine research

Research checked 6 September 2026. These sources informed the art direction and engineering tradeoffs. They are references, not assets or engine code incorporated into Voxyz.

## The user's MishMash references

- [Supplied MishMash pond video](https://www.youtube.com/watch?v=ZxfV7su168U). Inspected directly in Chrome after the search browser failed to retrieve it: video description, visible comments and a creator reply. Its description identifies an underlying GPU water simulation running on an M1 Pro. The channel is [@MishMash95](https://www.youtube.com/@MishMash95).
- [MGMishMash: procedural ponds, r/proceduralgeneration](https://www.reddit.com/r/proceduralgeneration/comments/1upoiw5/simulating_procedural_ponds_in_my_micro_voxel/). The creator identifies a custom C++ engine. Water uses a coarse GPU simulation with volume transport, motion vectors and occupancy-based flow, bounded by tick rate and simulation region. Terrain is stored in a voxel grid and meshed after modifications. Comments particularly appreciate water, atmosphere, organic details and sound; comments also identify visible wave patterns and vegetation popping. These are useful qualitative reactions, not a controlled consensus study.
- [MGMishMash: microvoxel engine, r/GraphicsProgramming](https://www.reddit.com/r/GraphicsProgramming/comments/1udkyzj/i_built_a_microvoxel_engine/). The creator describes coarse light-volume propagation with per-cell voxel occupancy controlling occlusion and energy transfer. Their post reports 0.1 m voxels, 40–100 FPS and 3.2 GB shared memory on an M1 Pro for that build. These are creator-reported measurements of a different native engine, not Voxyz benchmarks.

**Art decision:** pursue the reference's meadow-and-pond composition, warm sunlight, soft distance haze, lush shore detail, moving wildlife and layered ambient sound. Keep this appearance goal distinct from reproducing its exact microvoxel fidelity. Voxyz's browser implementation does not implement MishMash's native engine, GPU fluid solver, occupancy-based light propagation, or their reported performance characteristics.

## Follow-up through the creator's channel

- **Actual YouTube feedback:** a prominent [pond-video comment](https://www.youtube.com/watch?v=ZxfV7su168U&lc=UgybHLFFOPtckbBjbvR4AaABAg) emphasizes bird ambience and suggests changing call frequency through the day. Other visible comments repeatedly emphasize fish, reeds, small motion and background sound. In the [reflection discussion](https://www.youtube.com/watch?v=ZxfV7su168U&lc=Ugw2e1cY2yJXXXn62jB4AaABAg.AYyDXDjBg4jAYyK65n72ww), MishMash confirms screen-space reflections and explains that terrain DDA works better than DDA for dynamic props in his current pipeline. This supports testing the complete scene rather than choosing a renderer from isolated terrain benchmarks.
- **Caves:** the [Devlog #3 description](https://www.youtube.com/watch?v=qFcWtRgE25s) and [creator's accompanying post](https://www.reddit.com/r/VoxelGameDev/comments/1uimbj6/adding_caves_to_my_micro_voxel_engine_devlog_3/) describe stacked noise, deterministic feature generation for stalagmites, and an erosion pass for crevices. The author calls this an early pass and notes the challenge of returning upward after descending. For Voxyz, inspect cave entrances and return paths alongside visual shape.
- **Oceans:** the channel lists [Simulating Ocean Tides](https://www.youtube.com/watch?v=rCPDkSX5f1o). The [technical post and replies](https://www.reddit.com/r/VoxelGameDev/comments/1vfbiuf/simulating_ocean_tides_in_my_micro_voxel_game/) describe a separate local 2D ripple simulation whose height perturbations become a normal map; this avoids simulating every visual ripple throughout the 3D water volume. Ocean connectivity determines whether isolated pools receive waves. Each active chunk has an 8×8×8 water grid, with modified chunks copied back as needed. The author explicitly says microvoxel water meshing would be expensive and uses a continuous surface. These are future reference techniques, not current Voxyz features.
- **Whole-scene rendering:** in [ocean-development replies](https://www.reddit.com/r/proceduralgeneration/comments/1vg6nb0/simulating_procedural_oceans_in_my_micro_voxel/), MishMash explains that a terrain-only DDA test won in isolation but lost with the full scene's GPU workload. Mesh props also enable leaf sway and grass displacement through vertex animation. He notes that visually noisy distant LOD can reduce immersion even when its rendering cost is manageable.
- **Latest distance work:** the [18 August video description](https://www.youtube.com/watch?v=xGkWWfO87no), inspected on YouTube, reports 45–50 FPS on M1 Pro for an Ultra distance preset using about 5–6 GB system memory plus 3 GB VRAM, with remaining popping. The [detailed creator post](https://www.reddit.com/r/VoxelGameDev/comments/1vrqluv/improving_rendering_distance_in_my_micro_voxel/) describes direct coarse-resolution generation, independently cached edits, deterministic large-prop IDs, temporary LOD crossfades and fog that contracts while distant bands load. Those figures cannot substantiate a mobile-browser 60 FPS guarantee.

## Practical next choices from the follow-up

1. Keep the visible water surface, point-in-water tests and caustic eligibility consistent. Shallow flow must not trigger an underwater camera effect above its actual surface; dry surfaces must not receive underwater caustics.
2. Spend visual detail on shore plants, tree silhouettes, fish and sound variation. Keep distant grass as approximate coverage rather than millions of individually simulated entities.
3. Consider a small player-centered ripple buffer for contact with water, separate from the block-fluid update queue. This is a proposed improvement, not an implemented simulation claim.
4. Drive fog from available chunk coverage as well as the chosen quality preset. Hide incomplete distant generation without letting unloaded ground enter the player's collision region.
5. Profile draw passes and meshing separately. Skip reflection/refraction work when there is no visible water, and avoid persistent double rendering at LOD boundaries.
6. If terrain vertex count dominates, evaluate greedy merging while preserving material and per-corner AO. The original [0 FPS meshing article](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/) considers both resulting mesh size and remesh latency; its [AO follow-up](https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/) explains compatible merge rules and triangulation. The niche [urath Three.js/WASM project](https://github.com/LachyFS/urath) demonstrates typed-buffer output, reusable scratch storage and neighbor-border handling; its speed claims have not been independently benchmarked here, and adopting it is not required.

## Other useful precedents

| Source | Lesson for Voxyz |
| --- | --- |
| [Complementary Reimagined — official site](https://www.complementary.dev/shaders/) | Enrich lighting and water while retaining coherent cubic silhouettes. The creator explicitly distinguishes this style from the more realistic Unbound preset. |
| [Tiny Glade — developer site](https://pouncelight.games/tiny-glade/) | A relaxing nature composition can carry the experience: varied tree clusters, meadow clearings, small details and restrained contrast. Its [performance guidance](https://pouncelight.games/tiny-glade/troubleshooting/slow/) illustrates the value of resolution scaling. |
| [Veloren — water and lighting development notes](https://veloren.net/blog/devblog-156/) | Underwater deserves its own treatment: depth attenuation, floor caustics, appropriate sun/moon color and correct viewing of the surface from below. |
| [Nugget8 — Three.js Ocean Scene](https://github.com/Nugget8/Three.js-Ocean-Scene) | A concrete mobile browser reference using a gradient sky and scrolling water normals. The author removed parallax mapping because of mobile cost. Their 120 FPS claim applies to that small demo only. |
| [noa — browser voxel engine](https://github.com/fenomas/noa) | A useful architecture precedent for editable browser worlds; its project list includes Minecraft Classic and bloxd.io. |

The reviewed [Divine Voxel Engine README](https://github.com/Divine-Star-Software/DivineVoxelEngine) lists its Three.js adapter among packages not recently developed. A focused Three.js implementation avoids depending on that adapter for this project.

## Browser rendering decisions

- Use streamed chunk surface meshes and remove interior faces. The official [Three.js voxel guide](https://threejs.org/manual/en/voxel-geometry) explains why separate cube objects and hidden faces become expensive.
- Favor vertex ambient occlusion, a bounded sun shadow, atmospheric fog, instanced vegetation and lightweight wildlife. Each shadow-casting light requires additional scene rendering; see [Three.js shadows](https://threejs.org/manual/en/shadows.html).
- Separate discrete block-water behavior from water appearance. The browser design uses localized level updates with a surface shader; this is a different simulation from MishMash's volume-transport solver.
- Use reduced-resolution scene refraction and camera-synchronized planar reflection where the performance budget permits. Caustics use a bounded procedural pattern. Sun shafts sample the actual tree/terrain shadow map; neither effect implements a general light-transport simulation.
- Preserve a warm meadow palette, teal water/shadows, cream highlights and limited flower accents. Reserve brighter emissive colors for lanterns and fireflies.
- Treat 60 FPS as a measurement target for named devices and resolutions. Adapt resolution and quality from observed frame time; do not infer full-world performance from reference demos or claim a universal minimum.

## v3: water behavior and session semantics

Checked against the following sources on 6 September 2026:

- [Minecraft — Block of the Week: Water](https://www.minecraft.net/en-us/article/block-week-water), the official introduction, describes water spreading into adjacent air and explicitly explains Minecraft's automatic creation of additional source blocks. Voxyz deliberately omits that source multiplication.
- [PaperMC — FlowingFluid implementation patch](https://github.com/PaperMC/Paper/blob/main/paper-server/patches/sources/net/minecraft/world/level/material/FlowingFluid.java.patch), inspected as primary implementation evidence, exposes downward spreading before side spreading, downhill-path searches, transitions to empty fluid states, and avoiding chunk loads solely for fluid propagation.
- [Minecraft Wiki — water spreading](https://minecraft.wiki/w/Water#Spreading) documents seven horizontal steps, a downhill search extending four steps beyond a neighboring cell, and five game ticks between updates. Its [fluid-state table](https://minecraft.wiki/w/Water/FS) distinguishes falling water from horizontal flow levels. The Wiki provides useful detailed behavior documentation alongside the implementation source.

**Implemented model.** Voxyz evaluates nearby fluid cells against one stable snapshot every 0.25 seconds. Unsupported water falls before spreading sideways. Supported flow selects the nearest reachable downhill paths, including ties, and loses one level per horizontal step. Falling columns regain seven horizontal steps when they reach solid ground. Streams merge into existing ponds without constructing another sheet above their surface. Removing the source or sealing every feed makes downstream cells recede; opening a nearby drop can reroute an established stream. Horizontal levels strictly decrease, and falling cells require water above, preventing source-free cycles.

**Deliberate limits.** This is a discrete, Minecraft-inspired solver, not a physical volume or pressure simulation. A source continuously supplies water until removed; seven-block reach does not imply finite source volume, and successive downhill drops can extend a stream. Sources arise only from terrain or explicit placement, without Minecraft's automatic two-source multiplication. Waterlogging, item washing and entity-current forces are outside this pass. Voxyz uses its own metadata: `8` is a source, `1–7` are horizontal levels, and `9` is falling water. The shared height helper gives source surfaces 0.875 block height, horizontal cells `level / 8`, and falling/stacked cells full height. Neighboring surface corners are averaged into a continuous slope; this is a rendering choice rather than a claim of identical Minecraft geometry.

**Session behavior.** Block edits and transient flow belong only to the current `World` instance. Chunk eviction and return retain those edits, while reload or world regeneration starts pristine even with the same seed. Legacy block-save entries are ignored; no unrelated browser storage is deleted. Drained flow cells are removed from the transient map. Distant fluid work sleeps and resumes when revisited.

**CPU audit.** Development-host Node probes ran 400 ticks per scenario, followed by source removal. These measurements exclude rendering, worker meshing and browser overhead; they are not FPS claims.

| Scenario | Settled flow cells, excluding sources | Mean / maximum active tick | Drain after removal |
| --- | ---: | ---: | ---: |
| One source on an uninterrupted flat floor | 112 | 1.76 / 3.11 ms | 8 ticks / 2 s |
| Source at Y=65 falling into a Y=12 pond | 52 | 0.012 / 0.031 ms | 52 ticks / 13 s |
| Six nearby sources on a flat floor | 642 | 2.90 / 3.14 ms | 39 ticks / 9.75 s |

Settled idle ticks averaged roughly 0.001–0.002 ms on that host. Each active tick admits at most 192 candidates and targets a 3 ms evaluation budget; finishing the current bounded search and committing results can exceed that target slightly. Regression tests cover finite spread, downhill ties and obstacles, pond entry, complete drainage, chunk-boundary metadata/geometry, sleeping updates, session isolation and cleanup after long runs.

## v3: material and lighting pipeline

The official [Three.js color-management guide](https://threejs.org/manual/en/color-management.html) establishes linear working-space values and a single final display conversion. Voxyz therefore keeps scene, refraction and reflection targets in linear HDR and applies ACES and sRGB transfer once after compositing. This avoids clipping or display-mapping the water's scene textures before they are sampled.

[MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) and [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html) support the rough PBR terrain/foliage and filtered environment illumination. Original seamless procedural material fields provide bark grain, turf edges, stone variation and leaf relief; they use mip filtering and distance attenuation for fine analytic patterns.

The official [UnrealBloomPass documentation](https://threejs.org/docs/pages/UnrealBloomPass.html) and [post-processing guide](https://threejs.org/manual/en/post-processing.html) informed selective bright extraction and reduced-resolution blur. Voxyz uses a smaller custom three-pass bloom plus one final ACES/FXAA composite to keep browser cost bounded. This is an artistic lighting pass, not volumetric light transport.

No third-party visual assets, shader-pack code, or MishMash engine code were copied as part of this research.


## Sun shafts and the underwater interface

The fixed decorative light planes were removed. The current [Three.js GodraysNode documentation](https://threejs.org/docs/pages/GodraysNode.html) recommends shadow-based ray marching followed by bilateral filtering and depth-aware composition. The [three-good-godrays implementation notes](https://github.com/Ameobea/three-good-godrays) provide a useful precedent. Voxyz uses its own small GLSL implementation with the vendored r180 shadow format: RGBA-packed depth decoded with Three's packing helper, not the newer hardware comparison-depth path.

A quarter-resolution pass samples the existing sun shadow map along each camera ray, followed by a depth-aware blur and upsample. Desktop uses 24 steps over at most 32 blocks; mobile uses 16 over 24 blocks. There is no extra geometry pass. The camera and cached shadow matrix are captured together after the scene render. Contributions fade before the shadow-map boundary. Voxel trees and terrain occlude the light; decorative clouds do not cast these shadows. This is bounded single scattering, not path tracing.

Underwater shafts use the same occlusion with a shorter 16/12-block range and blue tint, stopping at the local water exit surface and foreground depth. They are disabled when the local water column is unknown or sealed, and all shafts are disabled at night, on Lightweight quality or without HDR support. The water underside deliberately favors readable transmission at all angles instead of total internal reflection: blue absorption, a subtle surface film and ripple refraction preserve a water interface without reflecting the pond floor into it. Caustic patterns share world coordinates across terrain, kelp and fish, and only apply inside exposed water columns.
