# Space Waves 2D

A fast-paced 2D space shooter built with vanilla JavaScript and Vite. Navigate waves of enemies, manage boost fuel, collect pickups, chain kill combos, and choose upgrades between waves. A boss appears every 5th wave.

## Features

- **Fixed-timestep engine** (60Hz) — identical game speed on 60/120/144Hz displays
- **Pre-rendered glow sprites** — crisp HiDPI rendering with no per-frame shadowBlur cost
- **Distinct enemy AIs:** Scout (kiting strafe), Fighter (chase), Tank (3-shot spread), Sniper (telegraphed high-velocity beam), and the **Overlord boss** every 5 waves with 3 cycling attack patterns
- **Fair spawning** — enemies telegraph with a blinking marker before materializing
- **Aim assist with lead prediction** and smooth ship rotation
- **Kill combo multiplier** (×1–×5) with floating score popups
- **Synthesized audio** (Web Audio, no assets) with mute toggle
- **High score persistence** via localStorage
- Full game feel: screen shake, hit-flash, shockwave rings, bullet trails, engine flame, spawn warnings, low-health vignette, wave banners
- Rarity-weighted upgrade cards (common / rare / epic)

## Tech Stack

- HTML5 Canvas
- ES Modules
- Vite for development and build
- Vanilla JavaScript, no external game libraries

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
git clone <repo-url>
cd SpaceShooter
npm install
```

## Run

```bash
npm run dev       # dev server at http://localhost:3000
npm run build     # production build → dist/
npm run preview   # preview production build
npm test          # headless engine smoke test
```

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Shift | Boost |
| Auto-fire | Always on, leads the nearest enemy in range |
| P / Esc | Pause / Resume |
| R | Quick restart |
| M | Sound on/off |

## Project Structure

```
SpaceShooter/
├── index.html          # Game shell and UI overlays
├── smoke.mjs           # Headless engine smoke test
└── js/
    └── 2d/
        ├── config.js   # Balance: player, waves, spawn system, enemy types
        ├── game.js     # Fixed-step loop, AI, collisions, rendering
        ├── input.js    # Keyboard input (layout-independent, edge detection)
        ├── audio.js    # Synthesized SFX (Web Audio API)
        ├── sprites.js  # Pre-rendered glow sprites and background art
        └── ui.js       # HUD and overlay management
```

## Balance Tuning

All gameplay values live in `js/2d/config.js` (per-second units):
- Player accel/boost, fire rate, auto-fire range, contact damage
- Enemy types: speed, HP, fire rate, bullet speed/damage, behavior
- Wave size/growth, boss frequency, spawn batch/delay/warning parameters

## License

MIT
