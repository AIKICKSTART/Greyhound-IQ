# Contributing to GreyhoundIQ

GreyhoundIQ uses a PR-first workflow. Work locally on a branch, push to GitHub, wait for CI, Vercel preview, and Codex review, then request human review.

## Local workflow

```bash
git checkout main
git pull
git checkout -b feature/short-description
npm ci
cp .env.example .env
npm run dev
```

Before opening a PR:

```bash
npm run typecheck
npm run lint
npm run build
```

## Branches

- `feature/*` for product work
- `fix/*` for defects
- `docs/*` for documentation
- `codex/*` for agent-authored changes

`main` is protected. Do not push directly to `main` after branch protection is enabled.

## Pull requests

Every PR must include:

- a short summary
- validation commands run
- screenshots for UI changes
- migration notes for database changes
- confirmation that no secrets were committed

## Database changes

Use Prisma migrations. Avoid destructive changes. If a migration drops data, changes indexes, or adds a non-null column, call it out in the PR body.

## Secrets

Do not paste secrets into issues, PRs, commits, logs, screenshots, README, wiki, or docs. Store runtime secrets in Vercel env vars and CI secrets in GitHub Actions.
