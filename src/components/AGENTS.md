# Purpose

- Owns reusable GreyhoundIQ UI components, motion helpers, shadcn-style primitives, navigation, cards, forms, replay surfaces, and mobile/tablet app chrome.

# Ownership

- `ui/` owns primitive controls and low-level reusable UI building blocks.
- `motion/` owns reusable animation wrappers and motion-specific utilities.
- Top-level component files own product-specific surfaces such as headers, footers, docks, cards, search, replay, and listing media fields.

# Local Contracts

- Reuse existing primitives and `lucide-react` icons before adding new component patterns.
- Components must remain responsive and accessible: clear labels, keyboard-safe controls, usable focus states, and no text overflow.
- Keep component props minimal. Do not add flexibility until there is a second real caller.
- Do not hard-code secrets, environment values, or privileged URLs in client-rendered components.
- Preserve the GreyhoundIQ premium design language without making one-note color-only sections.
- Signed-in navigation uses one compact utility header and the persistent five-item Home, Feed, Post, Chat, Menu dock at every breakpoint; privilege differences expand Menu content instead of adding competing navigation controls.
- `product-master-requirements.ts` and `security-master-requirements.ts` are immutable atomic prompt extractions; completion evidence belongs in `master-audit-evidence.ts`, and empty evidence never counts as complete.
- Final traceability-field and summary-metric evidence is structural only. It completes solely with the explicit `final-report-structure-only` scope and must never imply runtime coverage, finding absence, or production readiness.
- `demo-experience-registry.ts` owns visual screen contracts. Dynamic contracts retain the route pattern and a bracket-free `concreteRoute` audit sample; `noindex` and default `productionEnabled` values must match owning page metadata and access gates. The Design Lab production gate must remain derived from both screen-contract evidence and the two master requirement registries.
- `screen-contracts/design-lab-user-stories.ts` owns the six Design Lab route inventories. Keep actions, states, fixtures, and test IDs exact; exclude forms only while the owning source scan proves there is no `<form>` submission path. The registry may mirror those manifest areas, but canonical route-audit coverage remains authoritative. Permission and state completion must remain linked to a focused source contract and runnable test under `screen-contracts/`; onboarding stays open until separately proven.
- `design-lab-workspace.ts` owns the seven Mission Control area IDs and shareable `?area=` contract. The Architecture area embeds the canonical static production report without treating planning as verified evidence. Render one active module at a time, keep the canonical status ribbon derived from registries, and do not duplicate or hand-edit release counters in navigation UI.
- `design-lab-contract-inspector.tsx` is the standard Screen Library contract inspector. It must render all 19 `DL.INSPECT.*` dimensions for every registered route, label missing metadata as a gap, and never promote the underlying screen behavior merely because the gap is visible. Its route selector accepts only registered contracts, preserves non-sensitive categorical query state, strips transient `auditQuery` and `workQuery` values, persists the selected route in the same-origin URL, and restores copied, reloaded, and browser-history selections.
- `design-lab-pending-work.ts` owns the unified release-work index derived from screen, master, pre-production, and database registries. Never hand-edit completion in this view or create a second task counter; registry drift must fail its exact-total test.
- `design-lab-architecture-inventory.ts` owns source-static infrastructure, component-field, and trust-flow mappings for the selected Australia plan. Its evidence may verify mapping completeness only; deployed providers, runtime controls, failover, load, IAM, alert delivery, and production validation remain unverified until environment-bound tests pass.
- `design-lab-operating-model.ts` owns the six Design Lab capabilities, local/staging/production proof boundaries, two protected admin planes, training-video contract, release authority, and cross-product mobile contract. Keep web, iOS/iPadOS, Android/tablet, and shared backend as independent source and deployment boundaries: native implementation, UI, builds, signing, store credentials, and store mutations never belong in this Next.js repository. Add operating-model launch blockers only through `design-lab-preproduction-requirements.ts`, with empty evidence receiving no completion credit.
- Mobile source-boundary completion must consume a source-digested external-client evidence manifest from a clean, reproducible commit and exact-commit CI run. Dirty workspace evidence is source-contract capture only and cannot satisfy build, signing, deployment, provider, store, immutable promotion, or real-device gates.
- Daniel's 2026-07-15 MVP decision keeps all five native mobile requirements visible as post-MVP work but non-release-blocking for the Australian web MVP. Do not silently return them to the MVP release total; a later phase change requires an explicit product decision and updated gate tests.
- `design-lab-data-feed-registry.ts` owns the source-static inventory for every racing-data pipeline. Keep verified code facts separate from unknown operator metadata and server-supplied runtime snapshots; missing freshness, ownership, licence, alert or runbook evidence must render as unknown/not-verified rather than healthy. The Design Lab panel is read-only, and a future Admin operations desk must obtain live health through a least-privilege server boundary without exposing provider credentials or sensitive endpoints.

# Work Guidance

- Keep visual fixes in the smallest owning component or CSS rule.
- Prefer CSS/media queries for layout over JavaScript viewport detection unless behavior truly changes.
- Avoid nested card layouts unless the inner element is a real repeated item, modal, or framed tool.

# Verification

- Run `npm run typecheck`, `npm run lint`, and `npm run build` for component changes.
- For responsive or visual changes, inspect the affected mobile, tablet, and desktop breakpoints in a browser when a server is running.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
