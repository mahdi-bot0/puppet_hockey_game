// Turns the 3D model files in the "models" folder into one JavaScript file (models/models.js),
// so the game still works when you just double-click index.html.
// Run it from the project folder:   node tools/embed-models.js
const fs = require("fs");
const path = require("path");
const folder = path.join(__dirname, "..", "models");
const files = fs.readdirSync(folder).filter(f => /\.(fbx|glb)$/i.test(f));
let out = "// Made by tools/embed-models.js. Don't edit by hand!\nwindow.MODEL_FILES = {\n";
files.forEach(f => {
  const data = fs.readFileSync(path.join(folder, f)).toString("base64");
  out += "  " + JSON.stringify(f) + ": " + JSON.stringify(data) + ",\n";
  console.log("added", f, Math.round(data.length / 1024) + " KB");
});
out += "};\n";
fs.writeFileSync(path.join(folder, "models.js"), out);
console.log("wrote models/models.js with " + files.length + " model(s)");
