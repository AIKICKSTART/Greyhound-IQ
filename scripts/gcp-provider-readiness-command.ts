import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  DiscoveryError,
  ProbeErrorCode,
} from "./gcp-provider-readiness";

export type ProbeTool = "gcloud" | "gh" | "git";

export type CommandSpec = {
  tool: ProbeTool;
  args: string[];
  operation: string;
};

export type CommandResult = {
  ok: boolean;
  stdout: string;
  errorCode: ProbeErrorCode | null;
};

const ALLOWED_PREFIXES: Record<
  ProbeTool,
  readonly (readonly string[])[]
> = {
  gcloud: [
    ["auth", "list"],
    ["billing", "projects", "describe"],
    ["compute", "project-info", "describe"],
    ["compute", "regions", "describe"],
    ["config", "get-value"],
    ["iam", "service-accounts", "keys", "list"],
    ["iam", "service-accounts", "list"],
    ["iam", "workload-identity-pools", "list"],
    ["iam", "workload-identity-pools", "providers", "list"],
    ["projects", "describe"],
    ["projects", "get-iam-policy"],
    ["run", "services", "describe"],
    ["run", "services", "get-iam-policy"],
    ["run", "services", "list"],
    ["services", "list"],
  ],
  gh: [["api"], ["secret", "list"], ["variable", "list"]],
  git: [["remote", "get-url"], ["rev-parse"], ["status"]],
};

const MUTATING_ARGUMENTS = new Set([
  "add-iam-policy-binding",
  "apply",
  "create",
  "delete",
  "deploy",
  "disable",
  "enable",
  "import",
  "link",
  "patch",
  "remove-iam-policy-binding",
  "replace",
  "set",
  "submit",
  "unlink",
  "update",
  "update-traffic",
  "write",
]);

export function assertReadOnlyDiscoveryCommand(spec: CommandSpec) {
  const normalized = spec.args.map((arg) => arg.toLowerCase());
  const allowed = ALLOWED_PREFIXES[spec.tool].some(
    (prefix) =>
      prefix.length <= normalized.length &&
      prefix.every((part, index) => normalized[index] === part),
  );
  if (!allowed) {
    throw new Error(
      `Refusing non-allowlisted ${spec.tool} operation ${spec.operation}`,
    );
  }
  if (normalized.some((arg) => MUTATING_ARGUMENTS.has(arg))) {
    throw new Error(`Refusing mutating ${spec.tool} operation ${spec.operation}`);
  }
  if (
    spec.tool === "gh" &&
    spec.args.some((arg) =>
      ["-f", "-F", "-X", "--field", "--input", "--method", "--raw-field"].includes(
        arg,
      ),
    )
  ) {
    throw new Error(`Refusing state-capable GitHub operation ${spec.operation}`);
  }
  if (
    spec.tool === "gcloud" &&
    spec.args.some(
      (arg) =>
        arg === "auth" &&
        spec.args.some((part) => part.includes("print-access-token")),
    )
  ) {
    throw new Error(`Refusing credential-bearing GCP operation ${spec.operation}`);
  }
}

export function normalizeProbeError(value: string): ProbeErrorCode {
  if (/BILLING_DISABLED|requires billing to be enabled/i.test(value)) {
    return "BILLING_DISABLED";
  }
  if (/SERVICE_DISABLED|has not been used.+before|API .+ not enabled/i.test(value)) {
    return "SERVICE_DISABLED";
  }
  if (/PERMISSION_DENIED|does not have permission/i.test(value)) {
    return "PERMISSION_DENIED";
  }
  if (/NOT_FOUND|HTTP 404|could not be found/i.test(value)) return "NOT_FOUND";
  if (/ENOENT|not recognized|command not found/i.test(value)) {
    return "CLI_UNAVAILABLE";
  }
  return "UNKNOWN";
}

export class ReadOnlyProbeRunner {
  readonly audit: Array<{
    tool: ProbeTool;
    operation: string;
    ok: boolean;
    errorCode: ProbeErrorCode | null;
  }> = [];

  run(spec: CommandSpec): CommandResult {
    assertReadOnlyDiscoveryCommand(spec);
    const invocation = resolveToolInvocation(spec);
    const result = spawnSync(invocation.executable, invocation.args, {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      timeout: 45_000,
      windowsHide: true,
    });
    const ok = result.status === 0 && !result.error;
    const errorCode = ok
      ? null
      : normalizeProbeError(
          `${result.error?.message ?? ""}\n${result.stderr ?? ""}`,
        );
    this.audit.push({
      tool: spec.tool,
      operation: spec.operation,
      ok,
      errorCode,
    });
    return { ok, stdout: ok ? result.stdout.trim() : "", errorCode };
  }
}

export function parseProbeJson<T>(
  result: CommandResult,
  operation: string,
  errors: DiscoveryError[],
) {
  if (!result.ok) {
    errors.push({ operation, code: result.errorCode ?? "UNKNOWN" });
    return null;
  }
  try {
    return JSON.parse(result.stdout || "null") as T;
  } catch {
    errors.push({ operation, code: "INVALID_OUTPUT" });
    return null;
  }
}

function resolveToolInvocation(spec: CommandSpec) {
  if (process.platform !== "win32") {
    return { executable: spec.tool, args: spec.args };
  }
  if (spec.tool === "gh") return { executable: "gh.exe", args: spec.args };
  if (spec.tool === "git") return { executable: "git.exe", args: spec.args };

  const configuredRoot = process.env.CLOUDSDK_ROOT_DIR?.trim();
  let sdkRoot = configuredRoot && existsSync(configuredRoot) ? configuredRoot : null;
  if (!sdkRoot) {
    const located = spawnSync("where.exe", ["gcloud.cmd"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
    const commandPath =
      located.status === 0 ? located.stdout.split(/\r?\n/)[0]?.trim() : null;
    if (commandPath) sdkRoot = dirname(dirname(commandPath));
  }
  if (!sdkRoot) {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    const candidate = localAppData
      ? join(localAppData, "Google", "Cloud SDK", "google-cloud-sdk")
      : null;
    if (candidate && existsSync(candidate)) sdkRoot = candidate;
  }
  if (!sdkRoot) return { executable: "gcloud.cmd", args: spec.args };

  const bundledPython = join(
    sdkRoot,
    "platform",
    "bundledpython",
    "python.exe",
  );
  const python =
    process.env.CLOUDSDK_PYTHON?.trim() ||
    (existsSync(bundledPython) ? bundledPython : "python.exe");
  return {
    executable: python,
    args: ["-S", join(sdkRoot, "lib", "gcloud.py"), ...spec.args],
  };
}
