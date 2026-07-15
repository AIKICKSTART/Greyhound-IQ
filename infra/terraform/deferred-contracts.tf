locals {
  # These are review contracts, not module activations or deployed-state proof.
  # Every managed service stays blocked until its named evidence exists in an
  # independently reviewed green plan.
  deferred_managed_services = {
    alloydb = {
      provisioned    = false
      release_gate   = "blocked"
      target         = "Sydney HA primary with Melbourne cross-region secondary/read capacity"
      required_proof = "Prisma, RLS, extension, pooler, migration, PITR, restore, promotion and reconnect rehearsal"
    }
    espv2 = {
      provisioned    = false
      release_gate   = "blocked"
      target         = "ESPv2 beside each Australian Cloud Run cell, generated from the canonical OpenAPI contract"
      required_proof = "Pinned gateway image/config digests plus undeclared-route, authn, quota, payload, timeout and correlation tests"
    }
    cdn = {
      provisioned    = false
      release_gate   = "blocked"
      target         = "USE_ORIGIN_HEADERS on an explicit public route allowlist only"
      required_proof = "Cache-key, private-response bypass, Set-Cookie, purge, stale and cache-miss attack tests"
    }
    queues = {
      provisioned    = false
      release_gate   = "blocked"
      target         = "Pub/Sub persistence restricted to Sydney/Melbourne and bounded Sydney Cloud Tasks dispatch"
      required_proof = "Transactional outbox, idempotency, retry, dead-letter, queue-age, backlog and regional-failure tests"
    }
    observability = {
      provisioned    = false
      release_gate   = "blocked"
      target         = "Australian log sinks/buckets, SLOs, burn alerts, dashboards and paging runbooks"
      required_proof = "Edge-to-database correlation, redaction, retention, alert routing, synthetic checks and incident exercise"
    }
  }
}

check "managed_services_remain_deferred" {
  assert {
    condition = alltrue([
      for contract in values(local.deferred_managed_services) :
      contract.provisioned == false && contract.release_gate == "blocked"
    ])
    error_message = "AlloyDB, ESPv2, CDN, queues and observability must remain blocked until separate green-plan evidence exists."
  }
}
