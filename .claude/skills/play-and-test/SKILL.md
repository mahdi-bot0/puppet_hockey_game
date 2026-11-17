---
name: play-and-test
description: How to run, play, and check the hockey game after a change, including fixing errors. Use after every code change, or when Sarosh says something is broken or "not working".
---

# Playing and testing the game

## Run it
- **On Sarosh's computer:** double-click `index.html` (or drag it into Chrome/Edge/Firefox). Refresh the page
  (F5 / Cmd+R) after each change.
- **In a cloud session:** take a screenshot with Playwright so Claude can check it:
  ```js
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('console', m => console.log('console:', m.text()));
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.goto('file://' + process.cwd() + '/index.html');
  await p.waitForTimeout(1000); await p.screenshot({ path: 'screenshot.png' }); await b.close();
  ```
  Show Sarosh the screenshot. Don't commit screenshots.
  The game is 3D (WebGL). In a cloud container launch Chromium with
  `args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader']`. It renders very slowly there (~1-5 fps),
  so wait for game states with `page.waitForFunction(() => state === 'skating')` instead of fixed timeouts.
  Top-level names like `state`, `shooter`, `camera`, `spot()` can be read with `page.evaluate`.

## Quick checklist after a change
- Does the page load without errors? (Open the browser console: F12 → Console.)
- Does the new thing work?
- Did anything old break? (puck still moves, controls still work, score still counts)

## When something is broken
1. Ask Sarosh: "What did you expect, and what happened instead?"
2. Look at the red error in the console together. Explain it in kid words.
3. Make a guess, change one thing, refresh, check.
4. Common culprits: a typo in a name, a missing `}` or `)`, using a variable before creating it,
   a speed so big the puck flies off the screen.
