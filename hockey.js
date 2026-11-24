// =====================================================================
//  5-ON-5 HOCKEY  (the arena, players and sounds come from engine.js)
//
//  CONTROLS
//   W A S D   skate            SHIFT   sprint
//   MOUSE     aim              LEFT CLICK   shoot (hold longer = harder slap shot)
//   E or RIGHT CLICK   pass    Q   switch player
//   SPACE     poke check / body check        C   change camera
//
//  Your team (blue + orange) attacks to the RIGHT, toward the net at z = +89.
// =====================================================================

// ----- 1. SETTINGS -----
const HOME = SHOOTER_TEAM;                                         // your team
const AWAY = { jersey: "#c8102e", stripe: "#0b1f4d", pants: "#0b1f4d", pads: "#f4f4f4" };   // the other team: red + navy
const PERIOD_SECONDS = 240;          // each period lasts 4 minutes
const PERIODS = 3;
const ROSTER = {
  home: [{ num: "11", role: "C" }, { num: "17", role: "LW" }, { num: "9", role: "RW" }, { num: "44", role: "LD" }, { num: "4", role: "RD" }],
  away: [{ num: "21", role: "C" }, { num: "13", role: "LW" }, { num: "27", role: "RW" }, { num: "8", role: "LD" }, { num: "55", role: "RD" }]
};
const GOALIE_NUMBERS = { home: "35", away: "30" };
const SKATING = { max: 24, sprint: 30, ai: 22, grip: 2.6 };   // feet per second; grip = how fast you change direction
const SHOT = { wrist: 72, slap: 112, pass: 62 };              // puck speeds in feet per second
const GOALIE_SKILL = 0.92;           // how often the goalie stops a shot he's in front of (0 to 1)
// Where players like to be. x = across the ice, z = along it (+ = toward the net they attack)
const ATTACK_SPOTS = { C: [0, 56], LW: [-20, 66], RW: [20, 66], LD: [-16, 32], RD: [16, 32] };
const DEFEND_SPOTS = { C: [0, -60], LW: [-20, -46], RW: [20, -46], LD: [-11, -74], RD: [11, -74] };
const CREASE = RINK.goalLine - 2.6;  // where the goalies stand

// ----- 2. THE GAME'S MEMORY -----
const players = [];                  // the 10 skaters
const goalies = {};                  // goalies.home and goalies.away
const hpuck = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, carrier: null, passTo: null, shooter: null, shotClock: 0, lastZ: 0 };
let phase = "loading";               // loading -> menu -> faceoff -> play -> goal / stoppage -> intermission -> final
let controlled = null;               // the skater YOU control
let period = 1, gameClock = PERIOD_SECONDS, phaseTimer = 0;
const score = { home: 0, away: 0 }, shotsOnGoal = { home: 0, away: 0 };
let banner = "", bannerSub = "";
let cameraMode = "tv";               // "tv" = side view like on TV, "behind" = behind your player
let mouseOnIce = new THREE.Vector3(), shootHold = -1;
let aiThink = 0;

const puckMesh = addMesh(scene, new THREE.CylinderGeometry(0.25, 0.25, 0.085, 32), material("#0b0b0b", 0.35));
const youRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.75, 40), new THREE.MeshBasicMaterial({ color: "#ffe14d", transparent: true, opacity: 0.85, depthWrite: false }));
youRing.rotation.x = -Math.PI / 2;
youRing.renderOrder = 3;
scene.add(youRing);
buildNet(-1);                        // the second net, at the other end
camera.fov = 40;
camera.updateProjectionMatrix();
if (composer) { composer.passes[1].threshold = 1.3; composer.passes[1].strength = 0.2; }   // less glow, so the white ice isn't hazy
const AUTOPLAY = new URLSearchParams(location.search).has("autoplay");   // hockey.html?autoplay = the computer plays for you


// ----- 3. BUILDING THE PLAYERS (real 3D people from Mixamo, in our hockey gear) -----
let cleanedShirt = null;
function rigBody(root, model, clips, T, faceNet) {
  model.scale.setScalar(0.0345);
  if (faceNet) model.rotation.y = Math.PI;
  model.position.y = 0.25;
  root.add(model);
  model.traverse(n => {
    if (!n.isMesh) return;
    n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false;
    n.material = n.material.clone();
    if (/Shirt/.test(n.name)) {
      n.material.map = cleanedShirt || (cleanedShirt = cleanShirt(n.material.map));
      n.material.normalMap = null;
      n.material.color.set(T.jersey);
    }
    if (/Shorts/.test(n.name)) n.material.color.set(T.pants || T.jersey);
    if (/Socks/.test(n.name)) n.material.color.set(T.jersey);
    if (n.isSkinnedMesh) n.skeleton.pose();
  });
  root.updateMatrixWorld(true);
  const bone = name => model.getObjectByName("mixamorig5" + name);
  const at = obj => obj.getWorldPosition(new THREE.Vector3());
  const rig = { model, bone, at };
  rig.hips = bone("Hips");
  rig.spine = ["Spine", "Spine1", "Spine2"].map(bone);
  rig.head = bone("Head");
  rig.headTop = bone("HeadTop_End");
  rig.mixer = new THREE.AnimationMixer(model);
  rig.actions = {};
  clips.forEach(clip => rig.actions[clip.name] = rig.mixer.clipAction(clip));
  rig.current = rig.actions.idle;
  rig.current.time = Math.random() * 5;   // so they don't all breathe at the same time
  rig.current.play();
  return rig;
}

function makeSkater5(team, info, gltf) {
  const T = Object.assign({}, team === "home" ? HOME : AWAY, { number: info.num });
  const S = makeShooter(T);
  const rig = rigBody(S.root, THREE.SkeletonUtils.clone(gltf.scene), gltf.animations, T, true);
  const { bone, at } = rig;
  const toRoot = p => S.root.worldToLocal(p.clone());
  rig.legs = ["Left", "Right"].map(side => ({ up: bone(side + "UpLeg"), low: bone(side + "Leg"), foot: bone(side + "Foot"), toe: bone(side + "ToeBase") }));
  rig.arms = ["Left", "Right"].map(side => ({ up: bone(side + "Arm"), fore: bone(side + "ForeArm"), hand: bone(side + "Hand"), finger: bone(side + "HandMiddle1") }));
  rig.thigh = at(rig.legs[0].up).distanceTo(at(rig.legs[0].low));
  rig.shin = at(rig.legs[0].low).distanceTo(at(rig.legs[0].foot));
  rig.upperArm = at(rig.arms[0].up).distanceTo(at(rig.arms[0].fore));
  rig.foreArm = at(rig.arms[0].fore).distanceTo(at(rig.arms[0].hand));
  S.legs.forEach((leg, i) => {
    leg.skate.position.copy(toRoot(at(rig.legs[i].foot)));
    leg.skate.rotation.set(0, 0, 0);
    rig.legs[i].foot.attach(leg.skate);
    [leg.thigh, leg.shin].forEach(m => m.visible = false);
    leg.knee.scale.setScalar(1.2);
    leg.thighSock.scale.set(1.35, 1, 1.35);
  });
  S.arms.forEach((arm, i) => {
    const hand = at(rig.arms[i].hand), finger = at(rig.arms[i].finger);
    const dir = toRoot(finger).sub(toRoot(hand)).normalize();
    arm.glove.position.copy(toRoot(hand.clone().lerp(finger, 0.6)));
    arm.glove.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    rig.arms[i].hand.attach(arm.glove);
    placeBetween(arm.cuff, toRoot(hand).addScaledVector(dir, -0.3), toRoot(hand).addScaledVector(dir, 0.05));
    rig.arms[i].hand.attach(arm.cuff);
    [arm.upper, arm.elbow, arm.fore].forEach(m => m.visible = false);
  });
  S.head.children[0].visible = false;
  S.root.attach(S.head);
  S.head.scale.setScalar(1.08);
  const number = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.85, 24, 1, true, -0.85, 1.7),
    new THREE.MeshStandardMaterial({ map: backNumberTexture(T), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 }));
  S.root.add(number);
  number.position.copy(toRoot(at(rig.spine[2])).add(V(0, -0.08, 0.02)));
  rig.spine[2].attach(number);
  const pants = addMesh(S.root, lathe([[0.47, -0.7], [0.55, -0.5], [0.57, -0.25], [0.54, 0], [0.5, 0.2], [0.45, 0.3], [0.01, 0.34]]),
    material("#ffffff", 0.55, { map: kitTexture("pants" + T.jersey, () => pantsTexture(T)) }));
  pants.scale.z = 0.8;
  pants.position.copy(toRoot(at(rig.hips)).add(V(0, -0.02, 0)));
  rig.hips.attach(pants);
  S.torso.visible = false;
  return { team, dir: team === "home" ? 1 : -1, role: info.role, num: info.num, S, rig,
           x: 0, z: 0, vx: 0, vz: 0, yaw: 0, stride: Math.random(), lean: 0.3, windup: 0, follow: 0,
           handle: 1.1, cooldown: 0, celebrate: 0, stunned: 0, phaseBefore: [0, 0] };
}

function makeGoalie5(team, gltf) {
  const T = Object.assign({}, team === "home" ? Object.assign({}, HOME, { pads: "#f4f4f4" }) : AWAY, { number: GOALIE_NUMBERS[team] });
  const G = makeGoalie(T);
  const rig = rigBody(G.root, THREE.SkeletonUtils.clone(gltf.scene), gltf.animations, T, false);
  const { bone, at } = rig;
  rig.legs = ["Right", "Left"].map(side => ({ up: bone(side + "UpLeg"), low: bone(side + "Leg"), foot: bone(side + "Foot"), toe: bone(side + "ToeBase") }));
  rig.arms = ["Right", "Left"].map(side => ({ up: bone(side + "Arm"), fore: bone(side + "ForeArm"), hand: bone(side + "Hand") }));
  rig.upperArm = at(rig.arms[0].up).distanceTo(at(rig.arms[0].fore));
  rig.foreArm = at(rig.arms[0].fore).distanceTo(at(rig.arms[0].hand));
  G.arms.forEach(a => [a.upper, a.fore, a.elbow].forEach(m => m.visible = false));
  G.root.attach(G.head);
  const end = team === "home" ? -1 : 1;          // the home goalie guards the net on the LEFT (z = -89)
  return { team, end, G, rig, x: 0, z: end * CREASE, speed: 0, butterfly: 0, reach: 0, reachX: 0, reachY: 3, holding: 0 };
}

function loadPlayers() {
  if (!window.PLAYER_MODEL) { phase = "menu"; banner = "Player model missing"; return; }
  const bytes = Uint8Array.from(atob(window.PLAYER_MODEL), c => c.charCodeAt(0));
  new THREE.GLTFLoader().parse(bytes.buffer, "", gltf => {
    ["home", "away"].forEach(team => {
      ROSTER[team].forEach(info => players.push(makeSkater5(team, info, gltf)));
      goalies[team] = makeGoalie5(team, gltf);
    });
    controlled = players[0];
    setFaceoff(0, 0);
    phase = "menu";
  }, err => console.warn("Could not load the player model", err));
}


// ----- 4. MOVING THE 3D BODIES -----
const turnAround = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle);
function poseSkater(sk, dt) {
  const S = sk.S, rig = sk.rig;
  const speed = Math.hypot(sk.vx, sk.vz);
  const skating = speed > 3 && sk.celebrate <= 0;
  S.root.position.copy(spot(sk.x, 0, sk.z));
  S.root.rotation.y = sk.yaw;
  if (skating) sk.stride += dt * (0.7 + speed * 0.055);
  const p = sk.stride % 1;
  sk.lean += ((skating ? 0.3 + speed * 0.008 + sk.windup * 0.15 : 0.25) - sk.lean) * Math.min(1, dt * 6);
  const hipsY = skating ? 2.92 + 0.05 * Math.cos(p * Math.PI * 4) : 3.02;
  const sway = skating ? 0.14 * Math.sin(p * Math.PI * 2) : 0;
  const twist = -sk.windup * 0.5 + sk.follow * 0.3 - (sk.handle - 1.1) * 0.12;
  S.torso.position.set(sway, hipsY, 0);
  S.torso.rotation.set(-sk.lean, twist, 0);
  S.root.updateMatrixWorld(true);

  // the recorded animation (idle breathing, or the fist pump after a goal)
  const want = sk.celebrate > 0 ? rig.actions.fistpump : rig.actions.idle;
  if (rig.current !== want) { want.reset().fadeIn(0.3).play(); rig.current.fadeOut(0.3); rig.current = want; }
  rig.mixer.update(dt);
  [S.shaft, S.knob, S.blade].forEach(o => o.visible = sk.celebrate <= 0);
  if (sk.celebrate > 0) { placeHelmet5(S, rig); return; }

  // legs: push out to the side and back, then recover
  const legTargets = [-1, 1].map((s, i) => {
    const ph = (p + i * 0.5) % 1;
    let ankle, yaw;
    if (!skating) { ankle = V(s * 0.5, 0.5, s * 0.2); yaw = -s * 0.1; }
    else if (ph < 0.62) { const u = ph / 0.62; ankle = V(s * (0.4 + 0.95 * u), 0.5, -0.25 + 1.15 * u); yaw = -s * (0.25 + 0.3 * u); }
    else { const u = (ph - 0.62) / 0.38; ankle = V(s * (1.35 - 0.95 * u), 0.5 + 0.4 * Math.sin(Math.PI * u), 0.9 - 1.15 * u); yaw = -s * 0.55 * (1 - u); }
    if (skating && sk.phaseBefore[i] < 0.55 && ph >= 0.55) {
      sprayAt(S.root.localToWorld(ankle.clone()), V(s * 0.8, 0, 0.6), 4, 4);
      if (sk === controlled) playCarve(0.4, 0.16);
    }
    sk.phaseBefore[i] = ph;
    return { ankle, yaw, side: s };
  });

  // hands and stick: the blade goes to the puck if he has it
  const toRoot = point => S.root.worldToLocal(S.torso.localToWorld(point));
  const topHand = toRoot(V(-0.12 - sk.windup * 0.2, 1.0 + sk.windup * 0.6 + sk.follow * 0.3, -0.72 + sk.windup * 0.3));
  const bladeAt = hpuck.carrier === sk ? S.root.worldToLocal(spot(hpuck.x, 0, hpuck.z)) : V(1.1, 0, -2.8);
  if (sk.windup > 0) bladeAt.lerp(V(2.4, 4.3, 1.8), sk.windup);
  if (sk.follow > 0) bladeAt.lerp(V(0.9, 2.6, -4.2), Math.sin(sk.follow * Math.PI));
  const along = V(bladeAt.x - topHand.x, 0, bladeAt.z - topHand.z).normalize();
  const face = V(along.z, 0, -along.x);
  if (face.z > 0) face.negate();
  const bladeCenter = bladeAt.clone().addScaledVector(face, -0.26);
  bladeCenter.y = Math.max(0.14, bladeCenter.y);
  const heel = bladeCenter.clone().addScaledVector(along, -0.48);
  const topEnd = topHand.clone().add(topHand.clone().sub(heel).normalize().multiplyScalar(0.35));
  placeBetween(S.shaft, heel, topEnd);
  placeBetween(S.knob, topEnd, topEnd.clone().lerp(topHand, 0.5), false);
  S.knob.position.lerp(topEnd, 0.6);
  S.blade.position.copy(bladeCenter);
  S.blade.rotation.set(0, Math.atan2(-along.z, along.x), 0);
  const lowHand = topHand.clone().lerp(heel, 0.32);

  // bend the real bones
  const right = V(1, 0, 0).applyQuaternion(S.root.quaternion);
  rig.hips.position.copy(rig.hips.parent.worldToLocal(S.root.localToWorld(V(sway, hipsY + 0.1, 0.1))));
  rig.hips.updateMatrixWorld(true);
  rig.spine.forEach(b => turnBoneWorld(b, turnAround(right, -sk.lean / 3)));
  turnBoneWorld(rig.spine[2], turnAround(UP, twist));
  turnBoneWorld(rig.head, turnAround(right, sk.lean * 0.75));
  legTargets.forEach((t, i) => {
    const L = rig.legs[i];
    const ankle = S.root.localToWorld(t.ankle.clone());
    const ik = twoBone(L.up.getWorldPosition(new THREE.Vector3()), ankle, rig.thigh, rig.shin, V(t.side * 0.3, 0, -1).applyQuaternion(S.root.quaternion));
    aimBone(L.up, L.low, ik.joint);
    aimBone(L.low, L.foot, ik.end);
    const leg = S.legs[i];
    const kneeAt = S.root.worldToLocal(ik.joint.clone()), hipAt = S.root.worldToLocal(L.up.getWorldPosition(new THREE.Vector3()));
    leg.knee.position.copy(kneeAt);
    placeBetween(leg.thighSock, hipAt.lerp(kneeAt, 0.6), kneeAt);
    aimBone(L.foot, L.toe, ik.end.clone().add(V(-Math.sin(t.yaw), -0.6, -Math.cos(t.yaw)).applyQuaternion(S.root.quaternion)));
  });
  [topHand, lowHand].forEach((hand, i) => {
    const A = rig.arms[i], side = i === 0 ? -1 : 1;
    const ik = twoBone(A.up.getWorldPosition(new THREE.Vector3()), S.root.localToWorld(hand.clone()), rig.upperArm, rig.foreArm, V(side, -0.6, 0.6).applyQuaternion(S.root.quaternion));
    aimBone(A.up, A.fore, ik.joint);
    aimBone(A.fore, A.hand, ik.end);
  });
  placeHelmet5(S, rig);
}
function placeHelmet5(S, rig) {
  S.root.updateMatrixWorld(true);
  const head = rig.head.getWorldPosition(new THREE.Vector3()), top = rig.headTop.getWorldPosition(new THREE.Vector3());
  const upDir = top.clone().sub(head).normalize().applyQuaternion(S.root.quaternion.clone().invert());
  S.head.position.copy(S.root.worldToLocal(head.lerp(top, 0.52))).add(V(0, 0.02, 0.04));
  S.head.quaternion.setFromUnitVectors(V(0, 1, 0), upDir);
}

function poseGoalie5(g, dt) {
  const G = g.G, rig = g.rig, b = g.butterfly;
  G.root.position.copy(spot(g.x, 0, g.z));
  const baseYaw = g.end > 0 ? 0 : Math.PI;                  // face out of the net
  const toPuck = Math.atan2(-(hpuck.x - g.x), hpuck.z - g.z) + Math.PI;
  let turn = toPuck - baseYaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  G.root.rotation.y = baseYaw + clamp(turn, -0.7, 0.7);
  const hipsY = lerp(2.55, 1.75, b);
  G.torso.position.set(0, hipsY, lerp(-0.15, -0.25, b));
  G.torso.rotation.set(lerp(0.28, 0.08, b), 0, -g.speed * 0.012);
  G.root.updateMatrixWorld(true);
  const legs = G.legs.map(leg => {
    const s = leg.side;
    const knee = V(lerp(s * 0.62, s * 0.38, b), lerp(1.55, 0.32, b), lerp(0.45, 0.3, b));
    const ankle = V(lerp(s * 1.05, s * 1.95, b), lerp(0.45, 0.3, b), lerp(0.05, -0.55, b));
    placeBetween(leg.thigh, V(s * 0.38, hipsY - 0.2, lerp(-0.15, -0.25, b)), knee);
    const upDir = knee.clone().sub(ankle).normalize();
    placeBetween(leg.pad, ankle.clone().addScaledVector(upDir, -0.3), knee.clone().addScaledVector(upDir, 0.55), false);
    leg.pad.position.z += 0.14;
    leg.skate.position.set(ankle.x, ankle.y + 0.08, ankle.z);
    return { knee, ankle };
  });
  const r = g.reach;
  G.glove.position.copy(V(1.3, lerp(2.95, 2.6, b), 0.85)).lerp(V(clamp(g.reachX, 0.7, 2.4), clamp(g.reachY, 1.2, 4.3), 1.1), g.reachX > 0 ? r : 0);
  G.blocker.position.copy(V(-1.2, 2.75, 0.85)).lerp(V(clamp(g.reachX, -2.4, -0.7), clamp(g.reachY, 2.0, 4.3), 1.1), g.reachX < 0 ? r : 0);
  rig.mixer.update(dt);
  G.root.updateMatrixWorld(true);
  const right = V(1, 0, 0).applyQuaternion(G.root.quaternion);
  rig.hips.position.copy(rig.hips.parent.worldToLocal(G.root.localToWorld(V(0, hipsY + 0.05, lerp(-0.15, -0.25, b)))));
  rig.hips.updateMatrixWorld(true);
  rig.spine.forEach(bn => turnBoneWorld(bn, turnAround(right, lerp(0.28, 0.08, b) / 3)));
  legs.forEach((t, i) => {
    const L = rig.legs[i];
    const knee = G.root.localToWorld(t.knee.clone()), ankle = G.root.localToWorld(t.ankle.clone());
    aimBone(L.up, L.low, knee);
    aimBone(L.low, L.foot, ankle);
    aimBone(L.foot, L.toe, ankle.clone().add(V(0, -0.5, 1).applyQuaternion(G.root.quaternion)));
  });
  [G.blocker, G.glove].forEach((hand, i) => {
    const A = rig.arms[i], s = i === 0 ? -1 : 1;
    const target = G.root.localToWorld(hand.position.clone().add(V(0, 0, -0.38)));
    const ik = twoBone(A.up.getWorldPosition(new THREE.Vector3()), target, rig.upperArm, rig.foreArm, V(s, -0.7, -0.3).applyQuaternion(G.root.quaternion));
    aimBone(A.up, A.fore, ik.joint);
    aimBone(A.fore, A.hand, ik.end);
  });
  const head = rig.head.getWorldPosition(new THREE.Vector3()), top = rig.headTop.getWorldPosition(new THREE.Vector3());
  const upDir = top.clone().sub(head).normalize().applyQuaternion(G.root.quaternion.clone().invert());
  G.head.position.copy(G.root.worldToLocal(head.lerp(top, 0.55))).add(V(0, 0.02, 0.03));
  G.head.quaternion.setFromUnitVectors(V(0, 1, 0), upDir);
}


// ----- 5. HELPERS FOR THE RULES -----
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const teamOf = team => players.filter(p => p.team === team);
const otherTeam = team => team === "home" ? "away" : "home";
// keep something inside the rink (the boards are rounded in the corners). Returns the wall direction if it hit.
function keepInRink(o, margin) {
  const hw = RINK.halfWidth - margin, hl = RINK.endBoards - margin, r = RINK.cornerRadius;
  const cx = clamp(o.x, -(hw - r), hw - r), cz = clamp(o.z, -(hl - r), hl - r);
  const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
  if (d <= r) return null;
  o.x = cx + dx / d * r; o.z = cz + dz / d * r;
  return { nx: dx / d, nz: dz / d };
}
// where the blade of a skater's stick is
function bladePoint(sk) {
  const s = Math.sin(sk.yaw), c = Math.cos(sk.yaw);
  const lx = sk.handle, lz = -3.0;          // next to him, in front
  return { x: sk.x + c * lx + s * lz, z: sk.z - (-s * lx + c * lz) };
}
function faceToward(sk, dx, dz, dt, speed) {
  const want = Math.atan2(-dx, dz);
  let d = want - sk.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  sk.yaw += clamp(d, -speed * dt, speed * dt);
}

function setFaceoff(dotX, dotZ) {
  hpuck.carrier = null; hpuck.passTo = null;
  Object.assign(hpuck, { x: dotX, y: 0, z: dotZ, vx: 0, vy: 0, vz: 0 });
  players.forEach(p => {
    const d = p.dir;
    const spots = { C: [0, -2.5], LW: [-16, -12], RW: [16, -12], LD: [-12, -30], RD: [12, -30] };
    const [sx, sz] = spots[p.role];
    p.x = clamp(dotX + sx * d, -36, 36); p.z = clamp(dotZ + sz * d, -84, 84);
    p.vx = p.vz = 0; p.yaw = d > 0 ? 0 : Math.PI; p.windup = 0; p.follow = 0; p.celebrate = 0;
  });
  Object.values(goalies).forEach(g => { g.x = 0; g.z = g.end * CREASE; g.butterfly = 0; g.holding = 0; });
  phase = "faceoff"; phaseTimer = 1.4;
  banner = ""; bannerSub = "";
}


// ----- 6. PLAYING -----
function shoot(sk, targetX, targetY, targetZ, speed) {
  const dx = targetX - hpuck.x, dz = targetZ - hpuck.z;
  const d = Math.hypot(dx, dz) || 1;
  const t = d / speed;
  hpuck.carrier = null; hpuck.passTo = null; hpuck.shooter = sk; hpuck.shotClock = 0;
  hpuck.vx = dx / d * speed; hpuck.vz = dz / d * speed;
  hpuck.vy = (targetY - 0.05) / t + 16 * t;     // just enough lift to arrive at that height
  sk.cooldown = 0.35; sk.follow = 0.01; sk.windup = 0;
  playClack();
}
function pass(sk, target) {
  const t = dist(hpuck.x, hpuck.z, target.x, target.z) / SHOT.pass;
  const leadX = target.x + target.vx * t, leadZ = target.z + target.vz * t;   // pass to where he'll be
  const dx = leadX - hpuck.x, dz = leadZ - hpuck.z, d = Math.hypot(dx, dz) || 1;
  hpuck.carrier = null; hpuck.passTo = target; hpuck.shooter = null;
  hpuck.vx = dx / d * SHOT.pass; hpuck.vz = dz / d * SHOT.pass; hpuck.vy = 0;
  sk.cooldown = 0.35; sk.follow = 0.01;
  playTap();
}
// the best teammate to pass to: the one closest to where you're aiming (or the most open one)
function passTarget(sk, aimX, aimZ) {
  let best = null, bestScore = -Infinity;
  teamOf(sk.team).forEach(t => {
    if (t === sk) return;
    const d = dist(sk.x, sk.z, t.x, t.z);
    if (d < 6 || d > 110) return;
    let s;
    if (aimX !== undefined) {
      const ax = aimX - sk.x, az = aimZ - sk.z, al = Math.hypot(ax, az) || 1;
      s = ((t.x - sk.x) * ax + (t.z - sk.z) * az) / (d * al);           // facing the aim
    } else {
      const open = Math.min(...teamOf(otherTeam(sk.team)).map(o => dist(o.x, o.z, t.x, t.z)));
      s = open / 20 + (t.z - sk.z) * sk.dir / 60;                         // open, and further up the ice
    }
    if (s > bestScore) { bestScore = s; best = t; }
  });
  return best;
}
function pokeCheck(sk) {
  if (sk.cooldown > 0) return;
  sk.cooldown = 0.6;
  const c = hpuck.carrier;
  if (c && c.team !== sk.team && dist(sk.x, sk.z, c.x, c.z) < 5.5) {
    const hard = Math.hypot(sk.vx, sk.vz) > 15;                 // skating fast = a body check!
    if (hard || Math.random() < 0.6) {
      hpuck.carrier = null; c.cooldown = 0.8;
      const a = Math.random() * Math.PI * 2;
      hpuck.vx = Math.cos(a) * 14 + c.vx; hpuck.vz = Math.sin(a) * 14 + c.vz;
      if (hard) { c.stunned = 0.8; c.vx *= 0.2; c.vz *= 0.2; playThud(false); crowdRoar(0.1, 0.8); }
      else playTap();
    }
  }
}

// YOU: skate with WASD, sprint with SHIFT
function controlPlayer(sk, dt) {
  const k = key => keys[key] || keys[key.toUpperCase()];
  let ix = 0, iz = 0;
  if (cameraMode === "tv") {                     // TV camera: right on the screen = toward the net you attack
    if (k("d")) iz += 1; if (k("a")) iz -= 1; if (k("w")) ix -= 1; if (k("s")) ix += 1;
  } else {                                       // behind camera: W = forward
    if (k("w")) iz += 1; if (k("s")) iz -= 1; if (k("d")) ix += 1; if (k("a")) ix -= 1;
  }
  const len = Math.hypot(ix, iz);
  const top = keys.Shift ? SKATING.sprint : SKATING.max;
  const wantVx = len ? ix / len * top : 0, wantVz = len ? iz / len * top : 0;
  const g = Math.min(1, SKATING.grip * dt);
  sk.vx += (wantVx - sk.vx) * g * (len ? 1 : 0.35);
  sk.vz += (wantVz - sk.vz) * g * (len ? 1 : 0.35);
  if (hpuck.carrier === sk && shootHold >= 0) {   // holding the mouse: wind up!
    shootHold += dt;
    sk.windup = Math.min(1, shootHold / 0.6) * 0.9;
  }
  const speed = Math.hypot(sk.vx, sk.vz);
  if (hpuck.carrier === sk) faceToward(sk, mouseOnIce.x - sk.x, mouseOnIce.z - sk.z, dt, 5);   // face where you aim
  else if (speed > 2) faceToward(sk, sk.vx, sk.vz, dt, 6);
}

// THE COMPUTER PLAYERS
function aiPlayer(sk, dt, think) {
  const mine = hpuck.carrier && hpuck.carrier.team === sk.team;
  const theirs = hpuck.carrier && hpuck.carrier.team !== sk.team;
  const netZ = sk.dir * RINK.goalLine;
  let tx, tz, top = SKATING.ai;
  if (hpuck.carrier === sk) {
    // I have the puck: skate toward the net, shoot when close, pass when someone is on me
    tx = clamp(sk.x * 0.6, -15, 15); tz = sk.dir * 72;
    top *= 0.92;
    if (think) {
      const toNet = (netZ - sk.z) * sk.dir;
      const pressure = Math.min(...teamOf(otherTeam(sk.team)).map(o => dist(o.x, o.z, sk.x, sk.z)));
      if (toNet < 42 && toNet > 8 && Math.abs(sk.x) < 28 && Math.random() < 0.45) {
        const corner = Math.random() < 0.5 ? -1 : 1;
        shoot(sk, corner * (1.5 + Math.random() * 1.2), 0.4 + Math.random() * 3.2, netZ, Math.random() < 0.3 ? SHOT.slap : SHOT.wrist);
      } else if (pressure < 7 && Math.random() < 0.5) {
        const t = passTarget(sk);
        if (t) pass(sk, t);
      } else if (Math.random() < 0.06) {
        const t = passTarget(sk);
        if (t && (t.z - sk.z) * sk.dir > 5) pass(sk, t);
      }
    }
  } else if (theirs || !hpuck.carrier) {
    // we don't have the puck: the closest one chases it, the others protect our net
    const chasers = teamOf(sk.team).filter(p => p !== controlled || AUTOPLAY).sort((a, b) => dist(a.x, a.z, hpuck.x, hpuck.z) - dist(b.x, b.z, hpuck.x, hpuck.z));
    const chaser = chasers[0] === sk || (!hpuck.carrier && chasers[1] === sk && dist(sk.x, sk.z, hpuck.x, hpuck.z) < 25);
    if (chaser || hpuck.passTo === sk) {
      tx = hpuck.x; tz = hpuck.z;
      if (theirs && think && Math.random() < 0.35) pokeCheck(sk);
    } else {
      const [sx, sz] = DEFEND_SPOTS[sk.role];
      tx = lerp(sx * sk.dir, hpuck.x, 0.3); tz = lerp(sz * sk.dir, hpuck.z, 0.25);
    }
  } else {
    // a teammate has the puck: get open in the attacking zone
    const [sx, sz] = ATTACK_SPOTS[sk.role];
    tx = sx * sk.dir; tz = lerp(sz * sk.dir, hpuck.z, 0.3);
    if (hpuck.passTo === sk) { tx = hpuck.x; tz = hpuck.z; }
  }
  const dx = tx - sk.x, dz = tz - sk.z, d = Math.hypot(dx, dz);
  const want = d > 1 ? Math.min(top, d * 2.5) : 0;
  const g = Math.min(1, SKATING.grip * 0.9 * dt);
  sk.vx += ((d ? dx / d * want : 0) - sk.vx) * g;
  sk.vz += ((d ? dz / d * want : 0) - sk.vz) * g;
  if (hpuck.carrier === sk) faceToward(sk, netZ * 0 + (0 - sk.x) * 0.3 + sk.vx, sk.vz + sk.dir * 4, dt, 4);
  else if (Math.hypot(sk.vx, sk.vz) > 2) faceToward(sk, sk.vx, sk.vz, dt, 6);
  else faceToward(sk, hpuck.x - sk.x, hpuck.z - sk.z, dt, 3);
}

function aiGoalie(g, dt) {
  const toward = (hpuck.z - g.z) * -g.end;                  // how far the puck is in front of him
  const coming = !hpuck.carrier && (hpuck.vz * g.end) > 20;   // a shot is coming at him
  let wantX = clamp(hpuck.x * (toward < 60 ? 0.35 : 0.1), -2.3, 2.3);
  const wantB = (coming && hpuck.y < 1.3 && toward < 40) || (toward < 10 && Math.abs(hpuck.x) < 8) ? 1 : 0;
  // come out to cut down the angle when the puck is far, back in when it's close
  const wantZ = g.end * (CREASE - clamp((toward - 15) * 0.05, 0, 2.2));
  const step = clamp(wantX - g.x, -6.5 * dt, 6.5 * dt);
  g.x += step; g.speed = step / Math.max(dt, 1e-3);
  g.z += clamp(wantZ - g.z, -3 * dt, 3 * dt);
  g.butterfly += (wantB - g.butterfly) * Math.min(1, dt * 10);
  g.reach = Math.max(0, g.reach - dt * 1.5);
}

// the puck: sliding, bouncing off the boards, saves, posts and GOALS
function updatePuck(dt) {
  const c = hpuck.carrier;
  if (c) {
    c.handle = 1.1 + Math.sin(performance.now() / 180 + c.stride) * 0.4;   // stickhandling
    const b = bladePoint(c);
    hpuck.x = b.x; hpuck.z = b.z; hpuck.y = 0;
    hpuck.vx = c.vx; hpuck.vz = c.vz; hpuck.vy = 0;
    hpuck.lastZ = hpuck.z;
    return;
  }
  hpuck.shotClock += dt;
  const prevZ = hpuck.z;
  hpuck.x += hpuck.vx * dt; hpuck.z += hpuck.vz * dt; hpuck.y += hpuck.vy * dt;
  hpuck.vy -= 32 * dt;
  if (hpuck.y < 0) { hpuck.y = 0; hpuck.vy = Math.abs(hpuck.vy) > 4 ? -hpuck.vy * 0.25 : 0; }
  const slow = Math.exp(-(hpuck.y > 0.05 ? 0.05 : 0.3) * dt);   // ice is slippery!
  hpuck.vx *= slow; hpuck.vz *= slow;
  const wall = keepInRink(hpuck, 0.25);
  if (wall) {
    const vn = hpuck.vx * wall.nx + hpuck.vz * wall.nz;
    if (vn > 0) { hpuck.vx -= 1.6 * vn * wall.nx; hpuck.vz -= 1.6 * vn * wall.nz; if (vn > 15) playThud(false); }
  }
  // the two nets
  for (const end of [1, -1]) {
    const g = goalies[end > 0 ? "away" : "home"];
    const towardNet = hpuck.vz * end > 0;
    // 1) the goalie gets a chance first
    if (g && towardNet && (prevZ - g.z) * (hpuck.z - g.z) <= 0 && Math.abs(hpuck.x) < 4.5 && hpuck.y < 5 && g.holding <= 0) {
      const dx = hpuck.x - g.x, y = hpuck.y, b = g.butterfly;
      const reacted = hpuck.shotClock > 0.16;
      const inFront = (y < 1.2 && Math.abs(dx) < (b > 0.5 ? 2.3 : 1.4)) || (Math.abs(dx) < 0.95 && y < (b > 0.5 ? 3.0 : 4.4)) || (reacted && y > 1.3 && Math.abs(dx) < 2.1);
      if ((inFront && Math.random() < GOALIE_SKILL) || Math.random() < 0.05) {
        const shooter = hpuck.shooter;
        if (shooter) shotsOnGoal[shooter.team]++;
        hpuck.shooter = null;
        g.reach = 1; g.reachX = dx; g.reachY = y;
        if (Math.random() < 0.35 && y > 0.8) {             // he catches it: whistle!
          g.holding = 1.2; hpuck.vx = hpuck.vz = hpuck.vy = 0; hpuck.x = g.x + 1.2; hpuck.z = g.z - end * 0.8; hpuck.y = 2.8;
          playWhistle(); crowdRoar(0.08, 1);
          phase = "stoppage"; phaseTimer = 1.6; banner = "SAVE!"; bannerSub = "The goalie covers it";
        } else {                                           // rebound!
          hpuck.vz = -hpuck.vz * 0.3; hpuck.vx = hpuck.vx * 0.3 + (Math.random() - 0.5) * 18; hpuck.vy = 3;
          hpuck.z = g.z - end * 0.6;
          playThud(false); crowdRoar(0.09, 0.8);
        }
        continue;
      }
    }
    // 2) did it cross the goal line between the posts?
    const line = end * RINK.goalLine;
    if (towardNet && (prevZ - line) * (hpuck.z - line) <= 0 && hpuck.y < NET.height) {
      if (Math.abs(hpuck.x) < NET.halfWidth - 0.15) { scoreGoal(end > 0 ? "home" : "away"); return; }
      if (Math.abs(hpuck.x) < NET.halfWidth + 0.2) { hpuck.vz = -hpuck.vz * 0.5; hpuck.vx += Math.sign(hpuck.x) * 6; playThud(true); crowdRoar(0.08, 0.6); }
    }
    // 3) the back and sides of the net are solid
    const behind = (hpuck.z - line) * end;
    if (behind > 0 && behind < NET.depth + 0.3 && Math.abs(hpuck.x) < NET.halfWidth + 0.4 && hpuck.y < NET.height) {
      if (Math.abs(hpuck.x) > NET.halfWidth - 0.3) { hpuck.vx = -hpuck.vx * 0.4; hpuck.x = Math.sign(hpuck.x) * (NET.halfWidth + 0.45); }
      else { hpuck.vz = -Math.abs(hpuck.vz) * 0.4 * end; hpuck.z = line + end * (NET.depth + 0.35); }
    }
  }
  hpuck.lastZ = hpuck.z;
  // can someone pick it up?
  if (hpuck.y < 1.2) {
    let best = null, bestD = 1.7;
    players.forEach(p => {
      if (p.cooldown > 0 || p.stunned > 0) return;
      const b = bladePoint(p);
      const d = dist(b.x, b.z, hpuck.x, hpuck.z);
      if (d < bestD && Math.hypot(hpuck.vx - p.vx, hpuck.vz - p.vz) < 75) { best = p; bestD = d; }
    });
    if (best) {
      hpuck.carrier = best; hpuck.passTo = null; hpuck.shooter = null;
      if (best.team === "home") controlled = best;              // you take over whoever gets the puck
      playTap();
    }
  }
}

function scoreGoal(team) {
  score[team]++; shotsOnGoal[team]++;
  const shooter = hpuck.shooter;
  hpuck.vx *= 0.15; hpuck.vz = Math.sign(hpuck.vz) * 4; hpuck.vy = 0;
  phase = "goal"; phaseTimer = 4;
  banner = team === "home" ? "GOAL!!! 🚨" : "THEY SCORED 😬";
  bannerSub = shooter ? "#" + shooter.num + " scores!" : "";
  if (team === "home") { playHorn(); crowdRoar(0.2, 3); goalLightTimer5 = 3; } else crowdRoar(0.05, 1.5);
  if (shooter) shooter.celebrate = 3.5;
}
let goalLightTimer5 = 0;

function moveSkaters(dt) {
  players.forEach(p => {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stunned = Math.max(0, p.stunned - dt);
    p.follow = p.follow > 0 ? Math.min(1, p.follow + dt * 3) : 0;
    if (p.follow >= 1) p.follow = 0;
    p.celebrate = Math.max(0, p.celebrate - dt);
    if (p.stunned > 0) { p.vx *= 0.9; p.vz *= 0.9; }
    p.x += p.vx * dt; p.z += p.vz * dt;
  });
  // don't skate through each other
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j], d = dist(a.x, a.z, b.x, b.z);
    if (d < 2.6 && d > 0.01) {
      const push = (2.6 - d) / 2, nx = (a.x - b.x) / d, nz = (a.z - b.z) / d;
      a.x += nx * push; a.z += nz * push; b.x -= nx * push; b.z -= nz * push;
    }
  }
  players.forEach(p => {
    const wall = keepInRink(p, 2);
    if (wall) { const vn = p.vx * wall.nx + p.vz * wall.nz; if (vn > 0) { p.vx -= vn * wall.nx; p.vz -= vn * wall.nz; } }
    for (const end of [1, -1]) {   // can't skate through the nets
      const behind = p.z * end - RINK.goalLine;
      if (behind > -1.2 && behind < NET.depth + 1.2 && Math.abs(p.x) < NET.halfWidth + 1.2) {
        if (Math.abs(p.x) > NET.halfWidth) p.x = Math.sign(p.x) * (NET.halfWidth + 1.2);
        else p.z = end * (behind < NET.depth / 2 ? RINK.goalLine - 1.2 : RINK.goalLine + NET.depth + 1.2);
      }
    }
  });
}


// ----- 7. THE GAME LOOP: rules, then bodies, then camera -----
function update5(dt) {
  phaseTimer -= dt;
  goalLightTimer5 -= dt;
  if (phase === "faceoff" && phaseTimer <= 0) {
    playWhistle();
    phase = "play";
    // the puck is dropped: someone wins the draw and pulls it back to a defenseman
    const winner = Math.random() < 0.5 ? "home" : "away";
    const back = winner === "home" ? -1 : 1;
    hpuck.vz = back * 14; hpuck.vx = (Math.random() - 0.5) * 8;
  }
  if (phase === "stoppage" && phaseTimer <= 0) {
    const end = hpuck.z > 0 ? 1 : -1;
    setFaceoff((hpuck.x >= 0 ? 1 : -1) * 22, end * 69);
  }
  if (phase === "goal" && phaseTimer <= 0) setFaceoff(0, 0);
  if (phase === "play") {
    gameClock -= dt;
    if (gameClock <= 0) {
      gameClock = 0;
      playHorn();
      if (period >= PERIODS && score.home !== score.away) { phase = "final"; banner = score.home > score.away ? "YOU WIN! 🏆" : "FINAL"; bannerSub = "Home " + score.home + " – " + score.away + " Away · click for a new game"; }
      else { phase = "intermission"; banner = period >= PERIODS ? "TIED! Overtime next" : "End of period " + period; bannerSub = "Click to start the next period"; }
    }
  }
  const playing = phase === "play";
  aiThink -= dt;
  const think = aiThink <= 0;
  if (think) aiThink = 0.2;
  players.forEach(p => {
    if (!playing) { p.vx *= 0.9; p.vz *= 0.9; return; }
    if (p.stunned > 0) return;
    if (p === controlled && !AUTOPLAY) controlPlayer(p, dt); else aiPlayer(p, dt, think && Math.random() < 0.7);
  });
  moveSkaters(dt);
  if (playing || phase === "goal") updatePuck(dt);
  Object.values(goalies).forEach(g => {
    if (playing) aiGoalie(g, dt);
    g.holding = Math.max(0, g.holding - dt);
  });
  updateSpray(dt);
}

let camLook = new THREE.Vector3();
function updateCamera5(dt) {
  let pos, look;
  if (cameraMode === "behind" && controlled) {
    pos = spot(controlled.x * 0.8, 11, clamp(controlled.z - 24, -92, 70));
    look = spot(controlled.x * 0.6, 1, clamp(controlled.z + 22, -60, 95));
  } else {   // TV camera, high up on the side of the rink
    const z = clamp(hpuck.z * 0.85, -62, 62);
    pos = spot(54, 28, z);
    look = spot(hpuck.x * 0.3, 0, clamp(hpuck.z, -75, 75));
  }
  const k = 1 - Math.pow(0.03, dt);
  camera.position.lerp(pos, k);
  camLook.lerp(look, k);
  camera.lookAt(camLook);
  sun.target.position.copy(spot(hpuck.x * 0.5, 0, hpuck.z));
  sun.position.copy(sun.target.position).add(V(18, 70, 30));
}

function drawBodies(dt) {
  players.forEach(p => poseSkater(p, dt));
  Object.values(goalies).forEach(g => poseGoalie5(g, dt));
  puckMesh.position.copy(spot(hpuck.x, hpuck.y + 0.042, hpuck.z));
  if (controlled) { youRing.visible = true; youRing.position.copy(spot(controlled.x, 0.03, controlled.z)); }
  const lightOn = goalLightTimer5 > 0 && Math.floor(goalLightTimer5 * 4) % 2 === 0;
  goalLight.intensity = lightOn ? 600 : 0;
  goalLamp.material.emissiveIntensity = lightOn ? 4 : 0.1;
}


// ----- 8. MOUSE AND KEYBOARD -----
const iceRay = new THREE.Raycaster();
renderer.domElement.addEventListener("mousemove", e => {
  iceRay.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = new THREE.Vector3();
  if (iceRay.ray.intersectPlane(new THREE.Plane(V(0, 1, 0), 0), hit)) mouseOnIce.set(hit.x, 0, -hit.z);   // (game z is flipped)
});
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
renderer.domElement.addEventListener("mousedown", e => {
  startAudio();
  if (phase === "menu") { setFaceoff(0, 0); return; }
  if (phase === "intermission") { period++; gameClock = period > PERIODS ? 180 : PERIOD_SECONDS; setFaceoff(0, 0); return; }
  if (phase === "final") { score.home = score.away = 0; shotsOnGoal.home = shotsOnGoal.away = 0; period = 1; gameClock = PERIOD_SECONDS; setFaceoff(0, 0); return; }
  if (phase !== "play" || !controlled) return;
  if (e.button === 2) { doPass(); return; }
  if (hpuck.carrier === controlled) shootHold = 0;     // start winding up
  else pokeCheck(controlled);
});
renderer.domElement.addEventListener("mouseup", e => {
  if (e.button !== 0 || shootHold < 0) return;
  const power = Math.min(1, shootHold / 0.6);
  shootHold = -1;
  if (hpuck.carrier !== controlled || phase !== "play") { controlled.windup = 0; return; }
  // shoot toward the mouse. If you aim near the net, the puck goes up into the net
  const netZ = RINK.goalLine;
  const nearNet = Math.abs(mouseOnIce.z - netZ) < 14 && Math.abs(mouseOnIce.x) < 10;
  const tz = nearNet ? netZ : mouseOnIce.z, tx = nearNet ? clamp(mouseOnIce.x, -2.9, 2.9) : mouseOnIce.x;
  const ty = nearNet ? clamp(1 + (mouseOnIce.z - netZ + 6) * 0.25 + Math.random(), 0.3, 3.7) : 0.3;
  shoot(controlled, tx, ty, tz, lerp(SHOT.wrist, SHOT.slap, power));
});
function doPass() {
  if (hpuck.carrier !== controlled) return;
  const t = passTarget(controlled, mouseOnIce.x, mouseOnIce.z);
  if (t) pass(controlled, t);
}
document.addEventListener("keydown", e => {
  if (phase !== "play" || !controlled) { if (e.key.toLowerCase() === "c") cameraMode = cameraMode === "tv" ? "behind" : "tv"; return; }
  const key = e.key.toLowerCase();
  if (key === "e") doPass();
  if (key === "q") {             // switch to the teammate closest to the puck
    const mates = teamOf("home").filter(p => p !== controlled).sort((a, b) => dist(a.x, a.z, hpuck.x, hpuck.z) - dist(b.x, b.z, hpuck.x, hpuck.z));
    if (mates[0] && hpuck.carrier !== controlled) controlled = mates[0];
  }
  if (key === " ") { e.preventDefault(); pokeCheck(controlled); }
  if (key === "c") cameraMode = cameraMode === "tv" ? "behind" : "tv";
});


// ----- 9. THE SCOREBOARD AND MESSAGES -----
const ordinal = n => n > PERIODS ? "OT" : ["1st", "2nd", "3rd"][n - 1];
function updateHud() {
  const m = Math.floor(gameClock / 60), s = Math.floor(gameClock % 60);
  $("homeScore").textContent = score.home;
  $("awayScore").textContent = score.away;
  $("period").textContent = ordinal(period);
  $("clock").textContent = m + ":" + String(s).padStart(2, "0");
  $("shots").textContent = "SHOTS " + shotsOnGoal.home + " – " + shotsOnGoal.away;
  $("menu").style.display = phase === "menu" || phase === "loading" ? "block" : "none";
  $("start").textContent = phase === "loading" ? "Loading players..." : "Click to drop the puck!";
  $("big").textContent = phase === "faceoff" ? "FACEOFF" : banner && phase !== "play" ? banner : "";
  $("sub").textContent = phase === "play" ? "" : bannerSub;
  $("you").textContent = controlled ? "You: #" + controlled.num + (hpuck.carrier === controlled ? " 🏒 has the puck" : "") : "";
}


// ----- 10. START! -----
loadPlayers();
let last5 = performance.now();
function loop5(now) {
  const dt = Math.min(0.05, (now - last5) / 1000);
  last5 = now;
  update5(dt);
  drawBodies(dt);
  updateCamera5(dt);
  updateHud();
  drawFrame();
  requestAnimationFrame(loop5);
}
camera.position.copy(spot(64, 34, 0));
requestAnimationFrame(loop5);
