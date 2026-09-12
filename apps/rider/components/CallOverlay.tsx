"use client";

import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { useCall } from "../lib/use-call";

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [active]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Full-screen call sheet — renders nothing while idle. Pass the object
 * returned by useCall(orderId). */
export function CallOverlay({
  call,
  peerLabel = "your rider",
}: {
  call: ReturnType<typeof useCall>;
  peerLabel?: string;
}) {
  const { status, error, muted, decline, hangup, accept, toggleMute, remoteAudioRef } = call;
  const elapsed = useElapsed(status === "connected");

  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-ink px-8 py-16 text-cream">
      <audio ref={remoteAudioRef} autoPlay />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gold text-3xl font-bold text-ink">
          {peerLabel.charAt(0).toUpperCase()}
        </span>
        <h2 className="text-xl font-bold">{peerLabel}</h2>
        <p className="text-sm text-cream/70">
          {status === "ringing-outgoing" && "Calling…"}
          {status === "ringing-incoming" && "Incoming call…"}
          {status === "connected" && elapsed}
          {status === "ended" && "Call ended"}
          {status === "error" && (error ?? "Call failed")}
        </p>
      </div>

      {status === "ringing-incoming" ? (
        <div className="flex w-full items-center justify-center gap-10">
          <button
            onClick={decline}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"
            aria-label="Decline call"
          >
            <PhoneOff className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <button
            onClick={accept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green text-white shadow-lg"
            aria-label="Accept call"
          >
            <Phone className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-center gap-10">
          {status === "connected" && (
            <button
              onClick={toggleMute}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                muted ? "bg-gold text-ink" : "bg-white/10 text-cream"
              }`}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" strokeWidth={2.25} /> : <Mic className="h-5 w-5" strokeWidth={2.25} />}
            </button>
          )}
          <button
            onClick={hangup}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"
            aria-label="End call"
          >
            <PhoneOff className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Small header trigger — disabled until the other party's signaling socket
 * is connected (best-effort presence, not a guarantee they'll answer). */
export function CallButton({ call }: { call: ReturnType<typeof useCall> }) {
  return (
    <button
      onClick={call.call}
      disabled={!call.peerOnline || call.status !== "idle"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green text-white disabled:opacity-30"
      aria-label="Start voice call"
      title={call.peerOnline ? "Call" : "Waiting for the other side to be online"}
    >
      <Phone className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
