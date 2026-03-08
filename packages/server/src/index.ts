import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room.js';

const PORT = Number(process.env.PORT ?? 3001);

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Room>();

function findOrCreateRoom(): Room {
  // Simple matchmaking: join the first non-full room, or create one
  for (const room of rooms.values()) {
    if (!room.isFull && room.state?.phase === 'lobby') {
      return room;
    }
  }
  const id = Math.random().toString(36).slice(2, 8);
  const room = new Room(id);
  rooms.set(id, room);
  return room;
}

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const name = url.searchParams.get('name') ?? 'Player';
  const roomId = url.searchParams.get('room');

  let room: Room;
  if (roomId && rooms.has(roomId)) {
    room = rooms.get(roomId)!;
    if (room.isFull) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      ws.close();
      return;
    }
  } else {
    room = findOrCreateRoom();
  }

  room.addPlayer(ws, name);

  // Clean up empty rooms
  ws.on('close', () => {
    if (room.playerCount === 0) {
      rooms.delete(room.id);
    }
  });
});

console.log(`Minebombers server running on ws://localhost:${PORT}`);
