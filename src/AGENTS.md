# Purpose

- Owns the GreyhoundIQ application source: routes, UI components, services, validation, auth, and shared utilities.

# Ownership

- `app/` owns Next.js App Router pages, layouts, route handlers, metadata, actions, and global styles.
- `components/` owns reusable UI components and interaction surfaces.
- `lib/` owns shared services, validation, database access, auth helpers, live data, and utilities.
- `proxy.ts` owns request proxy behavior and must stay small and explicit.

# Local Contracts

- Use codebase-memory MCP before reading or changing source code. Trace callers before changing shared services, route handlers, or reusable components.
- Keep server/client boundaries explicit. Prefer server components unless the component needs browser state, effects, or event handlers.
- Generate request IDs at `src/proxy.ts`; never trust a caller-supplied request ID as GreyhoundIQ's correlation identity, and keep upstream trace propagation separate.
- Keep `MAINTENANCE_MODE` enforcement in `src/proxy.ts` after request-security rejection and before authentication; health, internal-job, and webhook paths must remain available for recovery.
- Do not introduce secrets, local credential paths, or service-role keys into source code.
- Reuse existing components, services, validators, and utilities before adding new ones.
- Preserve the premium GreyhoundIQ product style: dark racing analytics UI, glass/chrome surfaces, purple and molten-gold accents, clear mobile/tablet behavior.

# Work Guidance

- Keep changes surgical and local to the feature or bug.
- Prefer typed data contracts and existing validation helpers over ad hoc parsing.
- Do not add generic abstraction layers for one caller.

# Verification

- For source changes, run the smallest relevant check first, then `npm run typecheck`, `npm run lint`, and `npm run build` before shipping.

# Child DOX Index

- `app/AGENTS.md` - App Router routes, pages, metadata, route handlers, global styles, and actions.
- `components/AGENTS.md` - reusable UI components and design-system surfaces.
- `lib/AGENTS.md` - services, validation, auth, data access, and shared utilities.
