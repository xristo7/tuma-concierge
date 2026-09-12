/**
 * Durable Object: relays WebRTC signaling messages (offer/answer/ICE
 * candidates) between exactly the two parties on one order — a customer and
 * their rider. It never inspects call content, just relays JSON messages
 * verbatim to the other connected socket(s) in the room and tracks presence
 * so a caller knows whether the other side is even online before dialing.
 *
 * Cloudflare Workers only — there's no equivalent for local Node dev (see
 * apps/api/src/calls/routes.ts), same limitation as the D1 binding.
 *
 * Minimal ambient types below stand in for @cloudflare/workers-types (which
 * conflicts with @types/node's DOM-lib globals elsewhere in this project —
 * same reasoning as the CfExecutionContext shim in worker.ts).
 */
type WorkerWebSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerWebSocket; 1: WorkerWebSocket } };

type Env = Record<string, never>;
type DurableObjectState = Record<string, never>;

export class CallRoom {
  private sockets = new Set<WorkerWebSocket>();

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WorkerWebSocket });
  }

  private handleSession(ws: WorkerWebSocket) {
    ws.accept();
    this.sockets.add(ws);
    this.broadcastPresence();

    ws.addEventListener("message", (event: MessageEvent) => {
      for (const other of this.sockets) {
        if (other !== ws && other.readyState === WebSocket.OPEN) {
          other.send(event.data as string);
        }
      }
    });

    const cleanup = () => {
      this.sockets.delete(ws);
      this.broadcastPresence();
    };
    ws.addEventListener("close", cleanup);
    ws.addEventListener("error", cleanup);
  }

  private broadcastPresence() {
    const message = JSON.stringify({ type: "presence", peers: this.sockets.size });
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }
  }
}
