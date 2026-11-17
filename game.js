// =====================================================================
//  SAROSH'S HOCKEY SHOOTOUT  (3D version!)
//  HOW TO PLAY:
//   1. Pick your move: Wrist Shot or Deke
//   2. Wait for the whistle!
//   3. Skate with the ARROW KEYS (up = faster, down = slower)
//   4. CLICK inside the net where you want to shoot
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

const SHOOTER_TEAM = { jersey: "#00539b", stripe: "#f47d30", pants: "#0a2240", number: "11" }; // blue + orange
const GOALIE_TEAM  = { jersey: "#0038a8", stripe: "#ce1126", pads: "#f4f4f4", number: "30" };  // blue + red + white

const MOVES = {
  wrist: { name: "Wrist Shot", puckSpeed: 80 },  // feet per second
  deke:  { name: "Deke",       puckSpeed: 50 }   // slower shot, but it fakes out the goalie!
};

const SKATE = { startSpeed: 16, minSpeed: 8, maxSpeed: 24, sideSpeed: 10 };
const GOALIE_SETTINGS = { z: 86.6, speed: 7, reactionTime: 0.15 };
const CAMERA_SETTINGS = { behind: 13, height: 7, side: 3.8, fieldOfView: 55 };

// In our game, "z" grows as you skate TOWARD the net.
// three.js likes it the other way around, so this helper flips z for us.
function spot(x, y, z) { return new THREE.Vector3(x, y, -z); }


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
// Stretch a mesh (made 1 unit tall) between two points, like a stick or an arm
const UP = new THREE.Vector3(0, 1, 0);
function placeBetween(mesh, a, b) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  mesh.position.copy(a).addScaledVector(direction, 0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}
// A capsule (a pill shape). We fix its "sticker" so stripes and numbers aren't stretched.
function capsule(radius, length, capSegments, sides) {
  const shape = new THREE.CapsuleGeometry(radius, length, capSegments, sides);
  const pos = shape.attributes.position, uv = shape.attributes.uv;
  const bottom = -length / 2 - radius, height = length + radius * 2;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - bottom) / height);
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


// ----- 3. LIGHTS -----
// Reflections: we build a tiny pretend arena with bright ceiling lights,
// and the shiny ice + helmets reflect it.
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
sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
sun.shadow.camera.top = 38;   sun.shadow.camera.bottom = -38;
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
  bar(-0.5, 0.5, red);                                  // center red line
  bar(RINK.blueLine, RINK.blueLine + 1, blue);          // blue lines
  bar(-RINK.blueLine - 1, -RINK.blueLine, blue);
  bar(RINK.goalLine, RINK.goalLine + 0.2, red);         // goal lines
  bar(-RINK.goalLine - 0.2, -RINK.goalLine, red);
  ring(0, 0, 15, 0.25, blue);  dot(0, 0, 0.5, blue);   // center circle
  [-1, 1].forEach(end => {
    [-22, 22].forEach(x => {
      ring(x, end * 69, 15, 0.25, red);                 // face-off circles
      dot(x, end * 69, 1, red);
      dot(x, end * 20, 1, red);                         // neutral zone dots
      [-1, 1].forEach(side => [-1.5, 1.5].forEach(dz => line(x + side * 15, end * 69 + dz, x + side * 17, end * 69 + dz, 0.2, red)));
    });
    // goalie crease
    ctx.fillStyle = "#8fcdf4";
    ctx.beginPath();
    ctx.arc(X(0), Z(end * RINK.goalLine), 6 * PX, end > 0 ? 0 : Math.PI, end > 0 ? Math.PI : Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = red; ctx.lineWidth = 0.2 * PX; ctx.stroke();
    // trapezoid behind the net
    line(-11, end * RINK.goalLine, -14, end * RINK.endBoards, 0.2, red);
    line(11, end * RINK.goalLine, 14, end * RINK.endBoards, 0.2, red);
  });
  ctx.globalAlpha = 1;

  // a thin layer of ice on top of the paint
  ctx.fillStyle = "rgba(236,244,250,0.12)";
  ctx.fillRect(0, 0, w, h);

  // skate scratches
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 2600; i++) {
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

  // snow piled up along the boards
  for (let k = 8; k >= 1; k--) {
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = k * 0.45 * PX;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, RINK.cornerRadius * PX);
    ctx.stroke();
  }
});

// The ice itself: a flat rounded rectangle, very shiny
const iceShapeGeo = new THREE.ShapeGeometry(rinkShape(RINK.halfWidth, RINK.endBoards, RINK.cornerRadius), 32);
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
  const outer = rinkShape(RINK.halfWidth + outerGrow, RINK.endBoards + outerGrow, RINK.cornerRadius + outerGrow);
  outer.holes.push(rinkShape(RINK.halfWidth + innerGrow, RINK.endBoards + innerGrow, RINK.cornerRadius + innerGrow));
  const shape = new THREE.ExtrudeGeometry(outer, { depth: toHeight - fromHeight, bevelEnabled: false, curveSegments: 24 });
  shape.rotateX(-Math.PI / 2);
  mat.side = THREE.DoubleSide;   // show both sides of the wall
  const mesh = new THREE.Mesh(shape, mat);
  mesh.position.y = fromHeight;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
ringWall(0, 1.0, 0, RINK.boardHeight, material("#f6f6f1", 0.35));                // white boards
ringWall(-0.04, 0.3, 0, 0.75, material("#f2c230", 0.4));                         // yellow kickplate
ringWall(-0.15, 1.15, RINK.boardHeight - 0.1, RINK.boardHeight + 0.15, material("#262a30", 0.5)); // rail on top
ringWall(1.0, 1.7, 0, 9.2, material("#0e1219", 0.9));                            // dark wall behind the glass
ringWall(0.3, 0.42, RINK.boardHeight + 0.15, RINK.glassHeight,                   // see-through glass
  new THREE.MeshPhysicalMaterial({ color: "#d8ecf7", roughness: 0.02, transparent: true, opacity: 0.13, depthWrite: false }));

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
(function buildStands() {
  const outline = rinkShape(RINK.halfWidth + 1.7, RINK.endBoards + 1.7, RINK.cornerRadius + 1.7).getPoints(20);
  const coreW = RINK.halfWidth - RINK.cornerRadius, coreL = RINK.endBoards - RINK.cornerRadius;
  const positions = [], uvs = [], index = [];
  let travelled = 0;
  outline.forEach((p, i) => {
    if (i > 0) travelled += p.distanceTo(outline[i - 1]);
    const out = new THREE.Vector2(p.x - Math.max(-coreW, Math.min(coreW, p.x)), p.y - Math.max(-coreL, Math.min(coreL, p.y))).normalize();
    positions.push(p.x, 9.2, -p.y,  p.x + out.x * 70, 58, -(p.y + out.y * 70));
    uvs.push(travelled / 26, 0,  travelled / 26, 1);
    if (i > 0) { const a = (i - 1) * 2; index.push(a, a + 1, a + 2,  a + 1, a + 3, a + 2); }
  });
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  shape.setIndex(index);
  shape.computeVertexNormals();
  scene.add(new THREE.Mesh(shape, new THREE.MeshStandardMaterial({
    map: crowdTexture, emissive: "#ffffff", emissiveMap: crowdTexture, emissiveIntensity: 0.3, roughness: 0.95, side: THREE.DoubleSide
  })));
})();

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
  // posts and crossbar
  [[spot(-hw, 0, gz), spot(-hw, top, gz)], [spot(hw, 0, gz), spot(hw, top, gz)], [spot(-hw, top, gz), spot(hw, top, gz)]].forEach(([a, b]) => {
    placeBetween(addMesh(scene, post(0.12), red), a, b);
  });
  [spot(-hw, top, gz), spot(hw, top, gz)].forEach(p => addMesh(scene, new THREE.SphereGeometry(0.12, 16, 12), red).position.copy(p));
  // the white mesh: a curved "bag" from the crossbar down to the back of the net
  const topEdge = u => new THREE.Vector3(-hw * Math.cos(Math.PI * u), top, gz + 1.1 * Math.sin(Math.PI * u));
  const bottomEdge = u => new THREE.Vector3(-hw * 0.95 * Math.cos(Math.PI * u), 0.05, gz + NET.depth * Math.sin(Math.PI * u));
  const cols = 48, rows = 14, positions = [], uvs = [], index = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows;
      const p = topEdge(u).lerp(bottomEdge(u), v);
      p.z += Math.sin(Math.PI * v) * 0.35 * Math.sin(Math.PI * u);   // a little bulge
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
  // white frame along the bottom and the top shelf
  const curve = edge => new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, k) => { const p = edge(k / 16); return new THREE.Vector3(p.x, p.y, -p.z); }));
  addMesh(scene, new THREE.TubeGeometry(curve(bottomEdge), 48, 0.07, 8), white);
  addMesh(scene, new THREE.TubeGeometry(curve(topEdge), 48, 0.05, 8), white);
})();


// ----- 6. THE PLAYERS -----
// Jersey "sticker": stripes and a number
function jerseyTexture(team, chestStripe) {
  return paintTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = team.jersey; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.74, w, h * 0.04);
    ctx.fillStyle = team.stripe; ctx.fillRect(0, h * 0.78, w, h * 0.07);
    ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.85, w, h * 0.04);
    if (chestStripe) {
      ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.30, w, h * 0.03);
      ctx.fillStyle = team.stripe; ctx.fillRect(0, h * 0.33, w, h * 0.05);
      ctx.fillStyle = "white";     ctx.fillRect(0, h * 0.38, w, h * 0.03);
    }
    ctx.font = "900 " + (chestStripe ? 50 : 92) + "px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 8; ctx.strokeStyle = team.stripe;
    const y = chestStripe ? h * 0.56 : h * 0.47;
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

const black = material("#141414", 0.35);
const steel = material("#dfe3e8", 0.2, { metalness: 0.9 });
const limbShape = new THREE.CylinderGeometry(1, 1, 1, 12);   // stretched into arms

// THE SHOOTER (seen from behind)
function makeShooter() {
  const T = SHOOTER_TEAM;
  const root = new THREE.Group();
  const jersey = material(T.jersey, 0.65);
  const pants = material(T.pants, 0.7);
  const socks = material("#ffffff", 0.7, { map: stripeTexture(T.jersey, [[0.35, 0.08, "white"], [0.43, 0.12, T.stripe], [0.55, 0.08, "white"]]) });

  const legs = [-1, 1].map(side => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.36, 2.75, 0);
    addMesh(leg, capsule(0.3, 0.55, 6, 14), pants, 0, -0.45, 0);
    addMesh(leg, capsule(0.21, 1.0, 6, 14), socks, 0, -1.45, 0);
    addMesh(leg, new THREE.BoxGeometry(0.34, 0.42, 0.95), black, 0, -2.42, -0.1);
    addMesh(leg, new THREE.BoxGeometry(0.05, 0.12, 1.15), steel, 0, -2.68, -0.1);
    root.add(leg);
    return leg;
  });

  const body = new THREE.Group();
  body.position.y = 2.75;
  root.add(body);
  addMesh(body, new THREE.SphereGeometry(1, 24, 16), pants, 0, 0.15, 0).scale.set(0.74, 0.5, 0.56);
  const torso = addMesh(body, capsule(0.5, 0.95, 8, 24), material("#ffffff", 0.65, { map: jerseyTexture(T, false) }), 0, 1.3, 0);
  torso.scale.set(1.25, 1, 0.8);
  torso.rotation.y = Math.PI;   // turn the number to face the camera
  const shoulders = [-1, 1].map(side => addMesh(body, new THREE.SphereGeometry(0.34, 16, 12), jersey, side * 0.62, 1.95, 0));
  addMesh(body, new THREE.CylinderGeometry(0.17, 0.2, 0.3, 12), black, 0, 2.35, 0);
  addMesh(body, new THREE.SphereGeometry(0.42, 28, 20), material(T.jersey, 0.2, { metalness: 0.15 }), 0, 2.8, 0.02).scale.set(1, 1.02, 1.12);

  // Arms, gloves and stick live in the scene (we move them every frame to hold the stick)
  const arm = () => addMesh(scene, limbShape, jersey);
  const arms = { upperL: arm(), lowerL: arm(), upperR: arm(), lowerR: arm() };
  [arms.upperL, arms.upperR].forEach(a => a.scale.set(0.19, 1, 0.19));
  [arms.lowerL, arms.lowerR].forEach(a => a.scale.set(0.16, 1, 0.16));
  const elbows = [0, 1].map(() => addMesh(scene, new THREE.SphereGeometry(0.18, 12, 10), jersey));
  const gloves = [0, 1].map(() => { const g = addMesh(scene, new THREE.SphereGeometry(0.24, 14, 10), material(T.stripe, 0.55)); g.scale.set(1, 1, 1.25); return g; });
  const shaft = addMesh(scene, new THREE.BoxGeometry(0.1, 1, 0.07), material("#202020", 0.4));
  const blade = addMesh(scene, new THREE.BoxGeometry(0.95, 0.28, 0.06), material("#151515", 0.6));

  scene.add(root);
  return { root, body, legs, shoulders, arms, elbows, gloves, shaft, blade };
}

// THE GOALIE (facing us)
function makeGoalie() {
  const T = GOALIE_TEAM;
  const root = new THREE.Group();
  const jersey = material(T.jersey, 0.65);
  const white = material("#f4f4f4", 0.45);
  const padMat = material("#ffffff", 0.5, { map: stripeTexture(T.pads, [[0.18, 0.06, T.stripe], [0.26, 0.06, T.jersey], [0.62, 0.06, T.stripe], [0.70, 0.06, T.jersey]]) });

  const pads = [-1, 1].map(side => {
    const pad = addMesh(root, capsule(0.45, 1.75, 8, 18), padMat, side * 0.55, 1.35, 0.25);
    pad.scale.set(1, 1, 0.65);
    addMesh(root, new THREE.BoxGeometry(0.35, 0.3, 0.9), black, side * 0.55, 0.15, 0);
    return pad;
  });

  const body = new THREE.Group();
  root.add(body);
  addMesh(body, new THREE.SphereGeometry(1, 24, 16), jersey, 0, 2.7, 0).scale.set(0.95, 0.6, 0.75);
  const chest = addMesh(body, capsule(0.62, 0.9, 8, 24), material("#ffffff", 0.65, { map: jerseyTexture(T, true) }), 0, 3.85, 0);
  chest.scale.set(1.3, 1, 0.85);
  chest.rotation.y = Math.PI;
  const shoulders = [-1, 1].map(side => addMesh(body, new THREE.SphereGeometry(0.45, 16, 12), jersey, side * 0.85, 4.45, 0));

  // mask with a cage
  addMesh(body, new THREE.SphereGeometry(0.45, 28, 20), white, 0, 5.0, 0.05);
  addMesh(body, new THREE.SphereGeometry(0.47, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.3), material(T.jersey, 0.25, { metalness: 0.2 }), 0, 5.02, 0.02);
  const cage = material("#555", 0.4, { metalness: 0.6 });
  for (let i = -2; i <= 2; i++) addMesh(body, new THREE.BoxGeometry(0.03, 0.45, 0.03), cage, i * 0.1, 4.88, 0.47);
  [4.78, 4.98].forEach(y => addMesh(body, new THREE.BoxGeometry(0.46, 0.03, 0.03), cage, 0, y, 0.47));

  // blocker (screen left) and catching glove (screen right)
  const blocker = new THREE.Group();
  addMesh(blocker, new THREE.BoxGeometry(0.25, 1.05, 0.8), white);
  addMesh(blocker, new THREE.BoxGeometry(0.27, 0.12, 0.82), material(T.stripe, 0.5), 0, 0.42, 0);
  body.add(blocker);
  const glove = new THREE.Group();
  addMesh(glove, new THREE.SphereGeometry(0.52, 20, 14), jersey).scale.set(1, 1.1, 0.38);
  addMesh(glove, new THREE.SphereGeometry(0.3, 16, 12), material(T.stripe, 0.5), 0, 0, 0.12).scale.set(1, 1, 0.3);
  body.add(glove);

  // goalie stick
  const stickMat = material("#2a1f16", 0.5);
  placeBetween(addMesh(body, new THREE.BoxGeometry(0.1, 1, 0.07), stickMat), new THREE.Vector3(-1.2, 2.6, 0.6), new THREE.Vector3(-0.5, 1.9, 0.95));
  placeBetween(addMesh(body, new THREE.BoxGeometry(0.28, 1, 0.06), stickMat), new THREE.Vector3(-0.5, 1.9, 0.95), new THREE.Vector3(-0.35, 0.3, 1.05));
  addMesh(body, new THREE.BoxGeometry(1.4, 0.3, 0.06), stickMat, 0.3, 0.17, 1.08);

  const arms = [0, 1].map(() => { const a = addMesh(scene, limbShape, jersey); a.scale.set(0.27, 1, 0.27); return a; });

  scene.add(root);
  return { root, body, pads, shoulders, blocker, glove, arms };
}

const shooterModel = makeShooter();
const goalieModel = makeGoalie();
const puckModel = addMesh(scene, new THREE.CylinderGeometry(0.25, 0.25, 0.085, 32), material("#0b0b0b", 0.35));

// a yellow ring that shows where you aimed
const aimMarker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), new THREE.MeshBasicMaterial({ color: "#ffe14d", transparent: true, depthTest: false }));
aimMarker.visible = false;
scene.add(aimMarker);


// ----- 7. GAME STATE: everything the game needs to remember -----
//   "menu" -> "ready" -> "skating" -> ("deke") -> "shot" -> "result" -> back to "menu"
let state = "menu";
let chosenMove = "wrist";
let timer = 0, clock = 0;
let goals = 0, shots = 0;
let resultText = "";
let hintText = "", hintTimer = 0;
let goalLightTimer = 0;

const shooter = { x: 0, z: 22, speed: SKATE.startSpeed, swing: 0 };
const goalie = { x: 0, speed: 0, butterfly: 0, gloveReach: 0, blockerReach: 0, wantButterfly: 0, wantGlove: 0, wantBlocker: 0 };
const puck = { x: 0, y: 0, z: 0, onStick: true };
let shot = null;
let deke = null;

const keys = {};
document.addEventListener("keydown", e => { keys[e.key] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
document.addEventListener("keyup", e => { keys[e.key] = false; });


// ----- 8. SOUNDS (made with code, no sound files needed!) -----
let audio = null;
function startAudio() { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); }

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


// ----- 9. MENU BUTTONS AND CLICKING -----
const menu = document.getElementById("menu");
document.querySelectorAll("#menu button").forEach(button => {
  button.addEventListener("click", () => {
    startAudio();
    chosenMove = button.dataset.move;
    startShootout();
  });
});

const raycaster = new THREE.Raycaster();
const netPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), RINK.goalLine);  // an invisible wall at the goal line

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
    if (!insideNet) { hintText = "Click INSIDE the net to shoot!"; hintTimer = 1.5; return; }
    aimMarker.position.set(target.x, target.y, -RINK.goalLine + 0.05);
    aimMarker.visible = true;
    if (chosenMove === "deke") startDeke(target); else shoot(target);
  } else if (state === "result") {
    state = "menu";
  }
});


// ----- 10. GAME ACTIONS -----
function startShootout() {
  shooter.x = 0; shooter.z = 22; shooter.speed = SKATE.startSpeed; shooter.swing = 0;
  goalie.x = 0; goalie.speed = 0;
  goalie.wantButterfly = goalie.wantGlove = goalie.wantBlocker = 0;
  puck.onStick = true; puck.y = 0;
  shot = null; deke = null;
  aimMarker.visible = false;
  state = "ready"; timer = 0;
}

function startDeke(target) {
  const direction = target.x >= goalie.x ? -1 : 1;   // fake to the OTHER side
  deke = { target: target, direction: direction, time: 0.35 };
  state = "deke"; timer = 0;
}

function shoot(target) {
  shots++;
  puck.onStick = false;
  const distance = Math.hypot(target.x - puck.x, RINK.goalLine - puck.z);
  shot = { fromX: puck.x, fromZ: puck.z, toX: target.x, toY: target.y, time: 0,
           flightTime: distance / MOVES[chosenMove].puckSpeed, done: false, bounce: null, timeAfter: 0 };
  shooter.swing = 0.001;   // start swinging the stick
  state = "shot"; timer = 0;
}

// When the puck reaches the net: goal, save, or post?
function checkShot() {
  const dx = shot.toX - goalie.x;
  const y = shot.toY;
  if (Math.abs(shot.toX) > NET.halfWidth - 0.15 || y > NET.height - 0.15) {
    if (Math.abs(shot.toX) > NET.halfWidth || y > NET.height) return "Wide! Missed the net";
    return "PING! Off the post!";
  }
  if (y > 2.4 && dx > 0.6 && dx < 2.1) return "GLOVE SAVE!";
  if (y > 1.6 && dx < -0.6 && dx > -2.0) return "BLOCKER SAVE!";
  if (y < 1.2 && Math.abs(dx) < 1.6) return "PAD SAVE!";
  if (Math.abs(dx) < 1.2) return "SAVE!";
  return "GOAL!";
}


// ----- 11. UPDATE: move everything a tiny bit, many times per second -----
function update(dt) {
  clock += dt; timer += dt; hintTimer -= dt;

  if (state === "ready" && timer > 1.2) {
    playWhistle();
    state = "skating"; timer = 0;
  }

  if (state === "skating" || state === "deke") {
    if (keys["ArrowUp"]) shooter.speed = Math.min(SKATE.maxSpeed, shooter.speed + 12 * dt);
    if (keys["ArrowDown"]) shooter.speed = Math.max(SKATE.minSpeed, shooter.speed - 12 * dt);
    shooter.z += shooter.speed * dt;
    if (state === "deke") {
      shooter.x += deke.direction * 18 * dt;   // quick fake to one side!
      deke.time -= dt;
      if (deke.time <= 0) shoot(deke.target);
    } else {
      if (keys["ArrowLeft"]) shooter.x -= SKATE.sideSpeed * dt;
      if (keys["ArrowRight"]) shooter.x += SKATE.sideSpeed * dt;
    }
    shooter.x = Math.max(-30, Math.min(30, shooter.x));

    if (shooter.z > 74 && state === "skating") {   // too close without shooting!
      shots++;
      puck.onStick = false;
      resultText = "POKE CHECK!";
      goalie.wantButterfly = 1;
      playThud(false);
      state = "result"; timer = 0;
    }
  } else if (state === "shot") {
    shooter.z += shooter.speed * 0.4 * dt;       // glide after the shot
  }

  if (puck.onStick) { puck.x = shooter.x + 1.45; puck.z = shooter.z + 1.7; puck.y = 0; }
  if (shooter.swing > 0) shooter.swing = Math.min(1, shooter.swing + dt * 5);

  // The puck flies toward the net
  if (state === "shot") {
    shot.time += dt;
    if (!shot.done) {
      const t = Math.min(1, shot.time / shot.flightTime);
      puck.x = shot.fromX + (shot.toX - shot.fromX) * t;
      puck.z = shot.fromZ + (RINK.goalLine - shot.fromZ) * t;
      puck.y = shot.toY * t + Math.sin(Math.PI * t) * 0.3;
      if (t >= 1) {
        shot.done = true;
        resultText = checkShot();
        if (resultText === "GOAL!") { goals++; playHorn(); goalLightTimer = 3; shot.bounce = { vx: 0, vz: 6 }; }
        else if (resultText.startsWith("PING")) { playThud(true); shot.bounce = { vx: puck.x > 0 ? 12 : -12, vz: -18 }; }
        else if (resultText.startsWith("Wide")) { shot.bounce = { vx: puck.x > 0 ? 6 : -6, vz: 14 }; }
        else { playThud(false); shot.bounce = { vx: (Math.random() - 0.5) * 20, vz: -15 }; }
      }
    } else {
      shot.timeAfter += dt;
      if (resultText === "GOAL!") {
        puck.z = Math.min(RINK.goalLine + NET.depth - 0.6, puck.z + shot.bounce.vz * dt);
        puck.y = Math.max(0.04, puck.y - 4 * dt);
      } else {
        puck.x += shot.bounce.vx * dt;
        puck.z += shot.bounce.vz * dt;
        puck.y = Math.max(0.04, puck.y - 6 * dt);
      }
      if (shot.timeAfter > 0.9) { state = "result"; timer = 0; }
    }
  }

  // The goalie moves to stop the puck
  let wants = Math.max(-2.2, Math.min(2.2, puck.x * 0.3));   // usually: stay square to the puck
  let speed = GOALIE_SETTINGS.speed;
  if (state === "deke") { wants = Math.max(-2.6, Math.min(2.6, goalie.x + deke.direction * 3)); speed = 12; } // bites on the fake!
  if (state === "shot" && !shot.done) {
    if (shot.time > GOALIE_SETTINGS.reactionTime) {
      wants = Math.max(-2.4, Math.min(2.4, shot.toX));
      const dx = shot.toX - goalie.x;
      goalie.wantButterfly = shot.toY < 1.4 ? 1 : 0;
      goalie.wantGlove = shot.toY >= 1.4 && dx > 0.3 ? 1 : 0;
      goalie.wantBlocker = shot.toY >= 1.4 && dx < -0.3 ? 1 : 0;
    } else wants = goalie.x;
  }
  if ((state === "shot" && shot.done) || state === "result") wants = goalie.x;
  if (state === "menu" || state === "ready") goalie.wantButterfly = goalie.wantGlove = goalie.wantBlocker = 0;
  const step = Math.max(-speed * dt, Math.min(speed * dt, wants - goalie.x));
  goalie.x += step;
  goalie.speed = step / dt;
  const ease = Math.min(1, dt * 12);
  goalie.butterfly += (goalie.wantButterfly - goalie.butterfly) * ease;
  goalie.gloveReach += (goalie.wantGlove - goalie.gloveReach) * ease;
  goalie.blockerReach += (goalie.wantBlocker - goalie.blockerReach) * ease;

  goalLightTimer -= dt;
}


// ----- 12. MOVE THE 3D MODELS TO MATCH THE GAME -----
function updateModels() {
  // SHOOTER
  const S = shooterModel;
  S.root.position.copy(spot(shooter.x, 0, shooter.z));
  const skating = state === "skating" || state === "deke";
  const stride = skating ? clock * 7 : 0;
  S.legs.forEach((leg, i) => {
    const push = skating ? Math.max(0, Math.sin(stride + i * Math.PI)) : 0;
    leg.rotation.z = (i === 0 ? -1 : 1) * (0.06 + push * 0.32);   // legs push out to the side, like real skating
    leg.rotation.x = skating ? Math.sin(stride + i * Math.PI) * 0.12 : 0;
  });
  S.body.rotation.x = skating ? -0.38 : -0.2;                          // lean forward
  S.body.rotation.z = state === "deke" ? deke.direction * -0.3 : 0;   // lean into the deke
  S.body.position.y = 2.75 - (skating ? Math.abs(Math.sin(stride)) * 0.08 : 0);
  S.root.updateMatrixWorld(true);

  // the stick follows the puck; after a shot it swings forward
  const forward = spot(0, 0, 1);
  const bladeCenter = puck.onStick ? spot(puck.x - 0.05, 0.14, puck.z - 0.3) : spot(shooter.x + 1.45, 0.14, shooter.z + 1.4);
  const swing = Math.sin(Math.min(1, shooter.swing) * Math.PI / 2);
  bladeCenter.addScaledVector(forward, swing * 2.2);
  bladeCenter.y += swing * 1.4;
  const top = S.root.localToWorld(new THREE.Vector3(-0.1, 3.85 - swing * 0.3, -0.5 - swing * 0.4));
  const heel = bladeCenter.clone().add(new THREE.Vector3(-0.42, 0, 0));
  placeBetween(S.shaft, top, heel);
  S.blade.position.copy(bladeCenter);
  S.blade.rotation.set(0, 0, swing * 0.4);
  const topHand = top.clone().lerp(heel, 0.06), lowHand = top.clone().lerp(heel, 0.42);
  S.gloves[0].position.copy(topHand);
  S.gloves[1].position.copy(lowHand);
  // arms: shoulder -> elbow -> hand
  [[S.shoulders[0], topHand, S.arms.upperL, S.arms.lowerL, S.elbows[0], -1], [S.shoulders[1], lowHand, S.arms.upperR, S.arms.lowerR, S.elbows[1], 1]].forEach(([shoulder, hand, upper, lower, elbow, side]) => {
    const s = shoulder.getWorldPosition(new THREE.Vector3());
    const e = s.clone().lerp(hand, 0.5).add(new THREE.Vector3(side * 0.25, -0.3, 0.15));
    placeBetween(upper, s, e);
    placeBetween(lower, e, hand);
    elbow.position.copy(e);
  });

  // GOALIE
  const G = goalieModel;
  G.root.position.copy(spot(goalie.x, 0, GOALIE_SETTINGS.z));
  const b = goalie.butterfly;
  G.body.position.y = -0.95 * b;
  G.body.rotation.z = -goalie.speed * 0.012;
  G.pads.forEach((pad, i) => {
    const side = i === 0 ? -1 : 1;
    pad.rotation.z = side * (Math.PI / 2) * 0.95 * b;    // butterfly: pads flare out flat on the ice
    pad.position.x = side * (0.55 + 0.6 * b);
    pad.position.y = 1.35 - 0.9 * b;
  });
  const reachX = shot ? Math.max(0.8, Math.min(2.3, shot.toX - goalie.x)) : 1.3;
  const reachY = shot ? Math.max(1.8, Math.min(4.3, shot.toY)) + 0.95 * b : 3.0;
  G.glove.position.set(1.3 + (reachX - 1.3) * goalie.gloveReach, 3.0 + (reachY - 3.0) * goalie.gloveReach, 0.55 + 0.3 * goalie.gloveReach);
  const reachXB = shot ? Math.min(-0.8, Math.max(-2.3, shot.toX - goalie.x)) : -1.25;
  G.blocker.position.set(-1.25 + (reachXB + 1.25) * goalie.blockerReach, 3.0 + (reachY - 3.0) * goalie.blockerReach, 0.55 + 0.3 * goalie.blockerReach);
  G.root.updateMatrixWorld(true);
  [[G.shoulders[0], G.blocker], [G.shoulders[1], G.glove]].forEach(([shoulder, hand], i) => {
    placeBetween(G.arms[i], shoulder.getWorldPosition(new THREE.Vector3()), hand.getWorldPosition(new THREE.Vector3()));
  });

  // PUCK
  puckModel.position.copy(spot(puck.x, puck.y + 0.042, puck.z));
  puckModel.visible = state !== "result" || resultText !== "POKE CHECK!";
  if (!puck.onStick && shot && !shot.done) puckModel.rotation.x += 0.4;   // spinning in the air

  // GOAL LIGHT
  const lightOn = goalLightTimer > 0 && Math.floor(goalLightTimer * 4) % 2 === 0;
  goalLight.intensity = lightOn ? 600 : 0;
  goalLamp.material.emissiveIntensity = lightOn ? 4 : 0.1;
  aimMarker.material.opacity = Math.max(0, aimMarker.material.opacity - 0.01);
  if (state === "shot" && !shot.done) aimMarker.material.opacity = 1;

  // CAMERA follows the shooter: behind him (on the line from the net), and a little to his right,
  // so he never blocks your view of the net
  const followZ = Math.min(shooter.z, 74);
  const away = new THREE.Vector2(shooter.x, followZ - RINK.goalLine).normalize();   // from the net toward the shooter
  const camX = shooter.x + away.x * CAMERA_SETTINGS.behind - away.y * CAMERA_SETTINGS.side;
  const camZ = followZ + away.y * CAMERA_SETTINGS.behind + away.x * CAMERA_SETTINGS.side;
  camera.position.lerp(spot(camX, CAMERA_SETTINGS.height, camZ), 0.1);
  camera.lookAt(spot(shooter.x * 0.35, 0.5, RINK.goalLine));

  // the sun's shadows follow the action
  const middle = spot(shooter.x * 0.5, 0, (followZ + RINK.goalLine) / 2);
  sun.target.position.copy(middle);
  sun.position.copy(middle).add(new THREE.Vector3(18, 70, 30));
}


// ----- 13. THE WORDS ON THE SCREEN -----
const $ = id => document.getElementById(id);
function updateWords() {
  $("score").textContent = "GOALS " + goals + " · SHOTS " + shots;
  menu.style.display = state === "menu" ? "block" : "none";
  $("moveTag").style.display = state === "menu" ? "none" : "block";
  $("moveTag").textContent = "Move: " + MOVES[chosenMove].name;
  let big = "", sub = "", color = "white";
  if (state === "ready") big = "Get ready...";
  if (state === "skating" && timer < 0.8) { big = "TWEEEET! GO!"; color = "#ffe14d"; }
  if (state === "result") {
    big = resultText;
    color = resultText === "GOAL!" ? "#ffe14d" : "white";
    sub = (resultText === "POKE CHECK!" ? "Shoot sooner! · " : "") + "Click to go again";
  }
  $("big").textContent = big;
  $("big").style.color = color;
  $("sub").textContent = sub;
  $("hint").textContent = hintTimer > 0 ? hintText : (state === "skating" && timer > 0.8 ? "Click inside the net to shoot!" : "");
  renderer.domElement.style.cursor = state === "skating" ? "crosshair" : (state === "result" ? "pointer" : "default");
}


// ----- 14. THE GAME LOOP: update, move models, draw, about 60 times every second! -----
let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  updateModels();
  updateWords();
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
camera.position.copy(spot(CAMERA_SETTINGS.side, CAMERA_SETTINGS.height, shooter.z - CAMERA_SETTINGS.behind));
requestAnimationFrame(gameLoop);
