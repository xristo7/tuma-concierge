"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, getStoredToken } from "./api";

export type CallStatus = "idle" | "ringing-outgoing" | "ringing-incoming" | "connected" | "ended" | "error";

type SignalMessage =
  | { type: "presence"; peers: number }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "hangup" };

const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/**
 * WebRTC audio calling over the API's signaling WebSocket
 * (GET /v1/orders/:id/call). Connects the signaling channel as soon as the
 * order screen is open (cheap — just presence + relay) so an incoming call
 * can be detected even before the user taps "Call"; actual mic access only
 * happens once a call starts.
 *
 * Uses public STUN only — works on most networks, but strict mobile carrier
 * NATs can still fail to connect without a TURN relay (see infra/CLOUDFLARE.md).
 */
export function useCall(orderId: string) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [peerOnline, setPeerOnline] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const send = useCallback((msg: SignalMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const teardown = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setMuted(false);
  }, []);

  const hangup = useCallback(() => {
    send({ type: "hangup" });
    teardown();
    setStatus("idle");
  }, [send, teardown]);

  const makePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0] ?? null;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setError("Call connection lost.");
        teardown();
        setStatus("ended");
      }
    };
    pcRef.current = pc;
    return pc;
  }, [send, teardown]);

  const call = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = makePeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", sdp: offer });
      setStatus("ringing-outgoing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't access the microphone.");
      setStatus("error");
    }
  }, [send, makePeerConnection]);

  const accept = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = makePeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(offer);
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate).catch(() => {});
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", sdp: answer });
      setStatus("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't access the microphone.");
      setStatus("error");
    }
  }, [send, makePeerConnection]);

  const decline = useCallback(() => {
    send({ type: "hangup" });
    pendingOfferRef.current = null;
    setStatus("idle");
  }, [send]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  useEffect(() => {
    if (!orderId) return;
    const token = getStoredToken();
    if (!token) return;
    const wsBase = api.baseUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/v1/orders/${orderId}/call?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "presence") {
        setPeerOnline(msg.peers > 1);
        return;
      }
      if (msg.type === "offer") {
        pendingOfferRef.current = msg.sdp;
        setStatus((s) => (s === "idle" ? "ringing-incoming" : s));
        return;
      }
      if (msg.type === "answer") {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(msg.sdp);
          setStatus("connected");
        }
        return;
      }
      if (msg.type === "ice") {
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(msg.candidate).catch(() => {});
        } else {
          pendingCandidatesRef.current.push(msg.candidate);
        }
        return;
      }
      if (msg.type === "hangup") {
        teardown();
        setStatus("idle");
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      teardown();
    };
  }, [orderId, teardown]);

  return { status, peerOnline, muted, error, call, accept, decline, hangup, toggleMute, remoteAudioRef };
}
