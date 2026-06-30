# Codex Review Process

Codex is used as an automated PR reviewer, not as the final approver.

## Required setup

- Enable Codex review on the GitHub repo where available.
- Add `OPENAI_API_KEY` as a GitHub Actions secret for `openai/codex-action@v1`.

## Review focus

Codex should prioritize:

- auth and privacy regressions
- cross-user data access
- committed secrets
- Prisma migration safety
- deployment and environment mistakes
- missing tests for changed behavior
- high-impact UI regressions

## Human review

A human reviewer still approves final merge. Codex findings must be addressed or explicitly resolved in the PR.
