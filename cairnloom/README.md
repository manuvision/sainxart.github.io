# Cairnloom

**Weave the last light.** Cairnloom is a portrait-first roguelike tower-defense game designed for touch, mouse, and keyboard. Each ten-wave chapter generates a new functional battlefield; every defeat feeds permanent tower mastery and a branching talent tree.

## The MVP loop

1. Place tower cards on the glowing rune pads around a generated path.
2. Read the next enemy composition, then call the wave early for a Gold bonus.
3. Upgrade, sell, and recombine five tower roles: single-target, area damage, burn, slow, and chain lightning.
4. Choose one of three run relics after waves 3, 6, and 9.
5. Defeat a boss every tenth wave to earn a Sigil, salvage the current build, and enter a newly generated chapter.
6. On defeat, turn performance into Cinders for tower unlocks and mastery. Spend banked Sigils in the permanent talent tree.

## Systems

- Deterministic, validated 7 × 12 maps with an ordered route and 10–14 legal build pads.
- Infinite composition-based wave scaling across runners, brutes, shield bearers, swarms, regenerators, and bosses.
- Five towers with four in-run levels and five permanent mastery ranks.
- Three cleanly separated economies: run-only Gold, defeat-earned Cinders, and boss-earned Sigils.
- Fixed-step 30 Hz simulation with seeded generation and JSON-safe save data.
- Procedural canvas art, synthesized Web Audio soundscape, optional haptics, reduced-motion support, and high-contrast mode.
- A 500 px portrait playfield with generous touch targets; desktop uses atmospheric side vignettes instead of stretching the board.

## Run locally

Serve the repository root with any static server and open `/cairnloom/`. No build step or runtime dependencies are required.

```sh
npm run check
npm test
```

The rules and balance live in `content.js` and `engine.js`; the canvas presentation is in `renderer.js`; `app.js` binds the interface, persistence, input, and game loop.
