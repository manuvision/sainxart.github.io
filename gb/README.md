# Manu.Vision — SP Edition

A standalone, static portfolio route for GitHub Pages at `/gb/`. No build step, runtime CDN, API key, or backend is required. Three.js 0.180.0 and Pixelify Sans are vendored with their licenses.

- `console.js`: procedural Game Boy Advance SP model, animated hinge, raycast controls, bounded drag / trackpad rotation, idle rendering, reduced motion.
- `screen.js`: pixel LCD renderer, menu history, complete text pagination, project links, accessible reading view.
- `app.js`: keyboard, touch, screen enlargement, optional audio, renderer fallback.
- `content.js`: content exported from the main portfolio's HTML and university data.

Refresh portfolio content after editing the main website:

```sh
python3 gb/sync-content.py
```

Preview from the repository root using any static server. Validate the page at `/gb/`, including direct visits to `/gb` (GitHub Pages adds the trailing slash).

Controls: arrows navigate; Enter / Space / Z selects; Escape / X / Backspace returns; H / START goes home. SELECT returns, L/R navigate, and the brightness button enlarges the screen. Real 3D buttons and LCD menu rows accept pointer and touch input. Drag to rotate; release to return. Sound is opt-in.

Verified at desktop, tablet, and phone sizes down to 320px: 10 sections, 52 entries, all detail pages, physical controls, touch selection, link launching, drag return, reduced motion, and WebGL fallback.
