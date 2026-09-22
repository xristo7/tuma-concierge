import type { ApiClient } from "./api-client.js";
import type { Call } from "./domain.js";

/** Local state machine for one active call — thin enough to drive from any
 * app's own React (or other) UI layer without pulling React into this
 * package. Handles both the signaling polling (ring/accept/decline/end,
 * same shape regardless of provider) and, when the call's provider is
 * "cloudflare", the actual WebRTC negotiation against Realtime SFU via the
 * server-side proxy in apps/api/src/calls/routes.ts. For "mock" (or any
 * other unimplemented provider) it just runs the signaling with no real
 * audio — useful for testing the ring/accept/decline flow with zero setup. */
export type CallEnginePhase =
  | "idle"
  | "ringing_outbound"
  | "ringing_inbound"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

export type CallEngineState = {
  phase: CallEnginePhase;
  call: Call | null;
  error: string | null;
};

export type CallEngineOptions = {
  api: ApiClient;
  onStateChange: (state: CallEngineState) => void;
  /** Needed only for the "cloudflare" provider — omit and the engine still
   * runs the full signaling flow, it just never carries real audio. */
  getUserMedia?: () => Promise<MediaStream>;
  onRemoteStream?: (stream: MediaStream) => void;
  /** How often to poll for status changes while ringing/connecting (ms). */
  pollMs?: number;
};

const DEFAULT_POLL_MS = 2000;

export class CallEngine {
  private api: ApiClient;
  private onStateChange: (state: CallEngineState) => void;
  private getUserMedia?: () => Promise<MediaStream>;
  private onRemoteStream?: (stream: MediaStream) => void;
  private pollMs: number;

  private state: CallEngineState = { phase: "idle", call: null, error: null };
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  constructor(opts: CallEngineOptions) {
    this.api = opts.api;
    this.onStateChange = opts.onStateChange;
    this.getUserMedia = opts.getUserMedia;
    this.onRemoteStream = opts.onRemoteStream;
    this.pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  }

  private setState(patch: Partial<CallEngineState>) {
    this.state = { ...this.state, ...patch };
    this.onStateChange(this.state);
  }

  private stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  /** Starts an outbound call and begins polling for the callee's response. */
  async startCall(input: { calleeId: string; orderId?: string; restaurantId?: string }) {
    this.setState({ phase: "ringing_outbound", call: null, error: null });
    try {
      const { call } = await this.api.startCall(input);
      this.setState({ call });
      this.pollUntilResolved(call.id);
    } catch (err) {
      this.setState({ phase: "failed", error: err instanceof Error ? err.message : "Couldn't start the call" });
    }
  }

  /** Adopts a call that's already ringing for me (from GET /calls/incoming) — call this once the UI shows the incoming-call screen. */
  presentIncoming(call: Call) {
    this.setState({ phase: "ringing_inbound", call, error: null });
  }

  async accept() {
    const call = this.state.call;
    if (!call) return;
    try {
      const { call: updated } = await this.api.acceptCall(call.id);
      this.setState({ call: updated, phase: "connecting" });
      await this.connectMedia(updated);
      this.pollUntilResolved(call.id);
    } catch (err) {
      this.setState({ phase: "failed", error: err instanceof Error ? err.message : "Couldn't join the call" });
    }
  }

  async decline() {
    const call = this.state.call;
    if (!call) return;
    await this.api.endCall(call.id, "declined").catch(() => {});
    this.teardown("ended");
  }

  async hangUp() {
    const call = this.state.call;
    this.stopPolling();
    this.closeMedia();
    if (call && call.status !== "ended" && call.status !== "declined" && call.status !== "missed") {
      const reason = call.status === "ringing" ? "missed" : "ended";
      await this.api.endCall(call.id, reason).catch(() => {});
    }
    this.setState({ phase: "ended" });
  }

  private teardown(phase: CallEnginePhase) {
    this.stopPolling();
    this.closeMedia();
    this.setState({ phase });
  }

  private closeMedia() {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  /** Polls the call until it leaves a state either side can still act on —
   * picks up the callee accepting an outbound call, or either side ending
   * it. Cheap and simple over a WebSocket for a low-frequency event like
   * "did they pick up yet", matching every other polling loop in this app. */
  private pollUntilResolved(callId: string) {
    this.stopPolling();
    this.pollHandle = setInterval(async () => {
      try {
        const { call } = await this.api.getCall(callId);
        this.setState({ call });
        if (call.status === "accepted" && this.state.phase === "ringing_outbound") {
          this.setState({ phase: "connecting" });
          await this.connectMedia(call);
        } else if (call.status === "declined" || call.status === "missed" || call.status === "failed") {
          this.teardown("ended");
        } else if (call.status === "ended") {
          this.teardown("ended");
        }
      } catch {
        // transient error — keep polling, same tolerance as chat/order polling elsewhere
      }
    }, this.pollMs);
  }

  /** Real WebRTC only for the "cloudflare" provider; every other provider
   * (including "mock") just marks the call connected with no audio path —
   * signaling still works end-to-end for testing. */
  private async connectMedia(call: Call) {
    if (call.provider !== "cloudflare") {
      this.setState({ phase: "connected" });
      return;
    }
    if (!this.getUserMedia) {
      this.setState({ phase: "connected" });
      return;
    }
    try {
      const stream = await this.getUserMedia();
      this.localStream = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
      this.pc = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (e) => {
        if (e.streams[0]) this.onRemoteStream?.(e.streams[0]);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const { answer } = await this.api.publishCallSession(call.id, { type: "offer", sdp: offer.sdp ?? "" });
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // The other side may not have published yet — retry pulling their
      // track for a few seconds rather than failing the whole call.
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const pull = await this.api.pullRemoteCallTrack(call.id);
          if (pull.requiresRenegotiation && pull.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(pull.offer));
            const pullAnswer = await pc.createAnswer();
            await pc.setLocalDescription(pullAnswer);
            await this.api.renegotiateCall(call.id, { type: "answer", sdp: pullAnswer.sdp ?? "" });
          }
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      this.setState({ phase: "connected" });
    } catch (err) {
      this.setState({ phase: "failed", error: err instanceof Error ? err.message : "Couldn't connect audio" });
    }
  }

  destroy() {
    this.stopPolling();
    this.closeMedia();
  }
}
