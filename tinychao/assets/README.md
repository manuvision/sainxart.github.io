# Tiny Chao Garden asset sources

Original game graphics are © SEGA / Sonic Team / Dimps. This is an unofficial fan recreation. Nintendo and Game Boy Advance are trademarks of Nintendo.

These unmodified sprite sheets were downloaded from The Spriters Resource on September 8, 2026:

| Local file | Source | Sheet contributor |
| --- | --- | --- |
| `garden.png` | https://www.spriters-resource.com/game_boy_advance/sonicadv/asset/7060/ | Egadd |
| `chao.png` | https://www.spriters-resource.com/game_boy_advance/sonicadv/asset/7036/ | Sonikku |
| `minigames.png` | https://www.spriters-resource.com/game_boy_advance/sonicadv/asset/7039/ | Sonikku |

The sheets retain their original credits. No ownership of the original game artwork is claimed.

## Rendering references

The screen is 240 × 160 native pixels. The garden occupies the left 176 × 160 and the status panel the remaining 64 pixels.

- `garden.png`: garden crop `(210, 9, 176, 160)`.
- `chao.png`: solid background color key is RGB `(0, 248, 0)`; preserve other colors and existing alpha. Standard Chao frames use 24 × 24 crops.
- Blue Chao row starts: `9, 34, 59, 87, 115, 143, 171`.
- Most Chao column starts: `1, 26, 51, 79, 104, 129, 157, 182, 207, 235`.
- Chao last row columns: `1, 26, 54, 79, 107, 132, 160`.
- Egg `(657, 201, 16, 16)`; upper shell `(657, 218, 16, 16)`; lower shell `(657, 235, 16, 16)`. Other egg colors are offset by 17 pixels in x.
- Fruit cells: 16 × 16 at y = 257; x = `657, 674, 691, 708, 725, 742, 759` for orange, blue, pink, green, purple, yellow, red.

## Mechanics references

- Basics: https://chao-island.com/guides/spin-off-games/tiny-chao-garden/basics/
- Shop: https://chao-island.com/guides/spin-off-games/tiny-chao-garden/basics/items.html
- Memory: https://chao-island.com/guides/spin-off-games/tiny-chao-garden/mini-games/chao-memory.html
- Rock–paper–scissors: https://chao-island.com/guides/spin-off-games/tiny-chao-garden/mini-games/rock-paper-scissors.html

The Sonic Advance / Sonic Adventure 2: Battle Tiny Chao Garden is the version with the memory game and timed rock–paper–scissors card shooter. Sonic Advance 2 substitutes Chao Bounce for the latter.
