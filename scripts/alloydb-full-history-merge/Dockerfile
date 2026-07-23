FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS node_runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global prisma@6.19.3 \
  && prisma --version \
  && find /usr/local/lib/node_modules/prisma/node_modules/@prisma/engines -type f -name '*schema-engine*' -print -quit | grep -q .

FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

RUN apt-get update \
  && apt-get install -y --no-install-recommends jq openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -s /usr/local/lib/node_modules/prisma/build/index.js /usr/local/bin/prisma

# Build with the repository root as context:
# docker build -f scripts/alloydb-full-history-merge/Dockerfile .
COPY scripts/import-galtd-studbook.ts /usr/local/share/import-galtd-studbook.ts
COPY scripts/backfill-race-videos-evidence-contract.json /usr/local/share/giq-full-history-merge/replay-evidence-contract.json
COPY prisma/schema.prisma /usr/local/share/giq-full-history-merge/prisma/schema.prisma
COPY prisma/migrations/ /usr/local/share/giq-full-history-merge/prisma/migrations/
COPY scripts/alloydb-full-history-merge/galtd-stage-export.ts /usr/local/share/giq-full-history-merge/galtd-stage-export.ts
COPY scripts/alloydb-full-history-merge/merge.sh /usr/local/bin/giq-full-history-merge
COPY scripts/alloydb-full-history-merge/clean-partition.sh /usr/local/bin/giq-clean-partition
COPY scripts/alloydb-full-history-merge/normalize-checkpointed.sh /usr/local/bin/giq-normalize-checkpointed
COPY scripts/alloydb-full-history-merge/sql/ /usr/local/share/giq-full-history-merge/sql/

RUN find /usr/local/share/giq-full-history-merge/prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print \
      | sort \
      | while IFS= read -r migration; do \
          printf '%s\t%s\n' "$(basename "$(dirname "$migration")")" "$(sha256sum "$migration" | awk '{print $1}')"; \
        done > /usr/local/share/giq-full-history-merge/migration-manifest.tsv \
  && test "$(wc -l < /usr/local/share/giq-full-history-merge/migration-manifest.tsv)" -gt 0

RUN chmod 0555 /usr/local/bin/giq-full-history-merge /usr/local/bin/giq-clean-partition /usr/local/bin/giq-normalize-checkpointed

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-full-history-merge"]
