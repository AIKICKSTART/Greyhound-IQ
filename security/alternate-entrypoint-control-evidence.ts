import ts from "typescript";

export const ALTERNATE_ENTRYPOINT_CONTROL_REQUIREMENT_ID =
  "security.action-trace-server-entry.alternate-entry-points";

export type AlternateEntrypointContract = Readonly<{
  capability: string;
  entrypoints: readonly string[];
  service: string;
  serviceGuard: string;
}>;

export type AlternateEntrypointBinding = Readonly<{
  capability: string;
  entrypoint: string;
  sourceFile: string;
  requiredMarker: string;
}>;

export type AlternateEntrypointServiceBinding = Readonly<{
  capability: string;
  service: string;
  serviceGuard: string;
  sourceFile: string;
  directCallerFiles: readonly string[];
}>;

export type AlternateEntrypointSource = Readonly<{
  path: string;
  source: string;
}>;

const SOURCE_PATH = /^src\/.+\.tsx?$/u;

export const ALTERNATE_ENTRYPOINT_BINDINGS = [
  {
    capability: "agent execution",
    entrypoint: "POST /api/agents/[type]/run",
    sourceFile: "src/app/api/agents/[type]/run/route.ts",
    requiredMarker: "runAgentForCurrentUser(",
  },
  {
    capability: "agent execution",
    entrypoint: "src/app/actions.ts#createAgentRun",
    sourceFile: "src/app/actions.ts",
    requiredMarker: "runAgentForCurrentUser(",
  },
  {
    capability: "feed publishing",
    entrypoint: "POST /api/feed",
    sourceFile: "src/app/api/feed/route.ts",
    requiredMarker: "createFeedPostForCurrentUser(",
  },
  {
    capability: "feed publishing",
    entrypoint: "src/app/actions.ts#createFeedPost",
    sourceFile: "src/app/actions.ts",
    requiredMarker: "createFeedPostForCurrentUser(",
  },
  {
    capability: "marketplace listing edit page",
    entrypoint: "/marketplace/[id]/edit",
    sourceFile: "src/app/marketplace/[id]/edit/page.tsx",
    requiredMarker: '../../../listings/[id]/edit/page',
  },
  {
    capability: "marketplace listing edit page",
    entrypoint: "/listings/[id]/edit",
    sourceFile: "src/app/listings/[id]/edit/page.tsx",
    requiredMarker: "getOwnedListingForCurrentUser(",
  },
] as const satisfies readonly AlternateEntrypointBinding[];

export const ALTERNATE_ENTRYPOINT_SERVICE_BINDINGS = [
  {
    capability: "agent execution",
    service: "runAgentForCurrentUser",
    serviceGuard: "assertAgentTier(current, agentType)",
    sourceFile: "src/lib/agent-service.ts",
    directCallerFiles: [
      "src/app/actions.ts",
      "src/app/api/agents/[type]/run/route.ts",
    ],
  },
  {
    capability: "feed publishing",
    service: "createFeedPostForCurrentUser",
    serviceGuard: "current.dbUserId",
    sourceFile: "src/lib/feed-service.ts",
    directCallerFiles: [
      "src/app/actions.ts",
      "src/app/api/feed/route.ts",
      "src/lib/community-flow-probe.ts",
    ],
  },
  {
    capability: "marketplace listing edit page",
    service: "getOwnedListingForCurrentUser",
    serviceGuard: "current.profileId",
    sourceFile: "src/lib/listing-service.ts",
    directCallerFiles: ["src/app/listings/[id]/edit/page.tsx"],
  },
] as const satisfies readonly AlternateEntrypointServiceBinding[];

export const ALTERNATE_ENTRYPOINT_CONTROL_SCOPE =
  "Source-only proof that every registered alternate entry point for the three current multi-entry capabilities converges on the same guarded server service or canonical protected page. The AST caller inventory also fails when a new direct caller of those services appears without review. This verifies current alternate-entrypoint convergence only; it does not claim deployed direct-request testing, complete object authorization, cross-user or cross-tenant runtime behavior, provider behavior, or production readiness.";

export const ALTERNATE_ENTRYPOINT_CONTROL_MASTER_EVIDENCE = {
  [ALTERNATE_ENTRYPOINT_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "security/frontend-authorization-evidence.ts",
      "security/frontend-authorization-evidence.test.ts",
      "security/alternate-entrypoint-control-evidence.ts",
      "security/alternate-entrypoint-control-evidence.test.ts",
    ],
  },
};

export function auditAlternateEntrypointControls(
  contracts: readonly AlternateEntrypointContract[],
  entrypointBindings: readonly AlternateEntrypointBinding[],
  serviceBindings: readonly AlternateEntrypointServiceBinding[],
  sources: readonly AlternateEntrypointSource[],
  prerequisiteVerified: boolean,
) {
  const issues: string[] = [];
  const normalizedSources = sources.map(({ path, source }) => ({
    path: normalizePath(path),
    source,
  }));
  const sourcePaths = normalizedSources.map(({ path }) => path);
  const sourceByPath = new Map(
    normalizedSources.map(({ path, source }) => [path, source]),
  );

  if (!prerequisiteVerified) {
    issues.push("ALTERNATE_ENTRYPOINT_PREREQUISITE_UNVERIFIED");
  }
  if (contracts.length === 0) {
    issues.push("ALTERNATE_ENTRYPOINT_CONTRACT_INVENTORY_VACUOUS");
  }
  if (entrypointBindings.length === 0) {
    issues.push("ALTERNATE_ENTRYPOINT_BINDING_INVENTORY_VACUOUS");
  }
  if (serviceBindings.length === 0) {
    issues.push("ALTERNATE_ENTRYPOINT_SERVICE_INVENTORY_VACUOUS");
  }
  if (sources.length === 0) {
    issues.push("ALTERNATE_ENTRYPOINT_SOURCE_INVENTORY_VACUOUS");
  }
  if (new Set(sourcePaths).size !== sourcePaths.length) {
    issues.push("ALTERNATE_ENTRYPOINT_SOURCE_PATH_DUPLICATE");
  }
  for (const path of sourcePaths) {
    if (!SOURCE_PATH.test(path)) {
      issues.push(`ALTERNATE_ENTRYPOINT_SOURCE_PATH_INVALID:${path}`);
    }
  }

  const capabilitySet = new Set<string>();
  const expectedEntrypoints = new Set<string>();
  for (const contract of contracts) {
    if (!contract.capability.trim() || capabilitySet.has(contract.capability)) {
      issues.push(`ALTERNATE_ENTRYPOINT_CAPABILITY_INVALID:${contract.capability}`);
    }
    capabilitySet.add(contract.capability);
    if (contract.entrypoints.length < 2) {
      issues.push(`ALTERNATE_ENTRYPOINT_NOT_ALTERNATE:${contract.capability}`);
    }
    if (new Set(contract.entrypoints).size !== contract.entrypoints.length) {
      issues.push(`ALTERNATE_ENTRYPOINT_CONTRACT_DUPLICATE:${contract.capability}`);
    }
    if (!contract.service.trim() || !contract.serviceGuard.trim()) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_CONTRACT_INVALID:${contract.capability}`);
    }
    for (const entrypoint of contract.entrypoints) {
      expectedEntrypoints.add(`${contract.capability}:${entrypoint}`);
    }
  }

  const boundEntrypoints = entrypointBindings.map(
    ({ capability, entrypoint }) => `${capability}:${entrypoint}`,
  );
  if (new Set(boundEntrypoints).size !== boundEntrypoints.length) {
    issues.push("ALTERNATE_ENTRYPOINT_BINDING_DUPLICATE");
  }
  const boundEntrypointSet = new Set(boundEntrypoints);
  for (const expected of expectedEntrypoints) {
    if (!boundEntrypointSet.has(expected)) {
      issues.push(`ALTERNATE_ENTRYPOINT_BINDING_MISSING:${expected}`);
    }
  }
  for (const bound of boundEntrypointSet) {
    if (!expectedEntrypoints.has(bound)) {
      issues.push(`ALTERNATE_ENTRYPOINT_BINDING_STALE:${bound}`);
    }
  }
  for (const binding of entrypointBindings) {
    const source = sourceByPath.get(normalizePath(binding.sourceFile));
    if (source === undefined) {
      issues.push(`ALTERNATE_ENTRYPOINT_SOURCE_MISSING:${binding.sourceFile}`);
    } else if (!source.includes(binding.requiredMarker)) {
      issues.push(
        `ALTERNATE_ENTRYPOINT_MARKER_MISSING:${binding.capability}:${binding.entrypoint}`,
      );
    }
  }

  const serviceCapabilities = serviceBindings.map(({ capability }) => capability);
  if (new Set(serviceCapabilities).size !== serviceCapabilities.length) {
    issues.push("ALTERNATE_ENTRYPOINT_SERVICE_DUPLICATE");
  }
  const serviceByCapability = new Map(
    serviceBindings.map((binding) => [binding.capability, binding]),
  );
  for (const contract of contracts) {
    const binding = serviceByCapability.get(contract.capability);
    if (!binding) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_MISSING:${contract.capability}`);
      continue;
    }
    if (
      binding.service !== contract.service ||
      binding.serviceGuard !== contract.serviceGuard
    ) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_DRIFT:${contract.capability}`);
    }
  }
  for (const binding of serviceBindings) {
    if (!capabilitySet.has(binding.capability)) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_STALE:${binding.capability}`);
    }
    const serviceSource = sourceByPath.get(normalizePath(binding.sourceFile));
    if (serviceSource === undefined) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_SOURCE_MISSING:${binding.sourceFile}`);
      continue;
    }
    if (!serviceSource.includes(binding.service)) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_SYMBOL_MISSING:${binding.capability}`);
    }
    if (!serviceSource.includes(binding.serviceGuard)) {
      issues.push(`ALTERNATE_ENTRYPOINT_SERVICE_GUARD_MISSING:${binding.capability}`);
    }

    const actualCallers = discoverDirectCallers(
      normalizedSources,
      binding.service,
      normalizePath(binding.sourceFile),
    );
    const expectedCallers = binding.directCallerFiles
      .map(normalizePath)
      .toSorted();
    for (const path of expectedCallers) {
      if (!actualCallers.includes(path)) {
        issues.push(`ALTERNATE_ENTRYPOINT_DIRECT_CALLER_MISSING:${binding.service}:${path}`);
      }
    }
    for (const path of actualCallers) {
      if (!expectedCallers.includes(path)) {
        issues.push(`ALTERNATE_ENTRYPOINT_DIRECT_CALLER_UNREVIEWED:${binding.service}:${path}`);
      }
    }
  }

  return issues;
}

function discoverDirectCallers(
  sources: readonly AlternateEntrypointSource[],
  service: string,
  serviceSourceFile: string,
) {
  const callers = new Set<string>();
  for (const { path, source } of sources) {
    if (path === serviceSourceFile) continue;
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === service
      ) {
        callers.add(path);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return [...callers].sort();
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}
