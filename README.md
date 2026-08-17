# Space Waves 2D

A fast-paced 2D space shooter built with vanilla JavaScript and Vite. Navigate waves of enemies, manage boost fuel, collect pickups, chain kill combos, and choose upgrades between waves. A boss appears every 5th wave.

## Features

- **Fixed-timestep engine** (60Hz) — identical game speed on 60/120/144Hz displays
- **Pre-rendered glow sprites** — crisp HiDPI rendering with no per-frame shadowBlur cost
- **Distinct enemy AIs:** Scout (kiting strafe), Fighter (chase), Tank (3-shot spread), Sniper (telegraphed high-velocity beam), Blocker (intercepts and blocks escape lanes), and the **Overlord boss** every 5 waves with 3 cycling attack patterns
- **Wave families** — each wave draws from a family (swarm, precision, movement, panic) that shapes enemy mix and pacing; the game never repeats a family back-to-back
- **Fair spawning** — enemies telegraph with a blinking marker before materializing
- **Aim assist with lead prediction** and smooth ship rotation
- **Boost fuel system** — hold Shift to boost; fuel drains while boosting and regenerates when not. Fuel pickups (dropped by enemies) restore a chunk of fuel. Boost is unavailable at empty fuel until a recovery threshold is met.
- **Upgrade cards with roles** — between waves, pick from 3 rarity-weighted cards. Each card shows its role (Survival, Precision, Risk, Mobility, Utility, Horde) and kind (Reward or Tradeoff) so you can weigh benefit vs. cost before committing
- **Perfect Clear scoring** — end a wave with zero unshielded hits to earn a bonus that scales with wave number. Score comes from kills, combo multiplier (×1–×5), and Perfect Clears — not from waiting.
- **Run Debrief** — on death, a heuristic analysis identifies the primary cause (swarm pressure, low mobility, cornered, missed telegraph, etc.) and suggests a fix. Your build summary and run stats are displayed.
- **Learn-by-playing onboarding** — five contextual hints appear once per profile as you discover each mechanic (movement, boost, fuel, spawn warnings, upgrades). A reset button on the start screen restores them.
- **Synthesized audio** (Web Audio, no assets) with mute toggle; distinct sounds for hits, shield absorption, pickups, and UI
- **Persistence** via localStorage: high score and completed onboarding hints survive between sessions
- Full game feel: screen shake, hit-flash, shockwave rings, bullet trails, engine flame, spawn warnings, low-health vignette, wave banners

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
- Player: accel, boost multiplier/drain/regen, fire rate, auto-fire range, contact damage
- Enemy types: speed, HP, fire rate, bullet speed/damage, behavior parameters
- Wave families: enemy weights, batch size range, spawn delay range, breathing intervals
- Spawn system: batch size, delay, warning time, near-player chance
- Pickups: drop chance, fuel restore amount, magnet radius, lifetime
- Perfect Clear: base bonus and per-wave scaling
- Run Debrief: heuristic thresholds for death analysis
- Onboarding: hint display durations

### Design Principles

- Skill-first: no passive score drip; movement and positioning are the primary survival tools
- Readable pressure: every threat has a visible telegraph or warning
- Meaningful choices: no upgrade is strictly dominant; tradeoffs create build variety
- Fuel as decision-making: boost creates options but not requirements; normal movement is always viable

## License

MIT
