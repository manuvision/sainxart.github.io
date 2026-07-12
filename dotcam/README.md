# DotCam

DotCam is a dependency-free, real-time camera and video filter for `manu.vision/dotcam`. It reduces a live camera feed or user-selected video to color-sampled points that track movement across frames.

## How it works

1. The current camera frame is cover-cropped into a small analysis canvas.
2. A Shi–Tomasi-style corner score finds visually distinct points.
3. Pyramidal Lucas–Kanade optical flow follows those points while a scene-motion model bridges brief blur.
4. A candidate is shown only after it survives several tracking frames, then its gently stabilized source color is drawn as one crisp circle.
5. Each complete black-and-dot frame is composed offscreen and presented to the visible canvas in a single draw, preventing partial refresh flicker.
6. Mobile viewport changes are coalesced while the last complete frame stays visible, avoiding address-bar resize flashes.

All processing happens locally in the browser. No frames or selected files are uploaded or stored. The bundled procedural demo exercises the same filter path without requesting camera access or choosing a file.

## Run locally

Camera access requires HTTPS or a loopback address. From this directory:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Files

- `filter-engine.js` — frame analysis, point detection, optical flow, rendering, and export
- `app.js` — camera and local-video lifecycle, demo scene, controls, settings, share/save, and browser states
- `styles.css` — responsive full-screen interface
- `index.html` — semantic app shell and dialogs
