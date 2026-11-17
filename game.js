// =====================================================================
//  SAROSH'S HOCKEY SHOOTOUT  (3D version!)
//  HOW TO PLAY:
//   1. Before the whistle, pick one of 10 real shootout moves
//   2. Skate in with the ARROW KEYS (up = faster, down = slower)
//   3. CLICK inside the net where you want the puck to go
//   4. 3 rounds against the other team. Tied? Sudden death!
//
//  We use "three.js", a 3D engine. It works like a movie set:
//   - a SCENE  (the stage where we put everything)
//   - a CAMERA (what the player sees)
//   - LIGHTS   (so things have shadows and shine)
//   - MESHES   (3D objects = a SHAPE + a MATERIAL, like "a ball made of rubber")
// =====================================================================

// ----- 1. SETTINGS: numbers you can change! -----
// Real NHL rink sizes, in feet
const RINK = {
  halfWidth: 42.5, endBoards: 100, cornerRadius: 28,
  goalLine: 89, blueLine: 25, boardHeight: 3.5, glassHeight: 8.5
};
const NET = { halfWidth: 3, height: 4, depth: 3.3 };   // the net is 6 feet wide, 4 feet tall

const SHOOTER_TEAM = { jersey: "#00539b", stripe: "#f47d30", pants: "#0a2a5c", number: "11" }; // blue + orange
const GOALIE_TEAM  = { jersey: "#0038a8", stripe: "#ce1126", pads: "#f4f4f4", number: "30" };  // blue + red + white

// The 10 moves! Each one has its own numbers:
//   prep   = how long the move takes before the puck is shot (seconds)
//   speed  = how fast the puck flies (feet per second)
//   error  = how much the shot can miss where you clicked (feet)
//   react  = extra time the goalie needs to react (seconds)
//   fake   = how fast you slide sideways to fake out the goalie
const MOVES = {
  wrist:    { name: "Wrist Shot",  icon: "🏒", info: "Quick & accurate",          prep: 0.14, speed: 82 },
  snap:     { name: "Snap Shot",   icon: "⚡", info: "Fastest release",           prep: 0.07, speed: 92, error: 0.15 },
  slap:     { name: "Slap Shot",   icon: "💥", info: "Hardest, big wind-up",      prep: 0.5,  speed: 118, error: 0.45, windup: true },
  backhand: { name: "Backhand",    icon: "↩️", info: "Hard for goalies to read",  prep: 0.28, speed: 58, error: 0.2, react: 0.08, backhand: true },
  deke:     { name: "Deke",        icon: "🔀", info: "Fake one way, go the other", prep: 0.35, speed: 52, fake: 18, bite: 1 },
  fivehole: { name: "Five-Hole",   icon: "🕳️", info: "Make him move, go between the legs", prep: 0.3, speed: 58, fake: 15, bite: 1, fiveHole: true },
  spin:     { name: "Spin-o-rama", icon: "🌀", info: "Spin 360° to lose him",     prep: 0.6,  speed: 50, fake: 10, bite: 0.7, spin: true, react: 0.12 },
  toedrag:  { name: "Toe Drag",    icon: "🦶", info: "Pull it back, then fire",   prep: 0.32, speed: 72, toeDrag: true },
  fakeshot: { name: "Shot Fake",   icon: "🎭", info: "He drops — go high!",       prep: 0.5,  speed: 64, windup: true, fakeShot: true },
  lacrosse: { name: "Lacrosse",    icon: "🥍", info: "Scoop it up and tuck it",   prep: 0.65, speed: 48, lacrosse: true, react: 0.12 }
};

const SHOOTOUT_ROUNDS = 3;
const SKATE = { startSpeed: 16, minSpeed: 8, maxSpeed: 24, sideSpeed: 10 };
const GOALIE_SETTINGS = { homeZ: 86.4, speed: 6.2, slideSpeed: 9, reactionTime: 0.15 };   // make speed bigger for a harder goalie!
const OTHER_TEAM_SCORES = 0.35;   // the chance the other team scores on YOUR goalie
const CAMERA_SETTINGS = { behind: 14, height: 7.5, side: 4, fieldOfView: 52 };

// In our game, "z" grows as you skate TOWARD the net.
// three.js likes it the other way around, so this helper flips z for us.
function spot(x, y, z) { return new THREE.Vector3(x, y, -z); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;


// ----- 2. SET UP THE 3D WORLD -----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // sharp on Retina screens
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;               // soft shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping;              // movie-like colors
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#06090e");
scene.fog = new THREE.Fog("#06090e", 170, 330);

const camera = new THREE.PerspectiveCamera(CAMERA_SETTINGS.fieldOfView, window.innerWidth / window.innerHeight, 0.3, 600);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Little helpers to make building things shorter
function material(color, roughness, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: roughness === undefined ? 0.6 : roughness }, extra || {}));
}
function addMesh(parent, shape, mat, x, y, z) {
  const mesh = new THREE.Mesh(shape, mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
// Point a mesh from a to b (like a bone). "stretch" makes it exactly as long as a->b.
const UP = new THREE.Vector3(0, 1, 0);
function placeBetween(mesh, a, b, stretch) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  mesh.position.copy(a).addScaledVector(direction, 0.5);
  if (stretch !== false) mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}
// A tapered tube, 1 unit long (radius at the start, radius at the end) for arms and legs
function taper(startRadius, endRadius) { return new THREE.CylinderGeometry(endRadius, startRadius, 1, 16); }
// A capsule (pill shape) with its "sticker" fixed so stripes aren't stretched
function capsule(radius, length, capSegments, sides) {
  const shape = new THREE.CapsuleGeometry(radius, length, capSegments, sides);
  const pos = shape.attributes.position, uv = shape.attributes.uv;
  const bottom = -length / 2 - radius, height = length + radius * 2;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - bottom) / height);
  return shape;
}
// A "lathe" shape: like a vase on a pottery wheel. We give it [radius, height] points from bottom to top.
// We use it for jerseys and hockey pants so they have real body shapes.
function lathe(profile, sides) {
  const shape = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), sides || 32);
  const pos = shape.attributes.position, uv = shape.attributes.uv;
  const y0 = profile[0][1], y1 = profile[profile.length - 1][1];
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
  return shape;
}
// Draw a picture with code, then use it as a "texture" (like a sticker wrapped on a 3D shape)
function paintTexture(width, height, paint) {
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  paint(c.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
// "Inverse kinematics": given a shoulder and where the hand should go, find where the elbow goes.
// (Same for hip -> knee -> foot.) "hint" says which way the joint should bend.
function twoBone(start, target, length1, length2, hint) {
  const dir = new THREE.Vector3().subVectors(target, start);
  const dist = clamp(dir.length(), Math.abs(length1 - length2) + 0.01, (length1 + length2) * 0.999);
  dir.normalize();
  const along = (length1 * length1 - length2 * length2 + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, length1 * length1 - along * along));
  const side = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  return {
    joint: start.clone().addScaledVector(dir, along).addScaledVector(side, out),
    end: start.clone().addScaledVector(dir, dist)
  };
}


// ----- 3. LIGHTS -----
// Reflections: a tiny pretend arena with bright ceiling lights, reflected by the shiny ice and helmets
function makeArenaReflections() {
  const room = new THREE.Scene();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(220, 90, 280), new THREE.MeshBasicMaterial({ color: "#1b212b", side: THREE.BackSide }));
  walls.position.y = 35;
  room.add(walls);
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 7, 6.5) });
  for (let i = -1; i <= 1; i++) {
    for (let j = -2; j <= 2; j++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), bright);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(i * 36, 70, j * 48);
      room.add(panel);
    }
  }
  const crowdGlow = new THREE.Mesh(new THREE.CylinderGeometry(100, 100, 24, 32, 1, true), new THREE.MeshBasicMaterial({ color: "#3a3550", side: THREE.BackSide }));
  crowdGlow.position.y = 18;
  room.add(crowdGlow);
  return new THREE.PMREMGenerator(renderer).fromScene(room, 0.02).texture;
}
scene.environment = makeArenaReflections();

scene.add(new THREE.HemisphereLight("#dbe8ff", "#39424f", 1.1));   // soft light from everywhere
const sun = new THREE.DirectionalLight("#ffffff", 2.2);            // the main arena light (makes shadows)
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;   sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1;   sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);


// ----- 4. THE RINK -----
// The shape of a rink: a rectangle with rounded corners
function rinkShape(halfWidth, halfLength, radius) {
  const s = new THREE.Shape();
  s.moveTo(-halfWidth, -halfLength + radius);
  s.lineTo(-halfWidth, halfLength - radius);
  s.absarc(-halfWidth + radius, halfLength - radius, radius, Math.PI, Math.PI / 2, true);
  s.lineTo(halfWidth - radius, halfLength);
  s.absarc(halfWidth - radius, halfLength - radius, radius, Math.PI / 2, 0, true);
  s.lineTo(halfWidth, -halfLength + radius);
  s.absarc(halfWidth - radius, -halfLength + radius, radius, 0, -Math.PI / 2, true);
  s.lineTo(-halfWidth + radius, -halfLength);
  s.absarc(-halfWidth + radius, -halfLength + radius, radius, -Math.PI / 2, -Math.PI, true);
  return s;
}
function grownRink(grow) { return rinkShape(RINK.halfWidth + grow, RINK.endBoards + grow, RINK.cornerRadius + grow); }

// The ice "sticker": all the lines, circles and skate scratches, painted with code
const PX = 16; // pixels per foot (more = sharper lines)
const iceTexture = paintTexture(RINK.halfWidth * 2 * PX, RINK.endBoards * 2 * PX, (ctx, w, h) => {
  const X = x => (x + RINK.halfWidth) * PX;      // rink feet -> picture pixels
  const Z = z => (RINK.endBoards - z) * PX;
  ctx.fillStyle = "#f2f7fb";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {               // tiny frosty speckles
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.6)" : "rgba(190,210,225,0.25)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const red = "#c8102e", blue = "#0b3fa8";
  const bar = (z1, z2, color) => { ctx.fillStyle = color; ctx.fillRect(0, Z(z2), w, (z2 - z1) * PX); };
  const ring = (x, z, r, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width * PX; ctx.beginPath(); ctx.arc(X(x), Z(z), r * PX, 0, Math.PI * 2); ctx.stroke(); };
  const dot = (x, z, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Z(z), r * PX, 0, Math.PI * 2); ctx.fill(); };
  const line = (x1, z1, x2, z2, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width * PX; ctx.beginPath(); ctx.moveTo(X(x1), Z(z1)); ctx.lineTo(X(x2), Z(z2)); ctx.stroke(); };

  ctx.globalAlpha = 0.9;  // the lines are painted UNDER the ice, so they look a bit faded
  bar(-0.5, 0.5, red);
  bar(RINK.blueLine, RINK.blueLine + 1, blue);
  bar(-RINK.blueLine - 1, -RINK.blueLine, blue);
  bar(RINK.goalLine, RINK.goalLine + 0.2, red);
  bar(-RINK.goalLine - 0.2, -RINK.goalLine, red);
  ring(0, 0, 15, 0.25, blue);  dot(0, 0, 0.5, blue);
  [-1, 1].forEach(end => {
    [-22, 22].forEach(x => {
      ring(x, end * 69, 15, 0.25, red);
      dot(x, end * 69, 1, red);
      dot(x, end * 20, 1, red);
      [-1, 1].forEach(side => [-1.5, 1.5].forEach(dz => line(x + side * 15, end * 69 + dz, x + side * 17, end * 69 + dz, 0.2, red)));
    });
    ctx.fillStyle = "#8fcdf4";
    ctx.beginPath();
    ctx.arc(X(0), Z(end * RINK.goalLine), 6 * PX, end > 0 ? 0 : Math.PI, end > 0 ? Math.PI : Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = red; ctx.lineWidth = 0.2 * PX; ctx.stroke();
    line(-11, end * RINK.goalLine, -14, end * RINK.endBoards, 0.2, red);
    line(11, end * RINK.goalLine, 14, end * RINK.endBoards, 0.2, red);
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(236,244,250,0.12)";
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 1.3;
  for (let i = 0; i < 2600; i++) {               // skate scratches
    let x = (Math.random() - 0.5) * 82, z = (Math.random() - 0.5) * 196, dir = Math.random() * Math.PI * 2;
    ctx.strokeStyle = "rgba(140,165,185," + (0.12 + Math.random() * 0.18) + ")";
    ctx.beginPath();
    ctx.moveTo(X(x), Z(z));
    for (let s = 0; s < 7; s++) {
      dir += (Math.random() - 0.5) * 0.35;
      x += Math.cos(dir) * 1.3; z += Math.sin(dir) * 1.3;
      ctx.lineTo(X(x), Z(z));
    }
    ctx.stroke();
  }
  for (let k = 8; k >= 1; k--) {                 // snow piled up along the boards
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = k * 0.45 * PX;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, RINK.cornerRadius * PX);
    ctx.stroke();
  }
});

const iceShapeGeo = new THREE.ShapeGeometry(grownRink(0), 32);
const icePositions = iceShapeGeo.attributes.position, iceUV = iceShapeGeo.attributes.uv;
for (let i = 0; i < icePositions.count; i++) {
  iceUV.setXY(i, (icePositions.getX(i) + RINK.halfWidth) / (RINK.halfWidth * 2), (icePositions.getY(i) + RINK.endBoards) / (RINK.endBoards * 2));
}
iceShapeGeo.rotateX(-Math.PI / 2);
const ice = new THREE.Mesh(iceShapeGeo, new THREE.MeshPhysicalMaterial({
  map: iceTexture, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9
}));
ice.receiveShadow = true;
scene.add(ice);

// Walls that go around the rink (boards, glass, ...)
function ringWall(innerGrow, outerGrow, fromHeight, toHeight, mat) {
  const outer = grownRink(outerGrow);
  outer.holes.push(grownRink(innerGrow));
  const shape = new THREE.ExtrudeGeometry(outer, { depth: toHeight - fromHeight, bevelEnabled: false, curveSegments: 24 });
  shape.rotateX(-Math.PI / 2);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(shape, mat);
  mesh.position.y = fromHeight;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
ringWall(0, 1.0, 0, RINK.boardHeight, material("#f6f6f1", 0.35));
ringWall(-0.04, 0.3, 0, 0.75, material("#f2c230", 0.4));
ringWall(-0.15, 1.15, RINK.boardHeight - 0.1, RINK.boardHeight + 0.15, material("#262a30", 0.5));
ringWall(1.0, 1.7, 0, 9.2, material("#0e1219", 0.9));
ringWall(0.3, 0.42, RINK.boardHeight + 0.15, RINK.glassHeight,
  new THREE.MeshPhysicalMaterial({ color: "#d8ecf7", roughness: 0.02, transparent: true, opacity: 0.13, depthWrite: false }));

// A band that follows the rink outline (used for the ads on the boards and for the crowd)
function band(grow, bottomHeight, topHeight, outward, uvLength, mat) {
  const outline = grownRink(grow).getPoints(20);
  const coreW = RINK.halfWidth - RINK.cornerRadius, coreL = RINK.endBoards - RINK.cornerRadius;
  const positions = [], uvs = [], index = [];
  let travelled = 0;
  outline.forEach((p, i) => {
    if (i > 0) travelled += p.distanceTo(outline[i - 1]);
    const out = new THREE.Vector2(p.x - clamp(p.x, -coreW, coreW), p.y - clamp(p.y, -coreL, coreL)).normalize();
    positions.push(p.x, bottomHeight, -p.y,  p.x + out.x * outward, topHeight, -(p.y + out.y * outward));
    uvs.push(travelled / uvLength, 0,  travelled / uvLength, 1);
    if (i > 0) { const a = (i - 1) * 2; index.push(a, a + 1, a + 2,  a + 1, a + 3, a + 2); }
  });
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  shape.setIndex(index);
  shape.computeVertexNormals();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(shape, mat);
  scene.add(mesh);
  return mesh;
}

// Ads on the boards (made-up ones!)
const adTexture = paintTexture(2048, 256, (ctx, w, h) => {
  const ads = [["#00539b", "white", "PUPPET HOCKEY"], ["#ffffff", "#0a2a5c", "SAROSH'S SHOOTOUT"],
               ["#f47d30", "white", "SHOOT HIGH!"], ["#0b1f3a", "#ffe14d", "GO TEAM GO!"]];
  ads.forEach(([bg, color, text], i) => {
    ctx.fillStyle = bg; ctx.fillRect(i * 512, 0, 512, h);
    ctx.fillStyle = color; ctx.font = "900 64px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, i * 512 + 256, h / 2, 480);
    ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(i * 512, 0, 4, h);
  });
});
adTexture.wrapS = THREE.RepeatWrapping;
band(-0.03, 0.85, 3.2, 0, 64, new THREE.MeshStandardMaterial({ map: adTexture, roughness: 0.4 }));

// Metal posts that hold the glass
const stanchionShape = new THREE.BoxGeometry(0.12, RINK.glassHeight - RINK.boardHeight - 0.15, 0.12);
const stanchionMat = new THREE.MeshStandardMaterial({ color: "#c9d3dc", roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.55 });
grownRink(0.36).getSpacedPoints(64).forEach(p => {
  const s = new THREE.Mesh(stanchionShape, stanchionMat);
  s.position.set(p.x, (RINK.glassHeight + RINK.boardHeight + 0.15) / 2, -p.y);
  scene.add(s);
});

// The crowd: rows of fans painted on a sloped "stands" shape all around the rink
const crowdTexture = paintTexture(1024, 1024, (ctx, w, h) => {
  ctx.fillStyle = "#12161d";
  ctx.fillRect(0, 0, w, h);
  const shirts = ["#00539b", "#f47d30", "#0038a8", "#ce1126", "#ffffff", "#2b2b2b", "#7a7a7a", "#f2c230", "#00539b", "#f47d30"];
  const skins = ["#f1c7a5", "#d9a27a", "#a8714d", "#6b4429", "#f5d6bf"];
  const rows = 28, rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    ctx.fillStyle = r % 2 ? "#1c222c" : "#171c25";
    ctx.fillRect(0, y, w, rowH);
    for (let x = 3; x < w - 14; x += 17 + Math.random() * 6) {
      if (Math.random() < 0.1) continue; // an empty seat
      ctx.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
      ctx.beginPath(); ctx.roundRect(x, y + rowH * 0.48, 13, rowH * 0.52, 4); ctx.fill();
      ctx.fillStyle = skins[Math.floor(Math.random() * skins.length)];
      ctx.beginPath(); ctx.arc(x + 6.5, y + rowH * 0.36, 5.2, 0, Math.PI * 2); ctx.fill();
    }
  }
});
crowdTexture.wrapS = THREE.RepeatWrapping;
band(1.7, 9.2, 58, 70, 26, new THREE.MeshStandardMaterial({
  map: crowdTexture, emissive: "#ffffff", emissiveMap: crowdTexture, emissiveIntensity: 0.3, roughness: 0.95
}));

// The red goal light behind the net (it flashes when you score!)
const goalLight = new THREE.PointLight("#ff2020", 0, 40);
goalLight.position.copy(spot(0, 10.5, RINK.endBoards + 1));
scene.add(goalLight);
const goalLamp = addMesh(scene, new THREE.CylinderGeometry(0.5, 0.5, 1, 16), new THREE.MeshStandardMaterial({ color: "#400", emissive: "#ff0000", emissiveIntensity: 0 }));
goalLamp.position.copy(spot(0, 10, RINK.endBoards + 1.4));


// ----- 5. THE NET -----
const netTexture = paintTexture(64, 64, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, w, h);
});
netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping;
netTexture.repeat.set(46, 16);
(function buildNet() {
  const red = material("#c8102e", 0.3, { metalness: 0.4 });
  const white = material("#f2f2f2", 0.5);
  const post = r => new THREE.CylinderGeometry(r, r, 1, 16);
  const gz = RINK.goalLine, hw = NET.halfWidth, top = NET.height;
  [[spot(-hw, 0, gz), spot(-hw, top, gz)], [spot(hw, 0, gz), spot(hw, top, gz)], [spot(-hw, top, gz), spot(hw, top, gz)]].forEach(([a, b]) => {
    placeBetween(addMesh(scene, post(0.12), red), a, b);
  });
  [spot(-hw, top, gz), spot(hw, top, gz)].forEach(p => addMesh(scene, new THREE.SphereGeometry(0.12, 16, 12), red).position.copy(p));
  const topEdge = u => V(-hw * Math.cos(Math.PI * u), top, gz + 1.1 * Math.sin(Math.PI * u));
  const bottomEdge = u => V(-hw * 0.95 * Math.cos(Math.PI * u), 0.05, gz + NET.depth * Math.sin(Math.PI * u));
  const cols = 48, rows = 14, positions = [], uvs = [], index = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows;
      const p = topEdge(u).lerp(bottomEdge(u), v);
      p.z += Math.sin(Math.PI * v) * 0.35 * Math.sin(Math.PI * u);
      positions.push(p.x, p.y, -p.z);
      uvs.push(u, v);
      if (i < cols && j < rows) {
        const a = j * (cols + 1) + i;
        index.push(a, a + cols + 1, a + 1,  a + 1, a + cols + 1, a + cols + 2);
      }
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mesh.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  mesh.setIndex(index);
  mesh.computeVertexNormals();
  const net = new THREE.Mesh(mesh, new THREE.MeshStandardMaterial({ color: "white", map: netTexture, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }));
  net.castShadow = true;
  scene.add(net);
  const curve = edge => new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, k) => { const p = edge(k / 16); return V(p.x, p.y, -p.z); }));
  addMesh(scene, new THREE.TubeGeometry(curve(bottomEdge), 48, 0.07, 8), white);
  addMesh(scene, new THREE.TubeGeometry(curve(topEdge), 48, 0.05, 8), white);
})();


// ----- 6. THE PLAYERS -----
// Jersey "sticker": stripes and a number
function jerseyTexture(team, isGoalie) {
  return paintTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = team.jersey; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.80, w, h * 0.025);
    ctx.fillStyle = team.stripe; ctx.fillRect(0, h * 0.825, w, h * 0.05);
    ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.875, w, h * 0.025);
    if (isGoalie) {
      ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.30, w, h * 0.02);
      ctx.fillStyle = team.stripe; ctx.fillRect(0, h * 0.32, w, h * 0.035);
      ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.355, w, h * 0.02);
    }
    ctx.font = "900 " + (isGoalie ? 70 : 120) + "px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 10; ctx.strokeStyle = team.stripe;
    const y = isGoalie ? h * 0.5 : h * 0.42;
    ctx.strokeText(team.number, w / 2, y);
    ctx.fillStyle = "white";
    ctx.fillText(team.number, w / 2, y);
  });
}
function stripeTexture(base, stripes) {
  return paintTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    stripes.forEach(([y, height, color]) => { ctx.fillStyle = color; ctx.fillRect(0, y * h, w, height * h); });
  });
}
function pantsTexture(team) {
  return paintTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = team.pants; ctx.fillRect(0, 0, w, h);
    [0.25, 0.75].forEach(u => {   // stripes down both sides
      ctx.fillStyle = "white";     ctx.fillRect(u * w - 9, 0, 18, h);
      ctx.fillStyle = team.stripe; ctx.fillRect(u * w - 5, 0, 10, h);
    });
  });
}

const black = material("#141414", 0.35);
const steel = material("#e3e7ec", 0.15, { metalness: 0.95 });
const skin = material("#d9a37f", 0.6);

// A hockey skate: boot, white holder, steel blade
function makeSkate(parent) {
  const skate = new THREE.Group();
  addMesh(skate, new THREE.BoxGeometry(0.34, 0.42, 0.78), black, 0, -0.08, -0.12);
  addMesh(skate, new THREE.SphereGeometry(0.18, 14, 10), black, 0, -0.17, -0.5).scale.set(1, 0.75, 1.1);   // toe
  addMesh(skate, new THREE.BoxGeometry(0.2, 0.3, 0.1), material("#d8d8d8", 0.4), 0, 0.12, 0.28);          // heel guard
  addMesh(skate, new THREE.BoxGeometry(0.12, 0.16, 1.0), material("#f0f0f0", 0.35), 0, -0.36, -0.15);     // holder
  addMesh(skate, new THREE.BoxGeometry(0.035, 0.11, 1.08), steel, 0, -0.47, -0.15);                       // blade
  parent.add(skate);
  return skate;
}

// THE SHOOTER (an athletic skater in full gear)
function makeShooter() {
  const T = SHOOTER_TEAM;
  const root = new THREE.Group();
  scene.add(root);
  const m = {
    jersey: material(T.jersey, 0.7),
    jerseyTex: material("#ffffff", 0.7, { map: jerseyTexture(T, false) }),
    pants: material("#ffffff", 0.55, { map: pantsTexture(T) }),
    socks: material("#ffffff", 0.7, { map: stripeTexture(T.jersey, [[0.30, 0.06, "white"], [0.36, 0.1, T.stripe], [0.46, 0.06, "white"]]) }),
    sleeve: material("#ffffff", 0.7, { map: stripeTexture(T.jersey, [[0.62, 0.05, "white"], [0.67, 0.09, T.stripe], [0.76, 0.05, "white"]]) }),
    glove: material(T.jersey, 0.5),
    cuff: material("#ffffff", 0.5, { map: stripeTexture(T.stripe, [[0.35, 0.25, "white"]]) }),
    helmet: material(T.jersey, 0.15, { metalness: 0.25 })
  };

  // upper body pivots at the hips
  const torso = new THREE.Group();
  root.add(torso);
  const jersey = addMesh(torso, lathe([[0.6, 0.12], [0.58, 0.45], [0.55, 0.8], [0.58, 1.1], [0.64, 1.36], [0.64, 1.52], [0.54, 1.68], [0.34, 1.8], [0.17, 1.85], [0.01, 1.86]]), m.jerseyTex);
  jersey.scale.z = 0.6;
  jersey.rotation.y = Math.PI;                    // number faces backward (toward the camera)
  const pants = addMesh(torso, lathe([[0.5, -0.5], [0.56, -0.3], [0.55, -0.05], [0.5, 0.25], [0.45, 0.35], [0.01, 0.4]]), m.pants);
  pants.scale.z = 0.75;
  [-1, 1].forEach(s => addMesh(torso, new THREE.SphereGeometry(0.3, 18, 12), m.jersey, s * 0.62, 1.5, 0).scale.set(1, 0.85, 0.8));
  addMesh(torso, new THREE.CylinderGeometry(0.16, 0.18, 0.3, 14), black, 0, 1.93, 0);

  const head = new THREE.Group();
  head.position.set(0, 2.18, -0.02);
  torso.add(head);
  addMesh(head, new THREE.SphereGeometry(0.29, 20, 14), skin, 0, -0.08, -0.07);
  addMesh(head, new THREE.SphereGeometry(0.4, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), m.helmet).scale.set(0.92, 1, 1.1);
  const visor = addMesh(head, new THREE.SphereGeometry(0.43, 24, 8, Math.PI * 1.5 - 0.95, 1.9, Math.PI * 0.42, Math.PI * 0.16),
    new THREE.MeshPhysicalMaterial({ color: "#a8c4d8", roughness: 0.05, transparent: true, opacity: 0.35 }));
  visor.scale.set(0.95, 1, 1.12);
  visor.castShadow = false;

  // legs: thigh, knee, shin (with socks), skate
  const legs = [-1, 1].map(s => ({
    side: s,
    thigh: addMesh(root, taper(0.33, 0.3), m.pants),        // hockey pants leg
    thighSock: addMesh(root, taper(0.22, 0.22), m.socks),     // sock above the knee
    knee: addMesh(root, new THREE.SphereGeometry(0.23, 14, 10), m.socks),
    shin: addMesh(root, taper(0.19, 0.24), m.socks),
    skate: makeSkate(root),
    phaseBefore: 0
  }));

  // arms: upper arm, elbow, forearm, glove cuff, glove
  const arms = [-1, 1].map(s => {
    const glove = addMesh(root, new THREE.SphereGeometry(0.21, 16, 12), m.glove);
    glove.scale.set(1, 0.85, 1.35);
    return {
      side: s,
      upper: addMesh(root, taper(0.2, 0.17), m.jersey),
      elbow: addMesh(root, new THREE.SphereGeometry(0.18, 14, 10), m.jersey),
      fore: addMesh(root, taper(0.17, 0.155), m.sleeve),
      cuff: addMesh(root, taper(0.2, 0.22), m.cuff),
      glove: glove
    };
  });

  // the stick: black shaft, white tape on the knob and the blade
  const shaft = addMesh(root, new THREE.BoxGeometry(0.09, 1, 0.065), material("#1c1c1c", 0.35));
  const knob = addMesh(root, new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12), material("#f2f2f2", 0.7));
  const blade = new THREE.Group();
  addMesh(blade, new THREE.BoxGeometry(1.0, 0.27, 0.05), material("#1c1c1c", 0.5));
  addMesh(blade, new THREE.BoxGeometry(0.7, 0.2, 0.056), material("#f2f2f2", 0.8), 0.05, 0, 0);
  root.add(blade);

  return { root, torso, head, legs, arms, shaft, knob, blade };
}

// THE GOALIE (big pads, chest protector, blocker, glove and mask)
function makeGoalie() {
  const T = GOALIE_TEAM;
  const root = new THREE.Group();
  scene.add(root);
  const jersey = material(T.jersey, 0.7);
  const white = material("#f4f4f4", 0.45);
  const redTrim = material(T.stripe, 0.5);
  const padMat = material("#ffffff", 0.5, { map: stripeTexture(T.pads, [[0.14, 0.05, T.stripe], [0.2, 0.05, T.jersey], [0.55, 0.05, T.stripe], [0.61, 0.05, T.jersey], [0.86, 0.04, T.stripe]]) });

  const torso = new THREE.Group();
  root.add(torso);
  const chest = addMesh(torso, lathe([[0.68, 0.1], [0.68, 0.5], [0.7, 0.9], [0.76, 1.22], [0.76, 1.42], [0.6, 1.62], [0.34, 1.75], [0.01, 1.78]]), material("#ffffff", 0.7, { map: jerseyTexture(T, true) }));
  chest.scale.z = 0.78;
  chest.rotation.y = Math.PI;
  addMesh(torso, lathe([[0.6, -0.8], [0.68, -0.5], [0.68, -0.1], [0.6, 0.25], [0.01, 0.3]]), jersey).scale.z = 0.8;
  [-1, 1].forEach(s => addMesh(torso, new THREE.SphereGeometry(0.4, 18, 12), jersey, s * 0.78, 1.42, 0));

  const head = new THREE.Group();
  head.position.set(0, 2.05, 0.04);
  torso.add(head);
  addMesh(head, new THREE.SphereGeometry(0.42, 28, 20), white).scale.set(0.95, 1.08, 1.05);
  addMesh(head, new THREE.SphereGeometry(0.44, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), material(T.jersey, 0.2, { metalness: 0.3 })).scale.set(0.95, 1.08, 1.05);
  const cage = material("#444", 0.35, { metalness: 0.7 });
  for (let i = -2; i <= 2; i++) addMesh(head, new THREE.BoxGeometry(0.025, 0.42, 0.025), cage, i * 0.09, -0.12, 0.42);
  [-0.22, -0.06].forEach(y => addMesh(head, new THREE.BoxGeometry(0.42, 0.025, 0.025), cage, 0, y, 0.43));

  // blocker (holds the stick) and catching glove
  const blocker = new THREE.Group();
  addMesh(blocker, new THREE.BoxGeometry(0.65, 1.1, 0.2), white);
  addMesh(blocker, new THREE.BoxGeometry(0.67, 0.1, 0.22), redTrim, 0, 0.5, 0);
  addMesh(blocker, new THREE.BoxGeometry(0.67, 0.1, 0.22), redTrim, 0, -0.5, 0);
  const stickMat = material("#2a1f16", 0.45);
  placeBetween(addMesh(blocker, new THREE.BoxGeometry(0.1, 1, 0.07), stickMat), V(0.05, -0.3, 0.1), V(0.4, -1.0, 0.3));
  placeBetween(addMesh(blocker, new THREE.BoxGeometry(0.3, 1, 0.06), stickMat), V(0.4, -1.0, 0.3), V(0.55, -2.55, 0.45));
  addMesh(blocker, new THREE.BoxGeometry(1.35, 0.28, 0.06), stickMat, 1.2, -2.55, 0.47);
  root.add(blocker);

  const glove = new THREE.Group();
  addMesh(glove, new THREE.SphereGeometry(0.55, 22, 16), jersey).scale.set(1, 1.12, 0.36);
  addMesh(glove, new THREE.SphereGeometry(0.32, 18, 12), redTrim, 0, -0.05, 0.12).scale.set(1, 1, 0.3);
  addMesh(glove, new THREE.BoxGeometry(0.5, 0.06, 0.06), white, 0, 0.45, 0.15);
  root.add(glove);

  const legs = [-1, 1].map(s => {
    const pad = addMesh(root, capsule(0.45, 1.45, 8, 18), padMat);
    pad.scale.set(1, 1, 0.58);
    return { side: s, thigh: addMesh(root, taper(0.32, 0.28), jersey), pad: pad, skate: addMesh(root, new THREE.BoxGeometry(0.34, 0.3, 0.9), black) };
  });
  const arms = [-1, 1].map(() => ({ upper: addMesh(root, taper(0.26, 0.22), jersey), fore: addMesh(root, taper(0.22, 0.2), jersey), elbow: addMesh(root, new THREE.SphereGeometry(0.24, 14, 10), jersey) }));

  return { root, torso, head, blocker, glove, legs, arms };
}

const shooterModel = makeShooter();
const goalieModel = makeGoalie();
const puckModel = addMesh(scene, new THREE.CylinderGeometry(0.25, 0.25, 0.085, 32), material("#0b0b0b", 0.35));

// a yellow ring that shows where you aimed
const aimMarker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), new THREE.MeshBasicMaterial({ color: "#ffe14d", transparent: true, depthTest: false }));
aimMarker.visible = false;
scene.add(aimMarker);

// Ice spray: little snow bits that fly up from the skates
const SPRAY = 400;
const sprayPositions = new Float32Array(SPRAY * 3).fill(-50);
const sprayVelocity = new Float32Array(SPRAY * 3);
const sprayLife = new Float32Array(SPRAY);
let sprayNext = 0;
const sprayShape = new THREE.BufferGeometry();
sprayShape.setAttribute("position", new THREE.BufferAttribute(sprayPositions, 3));
const spray = new THREE.Points(sprayShape, new THREE.PointsMaterial({ color: "#ffffff", size: 0.16, transparent: true, opacity: 0.85, depthWrite: false }));
spray.frustumCulled = false;
scene.add(spray);
function sprayAt(where, direction, count, power) {
  for (let n = 0; n < count; n++) {
    const i = sprayNext++ % SPRAY;
    sprayPositions[i * 3] = where.x; sprayPositions[i * 3 + 1] = 0.05; sprayPositions[i * 3 + 2] = where.z;
    sprayVelocity[i * 3] = (direction.x + (Math.random() - 0.5) * 0.8) * power;
    sprayVelocity[i * 3 + 1] = (0.4 + Math.random()) * power * 0.6;
    sprayVelocity[i * 3 + 2] = (direction.z + (Math.random() - 0.5) * 0.8) * power;
    sprayLife[i] = 0.4 + Math.random() * 0.4;
  }
}
function updateSpray(dt) {
  for (let i = 0; i < SPRAY; i++) {
    if (sprayLife[i] <= 0) continue;
    sprayLife[i] -= dt;
    sprayVelocity[i * 3 + 1] -= 18 * dt;
    for (let k = 0; k < 3; k++) sprayPositions[i * 3 + k] += sprayVelocity[i * 3 + k] * dt;
    if (sprayPositions[i * 3 + 1] < 0.03) { sprayPositions[i * 3 + 1] = 0.03; sprayVelocity[i * 3] *= 0.8; sprayVelocity[i * 3 + 2] *= 0.8; }
    if (sprayLife[i] <= 0) sprayPositions[i * 3 + 1] = -50;   // hide it
  }
  sprayShape.attributes.position.needsUpdate = true;
}


// ----- 7. GAME STATE: everything the game needs to remember -----
//   "menu" -> "ready" -> "skating" -> "move" -> "shot" -> "result" -> back to "menu"
let state = "menu";
let chosenMove = "wrist";
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

const keys = {};
document.addEventListener("keydown", e => { keys[e.key] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
document.addEventListener("keyup", e => { keys[e.key] = false; });


// ----- 8. SOUNDS (made with code, no sound files needed!) -----
let audio = null, crowdVolume = null;
function startAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();
  // crowd noise: random "hiss" shaped to sound like lots of people
  const noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  source.buffer = noise; source.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass"; filter.frequency.value = 700; filter.Q.value = 0.6;
  crowdVolume = audio.createGain();
  crowdVolume.gain.value = 0.02;
  source.connect(filter).connect(crowdVolume).connect(audio.destination);
  source.start();
}
function crowdRoar(level, seconds) {
  if (!audio) return;
  const now = audio.currentTime;
  crowdVolume.gain.cancelScheduledValues(now);
  crowdVolume.gain.setValueAtTime(crowdVolume.gain.value, now);
  crowdVolume.gain.linearRampToValueAtTime(level, now + 0.15);
  crowdVolume.gain.setTargetAtTime(0.02, now + seconds, 0.6);
}
function playWhistle() {
  if (!audio) return;
  const now = audio.currentTime;
  const tone = audio.createOscillator(), trill = audio.createOscillator();
  const trillAmount = audio.createGain(), volume = audio.createGain();
  tone.frequency.value = 2900; trill.frequency.value = 35; trillAmount.gain.value = 250;
  trill.connect(trillAmount).connect(tone.frequency);
  volume.gain.setValueAtTime(0, now);
  volume.gain.linearRampToValueAtTime(0.15, now + 0.03);
  volume.gain.setValueAtTime(0.15, now + 0.55);
  volume.gain.linearRampToValueAtTime(0, now + 0.65);
  tone.connect(volume).connect(audio.destination);
  tone.start(now); trill.start(now); tone.stop(now + 0.7); trill.stop(now + 0.7);
}
function playHorn() {
  if (!audio) return;
  const now = audio.currentTime, volume = audio.createGain();
  volume.gain.setValueAtTime(0, now);
  volume.gain.linearRampToValueAtTime(0.12, now + 0.05);
  volume.gain.setValueAtTime(0.12, now + 1.6);
  volume.gain.linearRampToValueAtTime(0, now + 1.9);
  volume.connect(audio.destination);
  [155, 196, 233].forEach(freq => {
    const o = audio.createOscillator();
    o.type = "sawtooth"; o.frequency.value = freq;
    o.connect(volume); o.start(now); o.stop(now + 2);
  });
}
function playThud(high) {
  if (!audio) return;
  const now = audio.currentTime, o = audio.createOscillator(), volume = audio.createGain();
  o.type = high ? "triangle" : "sine";
  o.frequency.setValueAtTime(high ? 1800 : 180, now);   // high = "PING!" off the post
  o.frequency.exponentialRampToValueAtTime(high ? 1500 : 60, now + 0.25);
  volume.gain.setValueAtTime(0.3, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + (high ? 0.6 : 0.25));
  o.connect(volume).connect(audio.destination);
  o.start(now); o.stop(now + 0.7);
}
function playClack() {   // stick hitting the puck
  if (!audio) return;
  const now = audio.currentTime, o = audio.createOscillator(), volume = audio.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(900, now);
  o.frequency.exponentialRampToValueAtTime(200, now + 0.05);
  volume.gain.setValueAtTime(0.12, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  o.connect(volume).connect(audio.destination);
  o.start(now); o.stop(now + 0.1);
}


// ----- 9. MENU BUTTONS AND CLICKING -----
const $ = id => document.getElementById(id);
Object.keys(MOVES).forEach(key => {
  const m = MOVES[key];
  const button = document.createElement("button");
  button.innerHTML = '<span class="icon">' + m.icon + "</span>" + m.name + "<small>" + m.info + "</small>";
  button.addEventListener("click", () => { startAudio(); chosenMove = key; startAttempt(); });
  $("moveButtons").appendChild(button);
});

const raycaster = new THREE.Raycaster();
const netPlane = new THREE.Plane(V(0, 0, 1), RINK.goalLine);  // an invisible wall at the goal line

renderer.domElement.addEventListener("click", e => {
  startAudio();
  if (state === "skating") {
    // Shoot an invisible laser from the camera through your mouse, and see where it hits the net
    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(netPlane, hit)) return;
    const target = { x: hit.x, y: hit.y };
    const insideNet = Math.abs(target.x) < NET.halfWidth + 0.2 && target.y > 0 && target.y < NET.height + 0.2;
    if (!insideNet) { hintText = "Click INSIDE the net!"; hintTimer = 1.5; return; }
    aimMarker.position.set(target.x, target.y, -RINK.goalLine + 0.05);
    aimMarker.visible = true;
    aimMarker.material.opacity = 1;
    beginMove(target);
  } else if (state === "result") {
    if (shootout.winner) { shootout.you = []; shootout.them = []; shootout.winner = null; }
    state = "menu";
  }
});


// ----- 10. GAME ACTIONS -----
function startAttempt() {
  Object.assign(shooter, { x: 0, z: 22, speed: SKATE.startSpeed, handle: 1.1, reach: 3.0, spin: 0, windup: 0, follow: 0 });
  Object.assign(goalie, { x: 0, z: GOALIE_SETTINGS.homeZ, speed: 0, wantButterfly: 0, wantGlove: 0, wantBlocker: 0 });
  puck.onStick = true; puck.y = 0;
  shot = null; action = null;
  aimMarker.visible = false;
  state = "ready"; timer = 0;
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
           flightTime: distance / m.speed, reaction: GOALIE_SETTINGS.reactionTime + (m.react || 0),
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

// After your shot: the other team shoots on your goalie, then we check who's winning
function finishAttempt(scored) {
  shootout.you.push(scored);
  const theyScore = Math.random() < OTHER_TEAM_SCORES;
  shootout.them.push(theyScore);
  theirText = theyScore ? "Their shooter scored on your goalie 😬" : "Your goalie stopped their shooter! 🧤";
  const n = shootout.you.length;
  const mine = shootout.you.filter(Boolean).length, theirs = shootout.them.filter(Boolean).length;
  if (n < SHOOTOUT_ROUNDS) {
    const left = SHOOTOUT_ROUNDS - n;
    if (mine > theirs + left) shootout.winner = "you";
    if (theirs > mine + left) shootout.winner = "them";
  } else if (mine !== theirs) {
    shootout.winner = mine > theirs ? "you" : "them";
  }
  if (shootout.winner === "you") crowdRoar(0.2, 3.5);
}


// ----- 11. UPDATE: move everything a tiny bit, many times per second -----
function update(dt) {
  clock += dt; timer += dt; hintTimer -= dt; goalLightTimer -= dt; shake = Math.max(0, shake - dt * 3);

  if (state === "ready" && timer > 1.2) {
    playWhistle();
    state = "skating"; timer = 0;
  }

  const skatingNow = state === "skating" || state === "move";
  if (skatingNow) {
    if (keys["ArrowUp"]) shooter.speed = Math.min(SKATE.maxSpeed, shooter.speed + 12 * dt);
    if (keys["ArrowDown"]) shooter.speed = Math.max(SKATE.minSpeed, shooter.speed - 12 * dt);
    const slow = action && action.move.windup ? 0.6 : 1;
    shooter.z += shooter.speed * slow * dt;
    if (state === "skating") {
      if (keys["ArrowLeft"]) shooter.x -= SKATE.sideSpeed * dt;
      if (keys["ArrowRight"]) shooter.x += SKATE.sideSpeed * dt;
      shooter.handle = 1.1 + Math.sin(clock * 5.5) * 0.45;   // stickhandling: the puck goes side to side
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
  if (state === "skating" && shooter.z > 77) {
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
        if (result.goal) { playHorn(); crowdRoar(0.17, 2.5); goalLightTimer = 3; shot.bounce = { vx: 0, vz: 6 }; }
        else if (result.post) { playThud(true); crowdRoar(0.08, 0.8); shake = 1; shot.bounce = { vx: puck.x > 0 ? 12 : -12, vz: -18 }; }
        else if (resultText.startsWith("Wide")) { crowdRoar(0.05, 0.6); shot.bounce = { vx: puck.x > 0 ? 6 : -6, vz: 14 }; }
        else { playThud(false); crowdRoar(0.06, 0.8); shot.bounce = { vx: (Math.random() - 0.5) * 20, vz: -15 }; }
      }
    } else {
      shot.timeAfter += dt;
      if (resultGoal) {
        puck.z = Math.min(RINK.goalLine + NET.depth - 0.6, puck.z + shot.bounce.vz * dt);
        puck.y = Math.max(0, puck.y - 4 * dt);
      } else {
        puck.x += shot.bounce.vx * dt;
        puck.z += shot.bounce.vz * dt;
        puck.y = Math.max(0, puck.y - 6 * dt);
      }
      if (shot.timeAfter > 1.0) {
        finishAttempt(resultGoal);
        sprayAt(spot(shooter.x, 0, shooter.z), V(1, 0, -0.5), 30, 8);   // hockey stop!
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
  if (state === "menu" || state === "ready") { goalie.wantButterfly = goalie.wantGlove = goalie.wantBlocker = 0; }
  const step = clamp(wants - goalie.x, -speed * dt, speed * dt);
  goalie.x += step;
  goalie.speed = dt > 0 ? step / dt : 0;
  const ease = Math.min(1, dt * 10);
  goalie.butterfly += (goalie.wantButterfly - goalie.butterfly) * ease;
  goalie.gloveReach += (goalie.wantGlove - goalie.gloveReach) * Math.min(1, ease * 1.4);
  goalie.blockerReach += (goalie.wantBlocker - goalie.blockerReach) * Math.min(1, ease * 1.4);

  updateSpray(dt);
}


// ----- 12. MOVE THE 3D MODELS TO MATCH THE GAME -----
let lean = 0.3;
function updateShooterModel(dt) {
  const S = shooterModel;
  const skating = state === "skating" || state === "move";
  S.root.position.copy(spot(shooter.x, 0, shooter.z));
  S.root.rotation.y = shooter.spin;

  // Skating stride: each leg pushes OUT to the side and back, then comes back under the body
  if (skating) shooter.stride += dt * (0.9 + shooter.speed * 0.055);
  const p = shooter.stride % 1;
  const wantLean = skating ? 0.5 + shooter.windup * 0.15 : 0.28;
  lean += (wantLean - lean) * Math.min(1, dt * 6);
  const hipsY = skating ? 2.92 + 0.05 * Math.cos(p * Math.PI * 4) : 3.05;
  const sway = skating ? 0.14 * Math.sin(p * Math.PI * 2) : 0;
  S.torso.position.set(sway, hipsY, 0);
  S.torso.rotation.set(-lean, -shooter.windup * 0.5 + shooter.follow * 0.3 - (shooter.handle - 1.1) * 0.12, 0);
  S.head.rotation.x = lean * 0.8;   // keep looking at the net
  S.root.updateMatrixWorld(true);

  S.legs.forEach((leg, i) => {
    const s = leg.side;
    const ph = (p + (i === 0 ? 0 : 0.5)) % 1;
    let ankle, yaw;
    if (!skating) {                 // gliding: feet under the body
      ankle = V(s * 0.55, 0.45, s * 0.2); yaw = -s * 0.1;
    } else if (ph < 0.62) {         // PUSH: out to the side and back
      const u = ph / 0.62;
      ankle = V(s * (0.4 + 0.95 * u), 0.45, -0.25 + 1.15 * u); yaw = -s * (0.25 + 0.3 * u);
    } else {                        // RECOVER: lift the skate and bring it back
      const u = (ph - 0.62) / 0.38;
      ankle = V(s * (1.35 - 0.95 * u), 0.45 + 0.4 * Math.sin(Math.PI * u), 0.9 - 1.15 * u); yaw = -s * 0.55 * (1 - u);
    }
    if (skating && leg.phaseBefore < 0.55 && ph >= 0.55) {   // snow flies when the push ends
      sprayAt(S.root.localToWorld(ankle.clone()), V(s * 0.8, 0, 0.6), 6, 4);
    }
    leg.phaseBefore = ph;
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
  placeBetween(S.knob, topEnd, topHand, false);
  S.knob.position.copy(topEnd);
  S.blade.position.copy(bladeCenter);
  S.blade.rotation.set(0, Math.atan2(-along.z, along.x), 0);
  if (lifted) S.blade.rotateX(-Math.PI / 2.2);
  const lowHand = topHand.clone().lerp(heel, 0.32);

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

  G.legs.forEach(leg => {
    const s = leg.side;
    const knee = V(lerp(s * 0.62, s * 0.38, b), lerp(1.55, 0.32, b), lerp(0.45, 0.3, b));
    const ankle = V(lerp(s * 1.05, s * 1.95, b) + s * shuffle, lerp(0.45, 0.3, b), lerp(0.05, -0.55, b));
    const hip = V(s * 0.38, hipsY - 0.2, lerp(-0.15, -0.25, b));
    placeBetween(leg.thigh, hip, knee);
    const up = knee.clone().sub(ankle).normalize();
    placeBetween(leg.pad, ankle.clone().addScaledVector(up, -0.3), knee.clone().addScaledVector(up, 0.55), false);   // big pads: from the skate to above the knee
    leg.skate.position.set(ankle.x, 0.15, ankle.z);
  });

  // hands: glove on the right of the screen, blocker on the left. They reach toward high shots.
  const tx = shot ? shot.toX - goalie.x : 0, ty = shot ? shot.toY : 3;
  const gloveRest = V(1.3, lerp(2.95, 2.6, b), 0.85), blockerRest = V(-1.2, 2.75, 0.85);
  G.glove.position.copy(gloveRest).lerp(V(clamp(tx, 0.7, 2.4), clamp(ty, 1.2, 4.3), 1.1), goalie.gloveReach);
  G.blocker.position.copy(blockerRest).lerp(V(clamp(tx, -2.4, -0.7), clamp(ty, 2.0, 4.3), 1.1), goalie.blockerReach);
  [G.blocker, G.glove].forEach((hand, i) => {
    const s = i === 0 ? -1 : 1;
    const shoulder = G.root.worldToLocal(G.torso.localToWorld(V(s * 0.78, 1.42, 0)));
    const ik = twoBone(shoulder, hand.position.clone().add(V(0, 0, -0.15)), 1.0, 0.95, V(s, -0.7, -0.3));
    placeBetween(G.arms[i].upper, shoulder, ik.joint);
    G.arms[i].elbow.position.copy(ik.joint);
    placeBetween(G.arms[i].fore, ik.joint, ik.end);
  });
}

const lookTarget = spot(0, 1, RINK.goalLine);
function updateCamera(dt) {
  let wantPos, wantLook;
  if (state === "result" && resultGoal && timer > 0.3) {
    // GOAL replay angle: from the side of the net
    wantPos = spot(9, 4.2, 79);
    wantLook = spot(0, 1.5, RINK.goalLine - 3);
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

function updateModels(dt) {
  updateShooterModel(dt);
  updateGoalieModel();
  puckModel.position.copy(spot(puck.x, puck.y + 0.042, puck.z));
  puckModel.visible = !(state === "result" && resultText === "POKE CHECK!");
  if (!puck.onStick && shot && !shot.done) puckModel.rotation.x += 0.4;
  const lightOn = goalLightTimer > 0 && Math.floor(goalLightTimer * 4) % 2 === 0;
  goalLight.intensity = lightOn ? 600 : 0;
  goalLamp.material.emissiveIntensity = lightOn ? 4 : 0.1;
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
  $("moveTag").textContent = MOVES[chosenMove].icon + " " + MOVES[chosenMove].name;
  let big = "", sub = "", color = "white";
  if (state === "ready") big = "Get ready...";
  if (state === "skating" && timer < 0.8) { big = "TWEEEET! GO!"; color = "#ffe14d"; }
  if (state === "result") {
    big = resultText;
    color = resultGoal ? "#ffe14d" : "white";
    sub = (resultText === "POKE CHECK!" ? "You got too close — shoot sooner!<br>" : "") + theirText + "<br>";
    if (shootout.winner === "you") sub += "🏆 YOU WIN THE SHOOTOUT! 🏆<br>Click for a new shootout";
    else if (shootout.winner === "them") sub += "They win this time... Click for a new shootout";
    else sub += "Click for the next round";
  }
  $("big").textContent = big;
  $("big").style.color = color;
  if ($("sub").innerHTML !== sub) $("sub").innerHTML = sub;
  $("hint").textContent = hintTimer > 0 ? hintText : (state === "skating" && timer > 0.8 ? "Click inside the net to do your " + MOVES[chosenMove].name + "!" : "");
  renderer.domElement.style.cursor = state === "skating" ? "crosshair" : (state === "result" ? "pointer" : "default");
}


// ----- 14. THE GAME LOOP: update, move models, draw, about 60 times every second! -----
let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  updateModels(dt);
  updateWords();
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
camera.position.copy(spot(CAMERA_SETTINGS.side, CAMERA_SETTINGS.height, shooter.z - CAMERA_SETTINGS.behind));
requestAnimationFrame(gameLoop);
