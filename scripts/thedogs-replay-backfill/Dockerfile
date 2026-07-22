FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.json prisma.config.ts next.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

RUN npm ci --include=dev && chown -R node:node /app

USER node

ENTRYPOINT ["npx", "tsx", "scripts/backfill-thedogs-race-videos.ts"]
