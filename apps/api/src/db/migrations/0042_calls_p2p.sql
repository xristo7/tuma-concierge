-- Adds the fields needed for the "webrtc_p2p" call provider — direct
-- browser-to-browser WebRTC with no media-relay service (free STUN, plus
-- optional free/self-hosted TURN as a NAT-traversal fallback — see
-- ../calls/webrtc-p2p.ts). Uses non-trickle ICE (each side waits for its
-- own candidate gathering to finish before posting) so the whole exchange
-- is just two SDP blobs on the existing calls row rather than a separate
-- candidates table.
ALTER TABLE calls ADD COLUMN offer_sdp TEXT;
ALTER TABLE calls ADD COLUMN answer_sdp TEXT;
