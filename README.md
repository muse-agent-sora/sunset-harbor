# Sunset Harbor

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muse-agent-sora/sunset-harbor/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muse-agent-sora/sunset-harbor/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in a sun-soaked coastal city, built for the
[make.fun](https://make.fun/) GTA 6 bounty. No real places, people or brands —
only Sunset Harbor.

## The game

You are Rook, a driver-for-hire in Sunset Harbor. Steal cars, outrun the
police, and run five jobs for Marla, a fixer with a garage in Old Town:

1. **First Job** — take the sports car and deliver it to the Marina.
2. **The Package** — pick up a package at Harbor Plaza, past its guards.
3. **Hot Wheels** — lose a two-star wanted level and reach the Safehouse.
4. **Dockside Score** — grab three crates at the Docks and bring them back.
5. **The Sunset Run** — five checkpoints, coast to coast, against the clock.

Plus free-roam side work: cash drops scattered around the city and a timed
courier run at the plaza (press T).

- A city to explore on foot and by car: six named districts, traffic lights,
  parks, a beach and a harbor with piers and boats.
- Traffic cars that follow the roads and stop at red lights; pedestrians who
  stroll the sidewalks and scatter when shots are fired.
- Cars to steal and drive — sedans, sports cars, cabs, trucks and vans, each
  with its own speed and handling, handbrake drift and damage.
- A wanted level (1–5 stars) with foot cops who chase and arrest, and police
  cars that chase and ram. Lose the heat by staying out of sight.
- Combat on foot and drive-by: punch, pistol, ammo and reload, enemy thugs.
- HUD with a live minimap (roads, player, police, mission marker), health,
  cash, wanted stars, objective, speed and ammo.
- Title screen, pause, busted / wasted screens with score and restart, and a
  save in localStorage (cash, jobs done, best score) with Continue.
- Synthesized sound (engine, sirens, gunshots, pickups) with mute, screen
  shake, particles, skid marks and golden-hour light.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Enter / steal a car, advance dialogue |
| F | Punch |
| Mouse aim + click | Shoot |
| R | Reload |
| Shift | Sprint |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |
| T | Courier run / start the next job |

## How to run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No build step, no
network requests — the game is static files under `game/`.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged
with `?shot=start|play|mission|end` (see `shots.json`): the title screen, a
police chase, a mission in progress, and the busted screen.

## License

MIT — see [LICENSE](LICENSE).
