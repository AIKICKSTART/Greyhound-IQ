# Local Development

## Requirements

- Node.js 20+
- npm
- Git
- Access to the GreyhoundIQ GitHub repo
- Supabase staging credentials

## Setup

```bash
git clone https://github.com/AIKICKSTART/Greyhound-IQ.git
cd Greyhound-IQ
npm ci
cp .env.example .env
```

Fill `.env` from the team secret store. Do not paste secrets into GitHub issues, PRs, docs, or chat logs.

## Run locally

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Pre-PR checks

```bash
npm run typecheck
npm run lint
npm run build
```

Use `npm run ci` when you want the closest local match to the GitHub gate.
