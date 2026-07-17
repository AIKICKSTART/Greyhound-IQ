# WebSocket origin boundary

Status: source-verified; deployed provider configuration remains a release gate  
Owner: Platform and application security  
Last reviewed: 2026-07-15

GreyhoundIQ does not host a WebSocket upgrade handler. Browser realtime connections terminate at two managed providers: Supabase Realtime for feed, conversation, profile and presence events, and LiveKit for voice/video rooms. Origin is an abuse signal, not an authorization boundary: non-browser clients can choose an `Origin` header, so provider connections must remain safe even when that header is absent or forged.

The browser can obtain private provider credentials only through same-origin POST endpoints. `/api/realtime/token` and `/api/calls/[roomId]/token` are covered by the common proxy before authentication; cross-site or same-site browser mutations and malformed/null origins are rejected. Native clients do not use browser cookies and authenticate separately. The proxy matcher includes every API path, and CORS preflights are rejected rather than maintaining a cross-origin credential allowlist.

Supabase private topics use a five-minute signed JWT, opaque HMAC topic names, short-lived server-synchronised topic grants, database RLS and an application-level participant/block recheck. The public feed topic carries public feed events only. LiveKit tokens expire after ten minutes and are issued only after the current profile has an active, unexpired room permission and passes participant/block checks. Tokens are room-scoped, do not permit arbitrary data publication, and are returned only after per-user/per-room rate limiting.

The production CSP limits browser `connect-src` to self plus the configured Supabase HTTPS/WebSocket and LiveKit origins. This reduces browser misuse but is not treated as server-side authorization. No wildcard WebSocket origin or credentialed CORS response is emitted by application source.

If GreyhoundIQ later hosts its own WebSocket upgrade endpoint, this decision expires. That endpoint must validate an exact production-origin allowlist during the handshake, authenticate before subscription, authorize each channel, rate-limit connections and messages, cap frame size and idle lifetime, and test missing, null, malformed, development and attacker origins. The deployed Supabase and LiveKit tenant settings still require pre-production verification; this source review does not claim provider-console parity.
