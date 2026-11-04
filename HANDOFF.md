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
- PWA cache: sw.js, current CACHE_NAME pixel-extract-v21
- Save key: localStorage pixel_extract_save_v1
- Latest maintenance: run-only leveling, in-raid perk choices, multi-floor extraction choice (see git log)

## Current UI
- Mobile landscape one-screen layout; base has two columns: loadout and manage center.
- Top-left shows only the PX mark, base title and subtitle. There is no base level or XP bar.
- Manage center directly shows three entry cards: equipment, stash, black market.
- Each card opens its own independent window. No tabs, no extra manage-window entry.
- All three windows fit without vertical scrolling at tested sizes.
- The old progression panel was removed and must not be re-added.
- In-raid HUD shows run level, floor, XP, HP, ammo and backpack.
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
- Keep the base one-screen on mobile landscape; do not add scrolling panels.
- Mobile auto-lock must choose the nearest visible enemy in weapon range even when the player is moving backwards. Desktop auto-lock keeps the 75-degree front cone.
- Keep level-up choices as an in-raid compact modal, not a base progression panel.
- Continuing to the next floor keeps the current run's level, perks, HP, ammo and backpack.
- Enemy HP, damage, count and rare-loot chance scale with floor depth.

## Recent work
- First-raid four-step tutorial: move, search, combat, extract. Skippable, shows once.
- Combat feedback: hit marker, red kill marker, damage-direction arrow, low-HP edge pulse.
- Movement optimization: cached stick geometry, input dead zone and smoothing, HUD/minimap throttling, cached vignette gradient, particle caps.
- Reworked progression to be run-only: base level/XP and permanent perks were removed; every run starts at LV.1.
- Kills and loot grant run XP; level-ups open a paused 3-choice perk modal. Perk effects apply to the current run only.
- Extraction now opens a choice card: continue to the next floor with the current run, or return to base and settle loot.
- Floor scaling raises enemy count, HP, damage and rare-loot chance without using a persistent player level.
- Auto-lock now works on desktop hold-fire with the front cone, while mobile touch lock chooses the nearest visible enemy regardless of facing; HUD shows state.
- Compacted debrief/perk cards and added a compact extraction-choice card.
- Local tested at 932x430, 667x375 and 568x320: no page scroll, manage windows no scroll, debrief/perk/extraction cards no scroll; real 3-second extraction flow and multi-floor carry-over work.

## Run and test
- Local: run python -m http.server 8080 in the workspace, then open http://127.0.0.1:8080/index.html
- Or double-click the Chinese start batch file.
- Debug bridge: window.__PX with startRaid(), snapshot(), enableTouch(), touchMove(), hurt(), grantPerkChoices(), grantXP(), openExtractionChoice(), continueToNextFloor(), returnFromExtraction().
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
- Test in-raid perk selection, multi-floor balance, auto-lock and the extraction choice on a real phone.
- Verify old level/perk saves still migrate cleanly after the next data-format change.
- Daily challenges are the next content candidate; keep them compact and avoid adding a base progression panel.