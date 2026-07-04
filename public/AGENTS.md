# Purpose

- Owns static public assets served by the GreyhoundIQ app.

# Ownership

- Browser icons, manifest-linked assets, images, and public files live here when they must be directly served by Next.js.

# Local Contracts

- Do not place secrets, private exports, source credentials, or non-public client files in this folder.
- Keep filenames stable when referenced by metadata, manifest, CSS, or components.
- Optimize assets for web delivery where practical without degrading brand quality.
- Verify that public assets match the premium GreyhoundIQ visual system and are safe to cache publicly.

# Work Guidance

- Prefer replacing an asset in place only when the reference should keep the same URL.
- Add a new filename when cache behavior or visual history matters.
- Update every referencing route, metadata file, component, or doc when asset names change.

# Verification

- For favicon, icon, manifest, or image changes, run `npm run build` when practical and visually inspect the affected page or browser tab.

# Child DOX Index

- This subtree has no child AGENTS.md files yet.
