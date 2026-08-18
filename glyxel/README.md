# Glyxel

Glyxel is a dependency-free, mobile-first pixel-art generator designed like a slightly worn handheld console. It fills a real-size canvas with horizontally mirrored sprites, gives every glyph its own combination from the Copic Sketch Perfect Primaries and Secondary Tones marker sets, and exports the clean artwork as a PNG.

## Run locally

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173/` from this directory.

## Verify

```sh
npm run check
npm test
```

## Controls

- **Colors** sets how many of the 12 Copic marker colors are combined for each glyph.
- **Pixel size** sets the physical size of each logical sprite cell in the exported PNG.
- **Black ratio** sets the chance that a randomized cell stays empty.
- **Sprite width / height** set each sprite's logical grid.
- **Image width / height** set the exact exported PNG dimensions.
- On every load, the seed is derived from the visitor's local calendar date and the controls reset to their defaults, creating a stable Glyxel of the day.
- Every slider and −/+ button redraws immediately while keeping the current seed.
- **Randomize** replaces the daily seed with a fresh one and keeps every other setting intact.
- Tap the canvas to copy the current clean PNG to the clipboard, ready to paste into a creature-generation chat. If image copying is unavailable in the browser, Glyxel points back to the save button.
- Use the round floppy-disk button to download the current image as a PNG. Filenames contain only the local date and seed, for example `glyxel-20260816-0C8B605B.png`.

The defaults are 3 colors, 36 px cells, 50% black, 8 × 8-cell sprites, and a 512 × 512 px image.

The glass curvature, scanlines, rolling sheen, and random glitch bars are display-only effects; they are never baked into the PNG.

## Create mode

The public `/glyxel/create/` editor provides a 16 × 16 touch-friendly pixel grid using the same 12-color Copic palette. Pen and eraser tools support continuous drag strokes, the bucket fills connected regions, vertical symmetry is enabled by default, and horizontal symmetry can be combined for four-way drawing. Save exports a clean 512 × 512 PNG without the editor grid or CRT glass.

## Creature prompt kit

The unlisted `/glyxel/prompt/` page provides separate copy actions for the complete master prompt and its traditional Copic illustration reference. A creature generation should receive both of those items alongside the current pixel-art Glyxel. The reference is also available as a downloadable PNG when browser image-copying is unavailable.

## Hosting

The project uses relative asset paths and has no build step. Copy its contents into the `glyxel/` directory of the `manu.vision` GitHub Pages repository to serve it at `https://manu.vision/glyxel/`.

## Inspiration

Glyxel is an original interface and implementation inspired by:

- [Random spaceship sprite generator](https://2draw.me/random_ship_generator/index.en.htm)
- [f2d/random_ship_generator](https://github.com/f2d/random_ship_generator)
- [How to Create Generative Art In Less Than 100 Lines Of Code](https://www.freecodecamp.org/news/how-to-create-generative-art-in-less-than-100-lines-of-code-d37f379859f)

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for the referenced open-source project's license.
