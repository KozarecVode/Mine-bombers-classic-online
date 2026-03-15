import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3001);
const wss = new WebSocketServer({ port: PORT });

interface Conn { ws: WebSocket; playerId: number; }

let nextId = 1;
let hostId: number | null = null;
const conns = new Map<number, Conn>();

function broadcast(data: string, excludeId: number): void {
  for (const [id, c] of conns) {
    if (id !== excludeId && c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
  }
}

wss.on('connection', (ws: WebSocket) => {
  const playerId = nextId++;
  const isHost = conns.size === 0;
  if (isHost) hostId = playerId;
  conns.set(playerId, { ws, playerId });

  ws.send(JSON.stringify({ type: 'assign', playerId, isHost }));

  if (!isHost && hostId !== null) {
    conns.get(hostId)?.ws.send(JSON.stringify({ type: 'player_join', playerId }));
  }

  ws.on('message', (data: Buffer) => {
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

  ws.on('close', () => {
    conns.delete(playerId);
    broadcast(JSON.stringify({ type: 'player_leave', playerId }), playerId);

    if (playerId === hostId) {
      const next = conns.values().next().value as Conn | undefined;
      if (next) {
        hostId = next.playerId;
        next.ws.send(JSON.stringify({ type: 'promoted_host' }));
      } else {
        hostId = null;
        nextId = 1;
      }
    }
  });
});

console.log(`Minebombers relay server on ws://localhost:${PORT}`);
