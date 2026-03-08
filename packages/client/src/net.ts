import { ClientMessage, ServerMessage } from '@minebombers/shared';

type MessageHandler = (msg: ServerMessage) => void;

export class GameSocket {
  private ws: WebSocket;
  private handlers: MessageHandler[] = [];
  private queue: ClientMessage[] = [];

  constructor(url: string, onOpen?: () => void) {
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      for (const msg of this.queue) this._send(msg);
      this.queue = [];
      onOpen?.();
    });

    this.ws.addEventListener('message', (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data); } catch { return; }
      for (const h of this.handlers) h(msg);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this._send(msg);
    } else {
      this.queue.push(msg);
    }
  }

  private _send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}
