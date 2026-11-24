// =====================================================================
//  SAROSH'S HOCKEY SHOOTOUT (the rules of the shootout game)
//  The arena, players, sounds and graphics are in engine.js
// =====================================================================

const shooterModel = makeShooter();
const goalieModel = makeGoalie();
loadRealPlayer();
const puckModel = addMesh(scene, new THREE.CylinderGeometry(0.25, 0.25, 0.085, 32), material("#0b0b0b", 0.35));

// a yellow ring that shows where you aimed
const aimMarker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), new THREE.MeshBasicMaterial({ color: "#ffe14d", transparent: true, depthTest: false }));
aimMarker.visible = false;
aimMarker.scale.setScalar(1.6);
scene.add(aimMarker);

// The net ripples when the puck hits it
function rippleNet(dt) {
  if (netWobble <= 0) return;
  netWobble = Math.max(0, netWobble - dt);
  const pos = netMesh.geometry.attributes.position;
  const t = 1.2 - netWobble;                       // time since the puck hit
  const push = 0.55 * Math.exp(-3 * t) * Math.cos(t * 18);
  for (let i = 0; i < pos.count; i++) {
    const x = netRest[i * 3], y = netRest[i * 3 + 1], z = netRest[i * 3 + 2];
    const d2 = (x - netHitX) ** 2 + (y - netHitY) ** 2;
    pos.setZ(i, z - push * Math.exp(-d2 / 1.6) * Math.min(1, (-z - RINK.goalLine) * 2 + 0.2));
  }
  pos.needsUpdate = true;
}

// ----- 7. GAME STATE: everything the game needs to remember -----
//   "menu" -> "ready" -> "skating" -> "move" -> "shot" -> "result" -> back to "menu"
let state = "menu";
let chosenMove = "wrist";
let defending = false;     // true = the other team shoots and YOU are the goalie
let goalieView = "first";  // "first" = see through your goalie's eyes (Sarosh's favorite!), "behind" = camera behind your goalie
let savedMove = "wrist", ai = null;
const myGlove = { x: 1.3, y: 3, wantX: 1.3, wantY: 3 };   // where your glove is (x is measured from the goalie's middle)
let aimMode = "skate";   // "skate" = Skate & Shoot (click to shoot)   "pause" = Pause to Shoot (click, aim, press SPACE)
let pausedAim = null;    // where you're aiming while the game is paused
let timer = 0, clock = 0;
let resultText = "", resultGoal = false, theirText = "";
let hintText = "", hintTimer = 0;
let goalLightTimer = 0, shake = 0;
const shootout = { you: [], them: [], winner: null };

const shooter = { x: 0, z: 22, speed: SKATE.startSpeed, handle: 1.1, reach: 3.0, spin: 0, windup: 0, follow: 0, stride: 0 };
const goalie = { x: 0, z: GOALIE_SETTINGS.homeZ, speed: 0, butterfly: 0, gloveReach: 0, blockerReach: 0, wantButterfly: 0, wantGlove: 0, wantBlocker: 0 };
const puck = { x: 0, y: 0, z: 0, onStick: true };
let shot = null;     // info about the shot while the puck is flying
let action = null;   // info about the move while you're doing it



// ----- 9. MENU BUTTONS AND CLICKING -----

Object.keys(MOVES).forEach(key => {
  const m = MOVES[key];
  const button = document.createElement("button");
  button.innerHTML = '<span class="icon">' + m.icon + "</span>" + m.name + "<small>" + m.info + "</small>";
  button.addEventListener("click", () => { startAudio(); chosenMove = key; startAttempt(); });
  $("moveButtons").appendChild(button);
});

// The two ways to shoot
const AIM_MODES = { skate: "⛸️ Skate & Shoot", pause: "⏸️ Pause to Shoot" };
Object.keys(AIM_MODES).forEach(key => {
  const button = document.createElement("button");
  button.textContent = AIM_MODES[key];
  button.dataset.mode = key;
  button.addEventListener("click", () => { aimMode = key; });
  $("modeButtons").appendChild(button);
});

// The two goalie cameras
const GOALIE_VIEWS = { behind: "🎥 Goalie: behind", first: "👀 Goalie: first person" };
Object.keys(GOALIE_VIEWS).forEach(key => {
  const button = document.createElement("button");
  button.textContent = GOALIE_VIEWS[key];
  button.dataset.view = key;
  button.addEventListener("click", () => { goalieView = key; });
  $("viewButtons").appendChild(button);
});

const raycaster = new THREE.Raycaster();
// YOU'RE THE GOALIE: the glove follows the mouse
renderer.domElement.addEventListener("mousemove", e => {
  if (!defending) return;
  const nx = (e.clientX / window.innerWidth) * 2 - 1, ny = -(e.clientY / window.innerHeight) * 2 + 1;
  let x, y;
  if (goalieView === "first") {        // first person: the middle of the screen is right in front of you
    x = goalie.x - nx * 2.9;
    y = 2.5 + ny * 2.2;
  } else {                             // behind: find the spot on the goal line under the mouse
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(V(0, 0, 1), RINK.goalLine - 1), hit)) return;
    x = hit.x; y = hit.y;
  }
  myGlove.wantX = clamp(x - goalie.x, -0.3, 2.6);
  myGlove.wantY = clamp(y, 0.6, 4.3);
});
// Where on the net is the mouse pointing? (null if it's not on the net)
function netSpotUnderMouse(e) {
  const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(new THREE.Plane(V(0, 0, 1), RINK.goalLine), hit)) return null;
  const inside = Math.abs(hit.x) < NET.halfWidth + 0.2 && hit.y > 0 && hit.y < NET.height + 0.2;
  return inside ? { x: hit.x, y: hit.y } : null;
}
function showAim(target) {
  aimMarker.visible = !!target;
  if (target) { aimMarker.position.set(target.x, target.y, -RINK.goalLine + 0.05); aimMarker.material.opacity = 1; }
}
// PAUSE TO SHOOT: while paused, the yellow target follows the mouse...
renderer.domElement.addEventListener("mousemove", e => {
  if (state !== "aiming") return;
  pausedAim = netSpotUnderMouse(e);
  showAim(pausedAim);
});
// ...and SPACE shoots!
document.addEventListener("keydown", e => {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (state !== "aiming") return;
  if (!pausedAim) { hintText = "Point the mouse at the net first!"; hintTimer = 1.5; return; }
  beginMove(pausedAim);
});
const netPlane = new THREE.Plane(V(0, 0, 1), RINK.goalLine);  // an invisible wall at the goal line

renderer.domElement.addEventListener("click", e => {
  startAudio();
  if (defending && (state === "skating" || state === "move" || state === "shot" || state === "ready")) return;   // you're the goalie: no shooting!
  if (state === "skating" && aimMode === "pause") {
    // PAUSE TO SHOOT: freeze the game so you can aim
    state = "aiming";
    pausedAim = netSpotUnderMouse(e);
    showAim(pausedAim);
  } else if (state === "skating") {
    // SKATE & SHOOT: shoot an invisible laser from the camera through your mouse, and see where it hits the net
    const target = netSpotUnderMouse(e);
    if (!target) { hintText = "Click INSIDE the net!"; hintTimer = 1.5; return; }
    showAim(target);
    beginMove(target);
  } else if (replay) {
    endReplay();                 // click to skip the replay
  } else if (state === "result") {
    if (shootout.winner) {                                   // game over: start a new shootout
      shootout.you = []; shootout.them = []; shootout.winner = null;
      if (defending) endDefense();
      state = "menu";
    } else if (!defending) {
      startDefense();                                        // now it's their turn to shoot: YOU are the goalie!
    } else {
      endDefense();
      state = "menu";                                        // next round
    }
  }
});


// ----- 10. GAME ACTIONS -----
// INSTANT REPLAY: we save a "snapshot" of everything every frame, then play the last 2 seconds back in slow motion
let recording = [];
let replay = null, replayDone = false;
function snapshot() {
  return JSON.parse(JSON.stringify({ shooter, goalie, puck, shot, state, timer, clock }));
}
function applySnapshot(snap) {
  Object.assign(shooter, snap.shooter); Object.assign(goalie, snap.goalie); Object.assign(puck, snap.puck);
  shot = snap.shot; state = snap.state; timer = snap.timer; clock = snap.clock;
}
function startReplay() {
  replay = { frames: recording.slice(-120), i: 0, saved: snapshot() };
  replayDone = true;
}
function endReplay() {
  applySnapshot(replay.saved);
  replay = null;
  timer = Math.max(timer, 1.8);   // go straight to the celebration
}
function startAttempt() {
  recording = []; replay = null; replayDone = false;
  Object.assign(shooter, { x: 0, z: 22, speed: SKATE.startSpeed, handle: 1.1, reach: 3.0, spin: 0, windup: 0, follow: 0 });
  Object.assign(goalie, { x: 0, z: GOALIE_SETTINGS.homeZ, speed: 0, wantButterfly: 0, wantGlove: 0, wantBlocker: 0 });
  puck.onStick = true; puck.y = 0;
  shot = null; action = null;
  aimMarker.visible = false;
  state = "ready"; timer = 0;
}

// YOU'RE THE GOALIE: the computer picks a move, a lane and a spot to shoot at
function startDefense() {
  defending = true;
  savedMove = chosenMove;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const spots = [[2.3, 3.3], [-2.3, 3.3], [2.4, 0.5], [-2.4, 0.5], [1.5, 2.2], [-1.5, 2.2], ["fivehole", 0.4], [0.6, 3.5]];
  ai = { move: pick(["wrist", "snap", "backhand", "deke", "slap", "fivehole", "toedrag", "wrist"]),
         lane: (Math.random() - 0.5) * 14, shootZ: 54 + Math.random() * 15, spot: pick(spots) };
  chosenMove = ai.move;
  dressTeams();
  startAttempt();
  replayDone = true;          // no replays of their goals
  myGlove.wantX = myGlove.x = 1.3; myGlove.wantY = myGlove.y = 3;
}
function endDefense() {
  defending = false;
  chosenMove = savedMove;
  dressTeams();
}
function aiTarget() {
  const [x, y] = ai.spot;
  return { x: x === "fivehole" ? goalie.x : x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.4 };
}

function beginMove(target) {
  const m = MOVES[chosenMove];
  const away = target.x >= goalie.x ? -1 : 1;   // fakes go the OTHER way from where you want to shoot
  action = { target: target, move: m, t: 0, dir: away };
  state = "move";
}

function release() {
  const m = action.move;
  const target = { x: action.target.x, y: action.target.y };
  if (m.fiveHole) { target.x = goalie.x; target.y = 0.45; }          // aim between the goalie's legs
  if (m.error) { target.x += (Math.random() - 0.5) * 2 * m.error; target.y += (Math.random() - 0.5) * 2 * m.error; }
  target.y = Math.max(0.15, target.y);
  puck.onStick = false;
  const distance = Math.hypot(target.x - puck.x, RINK.goalLine - puck.z);
  shot = { fromX: puck.x, fromY: puck.y, fromZ: puck.z, toX: target.x, toY: target.y, time: 0,
           flightTime: distance / (m.speed * (defending ? DEFENSE_PUCK_SPEED : 1)), reaction: GOALIE_SETTINGS.reactionTime + (m.react || 0),
           done: false, bounce: null, timeAfter: 0, fiveHole: !!m.fiveHole,
           legsOpen: goalie.butterfly < 0.5 && (Math.abs(goalie.speed) > 2.5 || !!m.fiveHole) };   // a sliding goalie can't close his legs in time
  shot.reaction += Math.random() * 0.08;   // goalies aren't robots: sometimes a bit slower
  shooter.follow = 0.001;
  shooter.windup = 0;
  shooter.spin = 0;
  playClack();
  sprayAt(spot(puck.x, 0, puck.z), V(0.3, 0, 0.5), 18, 6);
  state = "shot"; timer = 0;
}

// When the puck reaches the net: goal, save, or post?
function checkShot() {
  const dx = shot.toX - goalie.x;
  const y = shot.toY;
  const b = goalie.butterfly;
  const ready = clamp((shot.flightTime - shot.reaction) / 0.3, 0, 1);  // how much time the goalie had
  if (Math.abs(shot.toX) > NET.halfWidth - 0.15 || y > NET.height - 0.15) {
    if (Math.abs(shot.toX) > NET.halfWidth || y > NET.height) return { text: "Wide! Missed the net", goal: false };
    return { text: "PING! Off the post!", goal: false, post: true };
  }
  if (defending) {                                          // YOU are the goalie
    if (Math.hypot(shot.toX - (goalie.x + myGlove.x), y - myGlove.y) < 0.7) return { text: "GLOVE SAVE! 🧤", goal: false, caught: true };
    if (y < 0.85 && Math.abs(dx) < 0.45) return b > 0.5 ? { text: "PAD SAVE!", goal: false } : { text: "FIVE-HOLE... THEY SCORED", goal: true };
    if (y < 1.2 && Math.abs(dx) < (b > 0.5 ? 2.4 : 1.2)) return { text: b > 0.5 ? "BUTTERFLY SAVE! 🦋" : "PAD SAVE!", goal: false };
    if (y < (b > 0.5 ? 3.0 : 4.0) && Math.abs(dx) < 0.85) return { text: "BIG SAVE!", goal: false };
    if (y > 1.2 && dx < -0.5 && dx > -(0.6 + 1.3 * ready)) return { text: "BLOCKER SAVE!", goal: false };
    return { text: "THEY SCORED!", goal: true };
  }
  if (y < 0.85 && Math.abs(dx) < 0.45) {                   // between the legs?
    if (shot.legsOpen) return { text: "FIVE-HOLE! GOAL!", goal: true };
    return { text: b > 0.5 ? "PAD SAVE!" : "STICK SAVE!", goal: false };
  }
  if (y < 1.1 && Math.abs(dx) < (b > 0.5 ? 2.4 : 1.35)) return { text: Math.abs(dx) > 1.7 ? "TOE SAVE!" : "PAD SAVE!", goal: false };
  if (y < (b > 0.5 ? 3.0 : 4.2) && Math.abs(dx) < 0.9) return { text: "SAVE!", goal: false };
  const reach = (b > 0.5 && y > 2.9) ? 0.45 : 1;          // down in the butterfly, the top corners are hard to reach!
  if (y > 1.5 && dx > 0.5 && dx < 0.6 + 1.5 * ready * reach) return { text: "GLOVE SAVE!", goal: false };
  if (y > 1.2 && dx < -0.5 && dx > -(0.6 + 1.3 * ready * reach)) return { text: "BLOCKER SAVE!", goal: false };
  return { text: "GOAL!", goal: true };
}

// After each shot: write it on the tracker, then check if someone has won
function finishAttempt(scored) {
  (defending ? shootout.them : shootout.you).push(scored);
  theirText = "";
  const you = shootout.you, them = shootout.them;
  const mine = you.filter(Boolean).length, theirs = them.filter(Boolean).length;
  if (you.length <= SHOOTOUT_ROUNDS && them.length <= SHOOTOUT_ROUNDS) {
    // in the 3 rounds: is it already impossible to catch up?
    if (mine > theirs + (SHOOTOUT_ROUNDS - them.length)) shootout.winner = "you";
    if (theirs > mine + (SHOOTOUT_ROUNDS - you.length)) shootout.winner = "them";
  }
  if (!shootout.winner && you.length >= SHOOTOUT_ROUNDS && you.length === them.length && mine !== theirs) {
    shootout.winner = mine > theirs ? "you" : "them";      // after a full round (or in sudden death)
  }
  if (shootout.winner === "you") crowdRoar(0.2, 3.5);
}


// ----- 11. UPDATE: move everything a tiny bit, many times per second -----
function update(dt) {
  hintTimer -= dt;
  if (replay) {                       // REPLAY: play the saved frames in slow motion
    replay.i += dt * 60 * 0.45;
    if (replay.i >= replay.frames.length - 1) endReplay();
    else applySnapshot(replay.frames[Math.floor(replay.i)]);
    updateSpray(dt);
    return;
  }
  if (state === "aiming") return;   // PAUSED: everything stands still while you aim
  if (state === "result" && resultGoal && !replayDone && timer > 1.5 && recording.length > 30) { startReplay(); return; }
  clock += dt; timer += dt; goalLightTimer -= dt; shake = Math.max(0, shake - dt * 3);

  if (state === "ready" && timer > 1.2) {
    playWhistle();
    state = "skating"; timer = 0;
  }

  const skatingNow = state === "skating" || state === "move";
  if (skatingNow) {
    if (!defending && keys["ArrowUp"]) shooter.speed = Math.min(SKATE.maxSpeed, shooter.speed + 12 * dt);
    if (!defending && keys["ArrowDown"]) shooter.speed = Math.max(SKATE.minSpeed, shooter.speed - 12 * dt);
    const slow = action && action.move.windup ? 0.6 : 1;
    shooter.z += shooter.speed * slow * dt;
    if (state === "skating") {
      if (defending) {                                   // the computer skates their shooter
        shooter.x += clamp(ai.lane - shooter.x, -6 * dt, 6 * dt);
        if (shooter.z >= ai.shootZ) beginMove(aiTarget());
      } else {
        if (keys["ArrowLeft"]) shooter.x -= SKATE.sideSpeed * dt;
        if (keys["ArrowRight"]) shooter.x += SKATE.sideSpeed * dt;
      }
      const before = shooter.handle;
      shooter.handle = 1.1 + Math.sin(clock * 5.5) * 0.45;   // stickhandling: the puck goes side to side
      if ((before - 1.1) * (shooter.handle - 1.1) < 0) playTap();
      shooter.reach = 3.0;
    }
  } else if (state === "shot" || state === "result") {
    shooter.z += shooter.speed * 0.35 * dt * Math.max(0, 1 - timer);   // glide, then stop
  }

  // DOING A MOVE
  if (state === "move") {
    const a = action, m = a.move;
    a.t += dt;
    const u = Math.min(1, a.t / m.prep);
    const swoop = Math.sin(Math.PI * u);
    if (m.fake) shooter.x += a.dir * m.fake * dt;
    if (m.spin) shooter.spin = -a.dir * Math.PI * 2 * (u * u * (3 - 2 * u));
    if (m.windup) shooter.windup = Math.sin(u * Math.PI / 2);
    if (m.backhand) shooter.handle = lerp(1.1, -0.95, u);
    if (m.fake && !m.spin) shooter.handle = 1.1 + a.dir * 0.9 * swoop;
    if (m.toeDrag) { shooter.handle = 1.1 + a.dir * 2.3 * u; shooter.reach = 3.0 - 1.4 * swoop; }
    if (m.lacrosse) { shooter.handle = 1.5; shooter.reach = lerp(3.0, 1.8, u); }
    if (!m.fake && !m.backhand && !m.toeDrag && !m.lacrosse && !m.windup) shooter.reach = 3.0 - 0.6 * u;  // pull it in for a quick shot
    if (m.fakeShot && u > 0.35) goalie.wantButterfly = 1;   // the goalie thinks it's a shot and drops!
    if (a.t >= m.prep) release();
  }
  shooter.x = clamp(shooter.x, -30, 30);
  if (shooter.follow > 0) shooter.follow = Math.min(1, shooter.follow + dt * 4);

  // Skated in too close without shooting? The goalie poke-checks you!
  if (state === "skating" && shooter.z > 77 && !defending) {
    puck.onStick = false;
    resultText = "POKE CHECK!"; resultGoal = false;
    goalie.wantButterfly = 1;
    playThud(false);
    sprayAt(spot(shooter.x, 0, shooter.z), V(1, 0, -0.6), 40, 9);
    finishAttempt(false);
    state = "result"; timer = 0;
  }

  // The puck rides on the stick until you shoot
  if (puck.onStick) {
    const c = Math.cos(shooter.spin), s = Math.sin(shooter.spin);
    const lx = shooter.handle, lz = -shooter.reach;            // where the puck is, next to the skater
    puck.x = shooter.x + c * lx + s * lz;
    puck.z = shooter.z - (-s * lx + c * lz);
    puck.y = action && action.move.lacrosse && state === "move" ? 3.3 * Math.min(1, action.t / (action.move.prep * 0.7)) : 0;
  }

  // The puck flies toward the net
  if (state === "shot") {
    shot.time += dt;
    if (!shot.done) {
      const t = Math.min(1, shot.time / shot.flightTime);
      puck.x = lerp(shot.fromX, shot.toX, t);
      puck.z = lerp(shot.fromZ, RINK.goalLine, t);
      puck.y = lerp(shot.fromY, shot.toY, t) + Math.sin(Math.PI * t) * 0.3;
      if (t >= 1) {
        shot.done = true;
        const result = checkShot();
        resultText = result.text; resultGoal = result.goal;
        shot.caught = !!result.caught;
        if (defending && !result.goal) { playThud(false); crowdRoar(0.17, 2.0); shot.bounce = { vx: (Math.random() - 0.5) * 16, vz: -14 }; }
        else if (defending && result.goal) { crowdRoar(0.05, 1.0); goalLightTimer = 3; shot.bounce = { vx: 0, vz: 6 }; netWobble = 1.2; netHitX = puck.x; netHitY = puck.y; }
        else if (result.goal) { playHorn(); crowdRoar(0.17, 2.5); goalLightTimer = 3; shot.bounce = { vx: 0, vz: 6 }; netWobble = 1.2; netHitX = puck.x; netHitY = puck.y; }
        else if (result.post) { playThud(true); crowdRoar(0.08, 0.8); shake = 1; shot.bounce = { vx: puck.x > 0 ? 12 : -12, vz: -18 }; }
        else if (resultText.startsWith("Wide")) { crowdRoar(0.05, 0.6); shot.bounce = { vx: puck.x > 0 ? 6 : -6, vz: 14 }; }
        else { playThud(false); crowdRoar(0.06, 0.8); shot.bounce = { vx: (Math.random() - 0.5) * 20, vz: -15 }; }
      }
    } else {
      shot.timeAfter += dt;
      if (resultGoal) {
        puck.z = Math.min(RINK.goalLine + NET.depth - 0.6, puck.z + shot.bounce.vz * dt);
        puck.y = Math.max(0, puck.y - 4 * dt);
      } else if (shot.caught) {
        puck.x = goalie.x + myGlove.x; puck.y = myGlove.y; puck.z = goalie.z + 0.6;   // the puck is in your glove!
      } else {
        puck.x += shot.bounce.vx * dt;
        puck.z += shot.bounce.vz * dt;
        puck.y = Math.max(0, puck.y - 6 * dt);
      }
      if (shot.timeAfter > 1.0) {
        finishAttempt(resultGoal);
        sprayAt(spot(shooter.x, 0, shooter.z), V(1, 0, -0.5), 30, 8);   // hockey stop!
        playCarve(1.4, 0.5);
        state = "result"; timer = 0;
      }
    }
  }

  // THE GOALIE
  let wants = clamp(puck.x * 0.32, -2.2, 2.2);    // stay square to the puck
  let speed = goalie.butterfly > 0.5 ? GOALIE_SETTINGS.slideSpeed : GOALIE_SETTINGS.speed;
  // come out to cut down the angle when you're far, back in when you're close
  const wantZ = GOALIE_SETTINGS.homeZ - clamp((RINK.goalLine - shooter.z - 15) * 0.06, 0, 2.4);
  goalie.z += clamp(wantZ - goalie.z, -3 * dt, 3 * dt);
  if (skatingNow && shooter.z > 70 && Math.abs(shooter.x) < 14) goalie.wantButterfly = 1;   // blocking butterfly up close
  if (state === "move") {
    const m = action.move;
    if (m.fake) { wants = clamp(goalie.x + action.dir * 3 * m.bite, -2.6, 2.6); speed = 12 * m.bite; }  // he bites on the fake!
    if (m.toeDrag) { wants = clamp(puck.x * 0.7, -2.6, 2.6); speed = 10; }
  }
  if (state === "shot" && !shot.done) {
    if (shot.time > shot.reaction) {
      wants = clamp(shot.toX, -2.4, 2.4);
      const dx = shot.toX - goalie.x;
      if (shot.toY < 1.2 && !shot.legsOpen) goalie.wantButterfly = 1;
      goalie.wantGlove = shot.toY >= 1.3 && dx > 0.3 ? 1 : 0;
      goalie.wantBlocker = shot.toY >= 1.3 && dx < -0.3 ? 1 : 0;
    } else wants = goalie.x;
  }
  if ((state === "shot" && shot.done) || state === "result") wants = goalie.x;
  if (defending) {
    if (state === "shot") wants = goalie.x;                          // you have to make the save yourself!
    goalie.wantButterfly = keys[" "] && state !== "result" ? 1 : 0;   // hold SPACE for the butterfly
    goalie.wantGlove = 0;                                            // the glove follows your mouse instead
    goalie.wantBlocker = state === "shot" && !shot.done && shot.time > shot.reaction && shot.toY >= 1.3 && shot.toX - goalie.x < -0.3 ? 1 : 0;   // blocker is automatic
    myGlove.x += clamp(myGlove.wantX - myGlove.x, -30 * dt, 30 * dt);
    myGlove.y += clamp(myGlove.wantY - myGlove.y, -30 * dt, 30 * dt);
  }
  if (state === "menu" || state === "ready") { goalie.wantButterfly = goalie.wantGlove = goalie.wantBlocker = 0; }
  const step = clamp(wants - goalie.x, -speed * dt, speed * dt);
  goalie.x += step;
  goalie.speed = dt > 0 ? step / dt : 0;
  const ease = Math.min(1, dt * 10);
  goalie.butterfly += (goalie.wantButterfly - goalie.butterfly) * ease;
  goalie.gloveReach += (goalie.wantGlove - goalie.gloveReach) * Math.min(1, ease * 1.4);
  goalie.blockerReach += (goalie.wantBlocker - goalie.blockerReach) * Math.min(1, ease * 1.4);

  updateSpray(dt);
  if (state === "skating" || state === "move" || state === "shot") recording.push(snapshot());
}


// ----- 12. MOVE THE 3D MODELS TO MATCH THE GAME -----
let lean = 0.3;
function updateShooterModel(dt) {
  const S = shooterModel;
  const skating = state === "skating" || state === "move" || state === "aiming";
  S.root.position.copy(spot(shooter.x, 0, shooter.z));
  S.root.rotation.y = shooter.spin;

  // Skating stride: each leg pushes OUT to the side and back, then comes back under the body
  if (skating && state !== "aiming") shooter.stride += dt * (0.9 + shooter.speed * 0.055);
  const p = shooter.stride % 1;
  const wantLean = skating ? 0.5 + shooter.windup * 0.15 : 0.28;
  lean += (wantLean - lean) * Math.min(1, dt * 6);
  const hipsY = skating ? 2.92 + 0.05 * Math.cos(p * Math.PI * 4) : 3.05;
  const sway = skating ? 0.14 * Math.sin(p * Math.PI * 2) : 0;
  S.torso.position.set(sway, hipsY, 0);
  S.torso.rotation.set(-lean, -shooter.windup * 0.5 + shooter.follow * 0.3 - (shooter.handle - 1.1) * 0.12, 0);
  S.head.rotation.x = lean * 0.8;   // keep looking at the net
  S.root.updateMatrixWorld(true);

  const legTargets = [];
  S.legs.forEach((leg, i) => {
    const s = leg.side;
    const ph = (p + (i === 0 ? 0 : 0.5)) % 1;
    let ankle, yaw;
    if (!skating) {                 // gliding: feet under the body
      ankle = V(s * 0.5, 0.5, s * 0.2); yaw = -s * 0.1;
    } else if (ph < 0.62) {         // PUSH: out to the side and back
      const u = ph / 0.62;
      ankle = V(s * (0.4 + 0.95 * u), 0.5, -0.25 + 1.15 * u); yaw = -s * (0.25 + 0.3 * u);
    } else {                        // RECOVER: lift the skate and bring it back
      const u = (ph - 0.62) / 0.38;
      ankle = V(s * (1.35 - 0.95 * u), 0.5 + 0.4 * Math.sin(Math.PI * u), 0.9 - 1.15 * u); yaw = -s * 0.55 * (1 - u);
    }
    if (skating && leg.phaseBefore < 0.55 && ph >= 0.55) {   // snow flies when the push ends
      sprayAt(S.root.localToWorld(ankle.clone()), V(s * 0.8, 0, 0.6), 6, 4);
      if (state !== "aiming") playCarve(0.5, 0.18);
    }
    leg.phaseBefore = ph;
    legTargets.push({ ankle: ankle, yaw: yaw, side: s });
    if (skating && ph < 0.62) addSkateMark(i, S.root.localToWorld(ankle.clone()), shooter.spin + yaw);   // the blade cuts the ice
    if (real.ready) return;     // the real player moves his own legs
    const hip = V(sway + s * 0.3, hipsY - 0.05, 0.05);
    const ik = twoBone(hip, ankle, 1.5, 1.55, V(s * 0.3, 0, -1));
    const pantsEnd = hip.clone().lerp(ik.joint, 0.7);
    placeBetween(leg.thigh, hip, pantsEnd);
    placeBetween(leg.thighSock, pantsEnd, ik.joint);
    leg.knee.position.copy(ik.joint);
    placeBetween(leg.shin, ik.end, ik.joint);
    leg.skate.position.copy(ik.end);
    leg.skate.rotation.set(0, yaw, 0);
  });

  // Where are the hands? The top hand is near the chest, the stick goes down to the puck.
  const toRoot = point => S.root.worldToLocal(S.torso.localToWorld(point));
  const topHand = toRoot(V(-0.12 - shooter.windup * 0.2, 1.0 + shooter.windup * 0.6 + shooter.follow * 0.3, -0.72 + shooter.windup * 0.3));
  let bladeAt;
  if (puck.onStick) bladeAt = S.root.worldToLocal(spot(puck.x, puck.y, puck.z));
  else bladeAt = V(1.1, 0, -2.8);
  if (shooter.windup > 0) bladeAt.lerp(V(2.4, 4.3, 1.8), shooter.windup);          // big wind-up behind you
  if (shooter.follow > 0 && (state === "shot" || state === "result")) {
    bladeAt.lerp(V(0.9, 2.6, -4.2), Math.sin(shooter.follow * Math.PI / 2) * clamp(1.6 - (state === "result" ? timer : 0), 0, 1));   // follow-through
  }
  const along = V(bladeAt.x - topHand.x, 0, bladeAt.z - topHand.z).normalize();       // direction the blade points
  const face = V(along.z, 0, -along.x);
  if (face.z > 0) face.negate();                                                     // the blade faces forward
  const bladeCenter = bladeAt.clone().addScaledVector(face, -0.26);
  const lifted = puck.onStick && puck.y > 0.2;
  if (lifted) { bladeCenter.copy(bladeAt); bladeCenter.y -= 0.15; }                  // lacrosse: puck sits ON the blade
  bladeCenter.y = Math.max(0.14, bladeCenter.y);
  const heel = bladeCenter.clone().addScaledVector(along, -0.48);
  const topEnd = topHand.clone().add(topHand.clone().sub(heel).normalize().multiplyScalar(0.35));
  placeBetween(S.shaft, heel, topEnd);
  placeBetween(S.knob, topEnd, topEnd.clone().lerp(topHand, 0.5), false);
  S.knob.position.lerp(topEnd, 0.6);
  S.blade.position.copy(bladeCenter);
  S.blade.rotation.set(0, Math.atan2(-along.z, along.x), 0);
  if (lifted) S.blade.rotateX(-Math.PI / 2.2);
  const lowHand = topHand.clone().lerp(heel, 0.32);

  if (real.ready) { poseRealPlayer(dt, legTargets, topHand, lowHand, hipsY, sway); return; }
  S.arms.forEach(arm => {
    const shoulder = toRoot(V(arm.side * 0.62, 1.5, 0));
    const hand = arm.side < 0 ? topHand : lowHand;
    const ik = twoBone(shoulder, hand, 0.95, 0.9, V(arm.side, -0.6, 0.6));
    const forward = ik.end.clone().sub(ik.joint).normalize();
    const wrist = ik.end.clone().addScaledVector(forward, -0.12);
    placeBetween(arm.upper, shoulder, ik.joint);
    arm.elbow.position.copy(ik.joint);
    placeBetween(arm.fore, ik.joint, wrist);
    placeBetween(arm.cuff, wrist.clone().addScaledVector(forward, -0.3), wrist);
    arm.glove.position.copy(ik.end);
    arm.glove.quaternion.setFromUnitVectors(V(0, 0, -1), forward);
  });
}

function updateGoalieModel() {
  const G = goalieModel;
  const b = goalie.butterfly;
  G.root.position.copy(spot(goalie.x, 0, goalie.z));
  G.root.rotation.y = clamp(Math.atan2(puck.x - goalie.x, goalie.z - puck.z), -0.7, 0.7);   // face the puck

  // Two poses: ready stance and butterfly. We blend between them with "b" (0 = stance, 1 = butterfly).
  const hipsY = lerp(2.55, 1.75, b);
  G.torso.position.set(0, hipsY, lerp(-0.15, -0.25, b));
  G.torso.rotation.set(lerp(0.28, 0.08, b), 0, -goalie.speed * 0.012);
  G.root.updateMatrixWorld(true);
  const shuffle = Math.sin(clock * 14) * Math.min(1, Math.abs(goalie.speed) / 5) * (1 - b) * 0.12;
  const goalieLegs = [];

  G.legs.forEach(leg => {
    const s = leg.side;
    const knee = V(lerp(s * 0.62, s * 0.38, b), lerp(1.55, 0.32, b), lerp(0.45, 0.3, b));
    const ankle = V(lerp(s * 1.05, s * 1.95, b) + s * shuffle, lerp(0.45, 0.3, b), lerp(0.05, -0.55, b));
    const hip = V(s * 0.38, hipsY - 0.2, lerp(-0.15, -0.25, b));
    placeBetween(leg.thigh, hip, knee);
    const up = knee.clone().sub(ankle).normalize();
    placeBetween(leg.pad, ankle.clone().addScaledVector(up, -0.3), knee.clone().addScaledVector(up, 0.55), false);   // big pads: from the skate to above the knee
    leg.pad.position.z += 0.14;   // pads sit in FRONT of the legs
    leg.skate.position.set(ankle.x, ankle.y + 0.08, ankle.z);
    goalieLegs.push({ knee: knee, ankle: ankle });
  });

  // hands: glove on the right of the screen, blocker on the left. They reach toward high shots.
  const tx = shot ? shot.toX - goalie.x : 0, ty = shot ? shot.toY : 3;
  const gloveRest = V(1.3, lerp(2.95, 2.6, b), 0.85), blockerRest = V(-1.2, 2.75, 0.85);
  G.glove.position.copy(gloveRest).lerp(V(clamp(tx, 0.7, 2.4), clamp(ty, 1.2, 4.3), 1.1), goalie.gloveReach);
  if (defending) G.glove.position.set(myGlove.x, myGlove.y, 1.0);   // your glove, controlled by the mouse
  G.blocker.position.copy(blockerRest).lerp(V(clamp(tx, -2.4, -0.7), clamp(ty, 2.0, 4.3), 1.1), goalie.blockerReach);
  [G.blocker, G.glove].forEach((hand, i) => {
    const s = i === 0 ? -1 : 1;
    const shoulder = G.root.worldToLocal(G.torso.localToWorld(V(s * 0.78, 1.42, 0)));
    const ik = twoBone(shoulder, hand.position.clone().add(V(0, 0, -0.15)), 1.0, 0.95, V(s, -0.7, -0.3));
    placeBetween(G.arms[i].upper, shoulder, ik.joint);
    G.arms[i].elbow.position.copy(ik.joint);
    placeBetween(G.arms[i].fore, ik.joint, ik.end);
  });
  if (realGoalie.ready) poseRealGoalie(goalieLegs, hipsY, b);
}

const lookTarget = spot(0, 1, RINK.goalLine);
function updateCamera(dt) {
  let wantPos, wantLook;
  if (replay) {
    // REPLAY camera: low, beside the net, like a TV replay
    const middleZ = (Math.min(shooter.z, 80) + RINK.goalLine) / 2;
    wantPos = spot(16, 5, middleZ - 3);
    wantLook = spot((shooter.x + puck.x) * 0.25, 1.8, middleZ);
  } else if (defending && state !== "result" && state !== "menu" && goalieView === "first" && realGoalie.ready) {
    // FIRST PERSON: see through your goalie's eyes
    wantPos = goalieModel.head.getWorldPosition(new THREE.Vector3()).add(V(0, 0.05, 0.4));
    wantLook = spot(puck.x, puck.y + 0.4, Math.min(puck.z, goalie.z - 3));
    camera.position.copy(wantPos);
  } else if (defending && state !== "result" && state !== "menu") {
    // BEHIND YOUR GOALIE: above and behind the net
    wantPos = spot(goalie.x * 0.6, 7, 97.5);
    wantLook = spot(puck.x * 0.6, 1.2, Math.min(puck.z, 82));
  } else if (state === "ready" && timer < 0.7) {
    // TV-style swoop: start high up, then fly down behind the shooter
    wantPos = spot(shooter.x + 18, 26, shooter.z - 12);
    wantLook = spot(0, 0, 60);
  } else if (state === "result" && resultGoal && timer > 0.3 && timer < 1.8) {
    // GOAL replay angle: from the side of the net
    wantPos = spot(9, 4.2, 79);
    wantLook = spot(0, 1.5, RINK.goalLine - 3);
  } else if (state === "result" && resultGoal && timer >= 1.8) {
    // then turn around to watch the celebration!
    wantPos = spot(shooter.x - 3, 4.5, shooter.z + 9);
    wantLook = spot(shooter.x, 3.6, shooter.z);
  } else {
    // follow the shooter: behind him (on the line from the net), and a bit to his right
    const followZ = Math.min(shooter.z, 76);
    const away = new THREE.Vector2(shooter.x, followZ - RINK.goalLine).normalize();
    const camX = shooter.x + away.x * CAMERA_SETTINGS.behind - away.y * CAMERA_SETTINGS.side;
    const camZ = followZ + away.y * CAMERA_SETTINGS.behind + away.x * CAMERA_SETTINGS.side;
    wantPos = spot(camX, CAMERA_SETTINGS.height, camZ);
    wantLook = spot(shooter.x * 0.35, 0.8, RINK.goalLine - 4);
  }
  const k = 1 - Math.pow(0.02, dt);
  camera.position.lerp(wantPos, k);
  lookTarget.lerp(wantLook, k);
  camera.lookAt(lookTarget);
  if (shake > 0) camera.position.add(V((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));

  const middle = spot(shooter.x * 0.5, 0, (Math.min(shooter.z, 76) + RINK.goalLine) / 2);
  sun.target.position.copy(middle);
  sun.position.copy(middle).add(V(18, 70, 30));
}

let frameDt = 1 / 60;
function updateModels(dt) {
  frameDt = dt;
  updateShooterModel(dt);
  updateGoalieModel();
  puckModel.position.copy(spot(puck.x, puck.y + 0.042, puck.z));
  goalieModel.head.visible = !(defending && goalieView === "first" && state !== "result" && state !== "menu");
  puckModel.visible = !(state === "result" && resultText === "POKE CHECK!");
  if (!puck.onStick && shot && !shot.done) puckModel.rotation.x += 0.4;
  const lightOn = goalLightTimer > 0 && Math.floor(goalLightTimer * 4) % 2 === 0;
  goalLight.intensity = lightOn ? 600 : 0;
  goalLamp.material.emissiveIntensity = lightOn ? 4 : 0.1;
  rippleNet(dt);
  if (aimMarker.visible) aimMarker.material.opacity = Math.max(0, aimMarker.material.opacity - dt * 0.6);
  updateCamera(dt);
}


// ----- 13. THE WORDS ON THE SCREEN -----
function trackerHTML() {
  const rounds = Math.max(SHOOTOUT_ROUNDS, shootout.you.length);
  const row = (name, list) => '<div class="row"><span class="team">' + name + "</span>" +
    Array.from({ length: rounds }, (_, i) => '<span class="dot ' + (list[i] === undefined ? "" : list[i] ? "goal" : "miss") + '"></span>').join("") + "</div>";
  return '<div class="label">SHOOTOUT</div>' + row("YOU", shootout.you) + row("THEM", shootout.them);
}
let lastTracker = "";
function updateWords() {
  const tracker = trackerHTML();
  if (tracker !== lastTracker) { $("tracker").innerHTML = tracker; lastTracker = tracker; }
  const round = shootout.you.length + 1;
  $("roundText").textContent = (round > SHOOTOUT_ROUNDS ? "SUDDEN DEATH! " : "Round " + round + " of " + SHOOTOUT_ROUNDS + " — ") + "choose your move before the whistle";
  $("menu").style.display = state === "menu" ? "block" : "none";
  $("moveTag").style.display = state === "menu" ? "none" : "block";
  $("moveTag").textContent = defending ? "🥅 You're the goalie!" : MOVES[chosenMove].icon + " " + MOVES[chosenMove].name;
  document.querySelectorAll("#viewButtons button").forEach(b => b.classList.toggle("picked", b.dataset.view === goalieView));
  let big = "", sub = "", color = "white";
  if (state === "ready") big = "Get ready...";
  if (replay) { big = ""; sub = ""; }

  document.querySelectorAll("#modeButtons button").forEach(b => b.classList.toggle("picked", b.dataset.mode === aimMode));
  if (state === "skating" && timer < 0.8) { big = "TWEEEET! GO!"; color = "#ffe14d"; }
  if (state === "result") {
    big = resultText;
    color = resultGoal ? "#ffe14d" : "white";
    sub = (resultText === "POKE CHECK!" ? "You got too close — shoot sooner!<br>" : "") + theirText + "<br>";
    if (shootout.winner === "you") sub += "🏆 YOU WIN THE SHOOTOUT! 🏆<br>Click for a new shootout";
    else if (shootout.winner === "them") sub += "They win this time... Click for a new shootout";
    else if (!defending) sub += "Now YOU'RE the goalie! 🥅 Click to get in the net";
    else sub += "Click for the next round";
  }
  $("big").textContent = big;
  $("big").style.color = color;
  if ($("sub").innerHTML !== sub) $("sub").innerHTML = sub;
  $("hint").textContent = replay ? "🔁 INSTANT REPLAY — click to skip"
    : defending && state !== "result" && state !== "menu" ? "🧤 Mouse = glove · hold SPACE = butterfly · the blocker moves by itself"
    : hintTimer > 0 ? hintText : state === "aiming" ? "⏸️ PAUSED — move the mouse to aim, press SPACE to shoot!" : (state === "skating" && timer > 0.8 ? (aimMode === "pause" ? "Click to PAUSE and aim your " : "Click inside the net to do your ") + MOVES[chosenMove].name + "!" : "");
  renderer.domElement.style.cursor = (state === "skating" || state === "aiming") ? "crosshair" : (state === "result" ? "pointer" : "default");
}


// ----- 14. THE GAME LOOP: update, move models, draw, about 60 times every second! -----
let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  updateModels(dt);
  updateWords();
  drawFrame();
  requestAnimationFrame(gameLoop);
}
camera.position.copy(spot(CAMERA_SETTINGS.side, CAMERA_SETTINGS.height, shooter.z - CAMERA_SETTINGS.behind));
requestAnimationFrame(gameLoop);
