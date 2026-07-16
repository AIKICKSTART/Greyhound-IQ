FROM postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55

COPY scripts/alloydb-runtime-role-provision/provision.sh /usr/local/bin/giq-runtime-role-provision

RUN chmod 0555 /usr/local/bin/giq-runtime-role-provision

USER postgres

ENTRYPOINT ["/usr/local/bin/giq-runtime-role-provision"]
