# Emberfall

Emberfall is a dependency-free, mobile-first tactical card-RPG vertical slice made for Sandy Lions. It translates the August 2026 design draft into one complete solo-Mage arc: a small overworld, deterministic stat and equipment card discovery, a 12-card loadout, three escalating lane battles, and a final boss.

## Play locally

```sh
python3 -m http.server 4174
```

Open `http://localhost:4174/` from this directory.

## Verify

```sh
npm run check
npm test
```

## Design notes

- Progress is saved to `localStorage`; active combat returns to the last safe checkpoint after a refresh.
- The first battle awards three freely allocated stat points. Reaching INT 8 unlocks Arcane Missile.
- The Fire Staff starts attuning at Cinderwatch. Completing Scorched Keep permanently discovers Fireball and Brand; upgrading to T2 discovers Flame Wall.
- Physical cards spend Stamina, which refills each turn. Magic cards spend Mana, which banks and restores by one each turn.
- Enemy intent marks absolute lane tiles before the player acts, so movement cards can evade a known attack.
- Visuals are original inline SVG and CSS. Sound effects are synthesized at runtime with the Web Audio API; no third-party art or audio assets are shipped.

## Hosting

The project has no build step and uses only relative paths. Its files live in the `emberfall/` directory of the `manu.vision` GitHub Pages repository and publish at `https://manu.vision/emberfall/`.
