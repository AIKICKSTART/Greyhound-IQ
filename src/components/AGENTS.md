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

# Work Guidance

- Keep visual fixes in the smallest owning component or CSS rule.
- Prefer CSS/media queries for layout over JavaScript viewport detection unless behavior truly changes.
- Avoid nested card layouts unless the inner element is a real repeated item, modal, or framed tool.

# Verification

- Run `npm run typecheck`, `npm run lint`, and `npm run build` for component changes.
- For responsive or visual changes, inspect the affected mobile, tablet, and desktop breakpoints in a browser when a server is running.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
