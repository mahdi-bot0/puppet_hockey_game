---
name: add-game-feature
description: Step-by-step recipe for adding a new feature to the hockey game (rink, puck, players, goalie, scoring, timer, sounds, screens). Use whenever Sarosh wants to add or change something in the game.
---

# Adding a game feature

## Recipe
1. **Pick it.** Take the next item from `docs/game-plan.md`, or what Sarosh asks for.
2. **Plan it out loud (2–4 bullets)** in kid language. Ask Sarosh any design choices
   (how fast? what color? which key?).
3. **Build the smallest version first.** e.g. "puck moves right" before "puck bounces everywhere".
4. **Play it** (see `play-and-test` skill). Ask Sarosh what he thinks.
5. **Tune it** together (speeds, sizes, colors).
6. **Explain the new code** in 1–3 sentences using a hockey comparison.
7. **Tick it off** in `docs/game-plan.md`.

## Code structure to keep (plain JS + canvas)
```
// 1. SETTINGS   – numbers Sarosh can tweak (rink size, speeds, colors) at the top
// 2. GAME STATE  – puck, players, score, timer
// 3. INPUT       – which keys are pressed
// 4. UPDATE      – move things, check bounces, goals, collisions
// 5. DRAW        – draw rink, then puck, then players, then scoreboard
// 6. GAME LOOP   – requestAnimationFrame(gameLoop)
```
- Put tweakable numbers in a `SETTINGS` object at the top with comments.
- Clear names: `puck.x`, `player1.speed`, `scoreHome`.
- A comment above every section, written so a kid can read it.
- Keep it in `index.html` until it's long, then move JS to `game.js`.

## Handy hockey-game building blocks
- **Bounce off boards:** if puck goes past an edge, flip its speed (`puck.vx = -puck.vx`).
- **Ice friction:** multiply speed by ~0.99 each frame so the puck slowly glides to a stop.
- **Hit the puck:** if distance between player and puck < their sizes added together, push the puck away.
- **Goal:** if the puck is inside the goal rectangle → add a point, reset puck to center face-off.
- **Timer:** count down using the time between frames; show it as `MM:SS`.
- **Computer opponent:** move toward the puck a bit slower than the human, so it's beatable.
