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
- PWA cache: sw.js, current CACHE_NAME pixel-extract-v18
- Save key: localStorage pixel_extract_save_v1
- Latest maintenance: level-up perk choices, 75-degree front auto-lock cone, compact debrief (see git log)

## Current UI
- Mobile landscape one-screen layout; base has two columns: loadout and manage center.
- Top-left shows PX mark, level and XP only. The old title is removed.
- Manage center directly shows three entry cards: equipment, stash, black market.
- Each card opens its own independent window. No tabs, no extra manage-window entry.
- All three windows fit without vertical scrolling at tested sizes.
- The old progression panel was removed and must not be re-added.
- Level-up growth is a focused 3-choice modal shown after debrief; current perks are summarized inside the equipment window.
- Debrief and perk-choice cards fit without scrolling at 932x430, 667x375 and 568x320.

## Must keep
- No separate fire button.
- Aim pad: light touch aims, hold about 0.15s fires, drag to aim.
- Touch auto-lock on nearest visible enemy in front.
- Stand near a container for 2 seconds to auto-search; moving, damage or reload interrupts.
- Stay in extraction zone for 3 seconds to extract.
- Keep risk picker, random events, stash filter/sell-common, save export/import and touch settings.
- Keep the base one-screen on mobile landscape; do not add scrolling panels.
- Keep auto-lock restricted to enemies in front of the aim direction (75-degree cone).
- Keep level-up choices as a compact modal, not a base progression panel.

## Recent work
- First-raid four-step tutorial: move, search, combat, extract. Skippable, shows once.
- Combat feedback: hit marker, red kill marker, damage-direction arrow, low-HP edge pulse.
- Movement optimization: cached stick geometry, input dead zone and smoothing, HUD/minimap throttling, cached vignette gradient, particle caps.
- Added permanent level-up perks with 3 random choices, save migration, pending-choice recovery and perk summary in the equipment window.
- Fixed touch auto-lock selecting enemies behind the player; it now uses a 75-degree front cone.
- Compacted the debrief stat grid so the return button is visible without scrolling in landscape.
- Production tested at 932x430, 667x375 and 568x320: no page scroll, manage windows no scroll, debrief/perk cards no scroll; touch movement and two-finger move plus aim/fire work.

## Run and test
- Local: run python -m http.server 8080 in the workspace, then open http://127.0.0.1:8080/index.html
- Or double-click the Chinese start batch file.
- Debug bridge: window.__PX with startRaid(), snapshot(), enableTouch(), touchMove(), hurt(), grantPerkChoices(), grantXP().
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
- Test perk selection and pending-choice recovery on a real phone.
- Daily challenges are the next content candidate; keep them compact and avoid adding a base progression panel.