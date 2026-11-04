# Pixel Extract - Handoff

## Summary
Pure frontend single-player pixel extraction shooter. Read this file before continuing; do not paste the whole chat history.

## Paths
- Workspace: C:\Users\86158\Documents\deepseek-harness\default-workspace
- Live: https://shiny-lolly-80eafb.netlify.app
- GitHub: https://github.com/w25257758/pixel-extract-game
- Stack: HTML + CSS + vanilla JavaScript + Canvas 2D, no build step.
- Entry: index.html
- Main logic: js/game.js
- Styles: css/style.css
- PWA cache: sw.js, current CACHE_NAME pixel-extract-v23
- Save key: localStorage pixel_extract_save_v1
- Latest maintenance: larger 72x54 map, weighted rarity loot and new collectibles (see git log)

## Current UI
- Mobile landscape one-screen layout; base has two columns: loadout and manage center.
- Top-left shows only the PX mark, base title and subtitle. There is no base level or XP bar.
- Manage center directly shows three entry cards: equipment, stash, black market.
- Each card opens its own independent window. No tabs, no extra manage-window entry.
- All three windows fit without vertical scrolling at tested sizes.
- The old progression panel was removed and must not be re-added.
- In-raid HUD shows run level, floor, XP, HP, ammo, keys and backpack.
- Bosses appear only on floors divisible by 5. Every other floor has no boss marker or boss HUD.
- Every floor has one golden key guardian, one locked key-room chest and a high-value vault loot table.
- War fog hides unseen tiles and entities. The minimap/full map only show explored tiles, with a cyan trail of the walked path.
- Map size is 72x54 tiles with 13-18 rooms, 31-43 searchable containers and more enemies than the old 52x40 map.
- Loot rarity is weighted by container quality (common/rare/vault), floor depth and risk. Rare caches use cyan world/map accents.
- Level-up growth is a focused, paused 3-choice modal. Perks are run-only and disappear when the run ends.
- Debrief, perk-choice and extraction-choice cards fit without scrolling at 932x430, 667x375 and 568x320.

## Must keep
- No separate fire button.
- Aim pad: light touch aims, hold about 0.15s fires, drag to aim.
- Mobile touch aim auto-locks the nearest visible enemy in weapon range regardless of facing; desktop hold-fire keeps the 75-degree front cone. HUD shows 索敌 ON / 锁定 / 索敌 OFF.
- Stand near a container for 2 seconds to auto-search; moving, damage or reload interrupts.
- Stay in extraction zone for 3 seconds, then choose continue to the next floor or return to base.
- Every new run starts at level 1. Base level/XP/permanent perks must not return.
- Keep risk picker, random events, stash filter/sell-common, save export/import and touch settings.
- Keep bosses exclusive to every fifth floor; key guardian must always drop one key; locked chest must consume exactly one key.
- Keep airdrops removed. The rare-loot source is the key-room chest.
- Keep fog of war and persistent explored-path display on both minimap and full map.
- Keep the enlarged map and loot density; room generation must still produce at least 12 rooms.
- Keep rarity-weighted loot: common/rare/vault containers use different rarity distributions and vault guarantees one rare+ item.
- Keep the base one-screen on mobile landscape; do not add scrolling panels.
- Mobile auto-lock must choose the nearest visible enemy in weapon range even when the player is moving backwards. Desktop auto-lock keeps the 75-degree front cone.
- Keep level-up choices as an in-raid compact modal, not a base progression panel.
- Continuing to the next floor keeps the current run's level, perks, HP, ammo and backpack.
- Enemy HP, damage, count and rare-loot chance scale with floor depth.
- Main-view visibility is a radial fog with LOS checks; map markers must never reveal unseen enemies or the boss.

## Recent work
- First-raid four-step tutorial: move, search, combat, extract. Skippable, shows once.
- Combat feedback: hit marker, red kill marker, damage-direction arrow, low-HP edge pulse.
- Movement optimization: cached stick geometry, input dead zone and smoothing, HUD/minimap throttling, cached vignette gradient, particle caps.
- Reworked progression to be run-only: base level/XP and permanent perks were removed; every run starts at LV.1.
- Kills and loot grant run XP; level-ups open a paused 3-choice perk modal. Perk effects apply to the current run only.
- Extraction now opens a choice card: continue to the next floor with the current run, or return to base and settle loot.
- Floor scaling raises enemy count, HP, damage and rare-loot chance without using a persistent player level.
- Auto-lock now works on desktop hold-fire with the front cone, while mobile touch lock chooses the nearest visible enemy regardless of facing; HUD shows state.
- Added every-5-floor boss spawning, golden key guardians, locked key-room chests, key HUD/inventory count and vault loot.
- Removed the airdrop event and all airdrop rendering/map references.
- Added radial war fog, LOS-filtered entity rendering, explored-tile fog masks, persisted walk trails, and fog-aware minimap/full map markers.
- Compacted the map card so the expanded key/path legend fits without scrolling at 568x320.
- Local/offline smoke-tested: F1-F4 have no boss, F5 boss HP 666; key guard drop, one-key chest unlock and vault loot; fog reveal/path growth; mobile fire lock at F5; no JS errors.
- Enlarged map to 72x54 tiles: 8 consecutive generations produced 13-18 rooms, 31-43 containers, 9-11 F1 enemies and 60 FPS in headless Edge.
- Verified weighted drops at F1: common cache 61.7/27.0/9.3/2.0%, rare cache 25.9/33.1/30.3/10.8%, vault 0/17.2/52.0/30.8% for common/uncommon/rare/epic.
- Added eight collectible item types: fiber, circuit, battery, lens, drone_core, medal, quantum and phase; rare caches now render cyan and appear cyan on maps.
- Compacted debrief/perk cards and added a compact extraction-choice card.
- Local tested at 932x430, 667x375 and 568x320: no page scroll, manage windows no scroll, debrief/perk/extraction cards no scroll; real 3-second extraction flow and multi-floor carry-over work.

## Run and test
- Local: run python -m http.server 8080 in the workspace, then open http://127.0.0.1:8080/index.html
- Or double-click the Chinese start batch file.
- Debug bridge: window.__PX with startRaid(), snapshot(), enableTouch(), touchMove(), hurt(), grantPerkChoices(), grantXP(), grantKeys(), damageEnemy(), damageBoss(), lootSample(quality,count), openExtractionChoice(), continueToNextFloor(), returnFromExtraction().
- After deploy verify:
  - document.documentElement.scrollHeight === innerHeight
  - manage windows scrollHeight === clientHeight
  - no script errors
  - movement, two-finger aim/fire, tutorial and combat feedback

## Release
1. Edit and test locally.
2. Bump CACHE_NAME in sw.js on every release.
3. Commit and push main; Netlify deploys automatically.
4. Wait for deploy and smoke-test production.

## Known environment issues
- GitHub SSH push from WSL sometimes returns Permission denied (publickey) or remote Internal Server Error. Retry after 30-60 seconds.
- Browser navigation may log Uncaught (in promise) Object. Fresh-page flow tests did not reproduce a user-visible issue; investigate async image/audio loads if needed.
- Avoid literal special Unicode graphic glyphs in PowerShell command payloads.

## Suggested next steps
- Test floating and fixed sticks on a real phone.
- Check long combat sessions on a low-end phone.
- Test fog visibility, key/chest flow, floor-5 boss transition, in-raid perk selection and the extraction choice on a real phone.
- Check whether the radial fog is too dark or too permissive on a real phone and tune VISION_RADIUS only.
- Verify old level/perk saves still migrate cleanly after the next data-format change.
- Daily challenges are the next content candidate; keep them compact and avoid adding a base progression panel.