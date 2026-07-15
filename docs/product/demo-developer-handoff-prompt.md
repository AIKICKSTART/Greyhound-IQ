# Design Lab demo developer handoff prompt

Copy the prompt below into a second developer or coding-agent session. This scope is the local Design Lab demo, not the production GreyhoundIQ application or live Google Cloud database.

```text
You are collaborating on the GreyhoundIQ Design Lab demo in E:\greyhoundiq.

Scope boundary:
- Work only on the isolated local Design Lab/demo experience and its synthetic fixtures, contracts, onboarding previews, tests, and documentation.
- The review surface is http://localhost:3000/design-lab.
- Do not connect to, read from, write to, migrate, seed, or otherwise mutate the live Google Cloud production database.
- Do not weaken real authentication, authorization, billing, tenancy, or production deployment controls to simulate a Design Lab role.
- Do not approve or promote production. A browser action, URL parameter, localStorage value, visual selection, or local command is never production approval.
- Preserve the existing dirty worktree and other developers' changes. Never reset, checkout, delete, or broadly reformat unrelated work.

Startup:
1. Read E:\greyhoundiq\AGENTS.md and every child AGENTS.md governing files you may touch.
2. Confirm the codebase-memory project E-greyhoundiq is current; use its graph tools before filesystem search for code discovery.
3. Read the applicable Next.js 16 documentation in node_modules\next\dist\docs before using version-sensitive APIs.
4. Open http://localhost:3000/design-lab and inspect the actual rendered UI before editing it.

Work contract:
1. Choose a bounded set of open items from the Product and security completion checklist.
2. Use the stable requirement IDs and shared trace IDs already registered in the repository. Do not invent a duplicate registry.
3. Implement real Design Lab screens, synthetic fixtures, states, onboarding steps, or safe simulated actions for those items.
4. Design Lab actions must never call production mutations. Destructive actions must be visibly simulated.
5. Add automated evidence for every completed item. Do not change a status to verified, tested, excluded, or not applicable without durable evidence and a specific justification.
6. Keep missing or unverified work honestly open. Never mark a heading or broad phase complete because one example passes.
7. Maintain keyboard support, visible focus, semantic labels, 44px touch targets, reduced-motion support, no horizontal overflow, and usable phone/tablet layouts.
8. Persist relevant Design Lab selector state in the URL so a reviewer can reproduce it.
9. Add or update focused tests first, then run the relevant route/component tests, npm run typecheck, npm run lint, and npm run build before handoff.

Production handoff rule:
- The protected GitHub production environment may only consider an exact 40-character commit SHA after successful CI, a matching SHA-256 Design Lab evidence digest, and an immutable container-image digest.
- Deployment must create a no-traffic candidate revision, smoke-test it, and only then promote the exact tested revision.
- Never bypass the blocked checklist or use local production deployment credentials.

At handoff, report:
- Requirement and trace IDs addressed.
- Files changed.
- Synthetic fixtures and states added.
- Tests and browser/device evidence.
- Remaining gaps or uncertainty.
- Confirmation that no production data or mutation was used.
```
