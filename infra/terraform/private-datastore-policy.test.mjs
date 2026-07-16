import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findPrivateDatastoreExposure } from "./private-datastore-policy.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const currentTerraform = readdirSync(directory)
  .filter((file) => file.endsWith(".tf"))
  .sort()
  .map((file) => readFileSync(join(directory, file), "utf8"))
  .join("\n");

assert.deepEqual(findPrivateDatastoreExposure(currentTerraform), []);

assert.deepEqual(
  findPrivateDatastoreExposure(`
    resource "google_sql_database_instance" "unsafe" {
      settings { ip_configuration { ipv4_enabled = true } }
    }
  `),
  [
    "google_sql_database_instance.unsafe:CLOUD_SQL_PRIVATE_NETWORK_MISSING",
    "google_sql_database_instance.unsafe:CLOUD_SQL_PUBLIC_IPV4_NOT_DISABLED",
  ],
);

assert.deepEqual(
  findPrivateDatastoreExposure(`
    resource "google_sql_database_instance" "private" {
      settings {
        ip_configuration {
          ipv4_enabled    = false
          private_network = google_compute_network.data.id
        }
      }
    }
    resource "google_redis_instance" "private" {
      authorized_network     = google_compute_network.data.id
      connect_mode           = "PRIVATE_SERVICE_ACCESS"
      transit_encryption_mode = "SERVER_AUTHENTICATION"
    }
    resource "google_alloydb_cluster" "private" {
      network_config { network = google_compute_network.data.id }
    }
  `),
  [],
);

assert.deepEqual(
  findPrivateDatastoreExposure(`
    resource "google_compute_firewall" "unsafe_database" {
      source_ranges = ["0.0.0.0/0"]
      allow { protocol = "tcp" ports = ["5432"] }
    }
  `),
  ["google_compute_firewall.unsafe_database:PUBLIC_DATASTORE_FIREWALL_RULE"],
);

assert.deepEqual(
  findPrivateDatastoreExposure(`
    resource "google_alloydb_cluster" "unsafe" {
      network_config {
        enable_public_ip = true
      }
    }
  `),
  [
    "google_alloydb_cluster.unsafe:ALLOYDB_PRIVATE_NETWORK_MISSING",
    "google_alloydb_cluster.unsafe:ALLOYDB_PUBLIC_IP_CONFIGURED",
  ],
);

console.log(
  "Private datastore policy passed: current Terraform has no public data path and unsafe Cloud SQL, AlloyDB and firewall fixtures fail closed.",
);
