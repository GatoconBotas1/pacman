# Pac-Man (3 Levels)

A simple browser-based Pac-Man clone built with plain HTML5 Canvas and vanilla JavaScript — no build tools or dependencies required.

## How to play

Open `index.html` in a browser (or serve the folder with any static file server), then click **Start Game**.

- Move with **Arrow keys** or **WASD**
- Eat all the dots and power pellets to clear a level
- Power pellets (large yellow dots) temporarily let you eat ghosts for bonus points
- Press **P** to pause/resume
- You have 3 lives; the game ends when you run out or clear all 3 levels

## Levels

The game has **3 levels** using the same maze layout, with increasing difficulty:

| Level | Ghosts | Ghost Speed | Frightened Time |
|-------|--------|-------------|------------------|
| 1     | 1      | Normal      | 7s               |
| 2     | 2      | Faster      | 6s               |
| 3     | 3      | Fastest     | 5s               |

## Files

- `index.html` — page structure and HUD
- `style.css` — visual styling
- `game.js` — game logic (maze, movement, ghost AI, collisions, level progression)
