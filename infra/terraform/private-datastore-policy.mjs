const DATASTORE_PORTS = ["5432", "3306", "6379", "27017", "9200"];

/**
 * Static policy for the selected GCP infrastructure source. Repository intent
 * is not deployed-state evidence; this only prevents a reviewed private data
 * service from being introduced with an obvious public network path.
 */
export function findPrivateDatastoreExposure(terraform) {
  const issues = [];

  for (const resource of extractResourceBlocks(terraform)) {
    if (resource.type === "google_sql_database_instance") {
      if (!/ipv4_enabled\s*=\s*false\b/.test(resource.body)) {
        issues.push(`${resource.label}:CLOUD_SQL_PUBLIC_IPV4_NOT_DISABLED`);
      }
      if (!/private_network\s*=\s*[^\s}]+/.test(resource.body)) {
        issues.push(`${resource.label}:CLOUD_SQL_PRIVATE_NETWORK_MISSING`);
      }
    }

    if (resource.type === "google_redis_instance") {
      if (!/authorized_network\s*=\s*[^\s}]+/.test(resource.body)) {
        issues.push(`${resource.label}:REDIS_PRIVATE_NETWORK_MISSING`);
      }
      if (!/connect_mode\s*=\s*"PRIVATE_SERVICE_ACCESS"/.test(resource.body)) {
        issues.push(`${resource.label}:REDIS_PRIVATE_CONNECT_MODE_MISSING`);
      }
      if (
        !/transit_encryption_mode\s*=\s*"SERVER_AUTHENTICATION"/.test(
          resource.body,
        )
      ) {
        issues.push(`${resource.label}:REDIS_TRANSIT_ENCRYPTION_MISSING`);
      }
    }

    if (resource.type === "google_alloydb_cluster") {
      if (!/network_config\s*\{[\s\S]*?network\s*=/.test(resource.body)) {
        issues.push(`${resource.label}:ALLOYDB_PRIVATE_NETWORK_MISSING`);
      }
      if (/enable_public_ip\s*=\s*true\b|\bpublic_ip\s*=/.test(resource.body)) {
        issues.push(`${resource.label}:ALLOYDB_PUBLIC_IP_CONFIGURED`);
      }
    }

    if (
      resource.type === "google_compute_firewall" &&
      /source_ranges\s*=\s*\[[^\]]*(?:"0\.0\.0\.0\/0"|"::\/0")/.test(
        resource.body,
      ) &&
      DATASTORE_PORTS.some((port) =>
        new RegExp(`ports\\s*=\\s*\\[[^\\]]*"${port}"`).test(resource.body),
      )
    ) {
      issues.push(`${resource.label}:PUBLIC_DATASTORE_FIREWALL_RULE`);
    }
  }

  return issues.sort();
}

function extractResourceBlocks(source) {
  const resources = [];
  const header = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  for (const match of source.matchAll(header)) {
    const start = match.index + match[0].length - 1;
    const end = matchingBrace(source, start);
    if (end < 0) {
      resources.push({
        type: match[1],
        label: `${match[1]}.${match[2]}`,
        body: source.slice(start),
      });
      continue;
    }
    resources.push({
      type: match[1],
      label: `${match[1]}.${match[2]}`,
      body: source.slice(start, end + 1),
    });
  }
  return resources;
}

function matchingBrace(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (!escaped && character === quote) quote = null;
      escaped = !escaped && character === "\\";
      if (character !== "\\") escaped = false;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
