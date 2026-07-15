# Purpose

- Owns the Next.js App Router surface for GreyhoundIQ: pages, layouts, route handlers, metadata, actions, global CSS, sitemap, loading, error, and not-found states.

# Ownership

- Route folders own their page-specific data loading, metadata, and UI composition.
- `api/` owns route handlers and must treat all inputs as untrusted.
- `globals.css` owns global design tokens, responsive layout rules, and cross-page visual systems.
- `actions.ts` owns server actions and must keep validation close to mutations.

# Local Contracts

- Read the relevant Next.js docs under `node_modules/next/dist/docs/` before changing App Router APIs, metadata, route handlers, caching, server actions, or file conventions.
- Use server components by default. Add `"use client"` only when browser-only behavior is required.
- Keep route handlers defensive: validate input, avoid leaking internal errors, and never expose secrets.
- Route handlers that call `checkRateLimit` must use `rateLimitExceededResponse` for every denial so actual 429 responses carry the standard limit, reset, retry, and no-store headers.
- Keep reusable constants, dependency-injected handlers, and test helpers in sibling modules; special `route.ts` files may export only supported HTTP methods and Next route-segment configuration.
- Stripe, Lago, and LiveKit webhook routes must read through `webhook-request-body.ts`, enforcing the shared 1 MiB declared and actual-byte ceiling before signature verification or parsing; malformed lengths and oversized payloads return no-store 4xx responses.
- Metadata, sitemap, manifest, favicon, and icon changes are user-facing SEO/product changes; verify names, descriptions, and asset references.
- Preserve responsive behavior for current mobile, older mobile, tablet portrait, tablet landscape, and desktop breakpoints.
- The `/admin` shell is shared by moderators and administrators: declare administrator-only screens in `admin-nav-data.ts`, enforce `requireAdminProfile()` in every matching page, keep moderator navigation to trust/safety and support work, require typed allowlists plus confirmation/audit UX for administrator mutations, and block self-lockout paths.
- Keep `admin-authorization-inventory.ts` exact for every `/admin` page, privileged server action, and report-resolution handler; inventory drift must fail CI, while request-level role denial and last-admin concurrency remain unverified until their named blockers have runtime evidence.
- Authentication callback failures must return a noindex recovery screen with allowlisted public reason codes and a safe retry; never expose provider errors or retry through an unvalidated destination.
- Design Lab routes are noindex, server-gated in production through `requireDesignLabReviewer()`, administrator-authorised outside the explicitly isolated demo, synthetic/read-only, and must not resolve real user or conversation data in the isolated demo runtime.
- `/design-lab` defaults to the Mission Control overview, while `/design-lab/demo-experience` defaults to the Screen library; both resolve the allowlisted `?area=` value on the server before rendering a single module.

# Work Guidance

- Reuse components from `src/components` and data helpers from `src/lib`.
- Keep page modules focused on composition. Move shared business logic to `src/lib`.
- Avoid oversized page-specific CSS when an existing global pattern covers it.

# Verification

- Run `npm run typecheck`, `npm run lint`, and `npm run build` for App Router or global CSS changes.
- For route handlers or server actions, add or run the smallest targeted check that exercises the changed path when available.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
