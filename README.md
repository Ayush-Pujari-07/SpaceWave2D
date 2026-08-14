# Space Waves 2D

A fast-paced 2D space shooter built with vanilla JavaScript and Vite. Navigate waves of enemies, manage boost fuel, collect pickups, and choose upgrades between waves.

## Features

- Modular 2D game loop with canvas rendering
- Randomized wave spawning with batch spawning and near-player surprises
- Four enemy types: Scout, Fighter, Tank, Sniper
- Auto-fire with aim assist
- Boost mechanic with fuel regeneration
- Shield pickups and health management
- Upgrade screen after each wave
- Polished HUD with wave progress, health, shield, boost, and enemy count
- Pause, restart, and game over screens

## Tech Stack

- HTML5 Canvas
- ES Modules
- Vite for development and build
- Vanilla JavaScript, no external game libraries

## Prerequisites

- Node.js 18+ 
- npm 9+

## Installation

1. Clone the repository
```bash
git clone <repo-url>
cd SpaceShooter
```

2. Install dependencies
```bash
npm install
```

## Setup and Run

### Development server

Start Vite dev server with hot reload:
```bash
npm run dev
```

The game will open automatically at http://localhost:3000

### Build for production

Create an optimized build:
```bash
npm run build
```

Output is written to `dist/`.

### Preview production build

```bash
npm run preview
```

## Controls

- Move: WASD or Arrow Keys
- Boost: Left Shift
- Auto-fire: always on, aims at nearest enemy within range
- Pause: P or Esc
- Resume: Resume button on pause screen
- Restart: Restart button on pause or game over screen

## Project Structure

```
SpaceShooter/
├── index.html          # Game shell and UI overlays
├── package.json
├── vite.config.js
└── js/
    └── 2d/
        ├── config.js   # Game balance and enemy definitions
        ├── game.js     # Core game loop, spawning, collisions
        ├── input.js    # Keyboard input manager
        └── ui.js       # HUD and overlay management
```

## Configuration

Game balance values are in `js/2d/config.js`:
- Ship size, speed, boost rates
- Enemy types with color, speed, HP, fire rate, weight
- Spawn system parameters

## License

MIT
