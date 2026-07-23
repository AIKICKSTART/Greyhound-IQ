FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

RUN apt-get update \
  && apt-get install -y --no-install-recommends jq \
  && rm -rf /var/lib/apt/lists/*

COPY export.sh /usr/local/bin/giq-normalized-copy-export
COPY restore-local.sh /usr/local/bin/giq-normalized-copy-restore
COPY run.sh /usr/local/bin/giq-normalized-copy
COPY contract.json /usr/local/share/giq-normalized-local-copy/contract.json
COPY portable-stage.sql /usr/local/share/giq-normalized-local-copy/portable-stage.sql
COPY load-stage.sql /usr/local/share/giq-normalized-local-copy/load-stage.sql
COPY apply-local.sql /usr/local/share/giq-normalized-local-copy/apply-local.sql
COPY reconcile-read-only.sql /usr/local/share/giq-normalized-local-copy/reconcile-read-only.sql
COPY verify-local-read-only.sql /usr/local/share/giq-normalized-local-copy/verify-local-read-only.sql
COPY export-safe-jsonl.sql /usr/local/share/giq-normalized-local-copy/export-safe-jsonl.sql
COPY export-snapshot.sql /usr/local/share/giq-normalized-local-copy/export-snapshot.sql

RUN chmod 0555 \
  /usr/local/bin/giq-normalized-copy \
  /usr/local/bin/giq-normalized-copy-export \
  /usr/local/bin/giq-normalized-copy-restore

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-normalized-copy"]
