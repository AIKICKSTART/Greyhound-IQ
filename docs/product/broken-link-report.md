# GreyhoundIQ broken-link report

Status: incomplete; public crawl evidence only  
Review snapshot: 2026-07-14 AEST; production crawl: 2026-07-13 AEST  
Owner: Product engineering

## Current evidence

The machine-readable snapshot at `output/product-audit/production-link-audit.json` recorded 1,026 discovered public destinations and 1,026 HTTP 200 responses. This proves only the links and anonymous destinations captured by that crawl. It does not prove authenticated navigation, action destinations, browser history, external-provider returns, forms, redirects, or the current working tree.

The local Design Lab route audit separately recorded all 90 registered screens rendering under isolated full-access demo mode. Its source digest is currently stale and must be regenerated after active source work settles before it is canonical evidence.

## Material routing defects

- The production snapshot showed plain HTTP redirecting to an unreachable HTTPS port 8080.
- Apex and `www` both served content without a verified canonical-host redirect.
- Production lacked `/responsible-use` at the snapshot date; the local route now exists but deployment parity is unverified.
- Auth callback failures and authorization-sensitive missing records require separate system-screen and hard-404 tests.
- A 200 response is not proof that a destination shows the intended record or action result.

## Closure criteria

Run a fresh anonymous and authenticated browser crawl against the exact immutable staging candidate; include every navigation, footer, dock, CTA, form result and provider return; record final URL, redirect chain, status, page identity and authorization outcome; then repeat after production promotion. Until that passes, the broken-link report is produced but product navigation remains release-blocking.
