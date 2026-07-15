import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import {
  assertDesignLabAdminUrl,
  assertLocalDockerEndpointValue,
  assertNoDockerOverrides,
  DESIGN_LAB_DATABASE_COMPOSE_FILE,
  DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
  DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
  DESIGN_LAB_DATABASE_CONTAINER,
  DESIGN_LAB_DATABASE_IMAGE_ID,
  DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
  DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
  DESIGN_LAB_DATABASE_VOLUME,
  parseDesignLabDatabaseContainerProvenance,
} from "./design-lab-database";

assert.doesNotThrow(() =>
  assertDesignLabAdminUrl("postgresql://postgres@127.0.0.1:55735/greyhoundiq"),
);

for (const unsafe of [
  "postgresql://postgres@db.example.test:55735/greyhoundiq",
  "postgresql://postgres@[::1]:55735/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55735/production",
  "postgresql://postgres:secret@127.0.0.1:55735/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55735/greyhoundiq?host=elsewhere",
]) {
  assert.throws(() => assertDesignLabAdminUrl(unsafe));
}

assert.doesNotThrow(() => assertNoDockerOverrides({}));
assert.throws(() =>
  assertNoDockerOverrides({ DOCKER_HOST: "tcp://example.test:2375" }),
);
assert.throws(() =>
  assertNoDockerOverrides({ COMPOSE_PROJECT_NAME: "collision" }),
);
assert.doesNotThrow(() =>
  assertLocalDockerEndpointValue("npipe:////./pipe/dockerDesktopLinuxEngine"),
);
assert.doesNotThrow(() =>
  assertLocalDockerEndpointValue("unix:///var/run/docker.sock"),
);
assert.throws(() => assertLocalDockerEndpointValue("tcp://127.0.0.1:2375"));
assert.throws(() =>
  assertLocalDockerEndpointValue("unix:///var/run/docker.sock?host=remote"),
);

assert.equal(DESIGN_LAB_DATABASE_COMPOSE_PROJECT, "greyhoundiq-design-lab-db");
assert.equal(DESIGN_LAB_DATABASE_COMPOSE_SERVICE, "postgres");
assert.equal(DESIGN_LAB_DATABASE_CONTAINER, "greyhoundiq-design-lab-postgres");
assert.equal(DESIGN_LAB_DATABASE_VOLUME, "greyhoundiq-design-lab-postgres-v2");
assert.equal(
  DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
  "postgres:15-alpine@sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e",
);
assert.equal(
  DESIGN_LAB_DATABASE_IMAGE_ID,
  "sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e",
);
assert.ok(isAbsolute(DESIGN_LAB_DATABASE_REPOSITORY_ROOT));
assert.equal(
  DESIGN_LAB_DATABASE_COMPOSE_FILE,
  resolve(
    DESIGN_LAB_DATABASE_REPOSITORY_ROOT,
    "docker-compose.design-lab-db.yml",
  ),
);
assert.match(
  readFileSync(DESIGN_LAB_DATABASE_COMPOSE_FILE, "utf8"),
  /image: postgres:15-alpine@sha256:cd17e2ac98240fce1541ad2a803b34009b4eea5aec8a832363cdc7eca62e722e/,
);

type InspectFixture = {
  Id: string;
  Image: string;
  Name: string;
  State: {
    Running: boolean;
    Status: string;
    Health: { Status: string };
  };
  Config: {
    Image: string;
    Labels: Record<string, string>;
  };
  HostConfig: {
    PortBindings: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
  NetworkSettings: {
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
  Mounts: Array<{ Type: string; Name: string; Destination: string }>;
};

const validInspectFixture: InspectFixture = {
  Id: "a".repeat(64),
  Image: DESIGN_LAB_DATABASE_IMAGE_ID,
  Name: `/${DESIGN_LAB_DATABASE_CONTAINER}`,
  State: {
    Running: true,
    Status: "running",
    Health: { Status: "healthy" },
  },
  Config: {
    Image: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    Labels: {
      "com.docker.compose.project": DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
      "com.docker.compose.service": DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
    },
  },
  HostConfig: {
    PortBindings: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55735" }],
    },
  },
  NetworkSettings: {
    Ports: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55735" }],
    },
  },
  Mounts: [
    {
      Type: "volume",
      Name: DESIGN_LAB_DATABASE_VOLUME,
      Destination: "/var/lib/postgresql/data",
    },
  ],
};

assert.deepEqual(
  parseDesignLabDatabaseContainerProvenance(
    JSON.stringify([validInspectFixture]),
  ),
  {
    containerId: "a".repeat(64),
    imageId: DESIGN_LAB_DATABASE_IMAGE_ID,
    imageReference: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    containerName: DESIGN_LAB_DATABASE_CONTAINER,
    composeProject: DESIGN_LAB_DATABASE_COMPOSE_PROJECT,
    composeService: DESIGN_LAB_DATABASE_COMPOSE_SERVICE,
    state: "running",
    health: "healthy",
    portBinding: {
      containerPort: "5432/tcp",
      hostIp: "127.0.0.1",
      hostPort: 55735,
    },
    volumeMount: {
      type: "volume",
      name: DESIGN_LAB_DATABASE_VOLUME,
      destination: "/var/lib/postgresql/data",
    },
  },
);

const invalidInspectMutations: ReadonlyArray<
  readonly [string, (fixture: InspectFixture) => void]
> = [
  [
    "wrong Compose project",
    (fixture) => {
      fixture.Config.Labels["com.docker.compose.project"] = "collision";
    },
  ],
  [
    "wrong Compose service",
    (fixture) => {
      fixture.Config.Labels["com.docker.compose.service"] = "other";
    },
  ],
  [
    "wrong container name",
    (fixture) => {
      fixture.Name = "/collision";
    },
  ],
  [
    "wrong host port",
    (fixture) => {
      fixture.HostConfig.PortBindings["5432/tcp"][0].HostPort = "55734";
      fixture.NetworkSettings.Ports["5432/tcp"][0].HostPort = "55734";
    },
  ],
  [
    "wrong bind IP",
    (fixture) => {
      fixture.HostConfig.PortBindings["5432/tcp"][0].HostIp = "0.0.0.0";
      fixture.NetworkSettings.Ports["5432/tcp"][0].HostIp = "0.0.0.0";
    },
  ],
  [
    "wrong volume name",
    (fixture) => {
      fixture.Mounts[0].Name = "collision";
    },
  ],
  [
    "wrong mount destination",
    (fixture) => {
      fixture.Mounts[0].Destination = "/tmp/postgres";
    },
  ],
  [
    "wrong mount type",
    (fixture) => {
      fixture.Mounts[0].Type = "bind";
    },
  ],
  [
    "not running",
    (fixture) => {
      fixture.State.Running = false;
      fixture.State.Status = "exited";
    },
  ],
  [
    "not healthy",
    (fixture) => {
      fixture.State.Health.Status = "unhealthy";
    },
  ],
  [
    "invalid container ID",
    (fixture) => {
      fixture.Id = "not-a-container-id";
    },
  ],
  [
    "wrong image ID",
    (fixture) => {
      fixture.Image = `sha256:${"b".repeat(64)}`;
    },
  ],
  [
    "unpinned image reference",
    (fixture) => {
      fixture.Config.Image = "postgres:15-alpine";
    },
  ],
];

for (const [label, mutate] of invalidInspectMutations) {
  const fixture = JSON.parse(
    JSON.stringify(validInspectFixture),
  ) as InspectFixture;
  mutate(fixture);
  assert.throws(
    () => parseDesignLabDatabaseContainerProvenance(JSON.stringify([fixture])),
    label,
  );
}

assert.throws(() => parseDesignLabDatabaseContainerProvenance("not json"));
assert.throws(() => parseDesignLabDatabaseContainerProvenance("[]"));
assert.throws(() =>
  parseDesignLabDatabaseContainerProvenance(
    JSON.stringify([validInspectFixture, validInspectFixture]),
  ),
);

const source = readFileSync("scripts/design-lab-database.ts", "utf8");
assert.doesNotMatch(source, /process\.cwd\(\)/);
assert.equal(
  source.match(/cwd: DESIGN_LAB_DATABASE_REPOSITORY_ROOT/g)?.length,
  source.match(/spawnSync\(/g)?.length,
  "every child process must launch from the import-meta-derived repository root",
);

console.log("Design Lab database control-plane tests passed");
