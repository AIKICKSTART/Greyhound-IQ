# Security Policy

GreyhoundIQ handles account data, private community messages, marketplace media, and racing intelligence workflows. Treat security issues as production incidents.

## Reporting

Report security issues privately to Daniel Fleuren via the AI Kick Start operator channel. Do not open public GitHub issues for vulnerabilities.

## Secret handling

- Never commit `.env`, API keys, database URLs, Supabase service-role keys, Vercel tokens, GitHub tokens, OpenAI keys, WorkOS keys, or local credential file paths.
- GitHub Actions secrets hold CI/CD credentials.
- Vercel environment variables hold runtime credentials.
- Rotate any credential that was exposed in a terminal log, screenshot, issue, PR, or commit.

## Required gates

Before merge:

- CI must pass.
- Codex PR review must run.
- At least one human review is required.
- Database migrations must be reviewed.

Before production launch:

- Supabase production keys rotated after development.
- RLS and auth checks reviewed.
- Security headers verified.
- Backup and restore runbook tested.
- Responsible gambling and privacy links verified.
