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
