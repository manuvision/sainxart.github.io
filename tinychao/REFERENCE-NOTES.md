# Tiny Chao Garden — reference notes

This implementation targets the standalone Tiny Chao Garden associated with **Sonic Advance / Sonic Adventure 2: Battle**. That version uses Chao Memory and the rock–paper–scissors card shooter. Sonic Advance 2's Chao Bounce is a different version. GameCube transfers and other Sonic games are outside this project.

## Visual comparison sources

| Reference | What it establishes |
| --- | --- |
| [Chao Island: new egg in the garden](https://chao-island.com/assets/images/guides/tiny-chao-garden/tcg-alone.png) | 240 × 160 screen, 176-pixel-wide garden, 64-pixel status panel, normal egg, hand cursor, and white/purple GBA icons |
| [Chao Island: jewel Chao garden screenshot](https://chao-island.com/assets/images/info-center/colours-sadv-jewel.png) | Independent comparison of the original garden and sidebar layout |
| [Chao Island: original shop screenshot](https://chao-island.com/assets/images/guides/tiny-chao-garden/tcg-shop.png) | Original shop layout, fruit order, price placement, full stat pips, and Chao type label |
| [Original minigame sprite sheet](https://www.spriters-resource.com/game_boy_advance/sonicadv/asset/7039/) | Both original minigame backdrops, their HUDs, card art, and gameplay screenshots |

The original garden has a checkerboard lawn, trees/bushes along its edges, a pond at lower left, and a bare brown area at upper right. The reference screenshots show no tree standing on that brown area. Preserve it as shown. The two GBA icons sit near the top of the garden; the white one selects rock–paper–scissors and the purple one selects memory.

The sidebar is pale cream with an orange dotted border. Its labels read Mood, Belly, Swim, Fly, Run, Power, and Stamina. The bottom contains the ring icon and total. The name and type occupy the top when a Chao is present. Use the original screenshot artwork for static panel details, then replace only changing values.

## Source atlas coordinates

All coordinates use native pixels and rectangles in `(x, y, width, height)` order. Disable texture/image smoothing.

- Garden background: `garden.png` rectangle `(210, 9, 176, 160)`.
- Chao and fruit sheet: `chao.png`, 882 × 1018. Its solid background color is RGB `(0, 248, 0)`; use transparency when drawing individual cells.
- Standard Chao frames: 24 × 24. Row starts are `9, 34, 59, 87, 115, 143, 171`.
- Most Chao column starts are `1, 26, 51, 79, 104, 129, 157, 182, 207, 235`. Last-row starts are `1, 26, 54, 79, 107, 132, 160`.
- Normal egg: `(657, 201, 16, 16)`. Upper shell: `(657, 218, 16, 16)`. Lower shell: `(657, 235, 16, 16)`. Additional egg colors advance 17 pixels horizontally.
- Fruits: 16 × 16 at y = 257. The x positions `657, 674, 691, 708, 725, 742, 759` correspond to orange, blue, pink, green, purple, yellow, and red.
- Original minigame backdrops: `minigames.png`, left backdrop starting at `(3, 104)`, memory board starting at `(311, 104)`.
- Original shop screenshot: full stat pip `(182, 40, 6, 5)` and child/type artwork `(185, 16, 51, 8)`.

## Behavior references

The [basics guide](https://chao-island.com/guides/spin-off-games/tiny-chao-garden/basics/) documents rubbing the egg with A, natural hatching, petting, naming, weed removal, and the visible stats. The original garden holds one Chao and one egg. Chao remain children here; they do not age, evolve, or die. Fly/swim behavior belongs to the later version and should not be mistaken for an original-version requirement.

The [items guide](https://chao-island.com/guides/spin-off-games/tiny-chao-garden/basics/items.html) documents the L-button shop and eight-fruit limit. Fruit prices in displayed order are **30, 60, 55, 50, 30, 55, 70 rings**. Toys are purchased in order: instrument **1,000**, duck **2,000**, television **8,000**; the original TV stock appears three hours after buying the duck.

The [memory guide](https://chao-island.com/guides/spin-off-games/tiny-chao-garden/mini-games/chao-memory.html) specifies **14 cards / 7 pairs**, a brief preview, Chao moving cards into empty spaces, and **three mistakes**. Each matched card pays **1 / 3 / 5 rings** by outer/middle/inner board position. Clearing the board pays a **60 / 30 / 10 ring bonus** for zero/one/two mistakes. One timed A press can trip the moving Chao and briefly reveal the card it is pushing.

The [rock–paper–scissors guide](https://chao-island.com/guides/spin-off-games/tiny-chao-garden/mini-games/rock-paper-scissors.html) specifies **10 moving cards**, **three random launch cards**, **30 seconds**, and **five replacement lives**. Left/right selects and A fires. A win removes a target, awards one ring, and replaces the launch card. A tie also removes the target and replaces the card, without a ring. A loss or miss consumes a replacement life. Clearing the moving cards grants another wave and ten seconds.

## Audio provenance

Original named MIDI sequences are available in [SAT-R/sa2: Tiny Chao Garden music and effects](https://github.com/SAT-R/sa2/tree/main/chao_garden/sound/songs/midi). Relevant files include `mus_garden.mid`, `mus_minigame.mid`, `se_confirm.mid`, `se_hatch.mid`, `se_gauge_lvl_up.mid`, `se_snore.mid`, and the two trumpet sequences. These preserve note sequences and timings; synthesized browser timbres are an adaptation of the original sound hardware.

Reference research completed September 8, 2026. See [CREDITS.md](CREDITS.md) for ownership and contributors.
