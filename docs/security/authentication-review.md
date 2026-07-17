# Authentication review

Status: **Partially verified**
Evidence date: 2026-07-13
Owner: Identity and security owner

## Implemented paths

| Path | Entry and implementation | Observed controls | Status |
|---|---|---|---|
| Start sign-in | `GET /sign-in`; `src/app/sign-in/route.ts` | WorkOS hosted flow; server-built redirect URI; safe internal `returnTo` | Verified by focused redirect tests |
| Callback | `GET /callback`; `src/app/callback/route.ts` | AuthKit `handleAuth`; local sync; safe allowlisted recovery reason/reference | Partially verified; no live provider flow run |
| Local identity link | `syncAuthUser`; `src/lib/auth-sync.ts` | WorkOS subject; email fallback excluded when email is explicitly unverified | Partially verified |
| Resolve current user | `getCurrentUser`; `src/lib/auth.ts` | WorkOS session then local tier/role/ban state | Partially verified |
| Require protected user | `requireCurrentUserProfile`; `src/lib/auth.ts` | Denies signed-out and banned users; creates missing local profile | Partially verified |
| Sign out | `signOutAction`; `src/components/site-header.tsx` | Server action delegates to AuthKit `signOut` | Partially verified; live server-session invalidation not tested |
| Callback failure | `/auth/error`; `classifyAuthCallbackFailure` | Safe reason allowlist, retry/home/support, opaque reference | Focused tests reported passing |
| Account deletion | `requestAccountDeletion`, `runAccountDeletionMaintenance` | Local ban and 30-day grace; local identity/social-actor scrub; sender-authored message tombstone; audited queued storage-prefix deletion | Provider cancellation/deletion, provider-session revocation and backup expiry remain incomplete; `SEC-H-002` |

## Redirect and callback controls

`resolveWorkosReturnTo` in `src/lib/workos-redirect.ts` accepts only an absolute-path reference on a fixed invalid origin. It rejects protocol-relative paths, backslashes, control characters, `/sign-in` and `/callback` loops. Plan and interval values are allowlisted. `src/lib/workos-redirect.test.ts` covers unsafe external destinations.

`resolveWorkosBaseUrl` rejects bind addresses and production localhost, accepts HTTPS, and derives production redirects from configured application origins. The production WorkOS dashboard redirect allowlist was not inspected.

The installed AuthKit callback implementation uses a flow-specific PKCE cookie and compares state before code exchange. That dependency behaviour is useful evidence, but GreyhoundIQ still requires an integration test against the configured staging tenant for invalid state, replayed code, cancelled flow and expired flow.

## Identity-linking risk

`authLookupWhere` always matches the WorkOS subject and permits email fallback when `emailVerified` is `true` or unknown. The active `requireCurrentUserProfile` call passes the provider value. Any new caller must pass verification explicitly; unknown must not become a silent account-linking bypass. Add tests for two WorkOS subjects with the same unverified email and for existing local email collision.

## Required provider evidence

The following are **Not verified** because they live in WorkOS or external tenant configuration:

- enabled authentication methods and account-creation policy;
- OAuth/OIDC issuer, audience, state, nonce and PKCE settings;
- callback code single-use behaviour in the configured tenant;
- brute-force, credential-stuffing and enumeration controls;
- email verification and recovery-token lifetime/single use;
- passwordless/password reset paths if enabled;
- account linking and unlinking controls;
- MFA and step-up requirements for moderator/administrator access;
- session idle/absolute lifetime, concurrent-session policy and revocation;
- suspended/deleted-user session invalidation;
- audit export for success, failure, recovery and privileged authentication.

## Release tests

Before release, staging tests must prove:

1. Signed-out access is denied for every protected route and API.
2. Unsafe `returnTo` variants cannot leave the application origin.
3. Invalid/missing state, reused callback, expired flow, provider failure and cancellation reach the safe recovery state without account enumeration.
4. Authentication rotates the session; privilege and security-setting changes revoke or rotate it.
5. Sign out invalidates the provider/server session and clears the cookie.
6. Banned, deletion-pending and finalised accounts cannot reuse an old session.
7. Administrator access requires the approved stronger-authentication control.
