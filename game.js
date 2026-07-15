// ---------------------------------------------------------------------------
// Simple Pac-Man — 3 levels, canvas + vanilla JS, no dependencies.
// ---------------------------------------------------------------------------

const CELL = 24;

// Symmetric 15x15 maze. # = wall, . = dot, o = power pellet, space = open path.
const MAZE_TEMPLATE = [
  "###############",
  "#.............#",
  "#.###.#.#.###.#",
  "#o###.#.#.###o#",
  "#.............#",
  "#.###.###.###.#",
  "#.....#.#.....#",
  "###.###.###.###",
  "#.....#.#.....#",
  "#.###.###.###.#",
  "#.............#",
  "#o###.#.#.###o#",
  "#.###.#.#.###.#",
  "#.............#",
  "###############",
];

const ROWS = MAZE_TEMPLATE.length;
const COLS = MAZE_TEMPLATE[0].length;

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  none: { dx: 0, dy: 0 },
};

const PACMAN_START = { col: 7, row: 13 };
const GHOST_START = { col: 7, row: 7 };
const GHOST_COLORS = ["#ff4d4d", "#ff9dff", "#4dd2ff"];

const LEVELS = [
  { ghostCount: 1, ghostSpeed: 1.6, pacSpeed: 2.0, frightenedTime: 7000 },
  { ghostCount: 2, ghostSpeed: 1.9, pacSpeed: 2.0, frightenedTime: 6000 },
  { ghostCount: 3, ghostSpeed: 2.2, pacSpeed: 2.0, frightenedTime: 5000 },
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("startBtn");

let grid = [];
let score = 0;
let lives = 3;
let levelIndex = 0;
let dotsRemaining = 0;
let pacman = null;
let ghosts = [];
let running = false;
let paused = false;
let frightenedUntil = 0;
let lastTime = 0;
let animTick = 0;

function isWall(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return grid[row][col] === "#";
}

function cloneMaze() {
  return MAZE_TEMPLATE.map((row) => row.split(""));
}

function countDots() {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === "." || grid[r][c] === "o") count++;
    }
  }
  return count;
}

function makeEntity(col, row, speed) {
  return {
    col,
    row,
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
    dir: "none",
    nextDir: "none",
    speed,
  };
}

function setupLevel(index) {
  const cfg = LEVELS[index];
  grid = cloneMaze();
  grid[PACMAN_START.row][PACMAN_START.col] = " ";
  grid[GHOST_START.row][GHOST_START.col] = " ";
  dotsRemaining = countDots();

  pacman = makeEntity(PACMAN_START.col, PACMAN_START.row, cfg.pacSpeed);

  ghosts = [];
  const spawnOffsets = [
    { col: 0, row: 0 },
    { col: -1, row: 0 },
    { col: 1, row: 0 },
  ];
  for (let i = 0; i < cfg.ghostCount; i++) {
    const off = spawnOffsets[i % spawnOffsets.length];
    const g = makeEntity(GHOST_START.col + off.col, GHOST_START.row + off.row, cfg.ghostSpeed);
    g.color = GHOST_COLORS[i % GHOST_COLORS.length];
    g.frightened = false;
    ghosts.push(g);
  }
  frightenedUntil = 0;
}

function resetGame() {
  score = 0;
  lives = 3;
  levelIndex = 0;
  updateHud();
  setupLevel(levelIndex);
}

function updateHud() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = levelIndex + 1;
}

function isAligned(entity) {
  const cx = entity.col * CELL + CELL / 2;
  const cy = entity.row * CELL + CELL / 2;
  return Math.abs(entity.x - cx) < 1 && Math.abs(entity.y - cy) < 1;
}

function snapToGrid(entity) {
  entity.x = entity.col * CELL + CELL / 2;
  entity.y = entity.row * CELL + CELL / 2;
}

function canMove(col, row, dir) {
  const d = DIRS[dir];
  if (!d || (d.dx === 0 && d.dy === 0)) return false;
  return !isWall(col + d.dx, row + d.dy);
}

function tryTurn(entity) {
  if (entity.nextDir !== "none" && isAligned(entity)) {
    if (canMove(entity.col, entity.row, entity.nextDir)) {
      entity.dir = entity.nextDir;
    }
  }
  if (isAligned(entity) && !canMove(entity.col, entity.row, entity.dir)) {
    entity.dir = "none";
  }
}

function moveEntity(entity, dt) {
  tryTurn(entity);
  if (entity.dir === "none") return;
  const d = DIRS[entity.dir];
  const dist = entity.speed * dt * 60;
  entity.x += d.dx * dist;
  entity.y += d.dy * dist;

  const targetCol = Math.round((entity.x - CELL / 2) / CELL);
  const targetRow = Math.round((entity.y - CELL / 2) / CELL);
  if (targetCol !== entity.col || targetRow !== entity.row) {
    if (isAligned2(entity, targetCol, targetRow)) {
      entity.col = targetCol;
      entity.row = targetRow;
    }
  }

  // wrap horizontally through side tunnels (row 1 middle row of open corridor)
  if (entity.x < -CELL / 2) {
    entity.x = COLS * CELL + CELL / 2;
    entity.col = COLS - 1;
  } else if (entity.x > COLS * CELL + CELL / 2) {
    entity.x = -CELL / 2;
    entity.col = 0;
  }
}

function isAligned2(entity, col, row) {
  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2;
  return Math.abs(entity.x - cx) < CELL / 2 && Math.abs(entity.y - cy) < CELL / 2;
}

function chooseGhostDirection(ghost) {
  if (!isAligned(ghost)) return;
  const opposite = { up: "down", down: "up", left: "right", right: "left" };
  const options = Object.keys(DIRS).filter(
    (dir) => dir !== "none" && canMove(ghost.col, ghost.row, dir)
  );
  if (options.length === 0) return;

  const nonReverse = options.filter((d) => d !== opposite[ghost.dir]);
  const candidates = nonReverse.length > 0 ? nonReverse : options;

  if (ghost.frightened) {
    ghost.nextDir = candidates[Math.floor(Math.random() * candidates.length)];
    return;
  }

  // Chase: pick the direction that most reduces distance to pac-man, with some randomness.
  if (Math.random() < 0.2) {
    ghost.nextDir = candidates[Math.floor(Math.random() * candidates.length)];
    return;
  }
  let best = candidates[0];
  let bestDist = Infinity;
  for (const dir of candidates) {
    const d = DIRS[dir];
    const nc = ghost.col + d.dx;
    const nr = ghost.row + d.dy;
    const dist = (nc - pacman.col) ** 2 + (nr - pacman.row) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }
  ghost.nextDir = best;
}

function eatAt(col, row) {
  const cell = grid[row][col];
  if (cell === ".") {
    grid[row][col] = " ";
    score += 10;
    dotsRemaining--;
    updateHud();
  } else if (cell === "o") {
    grid[row][col] = " ";
    score += 50;
    dotsRemaining--;
    frightenedUntil = performance.now() + LEVELS[levelIndex].frightenedTime;
    ghosts.forEach((g) => (g.frightened = true));
    updateHud();
  }
}

function respawnGhost(ghost) {
  ghost.col = GHOST_START.col;
  ghost.row = GHOST_START.row;
  snapToGrid(ghost);
  ghost.dir = "none";
  ghost.nextDir = "none";
  ghost.frightened = false;
}

function loseLife() {
  lives--;
  updateHud();
  if (lives <= 0) {
    endGame(false);
    return;
  }
  pacman.col = PACMAN_START.col;
  pacman.row = PACMAN_START.row;
  snapToGrid(pacman);
  pacman.dir = "none";
  pacman.nextDir = "none";
  ghosts.forEach(respawnGhost);
}

function checkCollisions() {
  for (const ghost of ghosts) {
    const dx = ghost.x - pacman.x;
    const dy = ghost.y - pacman.y;
    if (Math.abs(dx) < CELL * 0.6 && Math.abs(dy) < CELL * 0.6) {
      if (ghost.frightened) {
        score += 200;
        updateHud();
        respawnGhost(ghost);
      } else {
        loseLife();
      }
      return;
    }
  }
}

function endGame(won) {
  running = false;
  overlay.style.display = "flex";
  if (won) {
    overlayTitle.textContent = "YOU WIN!";
    overlayMessage.textContent = `You cleared all 3 levels with a final score of ${score}!`;
  } else {
    overlayTitle.textContent = "GAME OVER";
    overlayMessage.textContent = `Final score: ${score}. Try again?`;
  }
  startBtn.textContent = "Play Again";
}

function nextLevel() {
  levelIndex++;
  if (levelIndex >= LEVELS.length) {
    endGame(true);
    return;
  }
  running = false;
  overlay.style.display = "flex";
  overlayTitle.textContent = `LEVEL ${levelIndex + 1}`;
  overlayMessage.textContent = `Get ready! Ghosts are faster now.`;
  startBtn.textContent = "Continue";
  setupLevel(levelIndex);
}

function update(dt) {
  if (frightenedUntil && performance.now() > frightenedUntil) {
    frightenedUntil = 0;
    ghosts.forEach((g) => (g.frightened = false));
  }

  moveEntity(pacman, dt);
  eatAt(pacman.col, pacman.row);

  ghosts.forEach((g) => {
    chooseGhostDirection(g);
    moveEntity(g, dt);
  });

  checkCollisions();

  if (dotsRemaining <= 0) {
    nextLevel();
  }
}

function drawMaze() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const x = c * CELL;
      const y = r * CELL;
      if (cell === "#") {
        ctx.fillStyle = "#2121ff";
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      } else if (cell === ".") {
        ctx.fillStyle = "#ffd8a8";
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === "o") {
        ctx.fillStyle = "#ffe600";
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPacman() {
  const mouth = 0.2 + 0.15 * Math.abs(Math.sin(animTick / 6));
  const angles = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
    none: 0,
  };
  const angle = angles[pacman.dir] ?? 0;
  ctx.save();
  ctx.translate(pacman.x, pacman.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffe600";
  ctx.beginPath();
  ctx.arc(0, 0, CELL / 2 - 2, mouth * Math.PI, (2 - mouth) * Math.PI);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhosts() {
  ghosts.forEach((g) => {
    ctx.fillStyle = g.frightened ? "#3b3bff" : g.color;
    const r = CELL / 2 - 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, Math.PI, 0);
    ctx.lineTo(g.x + r, g.y + r);
    for (let i = 0; i < 3; i++) {
      const step = (r * 2) / 3;
      ctx.lineTo(g.x + r - step * (i + 0.5), g.y + r - 4);
      ctx.lineTo(g.x + r - step * (i + 1), g.y + r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(g.x - 4, g.y - 2, 3, 0, Math.PI * 2);
    ctx.arc(g.x + 4, g.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g.frightened ? "#fff" : "#003";
    ctx.beginPath();
    ctx.arc(g.x - 4, g.y - 2, 1.4, 0, Math.PI * 2);
    ctx.arc(g.x + 4, g.y - 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function render() {
  drawMaze();
  drawPacman();
  drawGhosts();
}

function loop(timestamp) {
  if (!running) return;
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  animTick++;

  if (!paused) {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

document.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.key];
  if (dir) {
    pacman.nextDir = dir;
    e.preventDefault();
  } else if (e.key === "p" || e.key === "P") {
    paused = !paused;
  }
});

startBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  if (!running) {
    if (startBtn.textContent === "Play Again") {
      resetGame();
    }
    running = true;
    lastTime = 0;
    requestAnimationFrame(loop);
  } else {
    running = true;
    lastTime = 0;
    requestAnimationFrame(loop);
  }
});

resetGame();
render();
