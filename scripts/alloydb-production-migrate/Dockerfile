FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY src/lib/database-url.ts ./src/lib/database-url.ts
COPY scripts/alloydb-production-migrate/migrate.sh /usr/local/bin/giq-production-migrate

RUN npm ci --include=dev \
  && chmod 0555 /usr/local/bin/giq-production-migrate \
  && chown -R node:node /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

USER node

ENTRYPOINT ["/usr/local/bin/giq-production-migrate"]
