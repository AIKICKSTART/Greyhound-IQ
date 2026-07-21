FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

USER root

RUN apt-get update \
  && apt-get install --yes --no-install-recommends jq ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts/pedigree-forward-merge/entrypoint.sh /usr/local/bin/giq-pedigree-forward-merge
COPY scripts/pedigree-forward-merge/merge.sql /app/merge.sql
COPY scripts/pedigree-forward-merge/input-manifest.json /app/input-manifest.json
COPY .pedigree-forward-merge-data/ /app/data/

RUN chmod 0555 /usr/local/bin/giq-pedigree-forward-merge \
  && chmod 0444 /app/merge.sql /app/input-manifest.json \
  && find /app/data -type f -exec chmod 0444 {} +

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-pedigree-forward-merge"]
