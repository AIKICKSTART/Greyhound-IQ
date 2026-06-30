<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GreyhoundIQ Project Rules

- Treat this as an AI Kick Start production app for Australian greyhound racing intelligence.
- Never commit secrets, tokens, API keys, Supabase service-role keys, Vercel tokens, local `.env` files, or local credential paths.
- Keep Vercel and GitHub tokens in GitHub Actions secrets or Vercel project environment variables only.
- Use Supabase staging for preview/temp deployments and reserve Supabase production for launch.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` before shipping code changes.
- Any Prisma migration must be forward-only and reviewed for destructive operations.
- PR reviews should prioritize security, data loss, auth, deployment, and user-facing regressions over style-only comments.
