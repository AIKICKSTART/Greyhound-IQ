import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  assertLocalDatabaseUrl,
  maskDatabaseUrl,
} from "./local-database-policy";

for (const value of [
  "postgresql://postgres:secret@localhost:5432/greyhoundiq",
  "postgres://postgres:secret@127.0.0.1:55433/greyhoundiq",
  "postgresql://postgres:secret@[::1]:5432/greyhoundiq",
]) {
  assert.doesNotThrow(() => assertLocalDatabaseUrl(value));
}

for (const value of [
  "postgresql://prod_user:prod_secret@postgres.internal:5432/greyhoundiq",
  "postgresql://prod_user:prod_secret@db.example.supabase.co:5432/postgres",
  "https://localhost:5432/greyhoundiq",
  "not-a-url",
]) {
  assert.throws(() => assertLocalDatabaseUrl(value));
}

const masked = maskDatabaseUrl(
  "postgresql://prod_user:prod_secret@db.example.supabase.co:5432/postgres"
);
assert.doesNotMatch(masked, /prod_user|prod_secret/);
assert.match(masked, /db\.example\.supabase\.co/);

assert.throws(
  () =>
    assertLocalDatabaseUrl(
      "postgresql://prod_user:prod_secret@db.example.supabase.co:5432/postgres"
    ),
  (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /prod_user|prod_secret/);
    return true;
  }
);

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8")
) as { scripts?: Record<string, string> };
const localDatabaseScripts = Object.entries(packageJson.scripts ?? {}).filter(
  ([name]) => name === "db:local" || name.startsWith("db:local:")
);

assert.ok(localDatabaseScripts.length > 0, "expected local database scripts");
for (const [name, command] of localDatabaseScripts) {
  assert.match(
    command,
    /^tsx scripts\/local-database\.ts(?:\s|$)/,
    `${name} must enter through the shared loopback-guarded command`
  );
}

for (const name of [
  "sync:live",
  "import:thedogs:raw",
  "import:thedogs:dog-profiles:raw",
]) {
  assert.match(
    packageJson.scripts?.[name] ?? "",
    /^tsx --conditions=react-server /,
    `${name} must enable the React Server condition for server-only database modules`
  );
}

const remoteUsername = "guard_remote_user";
const remotePassword = "guard_remote_password";
const remoteProbe = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/local-database.ts", "help"],
  {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      LOCAL_DATABASE_URL: `postgresql://${remoteUsername}:${remotePassword}@db.example.invalid:5432/greyhoundiq`,
    },
  }
);
const remoteProbeOutput = `${remoteProbe.stdout ?? ""}\n${remoteProbe.stderr ?? ""}`;

assert.notEqual(
  remoteProbe.status,
  0,
  "the command entrypoint must reject a non-loopback database before dispatch"
);
assert.match(remoteProbeOutput, /must use loopback PostgreSQL/);
assert.doesNotMatch(remoteProbeOutput, new RegExp(remoteUsername));
assert.doesNotMatch(remoteProbeOutput, new RegExp(remotePassword));

console.log("local database policy tests passed");
