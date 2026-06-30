# GitHub Workflow

## Branch rules

- `main` is protected.
- Work is done on branches.
- Pull requests are required.
- Squash merge is preferred.
- Delete branches after merge.

## Branch naming

- `feature/*`
- `fix/*`
- `docs/*`
- `codex/*`

## PR requirements

- CI passes.
- Codex review runs.
- Vercel preview deploys.
- One human review approves.
- Conversations are resolved.

## Local publishing

```bash
git checkout main
git pull
git checkout -b feature/my-change
# make changes
npm run typecheck
npm run lint
npm run build
git push -u origin feature/my-change
```
