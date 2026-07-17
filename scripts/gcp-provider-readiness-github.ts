import type { GithubSnapshot } from "./gcp-provider-readiness";
import {
  parseProbeJson,
  type ReadOnlyProbeRunner,
} from "./gcp-provider-readiness-command";

export function discoverGithubEnvironment(
  runner: ReadOnlyProbeRunner,
  repository: string | null,
  environmentName: string,
  requiredSecretNames: string[],
  optionalVariableNames: string[],
): GithubSnapshot {
  const snapshot = emptyGithubSnapshot(
    repository,
    environmentName,
    requiredSecretNames,
    optionalVariableNames,
  );
  if (!repository) {
    snapshot.discoveryErrors.push({
      operation: "github.repository",
      code: "NOT_FOUND",
    });
    return snapshot;
  }

  const environmentOperation = "github.environments.list";
  const environments = parseProbeJson<{
    environments?: Array<{
      name?: string;
      can_admins_bypass?: boolean;
      protection_rules?: unknown[];
    }>;
  }>(
    runner.run({
      tool: "gh",
      args: ["api", `repos/${repository}/environments`],
      operation: environmentOperation,
    }),
    environmentOperation,
    snapshot.discoveryErrors,
  );
  if (!environments) return snapshot;
  snapshot.discoveryVerified = true;
  const environment = (environments.environments ?? []).find(
    (item) => item.name === environmentName,
  );
  snapshot.environmentExists = Boolean(environment);
  snapshot.canAdminsBypass = environment?.can_admins_bypass ?? null;
  snapshot.protectionRuleCount = environment?.protection_rules?.length ?? null;

  snapshot.presentSecretNames = discoverNames(
    runner,
    "secret",
    environment ? environmentName : null,
    snapshot.discoveryErrors,
  );
  snapshot.presentVariableNames = discoverNames(
    runner,
    "variable",
    environment ? environmentName : null,
    snapshot.discoveryErrors,
  );
  return snapshot;
}

export function parseGithubRepository(remote: string) {
  const normalized = remote.trim().replace(/\.git$/, "");
  const ssh = normalized.match(
    /^[^@]+@github\.com:([^/]+\/[A-Za-z0-9_.-]+)$/i,
  );
  if (ssh?.[1]) return ssh[1];
  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const path = url.pathname.replace(/^\//, "");
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(path) ? path : null;
  } catch {
    return null;
  }
}

function emptyGithubSnapshot(
  repository: string | null,
  environmentName: string,
  requiredSecretNames: string[],
  optionalVariableNames: string[],
): GithubSnapshot {
  return {
    repository,
    environmentName,
    discoveryVerified: false,
    environmentExists: null,
    canAdminsBypass: null,
    protectionRuleCount: null,
    requiredSecretNames,
    presentSecretNames: [],
    optionalVariableNames,
    presentVariableNames: [],
    discoveryErrors: [],
  };
}

function discoverNames(
  runner: ReadOnlyProbeRunner,
  kind: "secret" | "variable",
  environmentName: string | null,
  errors: GithubSnapshot["discoveryErrors"],
) {
  const repoOperation = `github.${kind}s.repository`;
  const repositoryNames = parseProbeJson<Array<{ name?: string }>>(
    runner.run({
      tool: "gh",
      args:
        kind === "secret"
          ? ["secret", "list", "--app", "actions", "--json", "name"]
          : ["variable", "list", "--json", "name"],
      operation: repoOperation,
    }),
    repoOperation,
    errors,
  );
  if (!environmentName) return uniqueNames(repositoryNames ?? []);

  const environmentOperation = `github.${kind}s.environment`;
  const environmentNames = parseProbeJson<Array<{ name?: string }>>(
    runner.run({
      tool: "gh",
      args:
        kind === "secret"
          ? ["secret", "list", "--env", environmentName, "--json", "name"]
          : ["variable", "list", "--env", environmentName, "--json", "name"],
      operation: environmentOperation,
    }),
    environmentOperation,
    errors,
  );
  return uniqueNames([...(repositoryNames ?? []), ...(environmentNames ?? [])]);
}

function uniqueNames(values: Array<{ name?: string }>) {
  return values
    .flatMap((value) => (value.name ? [value.name] : []))
    .filter((name, index, names) => names.indexOf(name) === index)
    .toSorted();
}
