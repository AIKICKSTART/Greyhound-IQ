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
- Metadata, sitemap, manifest, favicon, and icon changes are user-facing SEO/product changes; verify names, descriptions, and asset references.
- Preserve responsive behavior for current mobile, older mobile, tablet portrait, tablet landscape, and desktop breakpoints.

# Work Guidance

- Reuse components from `src/components` and data helpers from `src/lib`.
- Keep page modules focused on composition. Move shared business logic to `src/lib`.
- Avoid oversized page-specific CSS when an existing global pattern covers it.

# Verification

- Run `npm run typecheck`, `npm run lint`, and `npm run build` for App Router or global CSS changes.
- For route handlers or server actions, add or run the smallest targeted check that exercises the changed path when available.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
