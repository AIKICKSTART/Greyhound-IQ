/**
 * Persistent, loopback-only PostgreSQL control plane for Design Lab.
 *
 * This database is separate from the recovered provider-data database and the
 * disposable migration-replay database. It is created from the checked-in
 * forward migrations and exposes the application through the real
 * NOBYPASSRLS runtime login. Trust authentication is acceptable only because
 * Docker binds the service to literal loopback; this file is not a production
 * authentication design.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertLocalDatabaseUrl } from "./local-database-policy";

export const DESIGN_LAB_DATABASE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const DESIGN_LAB_DATABASE_COMPOSE_FILE = resolve(
  DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
  "docker-compose.design-lab-db.yml",
);
export const DESIGN_LAB_DATABASE_COMPOSE_PROJECT = "greyhoundiq-design-lab-db";
export const DESIGN_LAB_DATABASE_COMPOSE_SERVICE = "postgres";
export const DESIGN_LAB_DATABASE_CONTAINER = "greyhoundiq-design-lab-postgres";
export const DESIGN_LAB_DATABASE_VOLUME = "greyhoundiq-design-lab-postgres-v2";
export const DESIGN_LAB_DATABASE_IMAGE_ID =
  "sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e";
export const DESIGN_LAB_DATABASE_IMAGE_REFERENCE = `postgres:15-alpine@${DESIGN_LAB_DATABASE_IMAGE_ID}`;

const DEFAULT_PORT = 55_735;
const POSTGRES_CONTAINER_PORT = "5432/tcp";
const POSTGRES_DATA_MOUNT = "/var/lib/postgresql/data";
const ADMIN_DATABASE_URL =
  process.env.DESIGN_LAB_DATABASE_ADMIN_URL ??
  `postgresql://postgres@127.0.0.1:${DEFAULT_PORT}/greyhoundiq`;

type Command = "up" | "provision" | "down" | "status";

export type DesignLabDatabaseContainerProvenance = Readonly<{
  containerId: string;
  imageId: typeof DESIGN_LAB_DATABASE_IMAGE_ID;
  imageReference: typeof DESIGN_LAB_DATABASE_IMAGE_REFERENCE;
  containerName: typeof DESIGN_LAB_DATABASE_CONTAINER;
  composeProject: typeof DESIGN_LAB_DATABASE_COMPOSE_PROJECT;
  composeService: typeof DESIGN_LAB_DATABASE_COMPOSE_SERVICE;
  state: "running";
  health: "healthy";
  portBinding: Readonly<{
    containerPort: typeof POSTGRES_CONTAINER_PORT;
    hostIp: "127.0.0.1";
    hostPort: 55735;
  }>;
  volumeMount: Readonly<{
    type: "volume";
    name: typeof DESIGN_LAB_DATABASE_VOLUME;
    destination: typeof POSTGRES_DATA_MOUNT;
  }>;
}>;

const FORBIDDEN_DOCKER_ENVIRONMENT = [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_CONFIG",
  "DOCKER_CERT_PATH",
  "DOCKER_TLS_VERIFY",
  "COMPOSE_FILE",
  "COMPOSE_PROJECT_NAME",
  "COMPOSE_PROJECT_DIRECTORY",
] as const;

export function assertDesignLabAdminUrl(value: string) {
  assertLocalDatabaseUrl(value);
  const url = new URL(value);
  if (url.protocol !== "postgresql:") {
    throw new Error("Design Lab PostgreSQL requires the postgresql protocol.");
  }
  if (url.hostname !== "127.0.0.1") {
    throw new Error(
      "Design Lab PostgreSQL requires the literal 127.0.0.1 host.",
    );
  }
  if (decodeURIComponent(url.pathname.replace(/^\/+/, "")) !== "greyhoundiq") {
    throw new Error(
      "Design Lab PostgreSQL provisioning is restricted to the greyhoundiq database.",
    );
  }
  if (Number(url.port || "5432") !== DEFAULT_PORT) {
    throw new Error(
      `Design Lab PostgreSQL is pinned to loopback port ${DEFAULT_PORT}.`,
    );
  }
  if (decodeURIComponent(url.username) !== "postgres" || url.password) {
    throw new Error(
      "Design Lab PostgreSQL provisioning requires the passwordless local postgres role.",
    );
  }
  if ([...url.searchParams].length > 0) {
    throw new Error(
      "Design Lab PostgreSQL provisioning URL may not contain query parameters.",
    );
  }
}

async function main() {
  const [command = "status"] = process.argv.slice(2);
  assertDesignLabAdminUrl(ADMIN_DATABASE_URL);
  assertNoDockerOverrides(process.env);
  assertLocalDockerEndpoint();

  switch (command as Command) {
    case "up":
      compose(["up", "-d"]);
      await waitForDatabase();
      return;
    case "provision":
      compose(["up", "-d"]);
      await waitForDatabase();
      runPrisma(["migrate", "deploy"]);
      configureRuntimeRole();
      console.log(
        "[db:design-lab] exact migrations are applied and greyhoundiq_runtime is a local LOGIN NOBYPASSRLS role",
      );
      return;
    case "down":
      compose(["down"]);
      return;
    case "status":
      compose(["ps"]);
      return;
    default:
      throw new Error(
        `Unknown Design Lab database command ${JSON.stringify(command)}. Expected up, provision, down or status.`,
      );
  }
}

function compose(args: string[]) {
  run(
    "docker",
    [
      "compose",
      "--project-name",
      DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
      "-f",
      DESIGN_LAB_DATABASE_COMPOSE_FILE,
      ...args,
    ],
    composeEnvironment(),
  );
}

function runPrisma(args: string[]) {
  run(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["exec", "--", "prisma", ...args],
    {
      ...cleanEnvironment(process.env),
      DATABASE_URL: ADMIN_DATABASE_URL,
      DIRECT_URL: ADMIN_DATABASE_URL,
    },
  );
}

function configureRuntimeRole() {
  run(
    "docker",
    [
      "compose",
      "--project-name",
      DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
      "-f",
      DESIGN_LAB_DATABASE_COMPOSE_FILE,
      "exec",
      "-T",
      DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
      "psql",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      "--dbname=greyhoundiq",
      "--command=ALTER DATABASE greyhoundiq SET timezone TO 'UTC'; ALTER ROLE greyhoundiq_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40;",
    ],
    composeEnvironment(),
  );
}

async function waitForDatabase() {
  const startedAt = Date.now();
  for (;;) {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--project-name",
        DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
        "-f",
        DESIGN_LAB_DATABASE_COMPOSE_FILE,
        "exec",
        "-T",
        DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
        "pg_isready",
        "--username=postgres",
        "--dbname=greyhoundiq",
      ],
      {
        cwd: DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
        env: composeEnvironment() as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
      },
    );
    if (result.status === 0) return;
    if (Date.now() - startedAt > 120_000) {
      throw new Error(
        "Design Lab PostgreSQL did not become ready within 120 seconds.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

function run(command: string, args: string[], env: Record<string, string>) {
  const launch = windowsLaunch(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd: DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
    env: env as NodeJS.ProcessEnv,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit code ${String(result.status ?? "unknown")}.`,
    );
  }
}

function composeEnvironment() {
  const port = new URL(ADMIN_DATABASE_URL).port || String(DEFAULT_PORT);
  return {
    ...minimalProcessEnvironment(process.env),
    COMPOSE_DISABLE_ENV_FILE: "1",
    GREYHOUNDIQ_DESIGN_LAB_DB_PORT: port,
  } satisfies Record<string, string>;
}

function cleanEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  return minimalProcessEnvironment(environment);
}

export function assertNoDockerOverrides(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const configured = FORBIDDEN_DOCKER_ENVIRONMENT.filter((name) =>
    Boolean(environment[name]?.trim()),
  );
  if (configured.length > 0) {
    throw new Error(
      `Design Lab PostgreSQL refuses Docker/Compose environment overrides: ${configured.join(", ")}.`,
    );
  }
}

export function assertLocalDockerEndpointValue(value: string) {
  const endpoint = value.trim();
  if (
    !/^npipe:\/{4}\.\/pipe\/[A-Za-z0-9_.-]+$/iu.test(endpoint) &&
    !/^unix:\/{3}[^\s?#]+$/iu.test(endpoint)
  ) {
    throw new Error(
      `Design Lab PostgreSQL requires a local Docker npipe or unix endpoint, received ${JSON.stringify(endpoint)}.`,
    );
  }
}

function assertLocalDockerEndpoint(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const result = spawnSync(
    "docker",
    ["context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}'],
    {
      cwd: DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
      env: minimalProcessEnvironment(
        environment,
      ) as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error("Unable to verify that Docker uses a local endpoint.");
  }
  assertLocalDockerEndpointValue(result.stdout ?? "");
}

export function parseDesignLabDatabaseContainerProvenance(
  value: string,
): DesignLabDatabaseContainerProvenance {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      "Design Lab PostgreSQL container inspection returned invalid JSON.",
    );
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(
      "Design Lab PostgreSQL container inspection must return exactly one container.",
    );
  }

  const container = record(parsed[0], "container");
  const containerId = stringField(container, "Id", "container ID");
  const imageId = stringField(container, "Image", "image ID");
  if (!/^[a-f0-9]{64}$/iu.test(containerId)) {
    throw new Error(
      "Design Lab PostgreSQL container ID must be 64 hexadecimal characters.",
    );
  }
  if (imageId !== DESIGN_LAB_DATABASE_IMAGE_ID) {
    throw new Error(
      "Design Lab PostgreSQL image ID does not match the pinned digest.",
    );
  }

  const inspectedName = stringField(container, "Name", "container name");
  if (inspectedName !== `/${DESIGN_LAB_DATABASE_CONTAINER}`) {
    throw new Error(
      "Design Lab PostgreSQL container name does not match the owned target.",
    );
  }

  const state = record(container.State, "container state");
  if (state.Running !== true || state.Status !== "running") {
    throw new Error("Design Lab PostgreSQL container must be running.");
  }
  const health = record(state.Health, "container health");
  if (health.Status !== "healthy") {
    throw new Error("Design Lab PostgreSQL container must be healthy.");
  }

  const config = record(container.Config, "container config");
  if (config.Image !== DESIGN_LAB_DATABASE_IMAGE_REFERENCE) {
    throw new Error(
      "Design Lab PostgreSQL image reference is not pinned exactly.",
    );
  }
  const labels = record(config.Labels, "container labels");
  if (
    labels["com.docker.compose.project"] !== DESIGN_LAB_DATABASE_COMPOSE_PROJECT
  ) {
    throw new Error("Design Lab PostgreSQL Compose project label is invalid.");
  }
  if (
    labels["com.docker.compose.service"] !== DESIGN_LAB_DATABASE_COMPOSE_SERVICE
  ) {
    throw new Error("Design Lab PostgreSQL Compose service label is invalid.");
  }

  const hostConfig = record(container.HostConfig, "container host config");
  const configuredPorts = record(
    hostConfig.PortBindings,
    "container port bindings",
  );
  const runtimeNetwork = record(
    container.NetworkSettings,
    "container network settings",
  );
  const runtimePorts = record(runtimeNetwork.Ports, "runtime port bindings");
  const configuredBinding = exactPortBinding(configuredPorts);
  const runtimeBinding = exactPortBinding(runtimePorts);
  if (
    configuredBinding.HostIp !== runtimeBinding.HostIp ||
    configuredBinding.HostPort !== runtimeBinding.HostPort
  ) {
    throw new Error(
      "Design Lab PostgreSQL configured and runtime port bindings must match.",
    );
  }

  if (!Array.isArray(container.Mounts) || container.Mounts.length !== 1) {
    throw new Error(
      "Design Lab PostgreSQL must have exactly one owned data-volume mount.",
    );
  }
  const mount = record(container.Mounts[0], "container volume mount");
  if (
    mount.Type !== "volume" ||
    mount.Name !== DESIGN_LAB_DATABASE_VOLUME ||
    mount.Destination !== POSTGRES_DATA_MOUNT
  ) {
    throw new Error("Design Lab PostgreSQL data-volume provenance is invalid.");
  }

  return {
    containerId,
    imageId,
    imageReference: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    containerName: DESIGN_LAB_DATABASE_CONTAINER,
    composeProject: DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
    composeService: DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
    state: "running",
    health: "healthy",
    portBinding: {
      containerPort: POSTGRES_CONTAINER_PORT,
      hostIp: "127.0.0.1",
      hostPort: DEFAULT_PORT,
    },
    volumeMount: {
      type: "volume",
      name: DESIGN_LAB_DATABASE_VOLUME,
      destination: POSTGRES_DATA_MOUNT,
    },
  };
}

export function readDesignLabDatabaseContainerProvenance(
  environment: NodeJS.ProcessEnv = process.env,
) {
  assertNoDockerOverrides(environment);
  assertLocalDockerEndpoint(environment);
  const result = spawnSync(
    "docker",
    ["container", "inspect", DESIGN_LAB_DATABASE_CONTAINER],
    {
      cwd: DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
      env: minimalProcessEnvironment(
        environment,
      ) as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Unable to inspect the exact Design Lab PostgreSQL container.",
    );
  }
  return parseDesignLabDatabaseContainerProvenance(result.stdout ?? "");
}

function exactPortBinding(bindings: Record<string, unknown>) {
  if (
    Object.keys(bindings).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(bindings, POSTGRES_CONTAINER_PORT)
  ) {
    throw new Error(
      "Design Lab PostgreSQL must expose only the owned PostgreSQL port binding.",
    );
  }
  const candidates = bindings[POSTGRES_CONTAINER_PORT];
  if (!Array.isArray(candidates) || candidates.length !== 1) {
    throw new Error(
      "Design Lab PostgreSQL must have exactly one PostgreSQL port binding.",
    );
  }
  const binding = record(candidates[0], "PostgreSQL port binding");
  if (
    binding.HostIp !== "127.0.0.1" ||
    binding.HostPort !== String(DEFAULT_PORT)
  ) {
    throw new Error(
      `Design Lab PostgreSQL must bind ${POSTGRES_CONTAINER_PORT} to 127.0.0.1:${DEFAULT_PORT}.`,
    );
  }
  return {
    HostIp: binding.HostIp,
    HostPort: binding.HostPort,
  } as const;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Design Lab PostgreSQL inspection is missing ${label}.`);
  }
  return value as Record<string, unknown>;
}

function stringField(
  value: Record<string, unknown>,
  field: string,
  label: string,
) {
  const candidate = value[field];
  if (typeof candidate !== "string") {
    throw new Error(`Design Lab PostgreSQL inspection is missing ${label}.`);
  }
  return candidate;
}

function minimalProcessEnvironment(environment: NodeJS.ProcessEnv) {
  const allowed = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "APPDATA",
    "LOCALAPPDATA",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PROGRAMDATA",
    "NODE_ENV",
  ];
  return Object.fromEntries(
    allowed.flatMap((name) => {
      const value = environment[name];
      return typeof value === "string" ? [[name, value]] : [];
    }),
  ) as Record<string, string>;
}

function windowsLaunch(command: string, args: string[]) {
  if (process.platform !== "win32" || !/\.(cmd|bat)$/iu.test(command)) {
    return { command, args };
  }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteCmd).join(" ")],
  };
}

function quoteCmd(value: string) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/gu, '\\"')}"`;
}

if (process.argv[1]?.endsWith("design-lab-database.ts")) {
  main().catch((error: unknown) => {
    console.error(
      `[db:design-lab] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
