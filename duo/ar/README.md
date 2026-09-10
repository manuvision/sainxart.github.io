# Duo AR assets

Live at **https://manu.vision/duo/**. The `/duo/ar/` route also renders this experience for existing links. The canonical website source now lives in `duo/source`; this directory retains the approved native assets and their build scripts.

The mobile-only **Try it in Augmented Reality** text link opens native AR Quick Look on iPhone/iPad or Scene Viewer on Android. There is no icon. The native viewer handles the camera permission and tabletop placement. Both links disable content resizing so the phone starts and stays at its authored physical size. Unsupported browsers get a brief fallback message; Android devices without AR support may open Scene Viewer's 3D mode.

## Model and motion

- Apple's original articulated device, converted from centimetres to metres with a scale of 0.01. The original geometry and proportions are preserved. Full mesh bounds include buttons and the camera protrusion, so they differ slightly from Apple's nominal body-only dimensions.
- Screen-up, horizontal tabletop orientation. The resting back/camera envelope touches Y=0, and the opening leaf rises above the table. The scene does not contain a baked table or a stand.
- Current raccoon wallpaper and lock-screen artwork embedded into both displays, using proportional crops. AR displays use baked emissive textures; the webpage's camera-dependent defocus effect is not part of the native asset.
- One seven-second skeletal animation: closed hold 0–1 s, cosine ease open 1–3.5 s, open hold 3.5–4.5 s, cosine ease closed 4.5–7 s. First and last poses match.
- Explicit animated USDZ for iOS and animated GLB for Android. No automatic browser USDZ conversion, which would discard animation.

The webpage uses the same timing. Touching the slider/phone or launching AR pauses the webpage loop; **Play loop** resumes from the current fold position. Reduced-motion preferences start with the phone open and paused. Hidden tabs do not advance the loop clock.

## Build the page

```sh
npm ci --prefix duo/source
node duo/source/build.mjs
```

The main entry point, timing function, and native links are in `duo/source`. The former AR source entry points forward to those shared modules. The bundle is self-hosted and introduces no runtime CDN dependency. See [website build and loading notes](../README.md).

## Rebuild the native assets

`source/prepare-ar-assets.py` needs Python with Pillow and NumPy. Blender 5.1 with OpenUSD is used for the USD skeleton export and compliance check. The scripts default to a sibling `ar-export` working directory outside the site repository; set `DUO_AR_BUILD_DIR` to override it.

Run the preparation script, followed by `source/export-ar-assets.py` and `source/verify-ar-usdz.py` through Blender's background Python runner. The preparation script also normalizes the final GLB to Scene Viewer's supported core PBR materials. See [asset build details](source/AR-ASSET-BUILD.md) for exact commands and checks. Validation scripts and asset metadata describe the resulting files.

## Verification and limits

The webpage is checked at desktop, iPhone, iPad, Android, small portrait/landscape widths, and reduced motion. Checks cover full-cycle timing, endpoint holds, manual pause/resume, mobile-only link visibility, and viewport fit. USDZ is inspected and rendered through Apple's native USD tools, and the baked skeleton is evaluated through all 211 samples to verify constant tabletop contact and exact holds.

These checks do not replace a physical phone test of camera tracking and placement. Open the URL in Safari on iPhone or Chrome on Android and tap the AR link to review the native experience.

## Sources

Model, original rig and lock-screen artwork: [existing Duo asset credits](../SOURCES.md). Wallpaper: supplied by Manu Vision. [Apple dimensions](https://www.apple.com/iphone-duo/specs/). [Apple AR Quick Look](https://developer.apple.com/videos/play/wwdc2019/612/), [WebKit AR links](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/), [Android Scene Viewer](https://developers.google.com/ar/develop/scene-viewer).
