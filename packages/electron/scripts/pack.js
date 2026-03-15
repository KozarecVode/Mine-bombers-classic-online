// Simple packaging script — no electron-builder, no winCodeSign issues.
// Copies the installed Electron binary + our compiled app into dist-electron/.
const path = require("path");
const fs = require("fs");

const electronExe = require("electron"); // returns path to electron.exe
const electronDir = path.dirname(electronExe);
const outDir = path.resolve(__dirname, "../../../dist-electron/MineBombers-win32-x64");

console.log("Cleaning output directory...");
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });

console.log("Copying Electron runtime...");
fs.cpSync(electronDir, outDir, { recursive: true });

// Rename electron.exe → MineBombers.exe
const exeSrc = path.join(outDir, "electron.exe");
if (fs.existsSync(exeSrc)) {
  fs.renameSync(exeSrc, path.join(outDir, "MineBombers.exe"));
}

// Place our app in resources/app/ (Electron loads resources/app/package.json)
const appDir = path.join(outDir, "resources", "app");
fs.mkdirSync(appDir, { recursive: true });

console.log("Copying app files...");
fs.mkdirSync(path.join(appDir, "dist"), { recursive: true });
fs.copyFileSync(path.resolve(__dirname, "../dist/main.js"),    path.join(appDir, "dist/main.js"));
fs.copyFileSync(path.resolve(__dirname, "../dist/preload.js"), path.join(appDir, "dist/preload.js"));
fs.cpSync(path.resolve(__dirname, "../app"),  path.join(appDir, "app"),  { recursive: true });
fs.copyFileSync(path.resolve(__dirname, "../package.json"), path.join(appDir, "package.json"));

console.log(`\nDone! App is at:\n  ${outDir}\\MineBombers.exe`);
