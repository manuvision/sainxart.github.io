# Emberfall Web Vertical Slice

## Project handbook and build-it-yourself guide

This document explains what was built for Emberfall, why it was built this way, how the code is organized, and how to recreate or extend it without needing the original development conversation.

Emberfall began as Sandy Lions's design for a medieval-fantasy tactical card-RPG: the persistent character-building of *Wartales*, the readable positional combat of *Fights in Tight Spaces*, and the card logic of *Slay the Spire*. The web version turns the design document's recommended MVP into a complete, replayable solo-Mage vertical slice.

- Live game: [https://manu.vision/emberfall/](https://manu.vision/emberfall/)
- Source repository: [manuvision/sainxart.github.io](https://github.com/manuvision/sainxart.github.io)
- Initial release commit: [`fcb4410`](https://github.com/manuvision/sainxart.github.io/commit/fcb4410ceac2261c3f5f11471ff170d870b04db4)
- Release date: August 21, 2026
- Version represented: design draft v0.1

## 1. What was shipped

The project is a dependency-free, mobile-first browser game with one short campaign:

- A title screen dedicated to Sandy.
- A six-node overworld route through Greybank March and the Charred Vale.
- A persistent solo Mage named Elowen.
- Six character stats and deterministic stat-gated card discovery.
- A permanent card library and an exact twelve-card active loadout.
- Fire Staff equipment progression from Tier 1 to Tier 2.
- Three turn-based tactical encounters on a nine-tile lane.
- Visible enemy intents that mark the exact tiles enemies will attack.
- Separate Stamina and Mana economies.
- Movement, blocking, direct damage, area damage, Burn, splash damage, and persistent tile hazards.
- A final boss encounter and personalized ending.
- Local save data, campaign statistics, restart flow, rules, combat log, and sound toggle.
- Responsive desktop and phone layouts.
- Original vector artwork, CSS animation, and synthesized Web Audio sound effects.
- Automated rules-engine tests and a complete manual browser playthrough.
- A generated social-sharing image, favicon, metadata, and live GitHub Pages deployment.

The Lab homepage was deliberately left unchanged so the direct URL could remain a surprise.

## 2. The product decision

The full design document describes several games' worth of systems: an overworld RPG, a party simulator, an equipment economy, and positional card combat. Trying to build all of that at once would make it hard to learn whether the central idea is actually fun.

The vertical slice therefore tests the two most important bets first:

1. Does earning cards from chosen stats and equipment feel more meaningful than receiving random card rewards?
2. Can a one-dimensional lane remain tactically interesting when enemy attacks are visible in advance?

Everything in the slice exists to answer those questions. Companions, a large open world, procedural contracts, shops, injuries, and dozens of equipment lines are intentionally deferred.

## 3. How the design document became a playable arc

The slice follows this progression:

1. **Greybank:** The player starts with a twelve-card Mage loadout and 5 Intelligence.
2. **The Ashen Road:** A tutorial encounter teaches range, movement, Stamina, Mana, Block, and enemy intent.
3. **Stat investment:** Victory grants three freely assignable stat points. Investing all three in Intelligence reaches 8 INT and unlocks Arcane Missile.
4. **Cinderwatch:** The player receives a Tier 1 Fire Staff. Its cards do not unlock immediately.
5. **Scorched Keep:** Completing a full battle with the staff equipped attunes it and permanently discovers Fireball and Brand.
6. **Ember Forge:** An Ember Shard upgrades the staff to Tier 2 and discovers Flame Wall.
7. **Loadout curation:** The player removes older cards and chooses which twelve discovered cards to bring forward.
8. **The Ember Crown:** The final fight tests everything together against an add and the Fallen Warden.
9. **Ending:** Campaign statistics are shown with a message for Sandy.

This arc makes every new card traceable to a visible choice, matching the design pillar: **your build is your history, not your luck**.

## 4. Stacklands-inspired presentation

Stacklands was used as a presentation reference, not as an asset source. The implementation borrows principles rather than copying its art:

- Treat cards as physical objects with weight, rotation, shadows, and a quick tabletop landing motion.
- Keep the surrounding interface quiet so the cards and game state carry the attention.
- Use brief animation and sound as feedback, not decoration.
- Give different actions recognizable audio signatures so sound reinforces what just happened.
- Make dragging or tapping through a simple action feel satisfying enough to repeat many times.

The Emberfall visual language remains original: parchment, moss green, soot black, oxblood red, ember orange, hand-drawn vector figures, medieval display type, and contour-map lines.

Useful reference pages:

- [Stacklands on Steam](https://store.steampowered.com/app/1948280/Stacklands/)
- [Half-Glass Gaming review](https://halfglassgaming.com/2022/04/stacklands-is-five-dollars-worth-of-hyper-addictive-card-stacking-fun/)
- [HitPoint review](https://hitpointreviews.com/reviews/1948280/stacklands)

## 5. Technology choices

The game intentionally uses the smallest practical web stack:

- Semantic HTML.
- Plain CSS with responsive media queries and custom properties.
- Native JavaScript ES modules.
- SVG strings for all game artwork and icons.
- Web Audio API oscillators, filters, and generated noise for sound.
- `localStorage` for saves and sound preference.
- Node's built-in test runner for engine tests.
- GitHub Pages for static hosting.

There is no framework, bundler, package dependency, database, server, account system, or asset pipeline. That keeps the prototype easy to understand and makes every file deployable as-is to any static host.

Google Fonts provides Cinzel and DM Sans. The design includes system fallbacks if those fonts are unavailable.

## 6. Repository map

```text
emberfall/
├── index.html              App shell, metadata, header, accessibility regions
├── styles.css              Complete visual system and responsive layouts
├── app.js                  Rendering, interaction, screen flow, save wiring
├── engine.js               Pure campaign and combat rules
├── art.js                  Inline SVG icons, characters, enemies, and scenes
├── audio.js                Procedural Web Audio sound engine
├── favicon.svg             Browser icon
├── social-preview.svg      Editable 1200 × 630 sharing artwork
├── social-preview.png      Sharing artwork used by social metadata
├── package.json            Syntax-check and test commands
├── README.md               Short developer quick start
├── project.md              This full handoff guide
└── tests/
    └── engine.test.js      Deterministic rules-engine tests
```

### Why the engine and interface are separate

`engine.js` knows nothing about the DOM. It receives plain serializable state and returns new state plus events. `app.js` renders that state and turns events into motion, sound, haptics, toasts, and accessible announcements.

That separation is the most important engineering decision in the project. It makes the rules testable without a browser and lets a future interface—Canvas, React, Godot, native mobile, or multiplayer client—reuse the same concepts.

## 7. State model

There are two related state objects.

### Campaign state

The campaign contains durable information:

- Save schema version and creation date.
- Current overworld node and completed nodes.
- Day, finish state, player identity, health, gold, and XP.
- Six stats and unspent stat points.
- Equipment and Fire Staff tier.
- The twelve-card active deck.
- Inventory, discovery flags, and lifetime play statistics.

New campaign data is created by `createCampaign()` in `engine.js`.

### Combat state

Combat is temporary and contains:

- Encounter, turn, and status.
- Player HP, Block, lane position, Stamina, Mana, and Overcharge state.
- Enemy instances, positions, effects, and current intents.
- Draw pile, hand, discard pile, and hazards.
- A short combat log and battle totals.

Combat begins with `startCombat()` and is resolved through `playCard()` and `endTurn()`.

All rules state is JSON-compatible. The engine uses copies when changing state, which makes tests predictable and avoids accidental UI mutation.

## 8. Card model

Every card is a record inside `CARDS` in `engine.js`. A card can declare:

- `id`, full name, and short mobile name.
- Family: physical, movement, utility, magic, or fire.
- Resource: Stamina or Mana.
- Cost.
- Target kind: none, enemy, or tile.
- Range.
- Damage, Block, movement, card draw, Mana gain, splash, Burn, or another special property.
- Icon identifier.
- Player-facing description.
- Source label showing why the player owns it.

A simplified card looks like this:

```js
firebolt: {
  id: "firebolt",
  name: "Firebolt",
  shortName: "Firebolt",
  family: "magic",
  resource: "mana",
  cost: 2,
  target: "enemy",
  range: 4,
  damage: 7,
  icon: "bolt",
  description: "Deal 7 damage to an enemy within 4 tiles.",
  source: "INT 5",
}
```

The shipped library includes shared basics, stat cards, and Fire Staff cards. The loadout editor enforces both ownership counts and the twelve-card limit.

## 9. Unlock model

There are two deterministic unlock paths.

### Stat-gated cards

`STAT_UNLOCKS` connects a stat threshold to a card and copy count. The slice implements:

- INT 3 → two Mana Gems.
- INT 5 → two Firebolts.
- INT 8 → one Arcane Missile.
- INT 10 → one Overcharge.
- WIS 3 → one Runic Ward.
- AGI 5 → one Cinderstep.

Only the early Intelligence path is required to finish the slice, but the locked cards demonstrate how the full library can preview future choices.

### Equipment discovery

The Fire Staff demonstrates the design document's discovery rule:

- Equipping Tier 1 begins attunement.
- Completing Scorched Keep permanently reveals Fireball and Brand.
- Applying the Ember Shard raises the staff to Tier 2 and reveals Flame Wall.

The card library is derived from stats and discovery flags by `getLibrary()`. The player never receives an unexplained random card reward.

## 10. Combat rules

The shipped balance uses:

- Nine lane tiles.
- Five cards drawn per turn.
- A twelve-card active deck.
- Three Stamina, fully restored every turn.
- One starting Mana, banking up to six and restoring by one each turn.
- Enemy attacks planned before the player acts.
- Fixed target tiles, so moving away makes an attack miss.
- A player-controlled phase followed by a complete enemy phase.

The combat loop is:

```text
Draw hand
→ reveal enemy intents
→ play cards in any order
→ reposition, block, or attack
→ end turn
→ resolve Burn and hazards
→ resolve enemy movement and attacks
→ refresh Stamina and partially restore Mana
→ draw the next hand
```

Enemy patterns are intentionally authored rather than random. Early enemies teach approach and single-tile threats. Scorched Keep adds ranged marked ground and wider attack shapes. The Fallen Warden alternates focused hits, three-tile sweeps, and an alternating-tile Emberfall pattern.

## 11. Interface architecture

`app.js` is a small state-driven single-page application. Its main screen modes are:

- `title`
- `map`
- `briefing`
- `town`
- `forge`
- `combat`
- `ending`

The central `render()` function chooses the appropriate screen renderer. Interactions use event delegation through `data-action` attributes instead of attaching listeners to every rerendered control.

Modals are used for:

- Rules.
- Character stats.
- Active loadout.
- New-campaign confirmation.

Small engine events are translated into UI feedback: card ghosts, hit numbers, shakes, screen flashes, sounds, haptics where supported, toasts, and screen-reader announcements.

## 12. Visual system

The presentation is built almost entirely in CSS and inline SVG.

### Palette

- Soot-black page background.
- Moss and charcoal play surfaces.
- Warm parchment cards and panels.
- Oxblood enemy and fire-card accents.
- Ember-orange primary actions.
- Muted blue for Mana.
- Ochre for Stamina and progression.

### Typography

- Cinzel for medieval display text and card names.
- DM Sans for compact interface copy and readable instructions.

### Card treatment

Cards use a thick paper border, inset frame, offset shadow, slight rotation, and small movement on hover or selection. Mobile cards become narrower and abbreviate their visible copy while retaining full accessible labels.

### Original artwork

`art.js` returns inline SVG for card symbols, Elowen, enemy silhouettes, map nodes, story scenes, and the flame sigil. No third-party game art was copied or shipped.

## 13. Motion and sound philosophy

Animation is short and functional:

- Cards lift when available and move toward their target when played.
- Damage, Block, misses, and unlocks each have a distinct response.
- Enemies move on the lane rather than teleporting without feedback.
- Embers and contour lines provide quiet ambience behind the readable state.

Sound is opt-in because browsers require a user gesture before audio starts. The sound preference is remembered.

`audio.js` creates every sound at runtime:

- Filtered noise for paper, impacts, and fire.
- Oscillators for Mana, movement, warnings, victory, and unlocks.
- A sparse randomized crackle on non-combat screens.

This avoids download-heavy audio assets and makes the prototype legally and technically portable.

## 14. Accessibility and mobile behavior

The game includes:

- Semantic headings, buttons, navigation, regions, dialogs, and articles.
- Descriptive accessible names for cards, enemies, health, resources, and intents.
- Live regions for important combat and progression feedback.
- Keyboard targeting, Escape cancellation, modal focus management, and focus trapping.
- Disabled states with visible and semantic feedback.
- A reduced-motion mode using `prefers-reduced-motion`.
- Sound off by default and a persistent sound control.
- High-contrast parchment-on-dark presentation.

Responsive layouts were verified at a 390 × 844 phone viewport and at desktop size. On phones, the map and lane retain their spatial structure while cards become a horizontally browsable hand.

## 15. Saving and reset behavior

Campaign data is stored under:

```text
emberfall-campaign-v1
```

Sound preference is stored under:

```text
emberfall-sound-v1
```

The campaign save is written at safe progression points. Active combat is deliberately not persisted; refreshing during a battle returns the player to the last safe checkpoint. This keeps the save model simple and prevents partially resolved turns.

The `version` field is important. If the save schema changes later, add a migration or change the storage key rather than assuming old saves have new fields.

## 16. Run the project locally

### Requirements

- A modern browser.
- Python 3 for the simplest local server.
- Node.js 20 or newer for checks and tests.

No package installation is required.

### Start the game

From the `emberfall` directory:

```sh
python3 -m http.server 4174
```

Open:

```text
http://localhost:4174/
```

Do not open `index.html` directly with a `file://` URL. ES module imports are expected to run through HTTP.

### Run verification

```sh
npm run check
npm test
```

The first command checks JavaScript syntax. The second runs the engine tests using Node's built-in test runner. If `npm` is not on the machine's path, run the underlying Node commands directly:

```sh
node --check engine.js
node --check art.js
node --check audio.js
node --check app.js
node --test
```

## 17. Build a similar prototype from scratch

This is the recommended order. Each step should remain playable before moving to the next.

### Step 1: Write one testable sentence

Define the prototype's unique bet in one sentence. For Emberfall it was:

> Build a persistent Mage through chosen stats and equipment, then use those cards to escape visible attacks on a tactical lane.

If a feature does not help test that sentence, defer it.

### Step 2: Choose the smallest complete journey

Plan a beginning, one progression choice, an escalation, a boss, and an ending. A complete fifteen-minute arc teaches more than a broad but unfinished sandbox.

For a first prototype, target:

- One hero.
- Eight to fourteen cards.
- One battlefield format.
- Two normal encounters.
- One boss.
- One permanent progression moment.

### Step 3: Build the rules without visuals

Create plain objects for cards, enemies, encounters, campaign state, and combat state. Write pure functions for:

- Creating a campaign.
- Starting combat.
- Finding valid targets.
- Checking whether a card can be played.
- Playing a card.
- Ending a turn.
- Applying victory rewards.

Pass a random-number function into rules that shuffle or roll. Tests can then use a fixed function and produce repeatable results.

### Step 4: Add tests before polish

Test the rules that would ruin a playthrough if broken:

- Starting deck size.
- Deterministic unlock thresholds.
- Equipment attunement.
- Loadout ownership and size.
- Resource spending.
- Range checks.
- Moving away from marked attacks.
- Turn refresh behavior.
- Victory progression.

### Step 5: Make one screen per player intention

Avoid exposing the entire system at once. Emberfall separates exploration, story choices, loadout editing, stat spending, combat, and results. Every screen should make the next meaningful action obvious.

### Step 6: Add visual language

Choose a small palette, two fonts, one border vocabulary, one shadow style, and a consistent animation duration. Make cards feel related even when their effects differ.

Create original SVG symbols or simple procedural art before searching for a large asset library. Consistency matters more than illustration detail in an early slice.

### Step 7: Add sound as information

Start with five cues:

- Select.
- Confirm or card landing.
- Movement.
- Damage or failure.
- Unlock or victory.

Keep them short. Each cue should explain the action even when the animation is missed.

### Step 8: Test the full campaign, not isolated screens

Play from a fresh save to the ending. Then repeat on a narrow viewport. Watch for progression locks, unwinnable decks, controls below the fold, stale save state, and errors after rerenders.

### Step 9: Package for sharing

Add:

- A clear title and description.
- Favicon.
- Canonical URL.
- Open Graph and Twitter metadata.
- A 1200 × 630 social preview image.
- A short README.
- A restart option so another person can replay from a clean state.

### Step 10: Deploy and verify production

Do not stop at a successful Git push. Open the real HTTPS URL, confirm its redirect and status, load every referenced asset, begin a new game, and inspect browser errors.

## 18. Add a new card

Follow this checklist:

1. Add the card definition to `CARDS` in `engine.js`.
2. Add its ID to `CARD_ORDER` so the library has a stable display position.
3. Add a stat threshold, equipment rule, or other discovery rule.
4. Add or reuse an icon in `art.js`.
5. If it uses an existing effect property, the renderer may work automatically.
6. If it introduces a new mechanic, implement it in `playCard()` and return a meaningful event.
7. Add a focused engine test.
8. Check the full and compact mobile card labels.
9. Play at least one encounter with it in the active deck.

Prefer combining known effect fields before creating a special one-off code path. A small vocabulary of composable mechanics produces more cards with fewer bugs.

## 19. Add a new enemy or encounter

### Enemy

1. Add its definition and maximum HP to `ENEMY_TYPES`.
2. Add its portrait key and SVG in `art.js`.
3. Define its intent cycle in the engine's enemy-planning logic.
4. Make each intent communicate power, shape, and affected tiles.
5. Test at least one movement card against its fixed target tiles.

### Encounter

1. Add an entry to `ENCOUNTERS` with region text and enemy placements.
2. Add an overworld node in `MAP_NODES`.
3. Extend `nodeState()` and `openMapNode()` with its unlock conditions.
4. Add briefing art and narrative copy.
5. Define its victory reward in `applyVictory()` and `acceptVictory()`.
6. Add a progression test and complete the encounter manually.

Place enemies so movement and range create a real decision on the first turn. Raw HP alone does not create positional gameplay.

## 20. Balance the game methodically

Track four numbers during a playthrough:

- Turns taken.
- Damage received.
- Cards played.
- Unspent resources at the end of each turn.

When an encounter is too easy, improve its decision pressure before increasing health. Better options include changing intent shapes, staggering enemy distances, forcing movement, or creating a reason to bank Mana.

When an encounter is too hard, check whether the player received enough information and whether their deck contains a valid answer before reducing damage.

The released browser playthrough completed:

- All three battles.
- The stat and equipment progression path.
- The final boss in eleven turns.
- The full ending with campaign totals.

## 21. Current automated coverage

`tests/engine.test.js` contains eight passing tests:

1. A new Mage starts with a valid twelve-card deck.
2. Three INT points unlock Arcane Missile at INT 8.
3. Fire Staff attunement and Tier 2 discovery work in order.
4. Loadout editing respects owned copies and the twelve-card cap.
5. Firebolt spends Mana and deals damage in range.
6. Movement causes a fixed telegraphed attack to miss.
7. Stamina refills while Mana banks between turns.
8. Victory advances the campaign and preserves totals.

Recommended future tests:

- Burn duration and death timing.
- Flame Wall target legality and hazard expiration.
- Splash damage near adjacent enemies.
- Overcharge cost and damage modification.
- Defeat and retry restoration.
- Save migration from an older schema.
- Every encounter's availability rules.

## 22. Manual release checklist

Before sharing a new version:

- Start from a clean save.
- Complete all encounters and reach the ending.
- Try spending stat points somewhere other than Intelligence.
- Remove and add cards until the loadout reaches exactly twelve.
- Verify that out-of-range cards are disabled.
- Move off a marked tile and confirm the attack misses.
- Take a blocked hit and an unblocked hit.
- Toggle sound on and off.
- Open and keyboard-navigate every modal.
- Refresh on the map and during combat.
- Check desktop and a phone-sized viewport.
- Check `prefers-reduced-motion` if possible.
- Run `npm run check` and `npm test`.
- Check the browser console for errors and warnings.
- Verify the final public URL and every referenced asset.

## 23. Deployment

The current game is a folder inside the `manu.vision` GitHub Pages repository. Because all paths are relative, deploying is simply a Git operation:

```sh
git add emberfall
git commit -m "Describe the Emberfall change"
git push origin master
```

GitHub Pages then publishes the branch. Deployment can take a few minutes.

Verify the exact route:

```sh
curl -I https://manu.vision/emberfall
curl -I https://manu.vision/emberfall/
curl -I https://manu.vision/emberfall/app.js
```

The no-slash URL should redirect to the slash URL, and the final page and assets should return HTTP 200.

The same folder can also be deployed to Netlify, Cloudflare Pages, Vercel, an S3 static bucket, or any ordinary web server. No build command is needed; the publish directory is the `emberfall` folder itself.

## 24. What is intentionally not implemented

This is a vertical slice, not the full production game. It does not yet include:

- Companion recruitment or multi-unit turns.
- Reserve swapping, injury, permanent loss, or roster attrition.
- A free-roaming overworld.
- Town economies, vendors, trainers with gold costs, or respec.
- Procedural contracts and events.
- Multiple weapon and armor lines.
- Full Strength, Agility, Constitution, Wisdom, and Luck card trees.
- A large card library or search/filter tools.
- Server saves, accounts, analytics, or cloud synchronization.
- Localization.
- A content-authoring tool.

These omissions are deliberate. The slice should be evaluated before expanding its content multiplier.

## 25. Recommended next milestones

### Milestone 1: Validate the combat core

- Put the game in front of five to ten players.
- Record where they misunderstand range, intent, resource banking, or discovery.
- Measure boss completion, turns, and restart rate.
- Change rules only after identifying a repeated problem.

### Milestone 2: Add build contrast

- Complete one non-Intelligence stat path.
- Add a second equipment line, such as Twin Daggers or Tower Shield.
- Create one encounter that is easier for each build but still solvable by both.

### Milestone 3: Test companions

- Add one companion rather than a full roster.
- Let the player interleave both characters' cards.
- Re-evaluate lane readability before adding a third unit.

### Milestone 4: Expand the world

- Add one settlement loop with a contract board, vendor, and trainer.
- Add one meaningful world consequence.
- Keep named build-defining equipment deterministic.

### Milestone 5: Move content into data

When cards and encounters become numerous, move definitions into JSON or a small authoring format. Keep effect execution in code, validate the data at startup, and version saved campaigns.

## 26. Lessons worth carrying forward

- A complete small arc is more informative than a large unfinished map.
- The source label on every card is essential; it makes progression understandable.
- Enemy intent must be visible on the battlefield, not only described in text.
- Movement feels valuable when it competes with damage for card access and timing.
- Split resources give martial and magical turns different rhythms.
- Permanent discovery plus a capped loadout preserves progression without creating unreadable combat hands.
- Short, distinct feedback sounds make a static card interface feel physical.
- Pure rules and browser rendering should remain separate.
- A production URL is not verified until the deployed page and assets are opened and tested.

## 27. Final handoff

If Sandy wants to take ownership, the fastest path is:

1. Clone or copy the `emberfall` folder.
2. Run it locally with Python's HTTP server.
3. Read `engine.js` first, then `tests/engine.test.js`, then `app.js`.
4. Change one card's numbers and rerun the tests.
5. Add one new card using the checklist above.
6. Add one enemy pattern that makes that card useful.
7. Play the complete arc on desktop and phone.
8. Commit each working milestone before expanding scope.

The prototype is deliberately small enough to understand end to end. That is its real value: it is not only a game to play, but a working reference for how Emberfall's central ideas can become a larger game.
