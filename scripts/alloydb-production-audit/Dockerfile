FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

COPY scripts/alloydb-production-audit/audit.sh /usr/local/bin/giq-production-db-audit

RUN sh -n /usr/local/bin/giq-production-db-audit \
    && chmod 0555 /usr/local/bin/giq-production-db-audit

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-production-db-audit"]
