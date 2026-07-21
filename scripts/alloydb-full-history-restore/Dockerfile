FROM gcr.io/alloydb-connectors/alloydb-auth-proxy@sha256:9d6ce91dc54cf4e36da640706a906b734230a8a60f5addf56d16bf9366a9c6db AS alloydb-proxy

FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

COPY --from=alloydb-proxy /alloydb-auth-proxy /usr/local/bin/alloydb-auth-proxy
COPY --from=alloydb-proxy /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY scripts/alloydb-full-history-restore/restore.sh /usr/local/bin/giq-full-history-restore

RUN sh -n /usr/local/bin/giq-full-history-restore \
    && chmod 0555 /usr/local/bin/alloydb-auth-proxy /usr/local/bin/giq-full-history-restore

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-full-history-restore"]
