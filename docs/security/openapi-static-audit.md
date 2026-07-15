# OpenAPI static security audit

Status: **static audit passed; deployed negative-test gate remains blocked**  
Audit date: 14 July 2026  
Tool: Spectral CLI 6.16.1 with the OWASP API Security ruleset

## Exact candidate

- Contract: `openapi.json`
- SHA-256: `26a56856a97ebfb7387cdf3f56ca5fd502eb639760a8f948ca59878359f936d2`
- Inventory: 83 paths, 104 operations and three component schemas
- Command: `npx spectral lint openapi.json --ruleset .spectral.yaml --fail-severity error --format json`
- Result: exit 0; 163 findings comprising zero errors and 163 warnings

The deterministic hardening pass and removal of one permanently retired route
reduced the original 499 errors to zero by
adding conservative input bounds, replacing the local-only server with the
production edge contract, removing unused legacy media credential parameters,
and binding download, replay-stream and authentication-redirect response limits
to implemented runtime controls. The removed `PUT
/api/media/[id]/local-upload` handler accepted no input, performed no work,
always returned `410`, and had no source or graph callers; its OpenAPI operation
and source-inventory record were removed with it rather than adding fictitious
authentication. `npm run check:openapi-contract` proves the hardening pass is
idempotent and preserves the remaining path, operation and component-schema
inventory. Remaining declared bounds are not runtime validation evidence.
The added `POST /api/conversations/{id}/delivered` operation is bound to its
source route, required WorkOS session, participant policy, bounded idempotent
receipt write and registered limiter. That static contract does not prove its
runtime authorization, rate limiting or rollback behavior.

Rate-limit documentation is derived from runtime source rather than added to
silence the audit. The authoritative registry contains 62 limited API
operations: 61 database-distributed controls and one process-local replay
backstop. A TypeScript AST contract proves both directions between exported
route methods and the registry, including three shared limiter helpers that
cover two HTTP methods each. A second deterministic synchronizer binds each
registered operation ID to `x-rate-limit-policy` and the exact shared `429`
response. The runtime response helper emits the same safe JSON body,
`RateLimit-Limit`, clamped `RateLimit-Remaining`, delta-second
`RateLimit-Reset`, matching `Retry-After`, exact-origin CORS and
`private, no-store` cache policy.

These legacy field names intentionally match the pinned OWASP ruleset and use
delta-second semantics. They are not presented as final IETF standard
conformance: the active May 2026
[RateLimit header-fields draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
uses consolidated `RateLimit` and `RateLimit-Policy` fields and remains a work
in progress. Any future migration must be versioned and contract-tested rather
than silently changing client retry behavior.

The upstream `owasp:api4:2023-rate-limit` rule is disabled because it requires
quota headers on every 2XX and 4XX response, including operations that do not
have a runtime limiter. It is replaced only for this concern by the source AST
parity contract, exact OpenAPI synchronizer and two fail-closed GreyhoundIQ
Spectral rules. All other OWASP API4 rules remain enabled. This is source-level
evidence; it does not prove Cloud Armor enforcement, distributed replay quotas
or deployed response behavior.

Replay now uses one opaque base64url `t` capability. AES-256-GCM protects the
allowlisted provider URL, its query credentials and the ten-minute expiry; the
capability allows at most 30 seconds of clock skew and is covered by tamper,
expiry and provider-host tests. The legacy `u`, `e`, `s` and unused
`content-type` parameters are absent from both runtime and OpenAPI. The upstream
generic URL-api-key rule is replaced by a fail-closed GreyhoundIQ rule: only
`ReplaySignature` can use the `MEDIA-SIGNED-URL-001` exception, the exception
must remain bounded, owned and review-dated, and every other query/path API key
still fails. Its review date is 14 October 2026.

The replay proxy's bounded saturation response is intentionally same-origin and
does not emit `Access-Control-Allow-Origin`. The exact `503` response therefore
uses `REPLAY-STREAM-503-SAME-ORIGIN-001`; its owner, rationale, residual risk and
14 October 2026 review date are mandatory. A replacement rule fails if that
exception is incomplete or copied to any other operation or response. Global
CORS checks remain enabled everywhere else.

## Remaining warnings

| Rule | Count | Required disposition |
|---|---:|---|
| Restricted-string patterns | 98 | Add source-backed formats, patterns or enums. |
| Validation-error responses | 63 | Register the actual validation error boundary and schema. |
| `additionalProperties` | 2 | Close only after the runtime object contract is known. |

Warnings remain tracked release work even though the pinned command fails only
on error severity. The reduction from 329 to 163 came from exact source-backed
authentication classifications, real response contracts and tighter replay
metadata; no fictitious limiter, validation behavior or production control was
added to silence the ruleset.

## Reviewed encrypted replay-capability exception

`GET /api/replay/stream` is the sole URL-credential exception because
browser-native HLS and media fetches cannot reliably attach an Authorization
header. The exception is not a relabel: OpenAPI still declares an `apiKey` in
query, while the local rule permits only the exact `ReplaySignature` component
and requires its maximum TTL, clock skew, owner, review date and residual risk.
The encrypted capability authenticates the full allowlisted provider target and
expiry. Exposure of opaque `t` in browser or access metadata during that short
lifetime remains residual risk; authorised staging must prove query-value
log/referrer redaction before launch.

## Acceptance

The static-contract portion of ARCH-201 now has a zero-error candidate, pending
independent review and immutable-candidate binding. The API production gate
remains blocked until authorised isolated staging tests prove authorisation,
input rejection, replay protection, access-log redaction, exact response
headers and layered edge/application limits. Replay DNS pinning, distributed
quota enforcement and deployed origin protection remain open. The signed-media
exception itself must be reviewed again by 14 October 2026.
