# Glyph — Complete Mobile App Rebuild Prompt

## What this is

**Glyph** is a real-time image dithering tool that maps pixel brightness to a 7-state glyph grid. It also has a live 3D particle primitive renderer (sphere, torus, cube, cylinder, tetrahedron) that feeds into the dithering engine. The web version is a single `glyph.html` file. You are rebuilding it as a **native iOS app** (SwiftUI, iOS 17+, AVFoundation).

---

## Visual Identity

- Background: `#000000` (pure black everywhere — canvas, sidebar, all containers)
- Card/panel background: `#1c1c1e`
- Secondary surface: `#2c2c2e`
- Tertiary surface: `#3a3a3c`
- Separator color: `rgba(84,84,88,0.35)`
- Primary accent: `#0a84ff` (iOS blue)
- Green accent: `#30d158` (iOS green)
- Danger: `#ff453a`
- Primary text: `#ffffff`
- Secondary text: `#8e8e93`
- Font: SF Pro (system font, `-apple-system`)
- Section titles: 11px, weight 600, color `#8e8e93`
- Toggle labels: 15px, white
- Slider labels: 13px, `#8e8e93`
- Slider values: 13px, `#8e8e93`, tabular numerals, right-aligned, min-width 34px

---

## App Structure (Navigation)

The app has a **live canvas** taking up the full screen, with a **bottom sheet / drawer** containing 4 tabs:

### Tabs
1. **Input** — media source selection + 3D shape controls
2. **Tune** — grid, render, scale, depth, flicker settings
3. **States** — 7 brightness states, each with glyph, color, rotation, flicker
4. **Export** — save PNG, record video

The bottom sheet is always visible at partial height (showing tabs + current section). User can scroll within each tab section. No navigation stack — everything is in this single bottom panel.

---

## Core Concept: Glyph Dithering

### How it works
1. Take a source image (photo, video frame, or 3D primitive render)
2. Divide into a grid of cells (`grid × grid` pixels each)
3. For each cell, compute average brightness (0–255)
4. Map brightness to one of 7 states:  
   `displayIdx = 6 - floor((brightness / 256) * 7)`  
   (0 = HIGHLIGHTS = brightest, 6 = SHADOWS = darkest)
5. Draw the assigned glyph (SVG shape) at that cell, tinted with the state color, at the assigned scale

### App State (all defaults)
```
grid: 16                (range 8–80)
bgColor: #000000
aspectRatio: 'original' (options: original, 1:1, 16:9, 9:16)
fillSolid: false        (fill cells with solid color instead of glyph)
invert: false           (invert brightness mapping)
scaleMin: 1.0           (range 0–1)
scaleMax: 1.0           (range 0.1–2)
depthSpread: 0          (range 0–200, shifts bright/dark glyphs on Z axis)
depthInvert: false
depthAnim: false        (auto-oscillates rotX/Y for 3D depth effect)
autoRandom: false       (randomly changes glyph assignments every ~3s)
flickerSpeed: 8         (glyphs per second, range 1–60)
variedRhythm: false     (each state flickers at slightly different rate)
gridAnim: false         (animates grid size between scaleMin→scaleMax)
gridAnimSpeed: 0.05     (range 0.01–0.5)
glyphsEnabled: false    (for primitive mode: bypass glyph render, show raw particles)
```

### Per-State Defaults (7 states, index 0=highlights → 6=shadows)
```
State 0: HIGHLIGHTS  — color #ffffff — glyph: Square
State 1: LIGHT MID   — color #d8d8d8 — glyph: X Mark
State 2: MID HIGH    — color #aaaaaa — glyph: Sq. Out
State 3: MIDTONES    — color #777777 — glyph: Ring
State 4: MID LOW     — color #4d4d4d — glyph: Asterisk
State 5: DARK MID    — color #2a2a2a — glyph: Dot Grid
State 6: SHADOWS     — color #111111 — glyph: Dot (small)
```

### Glyph Rendering
Each glyph is an SVG tinted with its state color, drawn at `(cellW × cellH)` pixels. The scale factor per cell: `scale = scaleMin + (brightness/255) * (scaleMax - scaleMin)`. Rotation per state: 0°, 90°, 180°, or 270° (cycles on tap). The `fillSolid` mode draws a solid colored rectangle instead of the SVG.

---

## 31 Built-in Shapes (SVG, viewBox 0 0 24 24, fill="currentColor")

### GEO group
- **Circle**: `<circle cx="12" cy="12" r="10" fill="currentColor"/>`
- **Ring**: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/>`
- **Square**: `<rect x="2" y="2" width="20" height="20" fill="currentColor"/>`
- **Sq. Out**: `<rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3"/>`
- **Rounded**: `<rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor"/>`
- **Tri ▲**: `<polygon points="12,2 22,22 2,22" fill="currentColor"/>`
- **Tri ▼**: `<polygon points="2,2 22,2 12,22" fill="currentColor"/>`
- **Diamond ◆**: `<polygon points="12,1 23,12 12,23 1,12" fill="currentColor"/>`
- **Dia. ◇**: `<polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="currentColor" stroke-width="2.5"/>`
- **Hexagon**: `<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" fill="currentColor"/>`

### LINES group
- **Plus +**: `<rect x="9" y="1" width="6" height="22" fill="currentColor"/><rect x="1" y="9" width="22" height="6" fill="currentColor"/>`
- **X Mark**: `<path d="M3 3L21 21M21 3L3 21" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>`
- **Asterisk ✳**: `<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>`
- **Hash #**: `<path d="M8 2v20M16 2v20M2 8h20M2 16h20" stroke="currentColor" stroke-width="2.5" fill="none"/>`
- **Slash /**: `<path d="M4 22L20 2" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/>`
- **Bkslash \\**: `<path d="M4 2L20 22" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/>`

### STARS group
- **Star 4pt**: `<polygon points="12,2 14.2,9.8 22,12 14.2,14.2 12,22 9.8,14.2 2,12 9.8,9.8" fill="currentColor"/>`
- **Star 5pt ★**: `<polygon points="12,2 14.4,9.2 22,9.5 16.2,14.3 18.5,22 12,17.3 5.5,22 7.8,14.3 2,9.5 9.6,9.2" fill="currentColor"/>`
- **Star 6pt ✶**: `<polygon points="12,2 14.5,7.7 20.7,7 17,12 20.7,17 14.5,16.3 12,22 9.5,16.3 3.3,17 7,12 3.3,7 9.5,7.7" fill="currentColor"/>`

### ASCII group
- **Dot ·**: `<circle cx="12" cy="12" r="4" fill="currentColor"/>`
- **Dot Grid**: `<circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="17" cy="7" r="3" fill="currentColor"/><circle cx="7" cy="17" r="3" fill="currentColor"/><circle cx="17" cy="17" r="3" fill="currentColor"/>`
- **H.Lines ░**: `<rect x="0" y="1" width="24" height="2.5" fill="currentColor"/><rect x="0" y="7" width="24" height="2.5" fill="currentColor"/><rect x="0" y="13" width="24" height="2.5" fill="currentColor"/><rect x="0" y="19" width="24" height="2.5" fill="currentColor"/>`
- **V.Lines**: `<rect x="1" y="0" width="2.5" height="24" fill="currentColor"/><rect x="7" y="0" width="2.5" height="24" fill="currentColor"/><rect x="13" y="0" width="2.5" height="24" fill="currentColor"/><rect x="19" y="0" width="2.5" height="24" fill="currentColor"/>`
- **Xhatch ▓**: `<path d="M0 0L24 24 M6 0L24 18 M12 0L24 12 M18 0L24 6 M0 6L18 24 M0 12L12 24 M0 18L6 24 M0 24L24 0 M0 18L18 0 M0 12L12 0 M0 6L6 0 M6 24L24 6 M12 24L24 12 M18 24L24 18" stroke="currentColor" stroke-width="1.8" fill="none"/>`
- **Block █**: `<rect x="0" y="0" width="24" height="24" fill="currentColor"/>`

### DECO group
- **Heart ♥**: `<path d="M12 20.5C11 19.5 2 14 2 7.5C2 4.5 4.5 2.5 7.5 2.5C9.5 2.5 11 3.5 12 5C13 3.5 14.5 2.5 16.5 2.5C19.5 2.5 22 4.5 22 7.5C22 14 13 19.5 12 20.5Z" fill="currentColor"/>`
- **Spiral**: `<path d="M12 12Q16 12 16 8.5Q16 4 11.5 4Q6 4 5 9.5Q4 15.5 8.5 19Q13.5 22.5 19 19Q23.5 15 22 9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`
- **Arrow →**: `<path d="M3 10h14.2l-5.1-5.1 1.5-1.4L21 12l-7.4 8.5-1.5-1.4 5.1-5.1H3z" fill="currentColor"/>`
- **Eye ◉**: `<path d="M2 12C5 7 10 4 12 4C14 4 19 7 22 12C19 17 14 20 12 20C10 20 5 17 2 12Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="4" fill="currentColor"/>`
- **Smiley ☺**: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="9.5" r="1.5" fill="currentColor"/><path d="M8 14.5Q12 18.5 16 14.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`
- **Leaf ⬩**: `<path d="M12 3C12 3 21 8 21 14C21 18.4 16.9 21.5 12 21.5C7.1 21.5 3 18.4 3 14C3 8 12 3 12 3Z" fill="currentColor"/>`

---

## 12 Color Palettes

Each palette has 7 colors ordered bright → dark (index 0 = HIGHLIGHTS, 6 = SHADOWS):

```
Monochrome: #e0e0e0 #c0c0c0 #a0a0a0 #808080 #606060 #404040 #242424
Dusk:       #f0c080 #d87840 #b84858 #6a2888 #243080 #141850 #0c0c28
Ember:      #f8d060 #f0a030 #e06018 #c03008 #881800 #4c0a00 #200400
Forest:     #c0f0a0 #80c860 #409040 #206830 #0c5020 #063010 #021808
Ocean:      #b0d8f8 #60a8e0 #2868c0 #084898 #043070 #011840 #000820
Aurora:     #e8c8ff #a060e8 #6020c0 #3008a8 #180470 #080128 #020014
Sepia:      #f0e0b0 #d0a860 #b07040 #804028 #502010 #28100c #140804
Neon City:  #d8ffc0 #60f060 #00c8b8 #0060f0 #8000e0 #40006c #140020
Rust:       #f0d890 #e09040 #c84820 #902018 #581008 #2c0804 #120200
Mint Ice:   #c8f8e4 #78e4be #30b890 #0a8868 #065848 #023020 #011010
Candy:      #ffc8e8 #ff98cc #ff50a0 #d01878 #800848 #3c0028 #180010
Gold Ink:   #f8e898 #e8c050 #c89010 #906000 #583800 #2c1c00 #140a00
```

Plus a dynamic **Image** palette extracted from the current media (7 samples at percentiles 4%, 17%, 31%, 50%, 69%, 83%, 96% sorted by luminance, bright→dark). A **Reverse** toggle swaps all palette directions.

---

## 3D Primitive Engine

### Overview
An offscreen canvas (1080×1080) renders animated particle clouds. In raw mode (`glyphsEnabled = false`) this canvas is blit directly to output. In glyph mode it feeds into the dithering pipeline as the brightness source.

### Constants
```js
TAU  = Math.PI * 2
PHI  = (1 + sqrt(5)) / 2        // golden ratio ≈ 1.6180
GOLDEN_ANGLE = TAU * (1 - 1/PHI) // ≈ 2.3999 rad
```

### Halton quasi-random sequence
```
halton(index, base):
  f = 1, r = 0
  while index > 0:
    f /= base
    r += f * (index % base)
    index = floor(index / base)
  return r
```
Used as `halton(i, 2)` and `halton(i, 3)` for independent 2D sampling.

### Default shape parameters
```
torus:    R=128 (major radius), r=52 (tube radius)
sphere:   R=180
cube:     a=108 (half side length)
cylinder: R=85, H=210
pyramid:  a=260 (edge length of regular tetrahedron)
```

### Particle counts
```
sphere:   6000 particles
torus:    5500 particles
others:   3600 particles
```

### Particle generation algorithms

**Sphere** — Halton(2,3) uniform sphere distribution (NO Fibonacci — causes ridges):
```
for i in 0..N:
  phi   = acos(2 * halton(i,2) - 1)
  theta = TAU * halton(i,3)
  x = R * sin(phi) * cos(theta)
  y = R * cos(phi)
  z = R * sin(phi) * sin(theta)
  phase = halton(i,7) * TAU
```

**Torus** — Independent Halton(2,3) for u/v (NOT correlated golden angle — causes helix artifact):
```
for i in 0..N:
  u = halton(i,2) * TAU   // angle around tube center circle
  v = halton(i,3) * TAU   // angle around tube cross-section
  x = (R + r*cos(v)) * cos(u)
  y = r * sin(v)
  z = (R + r*cos(v)) * sin(u)
  phase = halton(i,5) * TAU
```

**Cube** — 6 faces, floor(N/6) particles each, Halton(2,3) uniform per face:
```
faces = [
  (u,v) => (u, v, +a),  // +Z face
  (u,v) => (u, v, -a),  // -Z face
  (u,v) => (+a, u, v),  // +X face
  (u,v) => (-a, u, v),  // -X face
  (u,v) => (u, +a, v),  // +Y face
  (u,v) => (u, -a, v),  // -Y face
]
for each face:
  u = (halton(i,2)*2 - 1) * a
  v = (halton(i,3)*2 - 1) * a
```

**Cylinder** — 70% on side surface, 15% on each cap:
```
side (70%):
  theta = i * GOLDEN_ANGLE
  y = (halton(i,3)*2 - 1) * (H/2)
  x = R*cos(theta), z = R*sin(theta)

caps (15% each, top ci=0 y=+H/2, bottom ci=1 y=-H/2):
  r = sqrt(halton(i,2)) * R
  theta = (i + ci*137) * GOLDEN_ANGLE
  x = r*cos(theta), z = r*sin(theta)
```

**Pyramid (regular tetrahedron)** — 4 equilateral triangle faces, N/4 each:
```
R_base = a / sqrt(3)          // circumradius of equilateral triangle base
H      = a * sqrt(2/3)        // height of regular tetrahedron

apex   = (0, -H, 0)           // NEGATIVE Y = pointing UP on screen
base3  = [
  (R_base, 0, 0),
  (R_base*cos(2π/3), 0, R_base*sin(2π/3)),
  (R_base*cos(4π/3), 0, R_base*sin(4π/3)),
]

faces = [
  [apex, base3[0], base3[1]],
  [apex, base3[1], base3[2]],
  [apex, base3[2], base3[0]],
  [base3[0], base3[2], base3[1]],  // base
]

// Uniform triangle sampling (Halton barycentric):
sq = sqrt(halton(i,2))
u  = 1 - sq
v  = sq * halton(i,3)
w  = sq * (1 - halton(i,3))
point = u*v0 + v*v1 + w*v2
```

**Auto-centering**: After generating all particles, subtract the geometric centroid:
```
cx = mean(p.x), cy = mean(p.y), cz = mean(p.z)
for each p: p.x -= cx; p.y -= cy; p.z -= cz
```

### Rotation & projection

Initial state per shape load: `rotX = π/6 (30°), rotY = 0, velX = 0, velY = 0.003`

Auto-rotation each frame (when not dragging):
```
rotY += velY + 0.0025
rotX += velX
velX *= 0.96   // inertia decay
velY *= 0.96
```

Drag: 1-finger drag updates `rotY += dx * 0.006`, `rotX += dy * 0.006` with inertia `velY = dx*0.0006`.

Full 3-axis rotation matrix (Y → X → Z order):
```
// User sliders provide baseRotX, baseRotY, baseRotZ offsets
cosX = cos(rotX + baseRotX), sinX = sin(rotX + baseRotX)
cosY = cos(rotY + baseRotY), sinY = sin(rotY + baseRotY)
cosZ = cos(baseRotZ),        sinZ = sin(baseRotZ)

// Rotate Y
x1 = p.x*cosY + p.z*sinY
z1 = -p.x*sinY + p.z*cosY

// Rotate X
y2 = p.y*cosX - z1*sinX
z2 = p.y*sinX + z1*cosX

// Rotate Z
x3 = x1*cosZ - y2*sinZ
y3 = x1*sinZ + y2*cosZ

// Perspective projection onto 1080×1080 canvas
perspStr  = 0.00165
projScale = canvasWidth * 0.00138   // = 1080 * 0.00138 ≈ 1.49
scale_param applied: x3 *= scale, y3 *= scale, z2 *= scale

zEff  = z2 + offZ
persp = 1 / (1 + zEff * perspStr)
screenX = canvasWidth/2  + x3 * projScale * persp + offX
screenY = canvasHeight/2 + y3 * projScale * persp + offY
```

Particle depth/brightness:
```
depth = (zEff - minZ) / (maxZ - minZ)   // normalized 0–1
// Travelling glow pulse (slow sine wave):
N_particles = total particle count
t = time_seconds
pulse = (sin(t * 0.42) * 0.5 + 0.5) * N_particles
ripple = sin(p.phase + t * 1.8)
dp = i - pulse  // distance from pulse front (i = particle index)
glow = exp(-(dp*dp) / (N * 4.5))

alpha = clamp(0.07 + depth*0.87 + glow*0.6, 0, 1)
size  = max(0.3, 0.4 + depth*2.2 + glow*2.8)
brightness = round(alpha * 255)
draw filled circle at (screenX, screenY) with radius=size, color=rgb(brightness,brightness,brightness)
```

**Alpha-weighted optical centroid correction** (applied BEFORE sorting/drawing, prevents off-center appearance at non-zero tilt):
```
wX = sum(p.screenX * p.alpha), wY = sum(p.screenY * p.alpha), wSum = sum(p.alpha)
if wSum > 0:
  dX = (canvasWidth/2 + offX) - wX/wSum
  dY = (canvasHeight/2 + offY) - wY/wSum
  for each p: p.screenX += dX; p.screenY += dY
```

Sort particles back-to-front by Z before drawing.

Clear canvas each frame: `clearRect` then `fillRect(#000000)`.

### Shape-specific sliders (shown only for active shape)
```
Torus:    Major R (60–250, default 128), Tube R (10–150, default 52)
Sphere:   Radius (50–260, default 180)
Cube:     Size (60–260, default 108)   [half side length]
Cylinder: Radius (40–230, default 85), Height (50–520, step 5, default 210)
Pyramid:  Base (60–260, default 260)   [edge length]
```

### Shape Controls section sliders (all shapes)
```
Scale:  0.2–3.0,   default 1.0   (multiplies all coordinates before projection)
X:      -400–400,  default 0     (screen pixel offset of projection origin)
Y:      -400–400,  default 0
Z:      -300–300,  default 0     (world Z offset before perspective)
Rot X:  -180–180°, default 0     (adds to running rotX, shown as baseRotX)
Rot Y:  -180–180°, default 0
Rot Z:  -180–180°, default 0
```

---

## Input Modes

### 1. Image
Load a photo (any format). Auto-extracts palette from image. Renders static dithered frame. Drag to apply rotX/rotY 3D tilt to the CSS perspective transform (not re-rendered, just visual CSS). Pinch to zoom. Double-tap to reset transform.

### 2. Video
Load a video. Loop + muted + autoplay. Renders every frame in the glyph dithering pipeline at ~30fps. Play/pause button shown. Same drag/pinch/reset as image.

### 3. Camera
`AVCaptureSession` / `AVCaptureVideoDataOutput`. Front/back toggle. Live frames fed into dithering pipeline. Same as video for render.

### 4. 3D Primitive (default on launch)
Opens with **Sphere** at launch. Shape picker: **Torus / Sphere / Cube** (row 1), **Cylinder / Pyramid** (row 2). Stop button toggles to "◈ 3D Shape" text.

**Glyph Dither toggle** (in Shape Controls): default OFF. When OFF, primitive canvas is blit directly to output (raw particle cloud, no glyph substitution). When toggled ON, grid snaps to 16 and full glyph dithering is applied.

---

## Depth 3D Effect (for image/video/camera modes)

The depth spread creates a parallax-like effect. Each brightness state has a Z offset:
```
depthZ = (displayIdx - 3) * depthSpread * (depthInvert ? -1 : 1)
// displayIdx 0 = highlights (Z = -3*spread), 6 = shadows (Z = +3*spread)
// Applied to glyph x/y position:
cellX += depthZ * sin(rotY_radians)
cellY -= depthZ * sin(rotX_radians)
```

**Auto Rotate**: oscillates rotX and rotY with amplitude ±12° at ~0.5 Hz:
```
rotX_effective = rotX + 12 * sin(depthAnimPhase)
rotY_effective = rotY + 12 * cos(depthAnimPhase)
depthAnimPhase += dt * 0.5 * 2π   // ~0.5 Hz
```

---

## Flicker System

Each state can have "Flicker" enabled — it cycles through an uploaded glyph pack on each frame. Speed: `flickerSpeed` glyphs/second. With `variedRhythm`, each state uses an irrational multiplier: `[1.0, 0.61, 1.41, 0.77, 1.73, 0.52, 1.23]` times the base speed.

---

## Grid Animation

When "Animate Grid" is on, grid oscillates between `scaleMin` and `scaleMax` grid sizes using a cosine easing:
```
phase += dt * gridAnimSpeed * 2π
eased = 0.5 - 0.5 * cos(phase)
next  = round(scaleMin + eased * (scaleMax - scaleMin))
```

---

## States UI (per state, 7 rows)

Each row shows:
- **Color swatch** (tappable color picker, updates state color)
- **State name** (e.g. "STATE 1") + **label** (e.g. "HIGHLIGHTS")
- **Rotation button**: cycles 0° → 90° → 180° → 270° (shows current angle, blue highlight if non-zero)
- **Flicker toggle**: enables per-state glyph cycling
- **Random die button 🎲**: assigns a random shape from the built-in library
- **Glyph picker button ⊞**: opens the shape library modal targeting this state
- **SVG upload**: load a custom .svg file for this state

### States toolbar buttons
- **Glyph**: apply the preset sequence: circle→tri▼→tri▲→diamond→heart→leaf→rounded
- **🎨**: open palette picker modal
- **🎲**: randomize all 7 glyphs AND apply a random palette
- **↺**: reset to default glyphs (Square/X/Sq.Out/Ring/Asterisk/DotGrid/Dot) + extract image palette

---

## Shape Library Modal

Categories: All / Geo / Lines / Stars / ASCII / Deco / Uploaded / 📁 Load Folder

Grid of glyph thumbnails (SVG rendered). Tap any to assign to the targeted state. "Load Folder" imports a folder of .svg files into the Uploaded tab. Shows loading progress bar.

Uploaded SVGs are resized and stored; they can be used for Flicker mode (cycles through all uploaded shapes for that state each frame).

---

## Palette Picker Modal

Full-screen modal (backdrop blur). Shows:
1. Dynamic **Image** palette (extracted from current media)
2. 12 preset palettes with color swatches
3. **⇅ Reverse** button to flip all palettes dark↔light
4. Selected palette highlighted in blue

---

## Export

- **Save PNG**: captures current canvas frame at native resolution, saves to Photos
- **Record Video**: `MediaRecorder`/`ReplayKit` at 30fps, 8Mbps, output MP4/WebM. Shows recording indicator (red dot). Stops and downloads/saves on second tap.

When recording, a compositing pass applies the CSS 3D perspective transform mathematically to the output frame (strips-based perspective warping, 80 strips per axis, 900px focal depth) so the recorded video matches the visual.

---

## Interactions

### Canvas (preview area)
- **1-finger drag**: rotate view (rotX/rotY) — for glyph mode this is CSS 3D perspective; for primitive mode this updates particle rotation with inertia
- **2-finger pinch**: zoom (0.2–6×) + pan simultaneously
- **Double-tap**: reset all transforms (zoom=1, pan=0, rotX=0, rotY=0)
- **Drag sensitivity**: mouse = 0.45 deg/px; touch = 0.006 rad/px (primitive mode direct)

---

## Aspect Ratios

Original / 1:1 / 16:9 / 9:16. For non-original: crops source image centered, then sizes canvas to the cropped dimensions.

---

## Haptics

Add haptic feedback everywhere:
- Tab switches → light impact
- Shape selection → light impact
- Glyph assignment → medium impact
- Palette selection → light impact
- Toggle changes → selection feedback
- Record start/stop → heavy impact
- Save PNG → notification success
- Rotation cycle → selection feedback
- Random glyph/palette → medium impact
- Slider changes → none (would be too frequent)

---

## Launch Behavior

1. App opens with a **sphere** (3D primitive, raw particle mode, glyphs OFF)
2. Default glyphs applied: Square/X/Sq.Out/Ring/Asterisk/DotGrid/Dot (indices 0–6)
3. Sphere at 30° X tilt, slowly auto-rotating on Y axis
4. Grid at 16 (for when glyphs are turned on)
5. All state colors at defaults (white → black gradient)

---

## Technical Notes

### Rendering pipeline
```
Source (image/video/camera frame/primitiveCanvas 1080×1080)
  → downsample to (sw/grid × sh/grid) buffer
  → getImageData to read brightness per cell
  → for each cell: compute displayIdx, draw tinted glyph at (cellX, cellY)
  → output to screen canvas (native resolution)
```

### Source size reading (important for canvas sources)
```
srcW = el.videoWidth || el.naturalWidth || el.width || 800
srcH = el.videoHeight || el.naturalHeight || el.height || 600
```
Canvas elements only have `.width` / `.height` — NOT `videoWidth` or `naturalWidth`.

### Tinted glyph cache
Before each render pass, pre-render each glyph SVG into a `grid×grid` canvas tinted with its state color using `source-in` compositing. Invalidate cache whenever grid or any state changes.

### Auto-centering primitive canvas
The primitiveCanvas is 1080×1080. The output canvas is also set to 1080×1080 in primitive mode (since source `.width = 1080`). No cropping occurs.

### Image palette extraction
Downsample media to 64×64, collect all pixel luminances (`0.299R + 0.587G + 0.114B`), sort by luminance (bright first), sample at 7 percentile positions: `[0.04, 0.17, 0.31, 0.50, 0.69, 0.83, 0.96]`.

---

## iOS-Specific Implementation Notes

- Use `CADisplayLink` for the render loop (60fps target)
- Use `CGContext` or Metal for the glyph grid rendering
- SVG glyphs: render to `UIImage` / `CGImage` at grid size, cache tinted versions using `CIFilter` or blend modes
- Camera: `AVCaptureSession` with `.photo` quality preset, `AVCaptureVideoDataOutput` delegate, convert `CMSampleBuffer` → `CGImage` each frame
- Export PNG: `UIImageWriteToSavedPhotosAlbum`
- Export video: `ReplayKit` `RPScreenRecorder` or `AVAssetWriter` with `CVPixelBuffer`
- Haptics: `UIImpactFeedbackGenerator`, `UISelectionFeedbackGenerator`, `UINotificationFeedbackGenerator`
- Bottom sheet: native `UISheetPresentationController` detents (medium + large) or custom `GeometryReader`-based drag sheet in SwiftUI
- Particle rendering: use a `Metal` shader or `CAEmitterLayer` — but the exact algorithm above must be preserved
- All colors defined as SwiftUI `Color(hex:)` extension matching the hex values above exactly

---

*This prompt was generated from the live source code of `glyph.html` at commit `6a5cf1d` on branch `claude/glyph-html-project-PV9YM` of `manuvision/sainxart.github.io`.*
