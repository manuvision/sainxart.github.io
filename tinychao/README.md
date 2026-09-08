# Tiny Chao Garden

A standalone browser recreation of the Sonic Advance / Sonic Adventure 2: Battle Tiny Chao Garden, inside an interactive platinum Game Boy Advance SP. Published at **https://manu.vision/tinychao/** through the existing Manu.Vision GitHub Pages site.

The game is rendered at the original 240 × 160 resolution. The original garden, egg, Chao animation frames, fruit, toys, cursor, interface elements, and minigame backgrounds are sourced from the references in [CREDITS.md](CREDITS.md). This is an unofficial fan recreation, not an emulator or an official SEGA or Nintendo release.

## Play

- D-pad / arrow keys: move the hand cursor or choose an item.
- A / Z / Space: rub the egg, pet your Chao, pick up fruit, give fruit, or confirm.
- B / X / Escape: put down an item or return.
- L / Q: open or close the fruit shop.
- R / E: find fruit in the garden.
- START / Enter: garden menu or pause a minigame.
- SELECT / Shift: view Chao stats.
- Tap the original tiny GBA icons to enter Chao Memory or rock-paper-scissors.
- Drag the console to turn it. The brightness button or **Screen** opens a larger playable display.

The garden saves automatically in localStorage. One Chao lives in the active garden; **START → Chao Friends** preserves a collection of 12 normal, colored, and rare jewel Chao, each with independent names, hatch progress, care meters, and skill levels. Rings, fruit, toys, and minigame records are shared. Existing saves migrate without losing progress. Settings offers JSON backup export/import. Clearing this website's browser data removes the local save. Time away does not harm your Chao. There is no account, server, GameCube connection, or collection of other Sonic games.

## Colored and rare eggs

The original shop egg row now offers Silver, Gold, Ruby, Sapphire, Amethyst, Emerald, Garnet, Aquamarine, Peridot, Topaz, and Onyx eggs at their original ring prices. Buy an egg, then select it in Chao Friends to hatch it. Your previous Chao stays saved. One egg may wait to hatch at a time.

Stock refreshes after a completed minigame or five minutes. Offers exclude collected colors. Rare weights are assigned once per save and remain stable across reloads; prices range from 500 rings for Silver to 20,000 for Onyx. Collection storage and this restock schedule are standalone adaptations, so no GameCube transfer is needed. The original garden has no adult evolution or Chaos Chao transformation.

## Develop

There is no build step and no runtime CDN dependency. All game assets, fonts, and Three.js modules are local.

From the parent directory:

```sh
python3 -m http.server 4176 --bind 127.0.0.1
```

Open `http://127.0.0.1:4176/tinychao/`.

From this folder:

```sh
npm test
```

The tests cover hatching, feeding, fruit effects, purchase limits, minigame rewards, pause/exit behavior, malformed saves, and persistent progress. Browser verification also exercises the actual 3D button raycasts, touch controls, phone/landscape sizing, original artwork loading, and the complete play/save loop.

## Files

- `eggs.js`: original egg catalog, prices, weighted shop stock, and collection snapshots.
- `sprites.js`: native animation cells, walking directions, and jewel palettes.
- `game.js`: game state, persistence, care, original-style menus, two minigames, and pixel rendering.
- `console.js`: procedural Three.js SP, hinge animation, lighting, physical buttons, raycasting, and drag interaction.
- `audio.js`: local Web Audio music and effects with gesture activation and background suspension.
- `app.js`: keyboard/touch input, game loop, screen expansion, accessibility, settings, and save backups.
- `assets/`: original sprite sheets and UI resources, with attribution.
- `vendor/`: locally vendored Three.js and its license.
- `tests/`: meaningful game-state regression checks.

WebGL failure automatically switches to a fully playable 2D screen. Audio requires a user gesture; vibration depends on browser/device support.
