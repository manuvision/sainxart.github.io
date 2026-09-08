# Tamagochi · Pocket Pet

A mobile-friendly pocket pet at **https://manu.vision/tamagochi/**, with a procedural 3D device, a low-resolution green LCD, physical button animations, and synthesized sound effects. Static ES modules; no build step, account, or backend required.

## Preview and checks

From the repository root:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Open **http://127.0.0.1:4175/tamagochi/**. Use HTTP rather than opening `index.html` directly, so browser module imports work.

From `tamagochi/`, with Node.js installed:

```sh
npm run check
npm test
```

The tests use Node's built-in test runner; no dependency installation is needed. They cover hatching, care, growth, persistence, storage failures, and both mini games. Also check the page at desktop and mobile sizes, tap all three physical buttons, reload to verify the save, and test sound after the first interaction.

## Play

- Tap **B** to start the egg: it hatches after **10 seconds**. Momo grows into a child at **6 minutes** of pet age and an adult at **24 minutes** after hatching.
- **A** selects, **B** confirms, and **C** goes back. The keyboard supports A/B/C, left arrow/Enter/right arrow, Space to confirm, and Escape to go back or leave a mini game.
- Feed meals or treats, clean up, check stats, give medicine, or turn out the lights for a nap. Play **Food Catch** or **Tone Memory** to earn coins. Food Catch uses A/C to move; Tone Memory repeats the shown A/B/C sequence. The on-screen labels explain each context.
- The 3D shell tilts with the pointer; its projected buttons remain clickable by mouse or touch. Choose apricot, sage, or lilac, toggle sound, or enter fullscreen using the page controls. Sound starts after interaction. A playable flat device is used if WebGL is unavailable.

## Saves

Pet progress is stored in `localStorage` under **`manu.vision.tamagochi.v1`**; color and mute preferences use **`tamagochi.preferences`**. Saves belong to the current browser profile and origin: localhost and the live site have separate saves, and progress does not sync between devices. Clearing site data clears the save. If storage is unavailable, play continues in memory and the page reports that it cannot save.

Returning applies at most four hours of elapsed care changes; pets never die. Backgrounded mini games pause. **Help → Start a new egg** offers a confirmation before resetting pet progress.

## Assets and deployment

The shell geometry, LCD pixel artwork, icons, and square-wave sound effects are original assets generated in code. No remote image or audio assets are required. Three.js is vendored in `vendor/` and distributed under its included [MIT license](vendor/LICENSE).

Publish this directory as `/tamagochi/` within the existing static site. The repository's GitHub Pages deployment serves the root of `master`; retain the root `CNAME` and `.nojekyll` files.
