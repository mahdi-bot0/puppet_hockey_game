# Progress Log 📓

Newest entries at the bottom. Claude adds one at the end of every session.

## 2026-11-16 — Project set up
- **Built:** Project folder, game plan, and helper skills for Claude. No game code yet.
- **Learned:** —
- **Next:** Sarosh picks a game name and big idea, then we draw the rink in `index.html`.

## 2026-11-17 — A 3D rink!
- **Built:** A shootout rink you see from behind the shooter: shiny ice, skate scratches, face-off circles, blue line, crease, net, boards, glass, and a crowd.
- **Learned:** Code is a list of instructions. x/y are positions on the screen. The 3D trick: things far away are drawn smaller.
- **Next:** Sarosh picks his favorite shootout moves and jersey color, then we add the shooter and the puck.

## 2026-11-17 — Shootout is playable!
- **Built:** Menu to choose a move before the whistle (Wrist Shot or Deke), a whistle sound, a shooter (blue/orange #11) skating in with the camera following, clicking inside the net to aim, a goalie (blue/red/white) who reacts, goal/save/post results, goal horn, and a scoreboard.
- **Learned:** The painter's method (draw far things first). Game "states" (menu → ready → skating → shot → result). The game loop runs about 60 times per second.
- **Next:** Sarosh plays it and tells us what to change. Ideas: real shootout rules (3 rounds), more moves, team names.

## 2026-11-17 — Real 3D!
- **Built:** Sarosh said the graphics looked "kinda bad", so we rebuilt the game in real 3D with the three.js engine: lights, soft shadows, glossy ice that reflects the arena lights, 3D players (shooter in blue/orange #11, goalie in blue/red/white #30 with striped pads, blocker, glove and mask), a curved net with real mesh, white boards and glass, and a full arena of fans. The camera follows behind the shooter and never blocks the net. The goalie drops into the butterfly for low shots and reaches with his glove or blocker for high ones. The red goal light flashes when you score.
- **Learned:** A 3D engine works like a movie set: scene, camera, lights, and meshes (shape + material). Textures are like stickers wrapped on 3D shapes.
- **Next:** Sarosh plays it and tells us what to improve.

## 2026-11-17 — Realistic players, 10 moves, real shootout
- **Sarosh's feedback:** players looked fat, wanted them more realistic like a console hockey game, lots more moves, a butterfly goalie, real skating.
- **Built:** Athletic players with real gear (helmet + visor, shoulder pads, gloves, striped socks, skates with holders and steel blades, taped stick). Real skating: legs push out to the side, knees bent, stickhandling, snow spray from the skates. 10 moves: wrist, snap, slap, backhand, deke, five-hole, spin-o-rama, toe drag, shot fake, lacrosse. The goalie goes into the butterfly (low shots, up close, on shot fakes), comes out to cut the angle, and bites on dekes. Shootout with 3 rounds + sudden death and a tracker. Boards with ads, glass posts, crowd noise, goal replay camera.
- **Learned:** Inverse kinematics (the computer works out where the knee/elbow go when you say where the foot/hand should be). Data in an object (all 10 moves live in one MOVES list).
- **Next:** Sarosh plays and gives feedback.

## 2026-11-17 — A REAL 3D player!
- **Sarosh's feedback:** players still looked like shapes; wanted them to look actually realistic. Also a more real stick, a more real goalie, and nice brand names.
- **Built:** Sarosh and his parent downloaded a realistic person (Mixamo "Ch38") with Idle, Fist Pump and Rallying animations. We converted 157 MB of .fbx files into one 7 MB .glb. The skater and the goalie are now that real person, dressed in our gear (helmet with visor, gloves, socks over the knees, skates; goalie mask with cage, BRICKWALL pads, blocker, glove). Their bones are bent with inverse kinematics to skate, hold the stick, and drop into the butterfly. Realistic stick (curved blade, white tape, SNIPER carbon shaft). Made-up brands on the boards. Fist-pump celebration with a camera that turns around to watch.
- **Learned:** How real games make characters (artists, skeletons/rigs, motion capture). What GLTF and a loader are. Licenses (CC0, CC BY, ND...). How to make a GitHub token and push from Terminal.
- **Next:** Sarosh plays and gives feedback.
