# gta6-harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JEPEHHH/gta6-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JEPEHHH/gta6-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Blackwater Harbor** — an original open-world crime game that runs in the browser from static files: a sun-soaked harbour city with docks, downtown towers, suburbs, a park and a beach, day/night lighting, on-foot play, stealable traffic, police with a wanted level, missions with dialogue, and a Canvas2D renderer written from scratch (no libraries, no network at run time). Entry for the [make.fun](https://make.fun/bounty/gta6-01) *Make GTA 6* bounty.

## Run it

```sh
node main.ts          # writes out/ : the game, its four screenshots and dossier.json
node serve.ts         # serves game/ at http://localhost:8080 (open it in desktop Chrome)
```

No build step, no package install: the game is the ES modules under `game/`, and every asset is drawn by its own code.

## What the judge sees

- `screenshots/1-cover.png` — cover screen over Blackwater Harbor.
- `screenshots/2-foot.png` — on-foot exploration in the harbor city.
- `screenshots/3-car.png` — driving through city traffic.
- `screenshots/4-mission.png` — active mission play with dialogue.

Every screenshot is a real 1280x720 render of the game's own Canvas2D code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7kb24zbe&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
