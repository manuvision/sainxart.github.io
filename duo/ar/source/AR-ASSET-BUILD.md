# Animated AR assets

The two final models use Apple's original 62 meshes and 27-joint `Slider` rig. The GLB retains original positions, normals, UV0 artwork and the 27-joint rig, while normalizing optional material features and negligible fifth skin influences for Android Scene Viewer. The USDZ exports the original complete rig as a native USD skeleton. Both contain the raccoon wallpaper and original lockscreen overlays.

The single seven-second animation holds closed for one second, eases open for 2.5 seconds, holds open for one second, and eases closed for 2.5 seconds. Geometry is scaled from centimetres to metres. It remains flat on a horizontal table, with the back-camera protrusion touching the plane throughout. The original animated joint translations are retained.

## Rebuild

Requirements: Python with Pillow and NumPy, Blender 5.1 or later with bundled OpenUSD. Run from the repository root:

```sh
python3 duo/ar/source/prepare-ar-assets.py
blender --background --factory-startup --python duo/ar/source/export-ar-assets.py
blender --background --factory-startup --python duo/ar/source/verify-ar-usdz.py -- --skip-renders
blender --background --factory-startup --python duo/ar/source/validate-ar-animation.py
usdchecker --arkit --strict duo/ar/assets/duo-fold.usdz
```

`prepare-ar-assets.py` creates the self-contained GLB directly from the source asset and prepares the texture-converted glTF for Blender. For Android, it strips unsupported optional material extensions, removes secondary UV detail/AO maps, uses measured average metallic/roughness factors for those detail maps, and renormalizes four primary skin influences after discarding fifth-weight numerical residue below 0.000001. Base artwork, wallpaper, positions, normals, all 27 joints, and folding timing remain intact. These Android normalizations do not affect the USDZ. `export-ar-assets.py` exports native USD skeleton animation. `verify-ar-usdz.py` adds horizontal-plane anchoring metadata, packages the USDZ, and runs OpenUSD's ARKit compliance checks. Omit `--skip-renders` for Blender proof images. `validate-ar-animation.py` evaluates all 211 final USDZ poses for ground clearance, pauses, and loop continuity.

Intermediates default to an `ar-export` directory beside the repository, outside published content. Set `DUO_AR_BUILD_DIR` to override. The source `/duo` model and images are only read.

For Apple-native proof images, run `native-ar-proof.py` in Blender to create a camera scene in the build directory, then render that scene with `usdrecord --renderer Metal --camera ProofCamera --frames 0,68,105`. Its output path requires a `###` frame placeholder. This proof scene is not part of either AR asset.

`../assets/asset-info.json` records dimensions, timing, hashes and validation outcomes. Tiny negative ground values below 0.1 micrometre are floating-point rounding, not visible intersections. Real-device AR placement and native player behavior still require the mobile trial.
