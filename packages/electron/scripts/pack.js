// Simple packaging script — no electron-builder, no winCodeSign issues.
// Copies the installed Electron binary + our compiled app into dist-electron/.
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const electronExe = require("electron"); // returns path to electron.exe
const electronDir = path.dirname(electronExe);
const outDir = path.resolve(__dirname, "../../../dist-electron/MineBombers-win32-x64");

console.log("Cleaning output directory...");
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });

console.log("Copying Electron runtime...");
fs.cpSync(electronDir, outDir, { recursive: true });

// Rename electron.exe → MineBombers.exe
const exeSrc = path.join(outDir, "electron.exe");
const exeDst = path.join(outDir, "MineBombers.exe");
if (fs.existsSync(exeSrc)) {
  fs.renameSync(exeSrc, exeDst);
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

// Stamp icon onto MineBombers.exe using rcedit
const icoSrc = path.resolve(__dirname, "../icon.ico");
const cacheDir = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
let rcedit = null;
if (fs.existsSync(cacheDir)) {
  const dirs = fs.readdirSync(cacheDir).sort().reverse(); // newest first
  for (const d of dirs) {
    const candidate = path.join(cacheDir, d, "rcedit-x64.exe");
    if (fs.existsSync(candidate)) { rcedit = candidate; break; }
  }
}
if (rcedit && fs.existsSync(icoSrc)) {
  console.log("Stamping icon...");
  execFileSync(rcedit, [exeDst, "--set-icon", icoSrc]);
  console.log("Icon stamped.");
} else {
  if (!fs.existsSync(icoSrc)) console.warn("Warning: icon.ico not found at", icoSrc);
  if (!rcedit) console.warn("Warning: rcedit not found — skipping icon stamp");
}

console.log(`\nDone! App is at:\n  ${outDir}\\MineBombers.exe`);
