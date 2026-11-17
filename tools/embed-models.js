// Turns models/player.glb into models/player.js (the same data written as text),
// so the game still works when you just double-click index.html.
// Run it from the project folder:   node tools/embed-models.js
const fs = require("fs");
const path = require("path");
const glb = fs.readFileSync(path.join(__dirname, "..", "models", "player.glb"));
const out = "// Made by tools/embed-models.js from models/player.glb. Don't edit by hand!\n" +
            "window.PLAYER_MODEL = \"" + glb.toString("base64") + "\";\n";
fs.writeFileSync(path.join(__dirname, "..", "models", "player.js"), out);
console.log("wrote models/player.js (" + Math.round(out.length / 1024) + " KB)");
