# GreyhoundIQ Wiki

GreyhoundIQ is an AI Kick Start platform for Australian greyhound racing intelligence, race cards, ownership, breeding analytics, marketplace listings, community features, and agent-assisted workflows.

## Core links

- [Local Development](Local-Development)
- [Environment Variables](Environment-Variables)
- [Supabase Setup](Supabase-Setup)
- [Vercel Deployments](Vercel-Deployments)
- [GitHub Workflow](GitHub-Workflow)
- [CI/CD Gates](CICD-Gates)
- [Codex Review Process](Codex-Review-Process)
- [Release Process](Release-Process)
- [Incident and Secrets Runbook](Incident-Secrets-Runbook)

## Current hosting model

- GitHub repo: `AIKICKSTART/Greyhound-IQ`
- Production frontend/API: AI Kick Start Google Cloud VPS
- Preview/temp frontend/API: Vercel
- Database/storage: Supabase
- Auth: WorkOS only
- Billing: Lago is the source of truth
- PR review: GitHub Actions + Codex + human approval
