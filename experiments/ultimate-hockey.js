// ULTIMATE HOCKEY SIMULATOR
// JavaScript-only playable prototype
// Controls:
// WASD = Skate
// Mouse = Aim / Goalie glove
// Left click = Shoot
// 1-6 = Select shot
// SPACE = Butterfly
// G = Switch modes
// R = Reset puck

document.body.innerHTML = `
<style>
body {
  margin: 0;
  background: #101d2c;
  color: white;
  font-family: Arial;
  text-align: center;
}
canvas {
  width: min(100%, 1000px);
  background: #eaf5fa;
  border: 4px solid #7895ad;
  display: block;
  margin: auto;
  cursor: crosshair;
}
button {
  padding: 10px 18px;
  margin: 5px;
  background: #174b75;
  color: white;
  border: 1px solid #6ca4ce;
  border-radius: 6px;
  cursor: pointer;
}
</style>

<h1>🏒 ULTIMATE HOCKEY SIMULATOR</h1>
<h2 id="score">YOU 0 - 0 CPU</h2>
<h3 id="mode">SHOOTER MODE</h3>
<canvas id="rink" width="1000" height="620"></canvas>
<div>
<button onclick="switchMode()">Switch Mode (G)</button>
<button onclick="resetPuck()">Reset Puck (R)</button>
</div>
<p>
WASD: Skate | Mouse: Aim | Click: Shoot |
1-6: Shot types | Space: Butterfly
</p>
<p id="status">Ready to play!</p>
`;

const canvas = document.getElementById("rink");
const ctx = canvas.getContext("2d");

let mode = "shooter";
let keys = {};
let mouse = {x: 500, y: 310};
let score = [0, 0];
let shotType = 1;
let butterfly = false;
let celebration = 0;

const player = {
  x: 250, y: 310,
  vx: 0, vy: 0,
  angle: 0
};

const goalie = {
  x: 865,
  y: 310,
  gloveY: 310,
  blockerY: 310
};

const puck = {
  x: 290, y: 310,
  vx: 0, vy: 0,
  radius: 9,
  held: true
};

const cpu = {
  x: 620, y: 310
};

let particles = [];

const shots = {
  1: {name: "Wrist Shot", speed: 10},
  2: {name: "Snapshot", speed: 14},
  3: {name: "Slap Shot", speed: 19},
  4: {name: "Backhand", speed: 9},
  5: {name: "Michigan", speed: 12},
  6: {name: "Spinorama", speed: 13}
};

// DRAW RINK
function drawRink() {
  ctx.fillStyle = "#dceef7";
  ctx.fillRect(0, 0, 1000, 620);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(70, 40, 860, 540, 65);
  ctx.fill();

  ctx.strokeStyle = "#91aabb";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.save();

  ctx.beginPath();
  ctx.roundRect(70, 40, 860, 540, 65);
  ctx.clip();

  // Center red line
  ctx.strokeStyle = "#d52e3d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(500, 40);
  ctx.lineTo(500, 580);
  ctx.stroke();

  // Blue lines
  ctx.strokeStyle = "#2869bd";
  ctx.beginPath();
  ctx.moveTo(330, 40);
  ctx.lineTo(330, 580);
  ctx.moveTo(670, 40);
  ctx.lineTo(670, 580);
  ctx.stroke();

  // Center circle
  ctx.strokeStyle = "#d52e3d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(500, 310, 80, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// DRAW REAL-STYLE NET
function drawNet(x, y, flip = false) {
  ctx.save();
  ctx.translate(x, y);

  if (flip) ctx.scale(-1, 1);

  // White net body
  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(-8, -60, 26, 120);

  // Red metal frame
  ctx.strokeStyle = "#d51d2c";
  ctx.lineWidth = 9;
  ctx.strokeRect(-8, -60, 26, 120);

  // Net mesh
  ctx.strokeStyle = "#aab7c0";
  ctx.lineWidth = 1;

  for (let y = -55; y <= 55; y += 8) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(50, y * 0.8);
    ctx.stroke();
  }

  for (let x = 20; x <= 50; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, -50);
    ctx.lineTo(x, 50);
    ctx.stroke();
  }

  ctx.restore();
}

// DRAW PLAYER
function drawPlayer(x, y, color, angle, number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Legs
  ctx.strokeStyle = "#182535";
  ctx.lineWidth = 9;

  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(-16, 27);
  ctx.moveTo(8, 10);
  ctx.lineTo(16, 27);
  ctx.stroke();

  // Jersey
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-17, -17, 34, 38, 8);
  ctx.fill();

  // Number
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(number, 0, 7);

  // Head
  ctx.fillStyle = "#edc6a4";
  ctx.beginPath();
  ctx.arc(0, -25, 11, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = "#172331";
  ctx.beginPath();
  ctx.arc(0, -28, 12, Math.PI, 0);
  ctx.fill();

  // Stick
  ctx.strokeStyle = "#29221d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(40, 12);
  ctx.lineTo(60, 12);
  ctx.stroke();

  ctx.restore();
}

// DRAW GOALIE
function drawGoalie(x, y) {
  ctx.save();
  ctx.translate(x, y);

  // Body
  ctx.fillStyle = "#bd2535";
  ctx.beginPath();
  ctx.roundRect(-23, -35, 46, 70, 12);
  ctx.fill();

  // Leg pads
  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(-34, -27, 18, 60);
  ctx.fillRect(16, -27, 18, 60);

  // Mask
  ctx.fillStyle = "#f8fbff";
  ctx.beginPath();
  ctx.arc(0, -44, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#526779";
  ctx.lineWidth = 2;

  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9, -57);
    ctx.lineTo(i * 9, -30);
    ctx.stroke();
  }

  ctx.restore();
}

// DRAW PUCK
function drawPuck() {
  ctx.fillStyle = "#0005";
  ctx.beginPath();
  ctx.ellipse(puck.x + 3, puck.y + 5, 11, 6, 0, 0, 7);
  ctx.fill();

  ctx.fillStyle = "#101419";
  ctx.beginPath();
  ctx.ellipse(puck.x, puck.y, 10, 6, 0, 0, 7);
  ctx.fill();
}

// SHOOT
function shoot() {
  if (mode !== "shooter" || !puck.held) return;

  const shot = shots[shotType];

  let angle = Math.atan2(
    mouse.y - puck.y,
    mouse.x - puck.x
  );

  if (shotType === 4) angle += 0.4;
  if (shotType === 5) angle -= 0.3;

  puck.vx = Math.cos(angle) * shot.speed;
  puck.vy = Math.sin(angle) * shot.speed;

  if (shotType === 5) puck.vy -= 3;

  puck.held = false;

  document.getElementById("status").textContent =
    shot.name + "!";
}

// RESET
function resetPuck() {
  puck.x = mode === "shooter" ? player.x + 40 : 520;
  puck.y = 310;
  puck.vx = 0;
  puck.vy = 0;
  puck.held = mode === "shooter";
}

// MODE SWITCH
function switchMode() {
  mode = mode === "shooter" ? "goalie" : "shooter";

  document.getElementById("mode").textContent =
    mode.toUpperCase() + " MODE";

  resetPuck();
}

// GOAL
function goal(team) {
  score[team]++;

  document.getElementById("score").textContent =
    "YOU " + score[0] + " - " + score[1] + " CPU";

  document.getElementById("status").textContent =
    team === 0 ? "GOAL!!! 🎉" : "CPU SCORES!";

  celebration = 100;

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: puck.x,
      y: puck.y,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9,
      life: 1
    });
  }

  puck.vx = 0;
  puck.vy = 0;
  puck.held = false;

  setTimeout(resetPuck, 1100);
}

// CELEBRATION PARTICLES
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = "#e4b83f";

    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 7);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.015;
  });

  particles = particles.filter(p => p.life > 0);
  ctx.globalAlpha = 1;
}

// UPDATE GAME
function update() {
  if (mode === "shooter") {
    let ax = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    let ay = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);

    player.vx = (player.vx + ax * 0.6) * 0.9;
    player.vy = (player.vy + ay * 0.6) * 0.9;

    player.x += player.vx;
    player.y += player.vy;

    player.x = Math.max(120, Math.min(790, player.x));
    player.y = Math.max(100, Math.min(520, player.y));

    player.angle = Math.atan2(
      mouse.y - player.y,
      mouse.x - player.x
    );

    if (puck.held) {
      puck.x = player.x + Math.cos(player.angle) * 43;
      puck.y = player.y + Math.sin(player.angle) * 43;
    }

    goalie.y += (puck.y - goalie.y) * 0.04;

  } else {
    // Slow puck for goalie mode
    puck.vx *= 0.997;
    puck.vy *= 0.997;

    // Mouse glove movement
    goalie.gloveY += (mouse.y - goalie.gloveY) * 0.2;

    goalie.gloveY = Math.max(
      90, Math.min(530, goalie.gloveY)
    );

    // Automatic blocker tracking
    goalie.blockerY +=
      (puck.y - goalie.blockerY) * 0.08;

    // Butterfly
    if (butterfly) {
      goalie.gloveY += (310 - goalie.gloveY) * 0.08;
    }

    if (puck.held) {
      puck.held = false;
      puck.x = 530;
      puck.y = 310;
      puck.vx = -4;
      puck.vy = 0;
    }
  }

  puck.x += puck.vx;
  puck.y += puck.vy;

  puck.vx *= 0.995;
  puck.vy *= 0.995;

  // Side boards
  if (puck.y < 60 || puck.y > 560) {
    puck.vy *= -0.8;
    puck.y = Math.max(60, Math.min(560, puck.y));
  }

  // SHOOTER MODE
  if (mode === "shooter") {

    // Goal detection
    if (puck.x > 910 &&
        Math.abs(puck.y - 310) < 57) {
      goal(0);
    }

    // Goalie save
    if (puck.x > 840 &&
        Math.abs(puck.y - goalie.y) < 42 &&
        puck.vx > 0) {
      puck.vx *= -0.65;
      puck.vy += (puck.y - goalie.y) * 0.08;
    }

    if (puck.x < 90) puck.vx *= -0.8;

  } else {

    // CPU shot toward your net
    if (puck.x < 90 &&
        Math.abs(puck.y - 310) < 57) {
      goal(1);
    }

    // Glove save
    if (puck.x < 170 &&
        Math.abs(puck.y - goalie.gloveY) < 28 &&
        puck.vx < 0) {
      puck.vx = Math.abs(puck.vx) * 0.6;
    }

    // Blocker save
    if (puck.x < 170 &&
        Math.abs(puck.y - goalie.blockerY) < 30 &&
        puck.vx < 0) {
      puck.vx = Math.abs(puck.vx) * 0.6;
    }

    if (puck.x > 920) puck.vx *= -0.8;
  }

  if (Math.abs(puck.vx) + Math.abs(puck.vy) < 0.05 &&
      !puck.held && mode === "shooter") {
    resetPuck();
  }
}

// MAIN DRAW
function draw() {
  drawRink();

  drawNet(83, 310, true);
  drawNet(917, 310);

  if (mode === "shooter") {
    drawPlayer(
      player.x, player.y, "#1763a5",
      player.angle, "9"
    );

    drawGoalie(866, goalie.y);

    drawPlayer(
      cpu.x, cpu.y, "#b62e3c",
      Math.PI, "21"
    );

  } else {
    drawPlayer(cpu.x, cpu.y, "#b62e3c", 0, "21");

    drawGoalie(130, 310);

    // Glove
    ctx.fillStyle = "#e8b844";
    ctx.beginPath();
    ctx.arc(165, goalie.gloveY, 13, 0, 7);
    ctx.fill();

    // Blocker
    ctx.fillStyle = "#80522e";
    ctx.fillRect(
      180, goalie.blockerY - 12, 16, 24
    );

    if (butterfly) {
      ctx.fillStyle = "#315d91";
      ctx.beginPath();
      ctx.ellipse(130, 310, 40, 25, 0, 0, 7);
      ctx.fill();
    }
  }

  drawPuck();
  drawParticles();
}

// INPUT
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key >= "1" && e.key <= "6") {
    shotType = Number(e.key);
    document.getElementById("status").textContent =
      shots[shotType].name + " selected";
  }

  if (e.key === " ") {
    e.preventDefault();
    butterfly = true;
  }

  if (e.key.toLowerCase() === "g") switchMode();
  if (e.key.toLowerCase() === "r") resetPuck();
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key === " ") butterfly = false;
});

canvas.addEventListener("pointermove", e => {
  const rect = canvas.getBoundingClientRect();

  mouse.x = (e.clientX - rect.left) *
    canvas.width / rect.width;

  mouse.y = (e.clientY - rect.top) *
    canvas.height / rect.height;
});

canvas.addEventListener("pointerdown", shoot);

// GAME LOOP
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
