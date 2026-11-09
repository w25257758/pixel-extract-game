# Pixel Extract - Handoff

> **WORKING RULES (mandatory): see `..\AGENTS.md`.** Never read all of `js/game.js` (312 KB) at once — grep for the line, then `read offset/limit`. A previous session was killed by 413 Request Entity Too Large because it re-read whole large files and screenshots into context.

## Summary
Pure frontend single-player pixel extraction shooter. Read this file before continuing; do not paste the whole chat history.

## Paths
- Workspace: C:\Users\86158\Documents\deepseek-harness\default-workspace\games
- Live: https://shiny-lolly-80eafb.netlify.app
- GitHub: https://github.com/w25257758/pixel-extract-game
- Stack: HTML + CSS + vanilla JavaScript + Canvas 2D, no build step.
- Entry: index.html
- Main logic: js/game.js
- Styles: css/style.css
- PWA cache: sw.js, current CACHE_NAME pixel-extract-v45
- Save key: localStorage pixel_extract_save_v1, schema version 10
- Latest maintenance: boss signature attacks, elite affixes, room objectives, gear management/reroll, expanded tutorial and combat debrief statistics, daily contracts (see git log)

## Current UI
- Mobile landscape one-screen layout; base has two columns: loadout and manage center.
- Top-left shows only the PX mark, base title and subtitle. There is no base level or XP bar.
- Manage center directly shows six entry cards in a 3x2 grid: character, equipment, stash, black market, enhancement, transcendence.
- Each card opens its own independent window. No tabs, no extra manage-window entry.
- All six windows fit without vertical scrolling at tested sizes; item/stone lists and character detail scroll internally when needed.
- The old progression panel was removed and must not be re-added.
- Top-right stat chips now include a 合约 (daily contracts) chip showing today's cleared count; it opens a standalone overlay, not a seventh manage card.
- Daily contracts overlay: date, 3 compact goal cards with progress bars and rewards, plus one claim button; it fits at 932x430, 667x375 and 568x320 without page or card scrolling.
- Art pass: pre-rendered floors now carry grout, noise, cracks, grime/blood/water decals and wall contact shadows; walls have panel seams, rivets and a top highlight; characters/elites get a 1px dark outline, shoulder highlights and per-character gear silhouettes; muzzle flashes spill light; a faint CRT scanline overlay is drawn in normal mode only.
- Art pass 2: every room gets an overhead radial light pool baked into the map canvas, plus deterministic crates/barrels/pipes as pre-rendered props (kept clear of room centres); floating dust motes drift in the world layer. All of it lives in `buildMapCanvas` (zero per-frame cost), dust is skipped in performance mode.
- Art pass 3 (reference-driven): all six stage palettes brightened and desaturated less; walls are now offset brick courses with a face highlight; floors carry emissive specks plus cross-shaped glints; sprite scale is 1.5 for the player / 1.4 for enemies so silhouettes match the reference's chunky look; player ground ring widened; vignette eased to .38.
- Art pass 4: characters now render as standing side-view chibi sprites — the body mirrors horizontally (`ctx.scale(-1,1)` when facing left) instead of rotating with the aim angle, so heads stay up like the reference; the aim direction still reads through bullets/lock-on. UI switched to a heavy frame: 2px borders plus cut corners (clip-path) on panels, stat chips, manage cards, primary buttons and overlay cards. Verified base layout at 932x430 and 568x320 with no overflow.
- Loot window rebuilt from the owner's second reference: title "战利品包", a 6-cell summary row, a capacity-sized backpack grid (empty slots drawn, rarity-tinted borders, quantity badge) and a 3x3 secure box ("倒下也不会丢失"). Click a backpack item to select it, then click an empty secure cell to bank it; click a filled secure cell to take it back. `raid.secureBox` holds up to 9 items and its contents go to the stash even when the raid fails (death), while the backpack is still lost. Verified: 16 backpack cells and 9 secure cells render, move in/out both directions, death settlement banks exactly the secure items, no JS errors.
- Loot window also has a 整理背包 button (bottom right): sorts the live backpack array by kind (weapon/armor/pack/stone/loot), then rarity, then value, so the grid order is stable. The grid renders `player.backpack` directly (not `sortItemList`) so tidy has a visible effect. In short landscape the summary row collapses to 4 cells (role/value hidden) to keep the card near its max height.
- Reinforcement pressure: at 3:00 into a floor the first wave spawns, then roughly one wave per minute (interval shrinks with the wave number). Each wave picks 2+wave enemies (cap 14 per wave, 80 alive overall) from the stage pool, spawns them in rooms far from the player, and scales HP +15%/wave, damage +12%/wave, XP +10%/wave plus a rising elite chance. When the 6:00 timer hits zero the raid no longer ends — it flips to `overtime`, the timer HUD reads 增援中, waves keep coming on a shorter 45s-ish cycle forever. Verified: first wave at 180s, wave counter and enemy count increase, overtime triggers at 0 without ending the raid, HUD text switches to 增援中, no JS errors.
- Legendary tier added: `w_plasma` (等离子步枪) and `w_annihilator` (湮灭者) plus `a_phase` (相位护甲, 32% reduction/stealth) with matching WEAPON_DEFS/ARMOR_DEFS entries; `w_boss` upgraded from epic to legendary; `LOOT_POOLS.legendary` and a 3% legendary weight on the vault profile. Verified vault sample 20000 rolls ≈ 3.0% legendary.
- High-risk bounty per floor: one elite with 3.2x HP / 1.35x damage / 4x XP+scrap and a gold ring plus 「高危目标」 label. Killing it pays out 25% legendary / 75% epic gear (with +80~160 bonus scrap on the epic roll, +5 mod parts either way) and sets every living enemy to chase the player for 30s ("警报触发"). 24 test kills rolled 8 legendary / 16 epic, consistent with the 25% setting.
- Enhancement rework: stone tier gates, per-level success decay, luck pity and 3:1 fusion (see Must keep). Verified rates at +0 (white 27 / green 42 / blue 57 / purple 72 / red 87 / rainbow 100), gate refusal at +3 (white refused, stone count and plus unchanged), 20-attempt luck trail showing +10 per failure and reset on success, fusion white 6 -> 3 white + 1 green, and a fuse refusal when only 2 stones are owned. Enhancement window layout at 932x430 shows the new fusion block without breaking the panel.
- In-raid HUD shows run level, floor, XP, HP, ammo, keys, backpack, character name, dash CD and active-skill CD. Touch controls also have dedicated dash/skill buttons.
- Base loadout shows equipped backpack quality/capacity; the equipment window has a third backpack column with all six qualities.
- The enhancement window targets equipped weapon/armor/backpack, shows +0..+10 effects and lists six stone qualities with live success rates.
- The transcendence window shows level, current value progress / next threshold, permanent bonuses, item conversion list and bulk common-loot conversion.
- Bosses appear only on floors divisible by 5. Every other floor has no boss marker or boss HUD. Boss HUD now includes the current skill name and cast countdown.
- Six stage sectors cycle with floor depth: abandoned industry, red line, quantum abyss, foundry, void corridor, final citadel. Each has its own floor/wall/minimap palette and enemy pool.
- Enemy archetypes: assault burst, charging hound, heavy fan, sniper laser, mortar hazard and orbiting radial barrage.
- Bosses cycle through six named variants and use wall-blocked full-map bullet rings, targeted telegraphed slam zones and a suppression fan.
- Every floor has one golden key guardian, one locked key-room chest and a high-value vault loot table.
- Main raid view is fog-free and draws all nearby tiles/entities. The minimap/full map still hide unexplored tiles, with a cyan trail of the walked path.
- Map size is 72x54 tiles with 13-18 rooms, 31-43 searchable containers and more enemies than the old 52x40 map.
- Loot rarity is weighted by container quality (common/rare/vault), floor depth and risk. Rare caches use cyan world/map accents.
- Backpacks are a separate equipment drop: white/green/blue/purple/red/rainbow grant +8/+16/+24/+32/+40/+50 capacity on top of the base 8 slots.
- Enemies drop enhancement stones by chance; stones are six quality levels with 30/45/60/75/90/100% success rates.
- Level-up growth is a focused, paused 3-choice modal. Perks are run-only and disappear when the run ends.
- Four characters: Pioneer (heal 10% / low-HP damage reduction), Sniper (1.5s lock, 7x defense-and-wall-ignoring shot / piercing bullets), Assault (4s fire-rate overdrive / faster reload), Juggernaut (60 shield / 12% damage reduction). Sniper Q prefers a target in the aim cone before falling back to nearest visible.
- Universal Space dash: short directional displacement, 4s CD, brief invulnerability; touch dash button and Q active skill mirror it. Character status badges show shield/overdrive/low-HP/dash/lock/set effects.
- Debrief, perk-choice and extraction-choice cards fit without scrolling at 932x430, 667x375 and 568x320.
- Base loadout has a compact set-bonus line; equipment cards display affix text and item names use a star for set pieces.
- Stash now has quality/set/affix filters, lock/salvage/reroll actions and a compact action footer; equipment window has set codex and affix-aware comparison.
- In-raid HUD has an optional objective tracker with progress bar and active/idle hint; room objectives also render in the world and on the explored map.
- Boss HUD continues to show cast label, phase and core countdown; each boss variant has a named signature cast in its attack cycle.
- Elite enemies display an affix label above their health bars; volatile elites leave a telegraphed explosion on death.
- Debrief now reports damage dealt/taken, highest hit, dodges, elite/boss kills, objectives completed and best drop; run-earned mod parts are added on successful extraction.

## Must keep
- No separate fire button.
- Aim pad: light touch aims, hold about 0.15s fires, drag to aim.
- Mobile touch aim auto-locks the nearest visible enemy in weapon range regardless of facing; desktop hold-fire keeps the 75-degree front cone. HUD shows 索敌 ON / 锁定 / 索敌 OFF.
- Stand near a container for 2 seconds to auto-search; moving, damage or reload interrupts.
- Stay in extraction zone for 3 seconds, then choose continue to the next floor or return to base.
- Every new run starts at level 1. Base level/XP/permanent perks must not return.
- Keep risk picker, random events, stash filter/sell-common, save export/import and touch settings.
- Keep bosses exclusive to every fifth floor; key guardian must always drop one key; locked chest must consume exactly one key.
- Keep the four playable characters, their exact active/passive effects, save-persisted character selection and universal 4s dash with brief invulnerability.
- Keep Sniper active at 1.5s lock / 7x weapon damage / ignore defense / ignore walls, and keep its passive bullets piercing all enemies.
- Keep heavy/boss defense and ensure Sniper active ignores it; normal bullets must still be reduced by defense.
- Keep boss phase thresholds at 65%/30%, phase-scaled attack density, the exposed-core damage window (x1.5) and the P1/P2/P3 HUD markers.
- Keep random gear affixes and the three sets: raider (damage/crit), bulwark (reduction/max HP), specter (move speed/dash CD). Do not roll affixes on the starter pistol/pack.
- Keep the character status-effect badges and cooldown rings on touch buttons.
- Keep gear management: item locking must block sell/salvage/reroll, salvage grants mod parts, reroll costs 5 parts, and starter gear remains unmodded.
- Keep the affix-aware gear comparison including set break/activation preview; do not regress to base weapon DPS only.
- Keep the three room objective types and their risk/reward balance; objectives must remain optional and not block extraction.
- Keep elite affixes (swift/armored/frenzied/volatile/regenerating) and the volatile death telegraph.
- Keep room-based squad leaders (HP/damage buff) and squadmate coordination (damage/speed buff); do not remove the `队长` visual label.
- Keep one unique signature cast per boss variant; do not collapse all bosses back to the same three-pattern cycle.
- Keep five-step first-run tutorial and the debrief combat statistics.
- Keep character HUD/touch cooldown displays and the six-card 3x2 manage grid.
- Keep enemy attacks distinct and telegraphed: burst, charge, fan, sniper line, mortar circle and radial barrage. Do not collapse them back to one generic shot.
- Keep boss full-map barrages blocked by walls and keep targeted slam zones telegraphed for roughly 1.5 seconds with large damage on failure to dodge.
- Keep six stage palettes and stage-specific enemy pools; HUD objective must show the current stage name.
- Keep airdrops removed. The rare-loot source is the key-room chest.
- Keep fog of war on the minimap/full map and persistent explored-path display. Main raid view must stay fog-free.
- Keep the enlarged map and loot density; room generation must still produce at least 12 rooms.
- Keep the backpack equipment slot and exact bonuses: white +8, green +16, blue +24, purple +32, red +40, rainbow +50. Total capacity is base 8 + pack bonus + enhancement level + run-only scavenger perk.
- Keep the enhancement system: enemy stone drops, six stone tiers, +10 cap, failed attempts consume one stone without downgrading, and the reworked math below.
- Keep enhancement gates: +1~+2 white / +3~+5 green / +6~+7 blue / +8~+9 purple / +10 red; rainbow always allowed. A stone below the gate must be refused without consuming it.
- Keep the success formula `max(0.05, stone.success - targetLevel * 0.03)` (rainbow stays 100%) and the luck pity: each failure +10 luck, 100 luck guarantees success, success resets luck to 0.
- Keep stone fusion: 3 stones of a tier become 1 of the next tier (white->green->blue->purple->red), always succeeds, rainbow is top tier and never fuses. UI lives in the enhancement window.
- Keep enhancement effects: weapon damage +5% per level, armor damage reduction +1.5% per level, backpack capacity +1 per level; enhancement persists on the item.
- Keep transcendence: convert stash items by sell value; first threshold 1000, each later threshold x1.25 rounded up; progress overflow carries over.
- Keep transcendence permanent bonuses per level: max HP +10, weapon damage +2%, damage reduction +1%, move speed +1%. They persist across runs and floors.
- Keep rarity-weighted loot: common/rare/vault containers use different rarity distributions and vault guarantees one rare+ item.
- Keep the base one-screen on mobile landscape; do not add scrolling panels.
- Mobile auto-lock must choose the nearest visible enemy in weapon range even when the player is moving backwards. Desktop auto-lock keeps the 75-degree front cone.
- Keep level-up choices as an in-raid compact modal, not a base progression panel.
- Continuing to the next floor keeps the current run's level, perks, HP, ammo and backpack.
- Enemy HP, damage, count and rare-loot chance scale with floor depth.
- Main-view rendering must not apply radial fog or LOS culling; map markers must still never reveal unseen enemies or the boss.
- Keep daily contracts compact: three seeded goals per local day, progress recorded only at raid settlement, per-goal claim plus a full-clear bonus, and do not turn it into a base progression panel or a seventh manage card.
- Keep the daily chip in the top-right stat row; the 3x2 manage grid stays at six cards.
- Keep the secure box: 9 slots in the loot window, items banked there survive a failed raid and still enter the stash; do not let the loot window require page scrolling at 932x430 / 667x375 / 568x320.
- Keep reinforcements: first wave at 3:00, then about one per minute with scaling stats; running the 6:00 timer out must NOT end the raid — it switches to overtime with endless waves instead of failing the player.
- Keep one high-risk bounty per floor: a gold-ringed elite that drops a legendary only ~25% of the time (otherwise epic gear + bonus scrap) plus 5 mod parts, and killing it alerts the whole map (every living enemy chases for 30s). The 「高危目标」 label and gold ring must stay visible.
- Keep boss challenge mode: 开始行动 opens the stage list, boss stages are single-layer (no 继续下一层), the extraction point works from the start, and difficulty N must keep using the old F(5N) stats.
- Keep per-boss drops: every boss drops its own legendary weapon plus its collectible material (see the BOSS_DROPS table). Do not collapse them back to one shared boss weapon.
- Keep the collector room: only the `collectible` kind is accepted (never weapons/backpacks/stones), the Nth donation costs N items, the eight bonuses are permanent and fixed-order, and they must be applied in the Player constructor + search/scrap/part-drop paths.

## Recent work
- First-raid five-step tutorial: move, search, combat, tactical dash/skill, extract. Skippable, shows once.
- Combat feedback: hit marker, red kill marker, damage-direction arrow, low-HP edge pulse.
- Movement optimization: cached stick geometry, input dead zone and smoothing, HUD/minimap throttling, cached vignette gradient, particle caps.
- Reworked progression to be run-only: base level/XP and permanent perks were removed; every run starts at LV.1.
- Kills and loot grant run XP; level-ups open a paused 3-choice perk modal. Perk effects apply to the current run only.
- Extraction now opens a choice card: continue to the next floor with the current run, or return to base and settle loot.
- Floor scaling raises enemy count, HP, damage and rare-loot chance without using a persistent player level.
- Auto-lock now works on desktop hold-fire with the front cone, while mobile touch lock chooses the nearest visible enemy regardless of facing; HUD shows state.
- Added every-5-floor boss spawning, golden key guardians, locked key-room chests, key HUD/inventory count and vault loot.
- Removed the airdrop event and all airdrop rendering/map references.
- Earlier fog implementation added explored-tile masks and fog-aware map markers; current build removes the main-view radial fog/LOS culling while keeping minimap/full-map fog.
- Compacted the map card so the expanded key/path legend fits without scrolling at 568x320.
- Local/offline smoke-tested: F1-F4 have no boss, F5 boss HP 666; key guard drop, one-key chest unlock and vault loot; fog reveal/path growth; mobile fire lock at F5; no JS errors.
- Enlarged map to 72x54 tiles: 8 consecutive generations produced 13-18 rooms, 31-43 containers, 9-11 F1 enemies and 60 FPS in headless Edge.
- Verified weighted drops at F1: common cache 61.7/27.0/9.3/2.0%, rare cache 25.9/33.1/30.3/10.8%, vault 0/17.2/52.0/30.8% for common/uncommon/rare/epic.
- Added eight collectible item types: fiber, circuit, battery, lens, drone_core, medal, quantum and phase; rare caches now render cyan and appear cyan on maps.
- Compacted debrief/perk cards and added a compact extraction-choice card.
- Added six backpack equipment qualities with +8/+16/+24/+32/+40/+50 capacity, a third equipment column, base loadout summary and in-raid inventory display.
- Verified save migration v2 -> v3, all six capacities (16/24/32/40/48/58 total), pack drop tiers, real container drop path and 568x320 layout with no JS errors.
- Added the enhancement system: six stone tiers, real enemy drop/pickup, base enhancement window, +10 cap and per-gear combat effects.
- Verified v3 -> v4 migration (including explicit pack:null), v4 plus levels, +10 cap, failure consumption, stone pickup/inventory detail, weapon damage multiplier, armor reduction and backpack capacity from enhancement.
- Verified enemy stone drop path at F1, base 3x2 manage grid and enhancement window no-scroll at 932x430, 667x375 and 568x320 with no JS errors.
- Added transcendence: stash item-value conversion, 1000 first threshold, 1.25x scaling, permanent combat stats, bulk common-loot conversion and base/inventory displays.
- Verified thresholds 1000/1250/1563/1954/2442/3052, v4 -> v5 migration, bulk conversion, +20 HP / +4% damage / +2% reduction at level 2, and 3x2 manage grid + transcendence panel no-scroll at all three test sizes.
- Added six floor sectors with distinct map palettes and enemy pools, six enemy attack archetypes, and six boss variants with full-map barrage, telegraphed slam and suppression fan attacks.
- Verified F1/F5/F10/F15/F20/F25/F30 stage and boss rotation, all six enemy attack types, boss slam hit for 69 damage at F5 vs zero when dodging, barrage bullet count collapsing from 47 to 7 within 1.8s due to walls/lifetime, and 568x320 boss HUD/objective no overflow.
- Added character system and save schema v6: four selectable characters, active skills, passives, universal dash, enemy defense, sniper lock beams and HUD/touch cooldowns.
- Verified Pioneer heal 50->60 HP with 10s CD, dash displacement 139px with 4s CD and 100% dodge of a 999 hit, Pioneer low-HP passive 30 damage -> 24, Juggernaut 60 shield and 12% passive, Assault 4s overdrive, Sniper 1000 HP heavy taking exactly 168 (7x24, ignoring 22% defense), and Sniper bullets damaging two aligned enemies with one shot.
- Verified character panel at 932x430 and 568x320, six base cards, save character selection, and no JS errors.
- Local tested at 932x430, 667x375 and 568x320: no page scroll, manage windows no scroll, debrief/perk/extraction cards no scroll; real 3-second extraction flow and multi-floor carry-over work.

- Added boss phases and core windows: Enter phase 2 at 65% and phase 3 at 30%; phase scaling increases ring/fan/hazard counts and attack rate, phase transitions and completed barrages expose the core for 2.7s (phases 2/3 open a longer transition window), and weak-core damage is x1.5.
- Added random gear affixes: 0-3 affixes by rarity across weapon/armor/pack, plus raider/bulwark/specter 2/3-piece sets; starter gear stays clean. Affixes affect damage, fire rate, crit, pierce, anti-boss, lifesteal, defense, move speed, dash CD, capacity and scrap.
- Added character status badges (shield, overdrive, low-HP passive, dash invuln, sniper lock, active set), touch cooldown conic rings, aimed sniper target priority and a Q skill-target preview.
- Verified v6->v7 save migration preserving gear/transcend/character; v7 affix/set persistence; gear sample 300 rare rifles: all modded, set items ~22.7%, all six weapon affixes represented.
- Verified set effects: bulwark 3/3 max HP 100->120 and defense bonus; specter 3/3 dash CD 4->3 and move speed; raider 3/3 damage/crit. Verified precision rifle damage: 36 base * 1.18 gear damage * 0.78 heavy defense = 33.13 exact; lifesteal 4% healed 1.44 from a 36-base hit.
- Verified boss phase 2 at 65%, phase 3 at 30%, core damage x1.5 (100 base -> 123 after 18% defense), barrage core timer, HUD `P2/3`/`P3/3` and no page overflow at 932x430.
- Verified sniper aim-cone targeting: aimed far heavy locked while an off-angle near heavy was ignored; status badge `猎杀锁定`, touch skill ring at 360deg, and 568x320 no page scroll.
- Verified base/loadout/equip/stash/character layouts at 932x430, 667x375 and 568x320, no page scroll and no inner panel overflow.
- Added gear management: stash quality/set/affix filters, lock/unlock preventing sale, salvage -> mod parts, 5-part affix reroll, set codex, mod-part counters and affix-aware DPS/effective-HP/set-change comparison.
- Verified lock -> sell blocked, reroll affix changed and consumed 5 parts, set filter showed the expected item, set codex displayed raider 3/3 and stash count, and 568x320 stash action footer fit without page overflow.
- Added three objective types with hold progress, reinforcement waves, rewards (scrap + mod parts + item + possible pack), world/map markers and HUD tracker. Verified vault objective active -> complete, raid.parts +3 and objectives stat +1.
- Added elite affixes and verified volatile elite death created a `爆裂` hazard; affix labels are exposed in snapshot. Added random elite roll on generation and retained gold-key elite behavior.
- Added room-based enemy squad leaders and squadmates with small stat buffs and a `队长` label; verified F1 generated one leader and two members at 568x320 without overflow.
- Added boss signatures for titan/prism/tyrant/omega/wraith/architect; verified F5/F10/F15/F20/F25/F30 signatures generated 5 hazards, 28 prism bullets, 6 lava hazards, 24 gravity bullets + hazard, 11 wraith fan bullets, and 10 array bullets + 4 hazards respectively.
- Added full debrief stats and best-drop summary; verified debrief at 568x320 reports damage, highest hit, elite kills, objectives, scrap and mod parts with no page overflow.
- Bumped save schema to v8; PWA cache is currently v31 after the fog/backpack/movement fixes.
- Movement fix: pointer tracking moved to window-level handlers so horizontal drags survive leaving the target element; added cardinal assist (>=0.9 axis component snaps minor axis to 0). Verified horizontal, diagonal, and drag-beyond-zone input at 568x320.
- Backpack discard: inventory header button drops the selected item(s) near the player with a 2-second pickup delay and a `走开` arming check; added a ground countdown label. Verified dropped item stayed after walking away, then re-entered backpack when revisited.
- Removed the main-view fog overlay and LOS draw filters; minimap and full map still use `world.fogMini` and exploration masks.
- Added daily contracts (save schema v9): three goals generated per local date from an 8-goal pool (kills/containers/extracts/objectives/elites/bosses use sum mode, depth/damage use best-single-run mode), recorded at `endRaid`, per-goal claim with a full-clear bonus, and a compact overlay opened from the new top-right 合约 chip.
- Verified daily contracts: seed-stable generation, sum accumulation and max-mode best-run, cap at target, claim once (440 scrap / 6 parts for the seeded day, then 0 on a second claim), real settlement path (search -> endRaid adds containers/extracts/depth), v8 -> v9 migration keeping scrap/character/mod parts while rebuilding the daily block, and no overflow at 932x430 / 667x375 / 568x320.
- Art pass A+B: floors/walls decals and contact shadows are baked into `buildMapCanvas` (no per-frame cost); character outlines and muzzle light spill are skipped in performance mode; scanlines use a cached 4x4 pattern. Verified four characters and six enemy archetypes spawn and render with no JS errors at 932x430, and 1440/1200 screenshots show the new floor texture, blood decals, wall seams and outlined sprites. Keep the vignette at .46 and the scanline alpha at .10 — darker settings made the floor read as flat black.
- Art pass 2 verified: room light pools, crate/barrel/pipe props (room centres kept clear) and dust motes render at 1200x720 and 568x320 with no JS errors; map regeneration cost is one-off per floor, so combat FPS is unaffected.
- Art pass 3 (owner supplied a reference screenshot: purple neon dungeon, offset brick walls, emissive floor specks, chunky standing characters, thick cut-corner UI). Implemented so far: brighter palettes, brick walls, emissive floor specks, 1.4-1.5x sprite scale, wider player ring, softer vignette. Not yet matched: the reference draws characters as standing side-view sprites (no rotation, just horizontal flip) and uses a very heavy UI frame — that is the next step, and it changes how facing reads, so test it carefully.

## Run and test
- Local: run python -m http.server 8080 in the workspace, then open http://127.0.0.1:8080/index.html
- Or double-click the Chinese start batch file.
- Debug bridge: window.__PX with startRaid(), startBossStage(bossId,difficulty), snapshot(), enableTouch(), touchMove(), hurt(), grantPerkChoices(), grantXP(), grantKeys(), damageEnemy(), damageBoss(), lootSample(quality,count), packSample(quality,count), grantStone(type,count), enhanceEquipped(slot,stoneType), enhanceInfo(), fuseStone(type), grantTranscendProgress(value), transcendNow(), convertStashToTranscend(itemId), jumpFloor(floor), bossAttack(type), spawnEnemy(kind), spawnEnemyAt(kind,dx,dy), clearEnemies(), setAim(angle), setHp(hp), setEnemyHp(index,hp), shoot(), dash(), characterSkill(), chooseCharacter(id), grantStashItem(type), equipPack(type), searchContainer(index), openExtractionChoice(), continueToNextFloor(), returnFromExtraction(), gearSample(type,count), grantGear(type,setId,affixes), equipById(id), setBossHp(hp), forceBossPhase(phase), grantModParts(amount), teleportToObjective(), setObjectiveProgress(value), spawnEliteAt(kind,affix,dx,dy), bossSignature(), addBackpackItem(type), discardBackpackItem(id), dailyState(), setDailyValue(id,value), resetDaily(), claimDaily(), recordDailyRun(run), forceDaily(list), collectorState(), donateCollector(), grantCollectible(type,count), openLoot(), secureState(), moveToSecure(id), moveFromSecure(id), tidyBackpack(), setTimeLeft(value), triggerWave(), advanceRaid(seconds).
- After deploy verify:
  - document.documentElement.scrollHeight === innerHeight
  - manage windows scrollHeight === clientHeight
  - no script errors
  - movement, two-finger aim/fire, tutorial and combat feedback
  - enemy stone drop, enhancement success/failure, stone consumption and +10 cap
  - transcendence conversion, 1000/1250 thresholds, permanent stat application and save persistence
  - stage/boss rotation, telegraphs, wall-blocked boss barrage and slam dodge/damage behavior
  - character selection persistence, v6->v7 migration, universal dash dodge, all four active skills/passives and sniper lock visuals
  - boss 3-phase thresholds/core windows, signature casts, affix/set combat application, gear lock/reroll/filter, elite affixes, objectives and 568x320 layout
  - v7->v8 migration, mod parts persistence and debrief statistics
  - v8->v9 daily contract migration, daily chip/overlay layout at all three test sizes and claim-once behavior
  - fog-free main view with fogged minimap; backpack discard -> ground pickup after walking away; cardinal-assist movement with global pointer tracking

## Release
1. Edit and test locally.
2. Bump CACHE_NAME in sw.js on every release.
3. Commit and push main; Netlify deploys automatically.
4. Wait for deploy and smoke-test production.

## Known environment issues
- GitHub SSH push from WSL sometimes returns Permission denied (publickey) or remote Internal Server Error. Retry after 30-60 seconds.
- Browser navigation may log Uncaught (in promise) Object. Fresh-page flow tests did not reproduce a user-visible issue; investigate async image/audio loads if needed.
- Avoid literal special Unicode graphic glyphs in PowerShell command payloads.

## Boss challenge mode (shipped in v43)

Six bosses are now playable as standalone stages. Pressing 开始行动 opens a stage list: the first entry is 常规行动 (unchanged risk picker + multi-floor descent), followed by six boss cards with difficulty buttons 1-6.

- 开始行动 no longer starts a raid directly; it opens `stageOverlay`. `startNormalBtn` starts a normal raid.
- `startRaid({ bossId, difficulty })` sets `raid.challenge = { bossId, name, difficulty }` and `raid.floor = difficulty * 5`, so all existing floor scaling (enemy count/HP/damage/loot, boss scaling) reuses the old F(5N) numbers.
- `generateWorld` spawns the selected boss by forcing the challenge variant; without a challenge it falls back to `bossVariantForFloor`.
- Boss stages are single-layer: the extraction card hides 继续下一层 and says the run settles on extraction. The extraction point exists from the start, so killing the boss is optional.
- Key room, room objectives and containers are kept inside boss stages; reinforcements/overtime apply there too, which is the point of a place you cannot descend from.
- Verified: stage list renders 6 cards x 6 difficulty buttons; titan at difficulty 5 gives floor 25, the titan boss and 27 enemies; the extraction card hides the deeper button; normal raids still start at floor 1 with no boss; no JS errors.

## Boss weapons, drops (shipped in v44)

Each boss now drops its own legendary weapon plus a collectible material instead of the shared `w_boss` (which still exists in saves but no longer drops).

| Boss | Weapon id / name | Feel | Material |
|---|---|---|---|
| titan | `w_quake` 裂地炮 INT-90 | 5-pellet scatter, 26 dmg each, heavy shake | mat_titan 泰坦合金 |
| prism | `w_prism` 棱镜步枪 PRISM-7 | fast 22 dmg automatic, 27 mag | mat_prism 棱镜碎片 |
| tyrant | `w_flame` 熔核喷射器 HF-13 | 12 dmg at 0.06s, 80 mag, short range | mat_magma 熔渣核心 |
| omega | `w_gravity` 引力枪 OMEGA-Ω | 34 dmg piercing-ish single shots | mat_void 虚空残片 |
| wraith | `w_phase` 相位刃枪 NX-9 | 16 dmg at 0.09s, 36 mag, fast reload | mat_phase 相位碎片 |
| architect | `w_array` 终焉阵列炮 ARK-∞ | 120 dmg, 3 mag, huge shake | mat_arch 终焉核心 |

- Materials use the new `collectible` kind: sellable, cannot be equipped, and they are what the future collector room accepts (weapons/backpacks/stones are NOT accepted).
- Drop logic: `BOSS_DROPS[bossVariant.id]` in `die()`; the weapon drops at the boss position and the material 1-2 units beside it. Verified all six bosses at difficulties 1-6 drop the matching weapon + material, with the stage floor equal to 5N and no JS errors.

## Collector room (shipped in v45)

- Entry: 「收藏」 chip in the top-right stat row next to 合约 (no seventh manage card). Save schema is now v10 (`save.collector.level`).
- Only accepts the new **collectible** kind (the six boss materials). Weapons, backpacks and enhancement stones are not accepted — the owner rejected donating usable gear. `collectibleCount()` counts them in the stash.
- The Nth donation costs N collectibles (1, 2, 3, ...), consumed from the stash from the end. Each level grants one permanent, fixed-order bonus.
- Tiers: search speed +8%, flat attack +1, attack +1.5%, max HP +5, move speed +1%, crit +1%, scrap +5%, mod-part drop +8% (8 tiers).
- Wiring: `collectorBonuses()` is read in the Player constructor (maxHp/speed/damageMultiplier/critChance/flatDamage); flat damage is added per bullet; search duration becomes `2.0 / (1 + searchSpeed)`; scrap gains multiply by `1 + scrap`; `gainModParts()` rolls +1 per part with the partDrop chance.
- Verified: 6 collected materials -> donate 1 (level 1, have 5) -> donate 2 (level 2, have 3) -> donate 3 (level 3, have 0); bonuses object accumulates correctly; save version 10; collector window renders 8 tiers with activated/next/locked states at 932x430; no JS errors.
- Extension pool for later tiers: medkit effect +10%, 30 temp shield on entering a new floor, extraction dwell -0.5s, armor reduction +1%, backpack +2 slots, secure box +1 slot, shop discount 5%, item value on extraction +5%, enhancement success +2%, transcendence yield +5%, sell price +5%, reload speed +5%, dash CD -0.2s, skill CD -3%, crit damage +10%, auto-lock range +30px, enemy vision -3%, boss damage +3%, daily contract reward +10%.

## Planned: side systems backlog (agreed order, not started)

Owner approved these; pick one when work resumes. None of them change the six-card manage grid.

1. **Weapon mods** — three slots per weapon (optic: spread/range/crit, magazine: capacity/reload/fire rate, barrel: damage/pierce/knockback). Mods drop from enemies/containers/bosses, have rarity tiers, install on a weapon and can be removed at a mod-part cost.
2. **Faction reputation** — three factions (拾荒者 / 军方 / 黑市) each with exclusive gear and a reputation shop: 拾荒者 = recycler mods + salvage station, 军方 = standard-issue guns + armory discount + supply drop, 黑市 = smuggler affix gear + reroll discount + legendary pity box. Reputation rises from extractions/kills/objectives; leaning into one faction levels it faster.
3. **Daily survival run** — single-player, so no leaderboard and no "beat yesterday": one fixed-seed map per day, and the goal is a concrete survival target (reach X minutes alive). Hitting the target grants the reward; tie tiers to the target (e.g. 3/5/8 minutes) with escalating payouts instead of comparing personal records.
4. **Radio logs / lore fragments** — 1-2 audio logs per floor, collected into an archive, a finished series unlocks background story plus a small reward.
5. **Kill slow-mo** — ~0.15s slow motion + slight zoom + shake on the final hit. Must ship with its own settings toggle.
6. **Weather / time of day** — visual + vision only (no audio, no hearing mechanics): rain = rain streaks + wet floor + slightly shorter sight, fog = shorter enemy aggro range, night = darker with a light radius near the player.
7. **Rescue objective** — a trapped NPC/ally spawns on the map; escort them to extraction for bonus rewards, they take damage on the way.
8. **Raid insurance** — pay scrap before deploying; on death, refund 30-50% of the loot value estimate, premium is lost on success.
9. **Summoner enemy** — a support archetype that keeps spawning minions until killed; forces target priority.
10. **Package thief (softened)** — a rare elite that grabs one backpack item and runs instead of shooting; the item is dropped back when it dies, and only truly lost if it escapes the map edge. Always show a "被偷了：xxx" toast.
11. **Black market auction / daily deals** — 3 random items per day at a discount, refreshed daily, gone next day.
12. **Achievements** — kill counts, extraction totals, boss clears; grant titles and small rewards.
13. **More weapon types** — grenade launcher and flamethrower (numbers below).

### Planned weapon numbers (for the new types)

- **榴弹发射器 GL-40** (epic): damage 70, cooldown 1.1s, mag 4, reload 2.4s, spread 0.02, speed 620, range 520, semi-auto, reserve 20. Shells explode on impact: 60px radius, 60% splash damage, brief camera shake. Needs a new bullet kind that spawns a hazard/AOE on hit.
- **火焰喷射器 FT-13** (epic): damage 12 per puff, cooldown 0.06s, mag 80, reload 3.0s, spread 0.18, speed 520, range 260, full-auto, reserve 240. Hits apply a 2s burn (4 dmg/s). Needs a burning status on enemies plus a short flame particle stream instead of bullet sprites.

## Planned: enhancement rework (design agreed, not started)

Owner wants the enhancement stone tiers to actually matter. Keep "failure consumes one stone and never downgrades" (owner explicitly rejected the downgrade rule).

- **Tier gate**: +1~+2 white, +3~+5 green, +6~+7 blue, +8~+9 purple, +10 red. Colorful works anywhere. Using a stone below the gate is refused with a hint instead of a roll.
- **Success decay**: `actual = max(0.05, stone.success - targetLevel * 0.03)`. Examples: +8 purple = 51%, +10 red = 60%, colorful stays 100%.
- **Luck pity**: each failure adds +10% luck; at 100% the next attempt is guaranteed; luck resets on success.
- **Fusion**: 3 stones of the same tier fuse into 1 of the next tier (white→green→blue→purple→red), always succeeds, colorful is top tier and cannot be fused. UI goes in the enhancement window below the stone list, showing owned counts per tier.
- Expected math: getting one item to +10 costs roughly 5-6 red stones (60% + pity), i.e. ~400-500 white-stone equivalents.

## Suggested next steps
- Test floating and fixed sticks on a real phone.
- Check long combat sessions on a low-end phone.
- Verify the main view has no radial fog while the minimap/full map still hide unexplored tiles; test discard/repick and touch movement on a real phone.
- Check minimap fog readability and touch movement feel on a real phone; adjust VISION_RADIUS only for exploration/minimap, not main-view rendering.
- Verify old level/perk saves still migrate cleanly after the next data-format change.
- Daily challenges are the next content candidate; keep them compact and avoid adding a base progression panel.
- Daily contracts shipped in v32 — next candidates: a weekly streak line inside the same overlay, or per-contract bonus modifiers (e.g. "clear F5 with a boss contract"). Keep the 3-goal cap and the claim-once rule.
- Monitor whether the exposed-core windows make boss fights too easy; tune weak-point duration or phase attack density rather than removing the phase system.
- Art pass 4 (planned, start here): match the owner's reference screenshot more closely.
  1. Standing side-view sprites: in `drawCharacter`, replace the full-body `ctx.rotate(entity.angle)` with a horizontal flip (`ctx.scale(-1,1)` when `Math.cos(angle) < 0`). Keep the ground shadow and overhead health bar upright (draw them before the flip). Keep the gun pointing along `entity.angle` by drawing the gun/muzzle in a separate rotated block so aim still reads.
  2. Chibi proportions: head 10x10, slightly shorter torso, 2-frame leg walk driven by `walkPhase`.
  3. Heavy UI: 2px frames, cut corners via clip-path or corner pseudo-elements, brighter section headers. Must keep 932x430 / 667x375 / 568x320 free of page scroll and inner overflow.
  4. Test: left/right facing flip, aim readability, boss 1.45 scale, health-bar alignment, four characters, six enemy archetypes, no JS errors, all three layouts.
- Later art ideas: real bitmap sprite sheet (4 characters x 2 walk frames, 6 enemy archetypes), per-room light pools already shipped, parallax backdrop. Keep everything out of `performanceMode`'s cost path and never bake per-frame gradients for the floor.