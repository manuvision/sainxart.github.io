# Glyxel

Glyxel is a dependency-free, mobile-first pixel-art generator designed like a slightly worn handheld console. It fills a real-size canvas with horizontally mirrored sprites, gives every ship its own combination from Kerrie Lake's Resurrect 64 palette, and exports the clean artwork as a PNG.

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

- **Colors** sets how many Resurrect 64 colors are combined for each ship.
- **Pixel size** sets the physical size of each logical sprite cell in the exported PNG.
- **Black ratio** sets the chance that a randomized cell stays empty.
- **Sprite width / height** set each sprite's logical grid.
- **Image width / height** set the exact exported PNG dimensions.
- On every load, the seed is derived from the visitor's local calendar date and the controls reset to their defaults, creating a stable Glyxel of the day.
- Every slider and −/+ button redraws immediately while keeping the current seed.
- **Randomize** replaces the daily seed with a fresh one and keeps every other setting intact.
- Use the round floppy-disk button—or tap the canvas—to save the current image as a PNG.

The defaults are 4 colors, 36 px cells, 50% black, 8 × 8-cell sprites, and a 512 × 512 px image.

The glass curvature, scanlines, rolling sheen, and random glitch bars are display-only effects; they are never baked into the PNG.

## Hosting

The project uses relative asset paths and has no build step. Copy its contents into the `glyxel/` directory of the `manu.vision` GitHub Pages repository to serve it at `https://manu.vision/glyxel/`.

## Inspiration

Glyxel is an original interface and implementation inspired by:

- [Random spaceship sprite generator](https://2draw.me/random_ship_generator/index.en.htm)
- [f2d/random_ship_generator](https://github.com/f2d/random_ship_generator)
- [How to Create Generative Art In Less Than 100 Lines Of Code](https://www.freecodecamp.org/news/how-to-create-generative-art-in-less-than-100-lines-of-code-d37f379859f)
- [Resurrect 64 by Kerrie Lake](https://lospec.com/palette-list/resurrect-64)

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for the referenced open-source project's license.
