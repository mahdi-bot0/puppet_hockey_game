# Tools

## Turning Mixamo files into the game's player

1. Put the Mixamo `.fbx` downloads in `models/` (one character file plus animation files).
   The names the converter expects are at the top of `tools/build-player.html` (`ANIMATIONS` and `BODY_FILE`).
2. Start a local web server in the project folder: `python3 -m http.server 8765`
3. Open `http://127.0.0.1:8765/tools/build-player.html` in a browser (or with Playwright),
   run `buildPlayer()` in the console, and save the returned base64 as `models/player.glb`.
   It cleans up duplicate bones, drops the soccer shoes and hair, shrinks textures to 1024 px,
   and keeps the animations named `idle`, `fistpump`, `rallying`.
4. Run `node tools/embed-models.js` to make `models/player.js`.

`tools/lib/fbx-to-glb.min.js` is three.js's FBXLoader + GLTFExporter bundled with esbuild (MIT).
