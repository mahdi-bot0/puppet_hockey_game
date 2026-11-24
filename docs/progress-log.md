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

## 2026-11-17 — Real arena look + Pause to Shoot
- **Sarosh's feedback:** still looked blocky (the crowd wall, the gear); wants to publish it someday; wants a "pause to shoot" option.
- **Built:** Two-level arena with darker crowds, red seats, a glowing LED ad ring and roof lights. Shiny ice with faint reflections, glowing lights (bloom) and a TV-style vignette (`FANCY_GRAPHICS` switch). Realistic skate shapes, padded gloves, hockey pants. Goalie gear with flat faces: BRICKWALL pads with knee rolls, blocker, catching glove with T-trap. New menu option: ⛸️ Skate & Shoot (click the net) or ⏸️ Pause to Shoot (click to freeze, aim with the mouse, SPACE to shoot).
- **Next:** Sarosh plays it. Publishing needs a grown-up's decision (GitHub Pages or itch.io).

## 2026-11-17 — TV-style presentation
- **Built:** Instant replay in slow motion after goals (click to skip), the net ripples when the puck hits it, skate-carving and stickhandling sounds, a hockey-stop sound, skate marks left on the ice, and a camera swoop before each attempt.
- **Learned:** A replay works by saving a "snapshot" of the game every frame and playing them back slower.
- **Next:** Sarosh says the arena is good now, but the players still don't look real enough.

## 2026-11-17 — Goalie mode!
- **Sarosh's idea:** after you shoot, you play goalie against their shooter. The mouse moves the glove, SPACE is the butterfly, the blocker is automatic, and there's an option for first person.
- **Built:** Real back-and-forth shootout: you shoot, then the computer's shooter (red/white/blue #21) skates in on YOUR goalie (blue/orange #35) and picks a move and a spot. Their shots are a bit slower. Mouse = glove (catch it for a GLOVE SAVE), hold SPACE = butterfly, blocker moves by itself. Menu option: 🎥 Goalie behind view or 👀 first person. The tracker now uses real results for both teams, with sudden death.
- **Learned:** Teams can swap uniforms by repainting materials (a list of "kit change" functions).

## 2026-11-24 — 5-on-5 hockey!
- **Sarosh's feedback:** wants a real hockey game: 5 on 5, not just a shootout, and more realistic.
- **Built:** `hockey.html` — a full game: 5 skaters + a goalie per team (blue/orange vs red/navy), all real 3D people from the Mixamo model in our gear. Faceoffs, passing (E / right click), shooting (click; hold for a slap shot), poke and body checks (SPACE), switching players (Q), computer teammates and opponents who carry, pass and shoot, goalies who make saves, rebounds and freeze the puck, boards, both nets, 3 periods of 4 minutes, overtime, TV scoreboard, shots on goal, TV camera or behind-the-player camera (C).
- **Code:** the arena/players/sounds moved into `engine.js`, shared by the shootout (`index.html` + `game.js`) and 5-on-5 (`hockey.html` + `hockey.js`).
- **Also asked:** Meta Quest 3 + Unity. Explained options (see chat).
