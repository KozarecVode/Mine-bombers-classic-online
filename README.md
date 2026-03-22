# Minebombers

Vibecoded AI slop remake of the finnish 1996 classic Mine bombers with an online twist.

---

## How to play - hosting & joining

A LAN VPN is recommended (such as ZeroTier or Hamachi). Alternatively, the host can forward port 3001 on their router.
The game performs best for players with a ping of 30 ms or lower.

To host a game, simply click “Host Game.” Settings such as total rounds, match duration, starting cash, and other options are taken from the host and automatically synced to all connected clients.

To join a game, open the “Join Game” menu and enter the host’s IP address. This will be either their public IP (if port forwarding is enabled) or their VPN LAN IP (if using a LAN VPN).

## Development

### Prerequisites

- Node.js 18+
- npm 8+

### Install

```bash
npm install
```

---

## Running in Development

```bash
npm run dev
```

This starts:
- **Vite dev server** on `http://localhost:3000` (client with HMR)
- **WebSocket relay** on `ws://localhost:3001`

Open `http://localhost:3000` in your browser to play.

---

## Building the Electron App

```bash
npm run build:electron
```

This compiles shared → client → electron, then packs the executable.

**Output:** `dist-electron/MineBombers-win32-x64/MineBombers.exe`

> **Note:** The build requires `packages/electron/icon.ico` for the app icon. Place your icon file there before building.


## License

The **source code** is licensed under the MIT license.