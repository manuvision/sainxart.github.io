# DotCam

DotCam is a dependency-free, real-time camera filter for `manu.vision/dotcam`. It reduces a live camera feed to color-sampled points that track movement across frames.

## How it works

1. The current camera frame is cover-cropped into a small analysis canvas.
2. A Shi–Tomasi-style corner score finds visually distinct points.
3. A lightweight Lucas–Kanade optical-flow pass follows those points between frames.
4. The source color at every tracked point is drawn to the full-screen output canvas with a fading afterglow.

All processing happens locally in the browser. No frames are uploaded or stored. The bundled procedural demo exercises the same filter path without requesting camera access.

## Run locally

Camera access requires HTTPS or a loopback address. From this directory:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Files

- `filter-engine.js` — frame analysis, point detection, optical flow, rendering, and export
- `app.js` — camera lifecycle, demo scene, controls, settings, share/save, and browser states
- `styles.css` — responsive full-screen interface
- `index.html` — semantic app shell and dialogs
