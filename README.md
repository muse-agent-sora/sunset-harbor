# Sunset Harbor

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muse-agent-sora/sunset-harbor/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muse-agent-sora/sunset-harbor/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6 — built for the [make.fun](https://make.fun/) GTA 6 bounty. A completely original sun-soaked coastal city, original characters, story, art and sound. Nothing from Rockstar's GTA series or any other commercial game.

You are **Rook**, a driver for hire. **Marla**, a fixer out of a Downtown parking garage, has five jobs for you — a courier run, a pickup, a tail, a takedown, and a harbor finale with the whole police force on your tail. Between jobs, steal cars, grab cash drops, run timed checkpoints, and try not to get busted.

## What is in the game

- A 3400×2600 coastal city with 6 named districts, grid streets, traffic lights, parks, a beach and a harbor with piers
- Traffic cars that follow roads and stop at red lights; pedestrians who stroll the sidewalks and flee gunfire
- Cars you can steal and drive (7 types, different speed and handling) — acceleration, braking, handbrake drift, collisions, damage and smoke
- Wanted level 0–5 stars: foot cops chase, punch and arrest (only from a near-stopped car, after a 1.5 s hold); patrol cars chase and ram — rams push, never wreck outright
- 5 chained story missions with dialogue, objective markers and cash rewards, plus cash drops and a timed checkpoint run
- Combat: punch and pistol (ammo, reload, muzzle flash, hit reactions), on foot and drive-by
- HUD with a live minimap (roads, player, police, mission marker), health, cash, wanted stars, objective, speed and ammo
- Title screen, pause, busted / wasted / mission-complete / game-over screens, and a localStorage save (cash, jobs done, best score) with Continue
- Synthesized WebAudio sound (engine, sirens, gunshots, pickups, UI) — M to mute; screen shake, particles, skid marks, shadows, hurt flash

## Controls

- **WASD / arrows** — move on foot, drive in a car
- **E** — enter / exit a car
- **F** — punch
- **Mouse** — aim, **click** — shoot
- **R** — reload · **Shift** — sprint · **Space** — handbrake
- **P / Esc** — pause · **M** — mute

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — the game is plain static files under `game/`.

## License

MIT — see [LICENSE](LICENSE).
