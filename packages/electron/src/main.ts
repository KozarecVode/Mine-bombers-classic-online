import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

// ── Static file server (serves the Vite-built client on localhost) ─────────────

const APP_DIR = path.join(__dirname, "..", "app");
const HTTP_PORT = 3000;

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".gif":  "image/gif",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".ogg":  "audio/ogg",
  ".xml":  "text/xml",
  ".json": "application/json",
  ".map":  "application/json",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
};

const httpServer = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const decoded = decodeURIComponent(url === "/" ? "index.html" : url);
  const filePath = path.join(APP_DIR, decoded);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  });
});

httpServer.listen(HTTP_PORT);

// ── Embedded relay server ─────────────────────────────────────────────────────

const WS_PORT = 3001;
const wss = new WebSocketServer({ port: WS_PORT });

interface Conn { ws: WebSocket; playerId: number; }

let nextId = 1;
let hostId: number | null = null;
const conns = new Map<number, Conn>();

function broadcast(data: string, excludeId: number): void {
  for (const [id, c] of conns) {
    if (id !== excludeId && c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
  }
}

wss.on("connection", (ws: WebSocket) => {
  const playerId = nextId++;
  const isHost = conns.size === 0;
  if (isHost) hostId = playerId;
  conns.set(playerId, { ws, playerId });

  ws.send(JSON.stringify({ type: "assign", playerId, isHost }));

  if (!isHost && hostId !== null) {
    conns.get(hostId)?.ws.send(JSON.stringify({ type: "player_join", playerId }));
  }

  ws.on("message", (data: Buffer) => {
    const raw = data.toString();
    if (playerId === hostId) {
      broadcast(raw, hostId);
    } else {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw); } catch { return; }
      const hostConn = hostId !== null ? conns.get(hostId) : undefined;
      if (hostConn?.ws.readyState === WebSocket.OPEN) {
        hostConn.ws.send(JSON.stringify({ ...msg, fromPlayerId: playerId }));
      }
    }
  });

  ws.on("close", () => {
    conns.delete(playerId);
    broadcast(JSON.stringify({ type: "player_leave", playerId }), playerId);

    if (playerId === hostId) {
      const next = conns.values().next().value as Conn | undefined;
      if (next) {
        hostId = next.playerId;
        next.ws.send(JSON.stringify({ type: "promoted_host" }));
      } else {
        hostId = null;
        nextId = 1;
      }
    }
  });
});

// ── Window ────────────────────────────────────────────────────────────────────

ipcMain.on("quit", () => {
  httpServer.close();
  wss.close();
  app.quit();
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setFullScreen(true);
  // Re-enter fullscreen if user accidentally exits (e.g. pressing ESC)
  win.on("leave-full-screen", () => win.setFullScreen(true));
  win.loadURL(`http://localhost:${HTTP_PORT}`);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  httpServer.close();
  wss.close();
  app.quit();
});
