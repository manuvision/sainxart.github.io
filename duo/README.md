# iPhone Duo

Production: **https://manu.vision/duo/**. The former `/duo/ar/` test route renders the same experience and remains compatible with shared links.

The phone automatically opens and closes on a seven-second loop, with eased motion and one-second endpoint holds. Manual interaction pauses playback. Reduced-motion preferences start open and paused; the user can choose Play loop. Mobile visitors get the text-only **Try it in Augmented Reality** link for iOS Quick Look or Android Scene Viewer. The approved native models, wallpaper, physical scale, and table placement are documented in [AR asset notes](ar/README.md).

## Loading

The page displays **Loading 3D model…** immediately. Download progress uses actual streamed bytes against a build-generated inventory (0–85%). The remaining preparation gates cover the displays, lighting, materials, and shader compilation. The indicator reaches 100% only after the first frame has rendered. Failed downloads show a reload message; controls stay disabled until ready.

- Geometry is gzip-compressed without changing any bytes after decompression; browsers without native gzip decoding load the original file.
- The display photograph is WebP at quality 94. Original PNG and native AR textures are preserved.
- Studio lighting is losslessly predecoded to the original half-float samples and gzip-compressed. A legacy EXR path remains available.
- On small touch devices, screen effects are capped at 1024 pixels on the longest edge. Larger displays retain the original resolution.
- Texture upload work yields between textures, and shaders compile before the loading indicator disappears.
- Native AR files are downloaded only when requested by the native viewer.

## Build

```sh
npm ci --prefix duo/source
npm run check --prefix duo/source
npm run build --prefix duo/source
```

`source/build.mjs` verifies lossless geometry compression, regenerates `assets/load-manifest.json`, bundles the canonical entry point, and writes the compatibility AR bundle entry. Rebuild after changing model or lighting assets so inventory byte sizes stay correct.

To regenerate derived image or lighting assets, run `python3 duo/source/prepare-wallpaper.py` (Pillow required) or `node duo/source/precompute-lighting.mjs` before building. The original source assets remain available.
