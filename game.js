"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const levelElement = document.querySelector("#level");
const livesElement = document.querySelector("#lives");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const buttonLabel = document.querySelector("#button-label");
const startButton = document.querySelector("#start-button");
const levelBanner = document.querySelector("#level-banner");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_Y = HEIGHT - 54;
const keys = new Set();
const stars = Array.from({ length: 85 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  size: Math.random() * 1.5 + 0.4,
  alpha: Math.random() * 0.55 + 0.15
}));

let state = "ready";
let score = 0;
let lives = 3;
let level = 1;
let playerX = WIDTH / 2;
let playerShotCooldown = 0;
let enemyShotCooldown = 1.2;
let invulnerability = 0;
let enemies = [];
let playerShots = [];
let enemyShots = [];
let fleetDirection = 1;
let fleetOffset = 0;
let previousTime = 0;
let lastFrameTime = 0;

function createFleet() {
  enemies = [];
  fleetOffset = 0;
  fleetDirection = 1;
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      enemies.push({
        row,
        column,
        x: 112 + column * 72,
        y: 94 + row * 49,
        alive: true
      });
    }
  }
  enemyShotCooldown = Math.max(0.35, 1.15 - level * 0.06);
}

function updateHud() {
  scoreElement.textContent = String(score).padStart(6, "0");
  levelElement.textContent = String(level).padStart(2, "0");
  const icons = [...livesElement.children];
  icons.forEach((icon, index) => icon.classList.toggle("lost", index >= lives));
  livesElement.setAttribute("aria-label", `${lives} ${lives === 1 ? "vida" : "vidas"}`);
}

function showOverlay(kind) {
  if (kind === "ready") {
    overlayKicker.textContent = "TRANSMISIÓN ENTRANTE";
    overlayTitle.textContent = "Defiende la Tierra";
    overlayCopy.textContent = "Una flota alienígena se acerca. Derríbala antes de que alcance tu posición.";
    buttonLabel.textContent = "Iniciar partida";
  } else {
    overlayKicker.textContent = "SEÑAL PERDIDA";
    overlayTitle.textContent = "Fin de la partida";
    overlayCopy.textContent = `Puntuación final: ${String(score).padStart(6, "0")}. La galaxia aún necesita un héroe.`;
    buttonLabel.textContent = "Jugar de nuevo";
  }
  overlay.classList.remove("hidden");
}

function startGame() {
  if (state === "running") return;
  score = 0;
  lives = 3;
  level = 1;
  playerX = WIDTH / 2;
  playerShots = [];
  enemyShots = [];
  invulnerability = 0;
  createFleet();
  updateHud();
  state = "running";
  overlay.classList.add("hidden");
  previousTime = performance.now();
}

function endGame() {
  state = "gameover";
  showOverlay("gameover");
}

function loseLife() {
  if (invulnerability > 0 || state !== "running") return;
  lives -= 1;
  updateHud();
  playerX = WIDTH / 2;
  enemyShots = [];
  invulnerability = 1.5;
  if (lives <= 0) endGame();
}

function nextLevel() {
  level += 1;
  playerShots = [];
  enemyShots = [];
  createFleet();
  updateHud();
  levelBanner.textContent = `NIVEL ${String(level).padStart(2, "0")}`;
  levelBanner.classList.remove("show");
  void levelBanner.offsetWidth;
  levelBanner.classList.add("show");
}

function shoot() {
  if (playerShotCooldown > 0 || state !== "running") return;
  playerShots.push({ x: playerX, y: PLAYER_Y - 15 });
  playerShotCooldown = 0.28;
}

function enemyFire() {
  const columns = new Map();
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const lowest = columns.get(enemy.column);
    if (!lowest || enemy.y > lowest.y) columns.set(enemy.column, enemy);
  }
  const firingEnemies = [...columns.values()];
  if (!firingEnemies.length) return;
  const shooter = firingEnemies[Math.floor(Math.random() * firingEnemies.length)];
  enemyShots.push({
    x: shooter.x + fleetOffset + 16,
    y: shooter.y + 24,
    speed: 245 + level * 15
  });
}

function update(delta) {
  if (state !== "running") return;
  playerShotCooldown = Math.max(0, playerShotCooldown - delta);
  invulnerability = Math.max(0, invulnerability - delta);

  const horizontal = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
  playerX = Math.max(28, Math.min(WIDTH - 28, playerX + horizontal * 390 * delta));
  if (keys.has("Space")) shoot();

  const livingEnemies = enemies.filter((enemy) => enemy.alive);
  if (!livingEnemies.length) {
    nextLevel();
    return;
  }

  const leftEdge = Math.min(...livingEnemies.map((enemy) => enemy.x + fleetOffset));
  const rightEdge = Math.max(...livingEnemies.map((enemy) => enemy.x + fleetOffset + 32));
  const fleetSpeed = (39 + level * 8) * delta;
  fleetOffset += fleetDirection * fleetSpeed;
  if ((fleetDirection > 0 && rightEdge + fleetSpeed >= WIDTH - 30) ||
      (fleetDirection < 0 && leftEdge - fleetSpeed <= 30)) {
    fleetDirection *= -1;
    for (const enemy of livingEnemies) enemy.y += 18;
  }

  enemyShotCooldown -= delta;
  if (enemyShotCooldown <= 0) {
    enemyFire();
    enemyShotCooldown = Math.max(0.32, 0.95 - level * 0.045) + Math.random() * 0.45;
  }

  for (const shot of playerShots) shot.y -= 560 * delta;
  for (const shot of enemyShots) shot.y += shot.speed * delta;
  playerShots = playerShots.filter((shot) => shot.y > -12);
  enemyShots = enemyShots.filter((shot) => shot.y < HEIGHT + 12);

  for (const shot of playerShots) {
    for (const enemy of livingEnemies) {
      const enemyX = enemy.x + fleetOffset;
      if (shot.x >= enemyX && shot.x <= enemyX + 32 &&
          shot.y >= enemy.y && shot.y <= enemy.y + 25) {
        enemy.alive = false;
        shot.y = -30;
        score += (5 - enemy.row) * 10;
        updateHud();
        break;
      }
    }
  }
  playerShots = playerShots.filter((shot) => shot.y > -12);

  for (const shot of enemyShots) {
    if (Math.abs(shot.x - playerX) < 20 && Math.abs(shot.y - PLAYER_Y) < 17) {
      shot.y = HEIGHT + 20;
      loseLife();
    }
  }
  enemyShots = enemyShots.filter((shot) => shot.y < HEIGHT + 12);

  if (livingEnemies.some((enemy) => enemy.y + 25 >= PLAYER_Y - 12)) {
    endGame();
  }
}

function drawBackground() {
  ctx.fillStyle = "#080d1b";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#b7c9e8";
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(91, 126, 177, 0.09)";
  ctx.lineWidth = 1;
  for (let y = 48; y < HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(WIDTH / 2, PLAYER_Y, 10, WIDTH / 2, PLAYER_Y, 300);
  glow.addColorStop(0, "rgba(31, 85, 98, 0.11)");
  glow.addColorStop(1, "rgba(8, 13, 27, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawPlayer() {
  if (invulnerability > 0 && Math.floor(invulnerability * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(playerX, PLAYER_Y);
  ctx.shadowColor = "#61f4d2";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#61f4d2";
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(21, 10);
  ctx.lineTo(10, 8);
  ctx.lineTo(7, 14);
  ctx.lineTo(-7, 14);
  ctx.lineTo(-10, 8);
  ctx.lineTo(-21, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d3fff5";
  ctx.fillRect(-3, 1, 6, 8);
  ctx.restore();
}

function drawEnemy(enemy) {
  const x = enemy.x + fleetOffset;
  const colors = ["#ff7eb6", "#c29aff", "#a58bff", "#75c8ff", "#61f4d2"];
  const color = colors[enemy.row];
  const pixel = 4;
  const pattern = [
    "001000100",
    "000101000",
    "001111100",
    "011011110",
    "111111111",
    "101111101",
    "101000101",
    "000110000"
  ];
  ctx.save();
  ctx.translate(x, enemy.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  const offset = enemy.row % 2 === 0 ? 0 : 1;
  for (let row = 0; row < pattern.length; row += 1) {
    for (let column = 0; column < pattern[row].length; column += 1) {
      if (pattern[row][column] === "1") {
        ctx.fillRect(column * pixel + offset, row * pixel, pixel - 1, pixel - 1);
      }
    }
  }
  ctx.restore();
}

function drawShots() {
  ctx.save();
  ctx.shadowBlur = 12;
  for (const shot of playerShots) {
    ctx.fillStyle = "#d1fff5";
    ctx.shadowColor = "#61f4d2";
    ctx.fillRect(shot.x - 2, shot.y - 9, 4, 12);
  }
  for (const shot of enemyShots) {
    ctx.fillStyle = "#ff82ad";
    ctx.shadowColor = "#ff4b86";
    ctx.fillRect(shot.x - 2, shot.y - 5, 4, 10);
  }
  ctx.restore();
}

function draw() {
  drawBackground();
  for (const enemy of enemies) {
    if (enemy.alive) drawEnemy(enemy);
  }
  drawPlayer();
  drawShots();
  ctx.fillStyle = "rgba(97, 244, 210, 0.45)";
  ctx.fillRect(26, PLAYER_Y + 22, WIDTH - 52, 1);
}

function frame(timestamp) {
  const delta = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.04) : 0;
  lastFrameTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (event.code === "Enter" && state !== "running") startGame();
  keys.add(event.code);
});

document.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
startButton.addEventListener("click", startGame);

createFleet();
updateHud();
showOverlay("ready");
requestAnimationFrame(frame);
