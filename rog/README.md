# Rogue ASCII

A browser-based roguelike prototype made entirely from colored ASCII glyphs.

This version uses stacked DOM/CSS 3D planes to emulate the deep layered look from
the reference: a 10x10 camera window follows the player across a 40x40 map while
foreground trees and distant ASCII planes drift at different speeds.

## Run

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Controls

- Arrow keys: move
- Space: interact, open chests, attack adjacent monsters
- R: restart

## Goal

Kill every monster in the woods in the fewest turns. Winning turn counts are
stored in browser `localStorage`; deaths do not record a score.
