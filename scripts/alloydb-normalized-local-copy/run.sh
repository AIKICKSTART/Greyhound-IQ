#!/bin/bash
set -euo pipefail

case "${NORMALIZED_COPY_ACTION:-restore}" in
  export)
    exec /usr/local/bin/giq-normalized-copy-export
    ;;
  restore)
    exec /usr/local/bin/giq-normalized-copy-restore
    ;;
  *)
    printf 'OPERATOR_ATTENTION: NORMALIZED_COPY_ACTION must be export or restore\n' >&2
    exit 1
    ;;
esac
