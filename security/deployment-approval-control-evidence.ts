export const DEPLOYMENT_APPROVAL_CONTROL_REQUIREMENT_ID =
  "security.supply-chain-control.deployment-approval";

export type DeploymentWorkflowSource = Readonly<{
  path: string;
  source: string;
}>;

export type DeploymentWorkflowBinding = Readonly<{
  path: string;
  classification: "production-deployment" | "non-deployment";
  deploymentMarkers: readonly string[];
  approvalMarkers: readonly string[];
}>;

const WORKFLOW_PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/u;

export const DEPLOYMENT_WORKFLOW_BINDINGS = [
  {
    path: ".github/workflows/ci.yml",
    classification: "non-deployment",
    deploymentMarkers: [],
    approvalMarkers: [],
  },
  {
    path: ".github/workflows/cloud-run-deploy.yml",
    classification: "production-deployment",
    deploymentMarkers: ["gcloud builds submit", "gcloud run deploy"],
    approvalMarkers: [
      "workflow_dispatch:",
      "approved_sha:",
      "evidence_sha256:",
      "environment: ${{ github.event_name == 'workflow_dispatch' && inputs.environment || 'staging' }}",
      "if: github.event_name == 'workflow_dispatch' && inputs.environment == 'prod'",
      'if [[ ! "$APPROVED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then',
      'if [[ ! "$APPROVED_EVIDENCE_SHA256" =~ ^[0-9a-fA-F]{64}$ ]]; then',
      'checked_out_sha="$(git rev-parse HEAD)"',
      'git merge-base --is-ancestor "$checked_out_sha" "origin/$default_branch"',
      'status=completed',
      'select(.conclusion == "success")',
      "npm run check:design-lab-release --",
      "--require-ready",
      "--expected-evidence-sha256=",
      "cancel-in-progress: false",
    ],
  },
  {
    path: ".github/workflows/codex-review.yml",
    classification: "non-deployment",
    deploymentMarkers: [],
    approvalMarkers: [],
  },
  {
    path: ".github/workflows/live-sync.yml",
    classification: "non-deployment",
    deploymentMarkers: [],
    approvalMarkers: [],
  },
  {
    path: ".github/workflows/supabase-migrate.yml",
    classification: "production-deployment",
    deploymentMarkers: ["npx prisma migrate deploy"],
    approvalMarkers: [
      "workflow_dispatch:",
      "environment: ${{ inputs.environment }}",
      "inputs.environment == 'production'",
      "secrets.PROD_DATABASE_URL",
      "Block production seed",
      "npm run check:migrations",
      "cancel-in-progress: false",
    ],
  },
] as const satisfies readonly DeploymentWorkflowBinding[];

export const DEPLOYMENT_APPROVAL_CONTROL_SCOPE =
  "Repository-source proof that every current GitHub Actions workflow is explicitly classified and that both production-capable deployment workflows are manual-dispatch, protected-environment entry points. The Cloud Run path additionally binds production approval to an exact commit, a complete-evidence SHA-256, default-branch ancestry, successful CI and a release-readiness gate; the production database migration path is environment-bound, migration-checked and blocks seeding. The inventory fails closed on a new workflow or an unregistered production deployment command. This verifies the current source controls only; it does not claim GitHub environment reviewer configuration, branch protection, an executed approval, deployed artifact parity, provider state, or production readiness.";

export const DEPLOYMENT_APPROVAL_CONTROL_MASTER_EVIDENCE = {
  [DEPLOYMENT_APPROVAL_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      ".github/workflows/cloud-run-deploy.yml",
      ".github/workflows/supabase-migrate.yml",
      "security/deployment-approval-control-evidence.ts",
      "security/deployment-approval-control-evidence.test.ts",
    ],
  },
};

export function auditDeploymentApprovalControls(
  bindings: readonly DeploymentWorkflowBinding[],
  sources: readonly DeploymentWorkflowSource[],
) {
  const issues: string[] = [];
  const normalizedSources = sources.map(({ path, source }) => ({
    path: normalizePath(path),
    source,
  }));
  const normalizedBindings = bindings.map((binding) => ({
    ...binding,
    path: normalizePath(binding.path),
  }));

  if (normalizedSources.length === 0) {
    issues.push("DEPLOYMENT_APPROVAL_SOURCE_INVENTORY_VACUOUS");
  }
  if (normalizedBindings.length === 0) {
    issues.push("DEPLOYMENT_APPROVAL_BINDING_INVENTORY_VACUOUS");
  }

  const sourcePaths = normalizedSources.map(({ path }) => path);
  const bindingPaths = normalizedBindings.map(({ path }) => path);
  if (new Set(sourcePaths).size !== sourcePaths.length) {
    issues.push("DEPLOYMENT_APPROVAL_SOURCE_PATH_DUPLICATE");
  }
  if (new Set(bindingPaths).size !== bindingPaths.length) {
    issues.push("DEPLOYMENT_APPROVAL_BINDING_PATH_DUPLICATE");
  }

  for (const path of sourcePaths) {
    if (!WORKFLOW_PATH.test(path)) {
      issues.push(`DEPLOYMENT_APPROVAL_SOURCE_PATH_INVALID:${path}`);
    }
    if (!bindingPaths.includes(path)) {
      issues.push(`DEPLOYMENT_APPROVAL_WORKFLOW_UNREVIEWED:${path}`);
    }
  }
  for (const path of bindingPaths) {
    if (!sourcePaths.includes(path)) {
      issues.push(`DEPLOYMENT_APPROVAL_BOUND_WORKFLOW_MISSING:${path}`);
    }
  }

  const sourceByPath = new Map(
    normalizedSources.map(({ path, source }) => [path, source]),
  );
  for (const binding of normalizedBindings) {
    const source = sourceByPath.get(binding.path);
    if (source === undefined) continue;

    if (binding.classification === "production-deployment") {
      if (binding.deploymentMarkers.length === 0) {
        issues.push(`DEPLOYMENT_APPROVAL_DEPLOY_MARKERS_VACUOUS:${binding.path}`);
      }
      if (binding.approvalMarkers.length === 0) {
        issues.push(`DEPLOYMENT_APPROVAL_MARKERS_VACUOUS:${binding.path}`);
      }
      for (const marker of binding.deploymentMarkers) {
        if (!source.includes(marker)) {
          issues.push(
            `DEPLOYMENT_APPROVAL_COMMAND_MISSING:${binding.path}:${marker}`,
          );
        }
      }
      for (const marker of binding.approvalMarkers) {
        if (!source.includes(marker)) {
          issues.push(
            `DEPLOYMENT_APPROVAL_MARKER_MISSING:${binding.path}:${marker}`,
          );
        }
      }
      if (!isProductionDeploymentWorkflow(source)) {
        issues.push(`DEPLOYMENT_APPROVAL_CLASSIFICATION_STALE:${binding.path}`);
      }
    } else {
      if (
        binding.deploymentMarkers.length > 0 ||
        binding.approvalMarkers.length > 0
      ) {
        issues.push(`DEPLOYMENT_APPROVAL_NON_DEPLOY_BINDING_INVALID:${binding.path}`);
      }
      if (isProductionDeploymentWorkflow(source)) {
        issues.push(`DEPLOYMENT_APPROVAL_UNREGISTERED_DEPLOYMENT:${binding.path}`);
      }
    }
  }

  const productionBindings = normalizedBindings.filter(
    ({ classification }) => classification === "production-deployment",
  );
  if (productionBindings.length === 0) {
    issues.push("DEPLOYMENT_APPROVAL_PRODUCTION_BINDINGS_VACUOUS");
  }

  return issues;
}

function isProductionDeploymentWorkflow(source: string) {
  if (/\bgcloud\s+run\s+deploy\b/u.test(source)) return true;
  if (
    /\b(?:terraform\s+apply|kubectl\s+(?:apply|set\s+image)|helm\s+(?:install|upgrade)|firebase\s+deploy|supabase\s+db\s+push)\b/u.test(
      source,
    )
  ) {
    return true;
  }
  return (
    /\bprisma\s+migrate\s+deploy\b/u.test(source) &&
    /(?:PROD_DATABASE_URL|inputs\.environment\s*==\s*['"]production['"])/u.test(
      source,
    )
  );
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}
