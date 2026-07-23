# Session review

Status: **Partially verified**
Evidence date: 2026-07-13
Owner: Identity and security owner

## Observed implementation

- `src/proxy.ts` runs `authkitProxy` for non-demo requests, so application routes consume the WorkOS AuthKit session.
- `src/lib/auth.ts` calls `withAuth` and then resolves current local ban, tier and role state rather than accepting those values from the browser.
- `src/components/site-header.tsx` invokes AuthKit `signOut` through a server action.
- No application session identifier is placed in application URLs by reviewed source.
- No application authentication token was found intentionally persisted in `localStorage`, `sessionStorage` or IndexedDB. This was a code review, not a built-client storage inspection.
- `src/proxy.ts` rejects cross-origin browser mutations in addition to SameSite cookie behaviour.

## Cookie contract

The installed AuthKit package constructs session cookies with `HttpOnly`, configurable `SameSite`, `Path` and production `Secure` behaviour. The effective production environment values, `Domain`, cookie name and browser response were not inspected. Therefore the required cookie flags are **Partially verified**, not Verified.

Required production evidence:

| Control | Required value | Status |
|---|---|---|
| Secure | Enabled on production session and PKCE cookies | Not verified live |
| HttpOnly | Enabled on session and sensitive flow cookies | Not verified live |
| SameSite | Documented and appropriate for AuthKit flow | Not verified live |
| Domain | Narrowest working GreyhoundIQ host/domain | Not verified live |
| Path | `/` only where session use requires it | Not verified live |
| URL leakage | No session/code/token in app URLs, referrers or analytics | Not verified end-to-end |
| Client storage | No access/refresh/session token in browser-readable storage | Not verified in built app |

## Lifetime and rotation

The following session controls are provider-owned or absent from repository evidence and remain **Not verified**:

- idle timeout and absolute timeout;
- access/refresh lifetime and refresh-token rotation;
- rotation after authentication, role/tier change, MFA enrolment or email change;
- revocation after account recovery or suspected compromise;
- concurrent-session visibility and user-initiated revocation;
- administrator session lifetime and step-up authentication;
- provider invalidation when a local user is banned, requests deletion or is finalised.

Local authorisation re-evaluates `isBanned`, role and tier on protected requests, which limits stale entitlement use, but it does not prove the external session was revoked.

## CSRF and origin

`src/proxy.ts` calls `isCrossOriginBrowserMutation` before AuthKit handling and denies unsafe cross-origin browser mutations. `/api/internal/live-sync` is POST-only with a route regression test, while workload identity, replay and readiness-write controls remain release-blocking under `SEC-H-009`. User export is now an explicit same-origin POST form, so its audit and artifact writes no longer occur through GET; bounded projections, size limits and private `no-store` remain in place. Full runtime BOLA, large-account and cleanup tests remain under `SEC-H-003`.

The repository does not establish a separate synchroniser/double-submit token. SameSite and origin/fetch-metadata protection must be tested across server actions, JSON routes, multipart uploads, billing creation and sign-out. Missing `Origin`, `Sec-Fetch-Site` and non-browser clients need explicit endpoint policy rather than a blanket assumption.

## Cache and logging

Authenticated/private responses must use `private, no-store` where appropriate. The account export now sets private `no-store`; a product-wide response-header test remains missing. `src/lib/logger.ts` warns against logging tokens, but production logs/telemetry/error reporting were not sampled. Session and authorization headers must be redacted at the edge, app, provider SDK and error-reporting layers.

## Release decision

Session assurance is insufficient for production approval until the WorkOS tenant configuration and browser-observed cookies are captured from authorised staging, privileged step-up is defined, session revocation is tested, and every state-changing cookie-authenticated entry point has a negative CSRF/origin test.
